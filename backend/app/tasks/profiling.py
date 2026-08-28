"""Celery profiling tasks: comprehensive statistical profiling of dataset versions."""

import datetime
import io
import uuid
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from celery import shared_task
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.models.profile import Profile
from app.services.storage import storage_service
from app.tasks.ingestion import parse_file_to_df


def compute_column_profile(series: pd.Series, col_name: str) -> Dict[str, Any]:
    """Compute detailed profile metrics for a pandas Series."""
    total_len = len(series)
    null_count = int(series.isnull().sum())
    null_pct = float(round((null_count / max(total_len, 1)) * 100, 2))
    distinct_count = int(series.nunique(dropna=True))

    profile: Dict[str, Any] = {
        "column_name": col_name,
        "total_count": total_len,
        "null_count": null_count,
        "null_pct": null_pct,
        "distinct_count": distinct_count,
        "dtype": str(series.dtype),
    }

    # Numeric metrics
    if pd.api.types.is_numeric_dtype(series):
        non_nulls = series.dropna()
        if len(non_nulls) > 0:
            q25 = float(non_nulls.quantile(0.25))
            q75 = float(non_nulls.quantile(0.75))
            iqr = q75 - q25
            outlier_lower = q25 - 1.5 * iqr
            outlier_upper = q75 + 1.5 * iqr
            outlier_count = int(((non_nulls < outlier_lower) | (non_nulls > outlier_upper)).sum())

            profile.update({
                "type": "numeric",
                "min": float(non_nulls.min()),
                "max": float(non_nulls.max()),
                "mean": float(round(non_nulls.mean(), 4)),
                "std": float(round(non_nulls.std(), 4)) if len(non_nulls) > 1 else 0.0,
                "median": float(round(non_nulls.median(), 4)),
                "q25": float(round(q25, 4)),
                "q75": float(round(q75, 4)),
                "iqr": float(round(iqr, 4)),
                "outlier_count": outlier_count,
            })
        else:
            profile["type"] = "numeric"
    # Categorical/Text metrics
    else:
        profile["type"] = "categorical"
        top_val_counts = series.value_counts(dropna=True).head(10).to_dict()
        profile["top_values"] = {str(k): int(v) for k, v in top_val_counts.items()}

        if pd.api.types.is_string_dtype(series) or series.dtype == "object":
            str_lens = series.dropna().astype(str).str.len()
            if len(str_lens) > 0:
                profile["avg_string_length"] = float(round(str_lens.mean(), 2))
                profile["max_string_length"] = int(str_lens.max())

    return profile


@shared_task(name="app.tasks.profiling.profile_dataset_task")
def profile_dataset_task(dataset_version_id: str) -> Dict:
    """Celery task to compute column & dataset level profiles."""
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with Session(engine) as session:
        version = session.get(DatasetVersion, uuid.UUID(dataset_version_id))
        if not version:
            return {"error": "DatasetVersion not found"}

        dataset = session.get(Dataset, version.dataset_id)
        if not dataset:
            return {"error": "Dataset not found"}

        # Find or create Profile row
        stmt = select(Profile).where(Profile.dataset_version_id == version.id)
        profile_obj = session.scalars(stmt).first()
        if not profile_obj:
            profile_obj = Profile(dataset_version_id=version.id, status="running")
            session.add(profile_obj)
        else:
            profile_obj.status = "running"
        session.commit()

        try:
            # Download and parse file
            storage_key = version.storage_uri.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
            file_bytes = storage_service.download_file(storage_key)
            df = parse_file_to_df(file_bytes, dataset.source_type)

            # Compute summary
            total_cells = df.shape[0] * df.shape[1]
            total_nulls = int(df.isnull().sum().sum())
            completeness_pct = float(round(((total_cells - total_nulls) / max(total_cells, 1)) * 100, 2))
            duplicate_rows = int(df.duplicated().sum())

            summary = {
                "row_count": df.shape[0],
                "col_count": df.shape[1],
                "completeness_pct": completeness_pct,
                "duplicate_row_count": duplicate_rows,
                "memory_footprint_bytes": int(df.memory_usage(deep=True).sum()),
            }

            # Compute per-column profiles
            column_profiles = {}
            for col_name in df.columns:
                column_profiles[str(col_name)] = compute_column_profile(df[col_name], str(col_name))

            # Update Profile record
            profile_obj.summary = summary
            profile_obj.column_profiles = column_profiles
            profile_obj.status = "complete"
            profile_obj.completed_at = datetime.datetime.now(datetime.timezone.utc)
            session.commit()

            return {
                "status": "complete",
                "profile_id": str(profile_obj.id),
                "summary": summary,
            }
        except Exception as e:
            profile_obj.status = "failed"
            session.commit()
            raise e
