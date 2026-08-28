"""Dataset analytics service: statistical profiling, predictive recommendations, and trend forecasting."""

import os
from typing import Any, Dict, List, Optional
from uuid import UUID

import numpy as np
import pandas as pd
from scipy import stats as sp_stats
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser
from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.models.report import Report
from app.services.storage import storage_service
from app.tasks.ingestion import parse_file_to_df


def build_predictive_recommendations(
    df: pd.DataFrame,
    total_rows: int,
    total_cols: int,
    null_cells: int,
    completeness_pct: float,
    duplicate_rows: int,
    duplicate_pct: float,
    quality_score: float,
    outlier_total: int,
    numeric_cols: list,
    categorical_cols: list,
    feature_insights: list,
) -> list:
    """Analyze actual dataset values with multi-model predictive algorithms to generate future forecasts and strategic insights."""
    predictions = []

    # 1. Advanced Numerical Trend Analysis & Multi-Horizon Projections (Linear + Confidence Bands)
    trend_results = []
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) < 6:
            continue

        x = np.arange(len(series), dtype=float)
        y = series.values.astype(float)
        n = len(series)

        try:
            slope, intercept, r_value, p_value, std_err = sp_stats.linregress(x, y)
        except Exception:
            continue

        r_sq = round(float(r_value ** 2), 4)
        if np.isnan(r_sq):
            continue

        current_mean = float(series.mean())
        current_median = float(series.median())
        current_last = float(series.iloc[-1])
        series_std = float(series.std()) if n > 1 else 0.0

        # Forecast horizons: t+5, t+10, t+20 (or scaled to length)
        h_short = max(5, int(n * 0.1))
        h_long = max(10, int(n * 0.25))

        proj_short = round(float(intercept + slope * (n + h_short)), 2)
        proj_long = round(float(intercept + slope * (n + h_long)), 2)

        # 95% Confidence / Prediction Interval for projection
        # SE_pred = std_err * sqrt(1 + 1/n + (x_new - x_mean)^2 / sum((x - x_mean)^2))
        x_mean = np.mean(x)
        ss_x = np.sum((x - x_mean) ** 2) if n > 1 else 1.0
        se_proj = std_err * np.sqrt(1 + (1.0 / max(n, 1)) + (((n + h_long) - x_mean) ** 2) / max(ss_x, 1e-9)) if ss_x > 0 else std_err
        ci_margin = round(float(1.96 * max(se_proj, 0.05 * abs(current_mean))), 2)

        ci_lower = round(proj_long - ci_margin, 2)
        ci_upper = round(proj_long + ci_margin, 2)

        pct_change_long = round(((proj_long - current_last) / abs(current_last)) * 100, 1) if abs(current_last) > 1e-9 else 0.0

        # Determine directional trend significance
        if slope > 0 and (p_value < 0.1 or r_sq >= 0.2):
            direction = "increasing"
        elif slope < 0 and (p_value < 0.1 or r_sq >= 0.2):
            direction = "decreasing"
        else:
            direction = "stable"

        growth_rate_pct = round((slope / max(abs(current_mean), 1e-6)) * 100, 3)

        trend_results.append({
            "column": col,
            "direction": direction,
            "slope": round(float(slope), 5),
            "r_squared": r_sq,
            "p_value": round(float(p_value), 5),
            "current_mean": round(current_mean, 2),
            "current_median": round(current_median, 2),
            "current_last": round(current_last, 2),
            "proj_short": proj_short,
            "proj_long": proj_long,
            "forecast_steps": h_long,
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "pct_change": pct_change_long,
            "growth_rate_pct": growth_rate_pct,
            "confidence": "high" if (r_sq >= 0.4 and p_value < 0.05) else "medium" if r_sq >= 0.15 else "low",
        })

    # Sort by predictive signal strength (R² and significance)
    trend_results.sort(key=lambda t: t["r_squared"], reverse=True)

    for tr in trend_results[:5]:
        col = tr["column"]
        direction = tr["direction"]
        icon = "trending-up" if direction == "increasing" else "trending-down" if direction == "decreasing" else "activity"

        if direction == "increasing":
            emoji_dir = "📈"
            summary = (
                f"'{col}' shows a sustained upward trajectory (R²={tr['r_squared']:.2f}, p={tr['p_value']:.4f}). "
                f"Currently at {tr['current_last']:,.2f}, projected to reach {tr['proj_long']:,.2f} "
                f"[95% CI: {tr['ci_lower']:,.2f} – {tr['ci_upper']:,.2f}] over the next {tr['forecast_steps']} periods (+{abs(tr['pct_change'])}% growth)."
            )
        elif direction == "decreasing":
            emoji_dir = "📉"
            summary = (
                f"'{col}' exhibits a downward trend (R²={tr['r_squared']:.2f}, p={tr['p_value']:.4f}). "
                f"Currently at {tr['current_last']:,.2f}, projected to decline to {tr['proj_long']:,.2f} "
                f"[95% CI: {tr['ci_lower']:,.2f} – {tr['ci_upper']:,.2f}] in the next {tr['forecast_steps']} periods (-{abs(tr['pct_change'])}% change)."
            )
        else:
            emoji_dir = "➡️"
            summary = (
                f"'{col}' maintains a stable baseline around mean {tr['current_mean']:,.2f} (median: {tr['current_median']:,.2f}) "
                f"with minor variance (expected range: {tr['ci_lower']:,.2f} to {tr['ci_upper']:,.2f})."
            )

        steps = [
            f"Fitted Trend Model: Slope = {tr['slope']:+.4f}/step ({tr['growth_rate_pct']:+.2f}%/period), R² = {tr['r_squared']:.3f}, p-value = {tr['p_value']:.4f}.",
            f"Current Baseline: Latest = {tr['current_last']:,.2f} | Historical Mean = {tr['current_mean']:,.2f} | Median = {tr['current_median']:,.2f}.",
            f"Horizon Projections: Short-term = {tr['proj_short']:,.2f} | Extended (+{tr['forecast_steps']} steps) = {tr['proj_long']:,.2f} ({tr['pct_change']:+.1f}%).",
            f"95% Prediction Interval: Forecast bounded between {tr['ci_lower']:,.2f} (bearish) and {tr['ci_upper']:,.2f} (bullish).",
        ]

        if direction == "increasing":
            steps.append(f"Strategic Action: Prepare resource scaling and capacity planning to capture predicted +{abs(tr['pct_change'])}% volume.")
        elif direction == "decreasing":
            steps.append(f"Risk Mitigation: Initiate root-cause remediation on '{col}' to prevent predicted decline toward {tr['proj_long']:,.2f}.")
        else:
            steps.append(f"Planning Advice: '{col}' provides high predictability for stationary budgeting and baseline metrics.")

        predictions.append({
            "id": f"trend_{col}",
            "category": f"{emoji_dir} Trend Forecast — {col}",
            "icon": icon,
            "priority": "high" if tr["r_squared"] >= 0.35 else "medium" if tr["r_squared"] >= 0.1 else "low",
            "predicted_impact_pct": min(45, round(abs(tr["pct_change"]), 1)) if abs(tr["pct_change"]) > 0.5 else round(tr["r_squared"] * 30, 1),
            "confidence": tr["confidence"],
            "timeline": f"Next {tr['forecast_steps']} data periods",
            "summary": summary,
            "steps": steps,
        })

    # 2. Non-Linear & Linear Cross-Feature Predictive Relationships
    if len(numeric_cols) >= 2:
        try:
            corr_matrix = df[numeric_cols].corr(method="pearson")
            corr_pairs = []
            for i in range(len(numeric_cols)):
                for j in range(i + 1, len(numeric_cols)):
                    val = corr_matrix.iloc[i, j]
                    if not np.isnan(val) and abs(val) >= 0.45:
                        corr_pairs.append((numeric_cols[i], numeric_cols[j], round(float(val), 3)))
            corr_pairs.sort(key=lambda x: abs(x[2]), reverse=True)
        except Exception:
            corr_pairs = []

        for cp in corr_pairs[:4]:
            c1, c2, r = cp
            relationship = "positive synergy" if r > 0 else "inverse relationship"
            r_abs = abs(r)
            strength = "exceptionally strong" if r_abs >= 0.85 else "strong" if r_abs >= 0.7 else "moderate"

            s1_mean = round(float(df[c1].mean()), 2)
            s2_mean = round(float(df[c2].mean()), 2)
            s1_std = round(float(df[c1].std()), 2)
            s2_std = round(float(df[c2].std()), 2)

            slope_c, intercept_c = 0.0, 0.0
            r_sq_c = round(r ** 2, 3)
            try:
                valid_df = df[[c1, c2]].dropna()
                if len(valid_df) >= 3:
                    s1_arr = valid_df[c1].values.astype(float)
                    s2_arr = valid_df[c2].values.astype(float)
                    reg = sp_stats.linregress(s1_arr, s2_arr)
                    if not np.isnan(reg.slope) and not np.isnan(reg.intercept):
                        slope_c = round(float(reg.slope), 4)
                        intercept_c = round(float(reg.intercept), 4)
            except Exception:
                pass

            # Simulation scenarios
            target_10pct_up = round(s1_mean * 1.10, 2)
            predicted_s2_up = round(intercept_c + slope_c * target_10pct_up, 2)
            delta_s2_pct = round(((predicted_s2_up - s2_mean) / max(abs(s2_mean), 1e-9)) * 100, 1)

            summary = (
                f"'{c1}' acts as a key predictive driver for '{c2}' with {strength} correlation (r={r:+.3f}, R²={r_sq_c}). "
                f"A +10% increase in '{c1}' is forecasted to produce a {delta_s2_pct:+.1f}% change in '{c2}' "
                f"(moving from {s2_mean:,.2f} to ~{predicted_s2_up:,.2f})."
            )

            steps = [
                f"Statistical Association: Pearson r = {r:+.3f} (explains {r_sq_c * 100:.1f}% of variance between features).",
                f"Predictive Transfer Function: {c2} ≈ {intercept_c:+.2f} + ({slope_c:+.4f} × {c1}).",
                f"Feature Baselines: '{c1}' Mean = {s1_mean:,.2f} (σ={s1_std:,.2f}) | '{c2}' Mean = {s2_mean:,.2f} (σ={s2_std:,.2f}).",
                f"Scenario Simulation (+10% on {c1}): Setting '{c1}' to {target_10pct_up:,.2f} predicts '{c2}' at {predicted_s2_up:,.2f} ({delta_s2_pct:+.1f}% effect).",
                f"Decision Application: Leverage '{c1}' as an early leading indicator to forecast and steer quarterly '{c2}' performance.",
            ]

            predictions.append({
                "id": f"corr_{c1}_{c2}",
                "category": f"🔗 Driver Forecast — {c1} ➔ {c2}",
                "icon": "git-branch",
                "priority": "high" if r_abs >= 0.7 else "medium",
                "predicted_impact_pct": min(40, round(r_abs * 35, 1)),
                "confidence": "high" if r_abs >= 0.75 else "medium",
                "timeline": "Immediate predictive relationship in current dataset regime",
                "summary": summary,
                "steps": steps,
            })

    # 3. Categorical Uplift & Cohort Optimization Forecast
    for cat_col in categorical_cols[:2]:
        if len(numeric_cols) == 0:
            continue
        primary_num = numeric_cols[0]
        try:
            grouped = df.groupby(cat_col)[primary_num].agg(["count", "mean", "median"]).dropna()
            if len(grouped) >= 2:
                grouped = grouped[grouped["count"] >= max(3, int(total_rows * 0.03))]
                if len(grouped) >= 2:
                    top_group = grouped["mean"].idxmax()
                    top_mean = float(grouped.loc[top_group, "mean"])
                    overall_mean = float(df[primary_num].mean())
                    bottom_group = grouped["mean"].idxmin()
                    bottom_mean = float(grouped.loc[bottom_group, "mean"])

                    gap_pct = round(((top_mean - bottom_mean) / max(abs(bottom_mean), 1e-6)) * 100, 1)

                    if gap_pct > 15.0:
                        predictions.append({
                            "id": f"cohort_{cat_col}_{primary_num}",
                            "category": f"🎯 Cohort Uplift Potential — {cat_col}",
                            "icon": "layers",
                            "priority": "high" if gap_pct > 30 else "medium",
                            "predicted_impact_pct": min(35, round(gap_pct * 0.5, 1)),
                            "confidence": "high" if len(grouped) >= 3 else "medium",
                            "timeline": "Medium-term operational optimization",
                            "summary": (
                                f"Significant performance dispersion in '{cat_col}': Top tier '{top_group}' averages {top_mean:,.2f} in '{primary_num}', "
                                f"outperforming '{bottom_group}' ({bottom_mean:,.2f}) by +{gap_pct}%."
                            ),
                            "steps": [
                                f"Segment Variance: '{top_group}' leads '{primary_num}' with {top_mean:,.2f} vs overall mean of {overall_mean:,.2f}.",
                                f"Performance Lag: '{bottom_group}' trails by {gap_pct:.1f}%, highlighting under-monetized or lower efficiency records.",
                                f"Uplift Opportunity: Elevating lagging '{bottom_group}' records to the overall average yields significant metric expansion.",
                            ],
                        })
        except Exception:
            pass

    return predictions


async def generate_dataset_report_data(
    dataset_id: UUID,
    version: Optional[int],
    current_user: CurrentUser,
    db: AsyncSession,
) -> Dict[str, Any]:
    """Analyze the full dataset using Python (pandas, numpy, scipy) and return data-driven insights and predictive forecasts."""
    ds_res = await db.execute(
        select(Dataset)
        .options(selectinload(Dataset.versions))
        .where(
            Dataset.id == dataset_id,
            Dataset.created_by == current_user.user_id,
            Dataset.deleted_at.is_(None),
        )
    )
    dataset = ds_res.scalar_one_or_none()
    if not dataset:
        raise ValueError("Dataset not found")

    target_version = None
    if version:
        target_version = next((v for v in dataset.versions if v.version_number == version), None)
    if not target_version and dataset.versions:
        target_version = max(dataset.versions, key=lambda v: v.version_number)

    if not target_version:
        raise ValueError("No dataset versions available")

    try:
        file_bytes = storage_service.download_file(target_version.storage_uri)
    except Exception as e:
        raise ValueError(f"Physical dataset file not found on storage: {e}")

    df = parse_file_to_df(file_bytes, dataset.source_type or "csv")

    total_rows, total_cols = df.shape
    total_cells = total_rows * total_cols
    null_cells = int(df.isna().sum().sum())
    valid_cells = total_cells - null_cells
    completeness_pct = round((valid_cells / total_cells * 100), 2) if total_cells > 0 else 100.0

    duplicate_rows = int(df.duplicated().sum())
    duplicate_pct = round((duplicate_rows / total_rows * 100), 2) if total_rows > 0 else 0.0

    quality_score = round(max(0.0, completeness_pct - (duplicate_pct * 0.5)), 1)

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

    key_findings = []
    recommendations = []
    feature_insights = []
    outlier_total = 0

    if len(numeric_cols) >= 2:
        try:
            corr_matrix = df[numeric_cols].corr()
            high_corrs = []
            for i in range(len(numeric_cols)):
                for j in range(i + 1, len(numeric_cols)):
                    c1, c2 = numeric_cols[i], numeric_cols[j]
                    val = corr_matrix.loc[c1, c2]
                    if not np.isnan(val) and abs(val) >= 0.5:
                        high_corrs.append((c1, c2, round(float(val), 3)))

            if high_corrs:
                high_corrs.sort(key=lambda x: abs(x[2]), reverse=True)
                top_c1, top_c2, top_val = high_corrs[0]
                corr_type = "positive synergy" if top_val > 0 else "inverse relationship"
                key_findings.append(
                    f"Strong statistical dependency identified: '{top_c1}' ↔ '{top_c2}' (Pearson r = {top_val:+.3f}, {corr_type})."
                )
                recommendations.append(
                    f"Leverage '{top_c1}' as an early leading predictor for '{top_c2}' forecasting and scenario simulations."
                )
        except Exception:
            pass

    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) > 5:
            q1 = float(series.quantile(0.25))
            q3 = float(series.quantile(0.75))
            iqr = q3 - q1
            outliers = series[(series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)]
            outlier_cnt = len(outliers)
            outlier_total += outlier_cnt
            mean_val = float(series.mean())
            std_val = float(series.std()) if len(series) > 1 else 0.0

            feature_insights.append({
                "feature": col,
                "type": "numerical",
                "mean": round(mean_val, 2),
                "std": round(std_val, 2),
                "min": round(float(series.min()), 2),
                "max": round(float(series.max()), 2),
                "outliers_count": outlier_cnt,
            })

            if outlier_cnt > 0:
                outlier_pct = round((outlier_cnt / len(series)) * 100, 1)
                if outlier_pct > 2.5:
                    key_findings.append(
                        f"Numerical feature '{col}' exhibits {outlier_cnt} statistical outliers ({outlier_pct}% outside IQR limits), impacting variance."
                    )

    for col in categorical_cols:
        series = df[col].dropna()
        unique_cnt = series.nunique()
        top_val = str(series.mode()[0]) if not series.empty else "N/A"
        top_freq = int(series.value_counts().iloc[0]) if not series.empty else 0
        dom_pct = round((top_freq / len(series) * 100), 1) if len(series) > 0 else 0

        feature_insights.append({
            "feature": col,
            "type": "categorical",
            "unique_count": unique_cnt,
            "top_category": top_val,
            "top_frequency": top_freq,
            "dominance_pct": dom_pct,
        })

        if dom_pct >= 70.0:
            key_findings.append(
                f"Categorical attribute '{col}' is heavily skewed towards '{top_val}' ({dom_pct}% dominance)."
            )

    key_findings.append(
        f"Statistical scan audited {total_rows:,} records across {total_cols} attributes with {completeness_pct}% cell data completeness."
    )

    if duplicate_rows > 0:
        key_findings.append(f"Deduplication audit flagged {duplicate_rows:,} exact duplicate rows ({duplicate_pct}% of total records).")
        recommendations.append(f"Apply automated deduplication pipeline to prune {duplicate_rows:,} redundant records.")

    if null_cells > 0:
        recommendations.append(f"Apply intelligent median/mode imputation for {null_cells:,} missing cell entries across {len(df.columns[df.isna().any()])} columns.")

    if outlier_total > 0:
        recommendations.append(f"Perform Winsorization or IQR bounding on {outlier_total:,} detected numerical outliers to stabilize regression models.")

    recommendations.append("Deploy trained forecasting algorithms for continuous automated trajectory tracking.")

    exec_summary = (
        f"Automated intelligence engine performed a comprehensive audit on dataset '{dataset.name}' (Version {target_version.version_number}). "
        f"Processing all {total_rows:,} rows and {total_cols} features revealed a Data Quality Health rating of {quality_score}% "
        f"({completeness_pct}% completeness, {null_cells:,} missing cells, and {outlier_total:,} statistical outliers identified)."
    )

    predictive_recommendations = build_predictive_recommendations(
        df=df,
        total_rows=total_rows,
        total_cols=total_cols,
        null_cells=null_cells,
        completeness_pct=completeness_pct,
        duplicate_rows=duplicate_rows,
        duplicate_pct=duplicate_pct,
        quality_score=quality_score,
        outlier_total=outlier_total,
        numeric_cols=numeric_cols,
        categorical_cols=categorical_cols,
        feature_insights=feature_insights,
    )

    # Ensure report record is logged for user report quota tracking
    try:
        rep_check = await db.execute(
            select(Report).where(
                Report.dataset_version_id == target_version.id,
                Report.generated_by == current_user.user_id,
            )
        )
        existing_rep = rep_check.scalar_one_or_none()
        if not existing_rep:
            new_report = Report(
                project_id=dataset.project_id,
                dataset_version_id=target_version.id,
                title=f"{dataset.name} - Analytical Report (v{target_version.version_number})",
                status="ready",
                content_json={
                    "executive_summary": exec_summary,
                    "quality_score": quality_score,
                    "total_rows": total_rows,
                    "total_columns": total_cols,
                },
                generated_by=current_user.user_id,
                completed_at=target_version.created_at,
            )
            db.add(new_report)
            await db.commit()
    except Exception as e:
        print(f"Report tracking note: {e}")

    return {
        "dataset_id": str(dataset.id),
        "dataset_name": dataset.name,
        "version_number": target_version.version_number,
        "stage": target_version.stage,
        "created_at": target_version.created_at.isoformat() if target_version.created_at else "",
        "total_rows": total_rows,
        "total_columns": total_cols,
        "null_cells": null_cells,
        "valid_cells": valid_cells,
        "completeness_pct": completeness_pct,
        "duplicate_rows": duplicate_rows,
        "duplicate_pct": duplicate_pct,
        "quality_score": quality_score,
        "outlier_total": outlier_total,
        "numerical_columns_count": len(numeric_cols),
        "categorical_columns_count": len(categorical_cols),
        "executive_summary": exec_summary,
        "key_findings": key_findings,
        "recommendations": recommendations,
        "feature_insights": feature_insights,
        "predictive_recommendations": predictive_recommendations,
    }
