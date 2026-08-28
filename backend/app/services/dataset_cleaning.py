"""Dataset cleaning service: rule definitions, transformations, and retention policies."""

import hashlib
import os
from typing import Dict, List, Optional
from uuid import UUID

import numpy as np
import pandas as pd
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser
from app.core import settings
from app.models.cleaning_job import CleaningJob
from app.models.column_schema import ColumnSchema
from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.models.table_schema import TableSchema
from app.schemas.dataset import CleanDatasetRequest, CleanDatasetResponse, CleanRuleInput
from app.services.storage import storage_service
from app.tasks.ingestion import infer_column_type, is_column_pii_suspect, parse_file_to_df


async def execute_cleaning_pipeline(
    dataset_id: UUID,
    payload: CleanDatasetRequest,
    current_user: CurrentUser,
    db: AsyncSession,
) -> CleanDatasetResponse:
    """Apply data cleaning transformations to dataset and persist cleaned version to storage."""
    # 1. Verify Dataset Access
    result = await db.execute(
        select(Dataset)
        .options(selectinload(Dataset.versions))
        .where(
            Dataset.id == dataset_id,
            Dataset.created_by == current_user.user_id,
            Dataset.deleted_at.is_(None),
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset or not dataset.versions:
        raise ValueError("Dataset not found or no versions available")

    # 2. Get latest version
    versions = sorted(dataset.versions, key=lambda v: v.version_number or 0, reverse=True)
    latest_ver = versions[0]

    # 3. Fetch file bytes from storage
    file_bytes = storage_service.download_file(latest_ver.storage_uri)

    # 4. Parse DataFrame
    df = parse_file_to_df(file_bytes, dataset.source_type or "csv")

    # 5. Apply requested cleaning transformations
    applied_rules_list = []
    rules_to_run = payload.rules or []
    if not rules_to_run:
        rules_to_run = [
            CleanRuleInput(type="trim_whitespace", rationale="Trim leading and trailing whitespace"),
            CleanRuleInput(type="drop_empty_rows", rationale="Remove completely empty rows"),
            CleanRuleInput(type="deduplicate", rationale="Remove duplicate rows"),
            CleanRuleInput(type="impute_nulls", rationale="Fill null numerical values with column median"),
        ]

    non_negative_keywords = ["age", "price", "revenue", "cost", "amount", "salary", "quantity", "score", "count", "val", "fee", "total"]

    for rule in rules_to_run:
        rule_type = (rule.type or "").lower()
        if rule_type == "trim_whitespace":
            for col in df.columns:
                if df[col].dtype == "object" or str(df[col].dtype).startswith("str"):
                    df[col] = df[col].astype(str).str.strip()
                    df[col] = df[col].replace(["null", "None", "N/A", "n/a", "undefined", "nan", "NaN", "?", "#N/A", "-", "none"], np.nan)
            applied_rules_list.append({"type": "trim_whitespace", "status": "applied"})
        elif rule_type == "drop_empty_rows":
            for col in df.columns:
                col_lower = str(col).lower()
                if any(kw in col_lower for kw in non_negative_keywords):
                    df[col] = pd.to_numeric(df[col], errors="coerce")
                    df.loc[df[col] < 0, col] = np.nan
                    if "age" in col_lower:
                        df.loc[df[col] > 120, col] = np.nan

            df.dropna(how="all", inplace=True)
            df = df.loc[:, ~df.columns.duplicated()]
            applied_rules_list.append({"type": "drop_empty_rows", "status": "applied"})
        elif rule_type == "deduplicate":
            df.drop_duplicates(inplace=True)
            applied_rules_list.append({"type": "deduplicate", "status": "applied"})
        elif rule_type == "impute_nulls":
            df.replace([np.inf, -np.inf], np.nan, inplace=True)
            for col in df.columns:
                if pd.api.types.is_numeric_dtype(df[col]):
                    if df[col].isnull().sum() > 0:
                        med = df[col].median()
                        df[col] = df[col].fillna(med if not np.isnan(med) else 0)
                else:
                    if df[col].isnull().sum() > 0:
                        df[col] = df[col].fillna("N/A")
            applied_rules_list.append({"type": "impute_nulls", "status": "applied"})

    # 6. Export cleaned CSV bytes and save to disk / storage
    cleaned_csv = df.to_csv(index=False)
    cleaned_bytes = cleaned_csv.encode("utf-8")
    checksum = hashlib.sha256(cleaned_bytes).hexdigest()

    new_version_num = (latest_ver.version_number or 1) + 1
    storage_key = f"datasets/{dataset.id}/v{new_version_num}/cleaned/cleaned_data.csv"
    storage_uri = storage_service.upload_file(storage_key, cleaned_bytes, "text/csv")

    # 7. Create new DatasetVersion record
    cleaned_ver = DatasetVersion(
        dataset_id=dataset.id,
        version_number=new_version_num,
        storage_uri=storage_uri,
        file_checksum=checksum,
        stage="cleaned",
        byte_size=len(cleaned_bytes),
        row_count=len(df),
        parent_version_id=latest_ver.id,
    )
    db.add(cleaned_ver)
    await db.flush()

    # 8. Create Table Schema and Column Schema for new cleaned version
    table_schema = TableSchema(
        dataset_version_id=cleaned_ver.id,
        table_name="main",
    )
    db.add(table_schema)
    await db.flush()

    for idx, col_name in enumerate(df.columns):
        series = df[col_name]
        inferred = infer_column_type(series)
        is_pii = is_column_pii_suspect(str(col_name), series.head(20).tolist())
        col_obj = ColumnSchema(
            table_schema_id=table_schema.id,
            name=str(col_name),
            ordinal_position=idx,
            inferred_type=inferred,
            is_pii_suspect=is_pii,
        )
        db.add(col_obj)

    # 9. Create CleaningJob audit record
    cleaning_job = CleaningJob(
        dataset_version_id=latest_ver.id,
        status="applied",
        applied_rules={"rules": applied_rules_list},
        result_dataset_version_id=cleaned_ver.id,
        created_by=current_user.user_id,
    )
    db.add(cleaning_job)

    # 10. Update Dataset current_version_id
    dataset.current_version_id = cleaned_ver.id
    await db.flush()
    await db.commit()

    return CleanDatasetResponse(
        message=f"Successfully applied {len(applied_rules_list)} cleaning rules! Cleaned dataset saved as Version {new_version_num}.",
        cleaned_version_id=cleaned_ver.id,
        version_number=new_version_num,
        cleaned_row_count=len(df),
        applied_rules_count=len(applied_rules_list),
    )
