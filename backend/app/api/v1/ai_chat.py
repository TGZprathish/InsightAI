"""AI Chat API routes with real LLM integration via computed-summary context.

The stats engine computes aggregates (IQR outliers, correlations, trend forecasts, value_counts)
from the live dataframe. These aggregate summaries — never raw row-level data —
are passed to the LLM as context for narrative generation.
"""

import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from scipy import stats as sp_stats
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, PaginationParams, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.ai_conversation import AiConversation
from app.models.ai_message import AiMessage
from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.models.project import Project
from app.schemas.ai_chat import (
    AiConfigResponse,
    AiKeyTestRequest,
    AiKeyTestResponse,
    ConversationCreate,
    ConversationListItem,
    ConversationResponse,
    DatasetChatRequest,
    MessageCreate,
    MessageResponse,
)
from app.schemas.common import PaginatedResponse
from app.services.llm_gateway import llm_gateway
from app.services.prompt_library import load_prompt_template, render_user_prompt
from app.services.storage import storage_service

router = APIRouter(tags=["AI Chat"])


# ── Allowed aggregate keys (used by privacy test) ────────────────────
AGGREGATE_KEYS = {
    "mean", "median", "std", "min", "max", "outliers_count",
    "correlation", "r_value", "value_counts", "count", "null_count",
    "null_pct", "total_rows", "total_cols", "unique_count",
}


def _compute_dataset_summary(
    df: pd.DataFrame,
    dataset_name: str,
    prompt: str,
) -> Dict[str, Any]:
    """Compute aggregate statistical and predictive summary from the dataframe.

    Returns a dict of ONLY aggregate metrics and model projections — never raw row-level values.
    This is the sole data structure that may be sent to the LLM.
    """
    total_rows, total_cols = df.shape
    columns = list(df.columns)
    numeric_cols = [c for c in columns if pd.api.types.is_numeric_dtype(df[c])]
    categorical_cols = [c for c in columns if c not in numeric_cols]
    null_counts = df.isnull().sum().to_dict()
    total_nulls = sum(null_counts.values())

    # 1. Summary Statistics & Distributional Moments
    stats_summary = {}
    outliers_info = {}
    predictive_trends = {}

    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) > 0:
            q25 = float(series.quantile(0.25))
            q75 = float(series.quantile(0.75))
            iqr = q75 - q25
            outliers = series[(series < (q25 - 1.5 * iqr)) | (series > (q75 + 1.5 * iqr))]
            mean_val = float(series.mean())
            median_val = float(series.median())
            std_val = float(series.std()) if len(series) > 1 else 0.0

            stats_summary[col] = {
                "mean": round(mean_val, 2),
                "median": round(median_val, 2),
                "std": round(std_val, 2),
                "min": round(float(series.min()), 2),
                "max": round(float(series.max()), 2),
                "p10": round(float(series.quantile(0.10)), 2),
                "p90": round(float(series.quantile(0.90)), 2),
                "skewness": round(float(series.skew()), 2) if len(series) > 2 else 0.0,
                "outliers_count": len(outliers),
            }
            if len(outliers) > 0:
                outliers_info[col] = len(outliers)

            # Predictive trend linear projection
            if len(series) >= 6:
                x = np.arange(len(series), dtype=float)
                y = series.values.astype(float)
                try:
                    slope, intercept, r_val, p_val, _ = sp_stats.linregress(x, y)
                    r_sq = round(float(r_val ** 2), 3)
                    n_pts = len(series)
                    proj_10 = round(float(intercept + slope * (n_pts + 10)), 2)
                    predictive_trends[col] = {
                        "slope": round(float(slope), 4),
                        "r_squared": r_sq,
                        "p_value": round(float(p_val), 4),
                        "direction": "upward" if slope > 0 and (p_val < 0.1 or r_sq > 0.2) else "downward" if slope < 0 and (p_val < 0.1 or r_sq > 0.2) else "stable",
                        "current_latest": round(float(series.iloc[-1]), 2),
                        "projected_next_10_steps": proj_10,
                    }
                except Exception:
                    pass

    # 2. Pairwise Correlations & Key Driver Relationships
    correlations = []
    if len(numeric_cols) >= 2:
        corr_matrix = df[numeric_cols].corr()
        for i in range(len(numeric_cols)):
            for j in range(i + 1, len(numeric_cols)):
                c1, c2 = numeric_cols[i], numeric_cols[j]
                val = corr_matrix.loc[c1, c2]
                if not np.isnan(val):
                    correlations.append({"col1": c1, "col2": c2, "r_value": round(float(val), 3)})
        correlations.sort(key=lambda x: abs(x["r_value"]), reverse=True)

    # 3. Categorical value counts (low-cardinality non-ID aggregate dimensions only)
    ID_PII_KEYWORDS = ["id", "ssn", "uuid", "guid", "token", "key", "password", "email", "phone", "hash", "secret"]
    categorical_summary = {}
    for cat_col in categorical_cols:
        col_lower = str(cat_col).lower()
        nunique = int(df[cat_col].nunique())
        is_id_or_pii = any(kw in col_lower for kw in ID_PII_KEYWORDS) or (nunique > 25 and (nunique / max(total_rows, 1)) > 0.3)

        cat_info = {
            "unique_count": nunique,
            "null_count": int(df[cat_col].isnull().sum()),
        }
        if not is_id_or_pii and nunique <= 25:
            top_vals = df[cat_col].value_counts().head(5).to_dict()
            cat_info["value_counts"] = {str(k): int(v) for k, v in top_vals.items()}

        categorical_summary[cat_col] = cat_info

    # 4. Group-by aggregates for prominent categories
    groupby_aggregates = {}
    if len(categorical_cols) > 0 and len(numeric_cols) > 0:
        first_cat = categorical_cols[0]
        if df[first_cat].nunique() <= 10:
            first_num = numeric_cols[0]
            try:
                grp = df.groupby(first_cat)[first_num].agg(["mean", "count"]).head(5).to_dict()
                groupby_aggregates[first_cat] = {
                    "metric": first_num,
                    "means": {str(k): round(float(v), 2) for k, v in grp.get("mean", {}).items()},
                    "counts": {str(k): int(v) for k, v in grp.get("count", {}).items()},
                }
            except Exception:
                pass

    return {
        "dataset_name": dataset_name,
        "total_rows": total_rows,
        "total_cols": total_cols,
        "columns": columns,
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "null_summary": {k: int(v) for k, v in null_counts.items() if v > 0},
        "total_nulls": total_nulls,
        "stats_summary": stats_summary,
        "outliers_info": outliers_info,
        "predictive_trends": predictive_trends,
        "correlations": correlations[:10],
        "categorical_summary": categorical_summary,
        "groupby_aggregates": groupby_aggregates,
    }


def _build_system_prompt(persona: str, mode: str = "chat") -> str:
    """Build the system prompt incorporating the prompt registry standards for deep data analytics."""

    base = (
        "You are InsightAI, a World-Class Principal Data Scientist, AI Statistician, and Senior Analytics Consultant. "
        "You operate across InsightAI's specialized intelligence modules: Data Understanding, Exploratory Analysis, "
        "Predictive Modeling, and Executive Reporting.\n\n"
        "You receive pre-aggregated dataset metadata, distribution moments, correlation matrices, and predictive trend regressions. "
        "You never receive, and must never ask for, raw individual row-level records or unaggregated cell values.\n\n"
        "### CORE ANALYTICAL DIRECTIVES:\n"
        "1. **Direct & High-Impact Answer**: Answer the user's specific data analysis question directly in the opening section. Never give generic boilerplate.\n"
        "2. **Quantitative Precision**: Quote exact computed numbers from the provided statistical profile: means, medians, IQR, standard deviations, correlation coefficients (r), percentiles (P10/P90), and regression slopes.\n"
        "3. **Statistical Storytelling & Context**: Connect the numbers to practical business and domain dynamics — explain *why* distributions skew, which features act as primary drivers, and what factors produce variance.\n"
        "4. **Predictive Forefront**: Explicitly calculate and cite regression trends, R² confidence, and future period projections (t+5, t+10).\n"
        "5. **Strategic & Actionable Takeaways**: Conclude with 2-3 prioritized, high-leverage data-backed recommendations.\n"
        "6. **Rich Visual Formatting**: Organize your output with markdown headers, bold metrics, comparative markdown tables, and callouts (`> 💡 **Key Takeaway**`).\n"
        "7. **Strict Privacy**: You evaluate exclusively from aggregate statistics and maintain zero exposure of individual raw rows."
    )

    persona_instructions = {
        "executive": (
            "\n\n### TARGET AUDIENCE: Executive Strategic Briefing\n"
            "- Tailor your synthesis for C-suite and VP-level stakeholders.\n"
            "- Focus on bottom-line business outcomes, revenue/cost dynamics, growth drivers, and strategic risk.\n"
            "- Structure your output as:\n"
            "  1. 📌 **Executive Summary & Core Finding**\n"
            "  2. 📊 **Key Metric Drivers & Performance Indicators**\n"
            "  3. 🔮 **Forward Trajectory & Projected Impact**\n"
            "  4. 🎯 **Strategic Action Plan** (Prioritized Next Steps)"
        ),
        "technical": (
            "\n\n### TARGET AUDIENCE: Technical Data Science & Engineering\n"
            "- Provide mathematical rigor, statistical proofs, distributional skewness, and variance analysis.\n"
            "- Include exact statistical metrics, regression formulas ($y = \\beta x + \\alpha$), Pearson/Spearman coefficients, IQR outlier boundaries, and confidence bands.\n"
            "- Structure your output as:\n"
            "  1. 🔬 **Statistical Profile & Moment Analysis**\n"
            "  2. 📐 **Fitted Mathematical Models & Variance Breakdown**\n"
            "  3. ⚠️ **Outliers, Dispersion & Data Integrity Diagnostics**\n"
            "  4. 💻 **Data Engineering & Modeling Recommendations**"
        ),
        "analyst": (
            "\n\n### TARGET AUDIENCE: Senior Business Intelligence Analyst (Default)\n"
            "- Deliver a rich, well-rounded analytical investigation bridging technical depth with business understanding.\n"
            "- Highlight multi-feature correlations, distributional segments, trends, and 'what-if' sensitivity scenarios.\n"
            "- Structure your output as:\n"
            "  1. 📈 **Core Analytical Findings**\n"
            "  2. 🔍 **Deep-Dive Metric Breakdown & Correlation Insights**\n"
            "  3. 🔮 **Predictive Trend & Scenario Projections**\n"
            "  4. 💡 **Strategic Recommendations & Key Takeaways**"
        ),
    }

    return base + persona_instructions.get(persona, persona_instructions["analyst"])


def _build_llm_messages(prompt: str, computed_summary: Dict[str, Any]) -> List[Dict[str, str]]:
    """Build the messages array for the LLM, embedding the computed summary as context."""

    summary_json = json.dumps(computed_summary, indent=2, default=str)

    user_content = (
        f"## Dataset Statistical Summary\n\n"
        f"```json\n{summary_json}\n```\n\n"
        f"## User Question\n\n{prompt}"
    )

    return [{"role": "user", "content": user_content}]


def _generate_fallback_response(
    computed_summary: Dict[str, Any],
    prompt: str,
    persona: str = "analyst",
    mode: str = "chat",
) -> Dict[str, Any]:
    """Generate a template-based response when AI_MOCK_MODE is True or LLM is unavailable."""
    dataset_name = computed_summary["dataset_name"]
    total_rows = computed_summary["total_rows"]
    total_cols = computed_summary["total_cols"]
    numeric_cols = computed_summary["numeric_columns"]
    categorical_cols = computed_summary["categorical_columns"]
    stats_summary = computed_summary["stats_summary"]
    correlations = computed_summary["correlations"]
    outliers_info = computed_summary["outliers_info"]
    total_nulls = computed_summary["total_nulls"]
    categorical_summary = computed_summary.get("categorical_summary", {})
    predictive_trends = computed_summary.get("predictive_trends", {})

    if persona == "executive":
        content = f"### 📊 Executive Strategic & Predictive Briefing: {dataset_name}\n\n"
        content += f"> 📌 **Executive Takeaway**: Analysis of **{total_rows:,} records** across **{total_cols} dimensions** reveals stable core operational indicators with distinct growth avenues.\n\n"
        content += "#### 🎯 Key Strategic Performance Drivers:\n"
        for col in numeric_cols[:3]:
            st = stats_summary.get(col, {})
            tr = predictive_trends.get(col, {})
            proj_str = f" ➔ 🔮 *Forecasted: ~**{tr.get('projected_next_10_steps', 'N/A'):,}*** ({tr.get('direction', 'stable')})" if tr else ""
            content += f"- **{col.replace('_', ' ').title()}**: Mean stands at **{st.get('mean', 0):,}** (Median: {st.get('median', 0):,}){proj_str}.\n"
        if correlations:
            top_c = correlations[0]
            strength = "strong" if abs(top_c["r_value"]) > 0.6 else "moderate"
            content += f"- **Primary Growth Synergy**: Discovered a {strength} correlation between **{top_c['col1']}** and **{top_c['col2']}** (r = **{top_c['r_value']}**).\n"
        content += "\n#### 💡 Executive Action Plan:\n"
        content += f"1. Capitalize on high-correlation synergies to drive cross-functional alignment.\n"
        content += f"2. Maintain data completeness standard ({round((1 - total_nulls / (total_rows * total_cols if total_rows > 0 else 1)) * 100, 1)}%) to ensure predictive accuracy."

    elif persona == "technical":
        content = f"### ⚙️ Technical Data Engineering & Statistical Report: {dataset_name}\n\n"
        content += f"- **Matrix Dimensions**: `{total_rows}` observations × `{total_cols}` feature attributes\n"
        content += f"- **Missing Data Matrix**: `{total_nulls}` null elements detected across `{len(computed_summary.get('null_summary', {}))}` columns\n"
        content += f"- **Numerical Features**: `{', '.join(numeric_cols) if numeric_cols else 'None'}`\n\n"
        content += "#### 🔬 Feature Distribution Moments & Projections:\n"
        content += "| Feature | Mean | Median | Std Dev | P10 | P90 | Outliers | Trend (R²) |\n"
        content += "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n"
        for col, st in stats_summary.items():
            tr = predictive_trends.get(col, {})
            tr_str = f"{tr.get('direction', 'N/A')} ({tr.get('r_squared', '-')})" if tr else "-"
            content += f"| `{col}` | {st['mean']:,} | {st['median']:,} | {st['std']:,} | {st.get('p10', '-'):,} | {st.get('p90', '-'):,} | **{st['outliers_count']}** | {tr_str} |\n"
        if correlations:
            content += "\n#### 🔗 Correlation Matrix (|r| > 0.3):\n"
            for c in correlations[:5]:
                content += f"- `{c['col1']}` ↔ `{c['col2']}`: **{c['r_value']}**\n"

    else:  # Analyst Persona (Default)
        content = f"### 📈 Senior Data Analyst Breakdown: {dataset_name}\n\n"
        content += f"In response to *\"{prompt}\"*, here is the statistical evaluation computed across **{total_rows:,} records**:\n\n"
        content += "#### 📌 Metric Overview & Predictive Projections:\n"
        for col in numeric_cols[:4]:
            st = stats_summary.get(col, {})
            tr = predictive_trends.get(col, {})
            proj_info = f" (📈 Projected: ~**{tr.get('projected_next_10_steps', st.get('mean', 0)):,}**, Trend: *{tr.get('direction', 'stable')}*)" if tr else ""
            content += f"- **`{col}`**: Mean = **{st.get('mean', 0):,}**, Median = **{st.get('median', 0):,}** (σ = {st.get('std', 0):,}){proj_info}\n"
        if categorical_summary:
            content += "\n#### 🏷️ Categorical Insights:\n"
            for cat_col, cat_data in list(categorical_summary.items())[:2]:
                top_vals = cat_data.get("value_counts", {})
                val_str = ", ".join([f"**{k}** ({v:,})" for k, v in list(top_vals.items())[:3]])
                content += f"- **`{cat_col}`** Top Segments: {val_str}\n"
        if correlations:
            content += "\n#### 🔗 High-Impact Feature Dependencies:\n"
            for c in correlations[:3]:
                interp = "positive synergy" if c["r_value"] > 0 else "inverse relationship"
                content += f"- `{c['col1']}` and `{c['col2']}` demonstrate a **{c['r_value']}** Pearson correlation ({interp}).\n"
        if outliers_info:
            content += f"\n⚠️ **Anomaly Alert**: Flagged {sum(outliers_info.values())} IQR statistical outliers across {len(outliers_info)} feature(s)."

    return {
        "content": content,
        "is_detective": False,
        "detective_data": None,
    }


@router.post("/ai/dataset-chat")
async def dataset_chat_endpoint(
    body: DatasetChatRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze the user's selected dataset and return rich data-driven predictive answers.
    Also persists conversation history for continuous multi-turn sessions.
    """
    clean_prompt = body.prompt.strip().lower()
    off_topic_keywords = [
        "joke", "weather", "poem", "recipe", "song", "who is the president", "capital of",
        "movie", "sports", "football", "cricket", "translate to french", "translate to spanish",
        "who are you", "write code for flappy bird", "minecraft", "play game"
    ]
    if any(kw in clean_prompt for kw in off_topic_keywords):
        return {
            "dataset_id": str(body.dataset_id),
            "dataset_name": "N/A",
            "total_rows": 0,
            "total_columns": 0,
            "content": "🔒 **InsightAI Data Intelligence Guardrail**\n\nI am configured exclusively to analyze, query, and interpret statistical patterns, metrics, correlations, and predictive trends within your selected dataset. Please ask questions about your data!",
            "is_detective": False,
            "detective_data": None,
            "conversation_id": str(body.conversation_id) if body.conversation_id else None,
        }

    # 1. Verify Dataset Access
    result = await db.execute(
        select(Dataset)
        .options(selectinload(Dataset.versions))
        .where(
            Dataset.id == body.dataset_id,
            Dataset.created_by == current_user.user_id,
            Dataset.deleted_at.is_(None),
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset or not dataset.versions:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected dataset not found or access denied")

    latest_ver = sorted(dataset.versions, key=lambda v: v.version_number or 0, reverse=True)[0]

    # 2. Download File Content from Storage
    try:
        file_bytes = storage_service.download_file(latest_ver.storage_uri)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to access dataset storage: {e}")

    # 3. Parse DataFrame
    from app.tasks.ingestion import parse_file_to_df
    df = parse_file_to_df(file_bytes, dataset.source_type or "csv")

    # 4. Compute aggregate summary (PRIVACY: only aggregates, never raw rows)
    computed_summary = _compute_dataset_summary(
        df=df,
        dataset_name=dataset.name,
        prompt=body.prompt,
    )

    persona = body.persona or "analyst"
    mode = body.mode or "chat"

    # 5. Generate response — Live Google Gemini / LLM completion
    try:
        system_prompt = _build_system_prompt(persona, mode)
        messages = _build_llm_messages(body.prompt, computed_summary)
        llm_result = await llm_gateway.generate_completion(
            system_prompt=system_prompt,
            messages=messages,
            temperature=0.3,
            max_tokens=8192,
            api_key=body.api_key,
            model=body.model,
        )
        content = llm_result["text"]
        input_tokens = llm_result.get("input_tokens", 0)
        output_tokens = llm_result.get("output_tokens", 0)
        analysis_res = {
            "content": content,
            "is_detective": False,
            "detective_data": None,
            "model": llm_result.get("model", settings.GEMINI_MODEL),
            "provider": llm_result.get("provider", settings.AI_PROVIDER),
            "token_usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
                "cost_usd": llm_result.get("cost_usd", 0.0),
            },
        }
    except Exception as e:
        print(f"Live LLM call failed, falling back to template: {e}")
        analysis_res = _generate_fallback_response(computed_summary, body.prompt, persona, mode)

    # 6. Manage Conversation & Message History Persistence
    conversation_obj = None
    if body.conversation_id:
        conv_res = await db.execute(
            select(AiConversation).where(
                AiConversation.id == body.conversation_id,
                AiConversation.created_by == current_user.user_id,
            )
        )
        conversation_obj = conv_res.scalar_one_or_none()

    if not conversation_obj:
        # Create new conversation session
        conversation_obj = AiConversation(
            project_id=dataset.project_id,
            dataset_id=dataset.id,
            mode=mode,
            persona=persona,
            created_by=current_user.user_id,
            created_at=datetime.now(timezone.utc),
        )
        db.add(conversation_obj)
        await db.flush()

    # Save User message and Assistant response
    user_msg_record = AiMessage(
        conversation_id=conversation_obj.id,
        role="user",
        content=body.prompt,
        created_at=datetime.now(timezone.utc),
    )
    assistant_msg_record = AiMessage(
        conversation_id=conversation_obj.id,
        role="assistant",
        content=analysis_res["content"],
        token_usage=analysis_res.get("token_usage"),
        created_at=datetime.now(timezone.utc),
    )
    db.add(user_msg_record)
    db.add(assistant_msg_record)
    await db.commit()

    return {
        "dataset_id": str(dataset.id),
        "dataset_name": dataset.name,
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "content": analysis_res["content"],
        "is_detective": analysis_res.get("is_detective", False),
        "detective_data": analysis_res.get("detective_data"),
        "model": analysis_res.get("model", settings.GEMINI_MODEL),
        "provider": analysis_res.get("provider", settings.AI_PROVIDER),
        "conversation_id": str(conversation_obj.id),
    }


# ── Conversation History Endpoints ───────────────────────────────────

@router.get("/ai/conversations", response_model=List[ConversationListItem])
async def list_user_conversations(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all past AI conversation sessions for the current user."""
    result = await db.execute(
        select(AiConversation)
        .options(
            selectinload(AiConversation.messages),
            selectinload(AiConversation.dataset),
        )
        .where(AiConversation.created_by == current_user.user_id)
        .order_by(desc(AiConversation.created_at))
        .limit(50)
    )
    conversations = result.scalars().all()

    items = []
    for conv in conversations:
        msgs = conv.messages or []
        last_msg = msgs[-1].content if msgs else None
        first_user_msg = next((m.content for m in msgs if m.role == "user"), None)

        items.append(
            ConversationListItem(
                id=conv.id,
                dataset_id=conv.dataset_id,
                dataset_name=conv.dataset.name if conv.dataset else "Dataset",
                persona=conv.persona,
                mode=conv.mode,
                message_count=len(msgs),
                last_message_preview=last_msg[:90] if last_msg else None,
                created_at=conv.created_at,
            )
        )
    return items


@router.get("/ai/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a past conversation with all messages."""
    result = await db.execute(
        select(AiConversation)
        .options(selectinload(AiConversation.messages))
        .where(
            AiConversation.id == conversation_id,
            AiConversation.created_by == current_user.user_id,
        )
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    sorted_msgs = sorted(conversation.messages or [], key=lambda m: m.created_at)

    resp = ConversationResponse(
        id=conversation.id,
        project_id=conversation.project_id,
        dataset_id=conversation.dataset_id,
        mode=conversation.mode,
        persona=conversation.persona,
        created_by=conversation.created_by,
        created_at=conversation.created_at,
        messages=[MessageResponse.model_validate(m) for m in sorted_msgs],
    )
    return resp


@router.delete("/ai/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a past conversation session and all its messages."""
    result = await db.execute(
        select(AiConversation).where(
            AiConversation.id == conversation_id,
            AiConversation.created_by == current_user.user_id,
        )
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    await db.delete(conversation)
    await db.commit()
    return None


@router.get("/ai/config", response_model=AiConfigResponse)
async def get_ai_config(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return the active AI engine status, provider, and masked API key."""
    provider = settings.AI_PROVIDER or "gemini"
    key = settings.GEMINI_API_KEY if provider == "gemini" else settings.ANTHROPIC_API_KEY
    has_key = bool(key and not key.startswith("sk-ant-mock"))
    masked = f"{key[:7]}...{key[-4:]}" if (key and len(key) > 10) else ("Configured" if has_key else "Not set")
    model = settings.GEMINI_MODEL if provider == "gemini" else settings.ANTHROPIC_MODEL

    return AiConfigResponse(
        provider=provider,
        model=model,
        has_api_key=has_key,
        masked_key=masked,
        mock_mode=settings.AI_MOCK_MODE,
        status="ready" if has_key and not settings.AI_MOCK_MODE else "mock",
    )


@router.post("/ai/test-key", response_model=AiKeyTestResponse)
async def test_ai_key(
    body: AiKeyTestRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Test live connectivity for a provided or default API key."""
    result = await llm_gateway.test_connection(api_key=body.api_key, model=body.model)
    return AiKeyTestResponse(
        success=result.get("success", False),
        provider=result.get("provider", "gemini"),
        model=result.get("model", settings.GEMINI_MODEL),
        message=result.get("message"),
        error=result.get("error"),
    )
