"""Celery ingestion tasks: file parsing, schema inference, and PII detection."""

import io
import re
import uuid
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
try:
    from celery import shared_task
except ImportError:
    def shared_task(*args, **kwargs):
        def decorator(func):
            return func
        return decorator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base
from app.models.column_schema import ColumnSchema
from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.models.table_schema import TableSchema
from app.services.storage import storage_service

# Common PII regex patterns
PII_PATTERNS = {
    "email": re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"),
    "phone": re.compile(r"^\+?[\d\s\-\(\)]{7,15}$"),
    "ssn": re.compile(r"^\d{3}-\d{2}-\d{4}$"),
    "credit_card": re.compile(r"^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$"),
    "ip_address": re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$"),
}

PII_HEADER_KEYWORDS = [
    "email", "phone", "mobile", "ssn", "social_security",
    "credit_card", "card_number", "passport", "password", "ip_address",
    "first_name", "last_name", "full_name", "address", "zipcode"
]


def is_column_pii_suspect(col_name: str, sample_values: List[str]) -> bool:
    """Determine if a column is PII-suspect based on header name and sample values."""
    col_lower = col_name.lower()
    if any(keyword in col_lower for keyword in PII_HEADER_KEYWORDS):
        return True

    # Check sample values against regexes
    non_null_samples = [str(val).strip() for val in sample_values if pd.notna(val) and str(val).strip() != ""]
    if not non_null_samples:
        return False

    sample_subset = non_null_samples[:20]
    for pattern_name, regex in PII_PATTERNS.items():
        matches = sum(1 for val in sample_subset if regex.match(val))
        if len(sample_subset) > 0 and (matches / len(sample_subset)) >= 0.5:
            return True

    return False


def infer_column_type(series: pd.Series) -> str:
    """Infer high-level column type from pandas Series."""
    dtype_str = str(series.dtype).lower()

    if "int" in dtype_str:
        return "integer"
    elif "float" in dtype_str:
        return "float"
    elif "bool" in dtype_str:
        return "boolean"
    elif "datetime" in dtype_str:
        return "datetime"
    else:
        # Check if text strings can be parsed as dates
        non_nulls = series.dropna()
        if len(non_nulls) > 0 and series.dtype == "object":
            # Check cardinality for categoricals
            unique_ratio = series.nunique() / max(len(non_nulls), 1)
            if series.nunique() <= 30 or unique_ratio < 0.2:
                return "categorical"

            # Check date parseability on a small sample
            sample_str = non_nulls.head(10).astype(str)
            date_matches = 0
            for val in sample_str:
                try:
                    pd.to_datetime(val)
                    date_matches += 1
                except Exception:
                    pass
            if len(sample_str) > 0 and (date_matches / len(sample_str)) >= 0.8:
                return "datetime"

        return "string"


def parse_file_to_df(file_bytes: bytes, source_type: str) -> pd.DataFrame:
    """Parse raw bytes into a pandas DataFrame and automatically convert numeric strings to float/int numbers."""
    buf = io.BytesIO(file_bytes)

    if source_type == "csv":
        df = pd.read_csv(buf, on_bad_lines="skip")
    elif source_type in ["xlsx", "xls"]:
        df = pd.read_excel(buf)
    elif source_type == "json":
        df = pd.read_json(buf)
    else:
        df = pd.read_csv(buf, on_bad_lines="skip")

    # Auto-convert string numbers, currency strings ($), and percentages (%) to numeric dtypes
    for col in df.columns:
        dtype_name = str(df[col].dtype).lower()
        if dtype_name == "object" or "str" in dtype_name:
            cleaned_series = (
                df[col]
                .astype(str)
                .str.strip()
                .str.replace(r"^[\$€£¥]", "", regex=True)
                .str.replace(r"[,%]", "", regex=True)
            )
            converted = pd.to_numeric(cleaned_series, errors="coerce")
            non_null_orig = df[col].dropna()
            non_null_conv = converted.dropna()
            if len(non_null_orig) > 0 and (len(non_null_conv) / len(non_null_orig)) >= 0.5:
                df[col] = converted

    return df


@shared_task(name="app.tasks.ingestion.parse_and_infer_schema")
def parse_and_infer_schema(dataset_version_id: str) -> Dict:
    """Celery task to load dataset, infer dtypes, detect PII, and save Table/Column schemas."""
    from sqlalchemy import create_engine
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with Session(engine) as session:
        version = session.get(DatasetVersion, uuid.UUID(dataset_version_id))
        if not version:
            return {"error": "DatasetVersion not found"}

        dataset = session.get(Dataset, version.dataset_id)
        if not dataset:
            return {"error": "Dataset not found"}

        # Load file from storage
        storage_key = version.storage_uri.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
        file_bytes = storage_service.download_file(storage_key)

        # Parse DataFrame
        df = parse_file_to_df(file_bytes, dataset.source_type)

        # Update dataset version metadata
        version.row_count = len(df)
        session.flush()

        # Create TableSchema
        table_schema = TableSchema(
            dataset_version_id=version.id,
            table_name="main",
        )
        session.add(table_schema)
        session.flush()

        # Create ColumnSchemas
        column_schemas = []
        for idx, col_name in enumerate(df.columns):
            series = df[col_name]
            inferred_type = infer_column_type(series)
            sample_vals = series.head(20).tolist()
            is_pii = is_column_pii_suspect(str(col_name), sample_vals)

            col_obj = ColumnSchema(
                table_schema_id=table_schema.id,
                name=str(col_name),
                ordinal_position=idx,
                inferred_type=inferred_type,
                is_pii_suspect=is_pii,
            )
            session.add(col_obj)
            column_schemas.append({
                "name": str(col_name),
                "inferred_type": inferred_type,
                "is_pii": is_pii,
            })

        session.commit()

        # Automatically enqueue profiling job
        from app.tasks.profiling import profile_dataset_task
        profile_dataset_task.delay(str(version.id))

        return {
            "status": "success",
            "dataset_version_id": dataset_version_id,
            "row_count": len(df),
            "col_count": len(df.columns),
            "columns": column_schemas,
        }
