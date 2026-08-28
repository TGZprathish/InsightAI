"""Celery cleaning tasks: execute user-approved cleaning rules on pandas DataFrames."""

import datetime
import io
import uuid
from typing import Any, Dict, List

import pandas as pd
from celery import shared_task
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.cleaning_job import CleaningJob
from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.services.storage import storage_service
from app.tasks.ingestion import parse_file_to_df


def apply_rule_to_df(df: pd.DataFrame, rule: Dict[str, Any]) -> pd.DataFrame:
    """Apply a single cleaning rule to a pandas DataFrame."""
    rule_type = rule.get("type")
    col = rule.get("column")
    params = rule.get("params", {}) or {}

    if rule_type == "drop_empty_rows":
        return df.dropna(how="all")

    elif rule_type == "drop_empty_cols":
        return df.dropna(how="all", axis=1)

    elif rule_type == "trim_whitespace":
        string_cols = df.select_dtypes(include=["object"]).columns
        for c in string_cols:
            df[c] = df[c].astype(str).str.strip()
        return df

    elif rule_type == "deduplicate":
        keep = params.get("keep", "first")
        return df.drop_duplicates(keep=keep)

    elif rule_type == "type_coercion" and col and col in df.columns:
        target_type = params.get("target_type")
        if target_type == "integer":
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
        elif target_type == "float":
            df[col] = pd.to_numeric(df[col], errors="coerce")
        elif target_type == "datetime":
            df[col] = pd.to_datetime(df[col], errors="coerce")
        elif target_type == "string":
            df[col] = df[col].astype(str)
        return df

    elif rule_type == "impute_nulls" and col and col in df.columns:
        strategy = params.get("strategy", "median")
        fill_val = params.get("value")

        if strategy == "median" and pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(df[col].median())
        elif strategy == "mean" and pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(df[col].mean())
        elif strategy == "mode":
            mode_val = df[col].mode()
            if not mode_val.empty:
                df[col] = df[col].fillna(mode_val[0])
        elif strategy == "constant" and fill_val is not None:
            df[col] = df[col].fillna(fill_val)
        return df

    return df


@shared_task(name="app.tasks.cleaning.apply_cleaning_job")
def apply_cleaning_job(cleaning_job_id: str) -> Dict:
    """Celery task to apply approved cleaning rules and produce a new DatasetVersion."""
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with Session(engine) as session:
        job = session.get(CleaningJob, uuid.UUID(cleaning_job_id))
        if not job:
            return {"error": "CleaningJob not found"}

        parent_version = session.get(DatasetVersion, job.dataset_version_id)
        if not parent_version:
            return {"error": "Parent DatasetVersion not found"}

        dataset = session.get(Dataset, parent_version.dataset_id)
        if not dataset:
            return {"error": "Dataset not found"}

        # Download parent file
        storage_key = parent_version.storage_uri.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
        file_bytes = storage_service.download_file(storage_key)
        df = parse_file_to_df(file_bytes, dataset.source_type)

        # Apply each approved rule in sequence
        approved_rules = job.applied_rules or []
        for rule in approved_rules:
            df = apply_rule_to_df(df, rule)

        # Write cleaned DataFrame as Parquet
        parquet_buf = io.BytesIO()
        df.to_parquet(parquet_buf, index=False)
        cleaned_bytes = parquet_buf.getvalue()

        cleaned_checksum = storage_service.compute_checksum(cleaned_bytes)
        new_version_num = parent_version.version_number + 1

        cleaned_key = f"datasets/{dataset.id}/v{new_version_num}/cleaned/data.parquet"
        storage_uri = storage_service.upload_file(cleaned_key, cleaned_bytes, "application/x-parquet")

        # Create new DatasetVersion
        cleaned_version = DatasetVersion(
            dataset_id=dataset.id,
            version_number=new_version_num,
            storage_uri=storage_uri,
            file_checksum=cleaned_checksum,
            stage="cleaned",
            row_count=len(df),
            byte_size=len(cleaned_bytes),
            parent_version_id=parent_version.id,
        )
        session.add(cleaned_version)
        session.flush()

        # Update CleaningJob
        job.result_dataset_version_id = cleaned_version.id
        job.status = "applied"
        job.completed_at = datetime.datetime.now(datetime.timezone.utc)
        session.commit()

        # Trigger profiling on cleaned version
        from app.tasks.profiling import profile_dataset_task
        profile_dataset_task.delay(str(cleaned_version.id))

        return {
            "status": "applied",
            "new_version_id": str(cleaned_version.id),
            "version_number": new_version_num,
            "row_count": len(df),
        }
