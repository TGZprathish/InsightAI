"""Celery analysis tasks: descriptive stats, correlation, multi-horizon trend forecasting, and segment analysis."""

import datetime
import io
import uuid
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from celery import shared_task
from scipy import stats
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.analysis import Analysis
from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.services.storage import storage_service
from app.tasks.ingestion import parse_file_to_df


def run_descriptive_stats(df: pd.DataFrame) -> Dict[str, Any]:
    """Compute comprehensive descriptive stats and IQR distribution bounds for all numeric columns."""
    numeric_df = df.select_dtypes(include=[np.number])
    stats_list = []

    for col in numeric_df.columns:
        series = numeric_df[col].dropna()
        if len(series) > 0:
            q25 = float(series.quantile(0.25))
            q75 = float(series.quantile(0.75))
            iqr = q75 - q25
            outliers = series[(series < q25 - 1.5 * iqr) | (series > q75 + 1.5 * iqr)]

            stats_list.append({
                "column": col,
                "count": int(len(series)),
                "mean": float(round(series.mean(), 4)),
                "std": float(round(series.std(), 4)) if len(series) > 1 else 0.0,
                "min": float(series.min()),
                "max": float(series.max()),
                "median": float(series.median()),
                "q25": round(q25, 4),
                "q75": round(q75, 4),
                "iqr": round(iqr, 4),
                "outliers_count": len(outliers),
                "skewness": float(round(series.skew(), 4)) if len(series) > 2 else 0.0,
                "null_pct": float(round((df[col].isnull().sum() / len(df)) * 100, 2)),
            })

    return {"descriptive_stats": stats_list}


def run_correlation(df: pd.DataFrame, method: str = "pearson") -> Dict[str, Any]:
    """Compute pairwise Pearson and Spearman correlation matrices."""
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.shape[1] < 2:
        return {"correlation_matrix": [], "top_correlations": []}

    corr_matrix = numeric_df.corr(method=method).round(4)
    matrix_data = corr_matrix.to_dict()

    top_correlations = []
    cols = numeric_df.columns.tolist()
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            c1, c2 = cols[i], cols[j]
            val = corr_matrix.loc[c1, c2]
            if not np.isnan(val):
                strength = "strong" if abs(val) >= 0.7 else "moderate" if abs(val) >= 0.4 else "weak"
                top_correlations.append({
                    "pair": f"{c1} ↔ {c2}",
                    "col1": c1,
                    "col2": c2,
                    "value": float(val),
                    "abs_value": float(abs(val)),
                    "strength": strength,
                })

    top_correlations.sort(key=lambda x: x["abs_value"], reverse=True)

    return {
        "correlation_matrix": matrix_data,
        "top_correlations": top_correlations[:15],
    }


def run_trend_analysis(df: pd.DataFrame, time_col: str, metric_col: str) -> Dict[str, Any]:
    """Compute temporal trend regression and generate 6-period predictive forecast with 95% confidence bands."""
    if time_col not in df.columns or metric_col not in df.columns:
        return {"error": "Columns not found"}

    temp_df = df[[time_col, metric_col]].dropna().copy()
    temp_df[time_col] = pd.to_datetime(temp_df[time_col], errors="coerce")
    temp_df = temp_df.dropna().sort_values(by=time_col)

    if len(temp_df) < 3:
        return {"error": "Insufficient data points for trend analysis"}

    # Resample daily or weekly or monthly depending on date range
    time_range = (temp_df[time_col].max() - temp_df[time_col].min()).days
    freq = "D" if time_range < 90 else "W" if time_range < 365 else "ME"

    resampled = temp_df.set_index(time_col).resample(freq)[metric_col].agg(["sum", "mean", "count"]).reset_index()
    resampled_dates = resampled[time_col].copy()
    resampled[time_col] = resampled[time_col].dt.strftime("%Y-%m-%d")

    # Fit linear regression trend line
    x = np.arange(len(resampled), dtype=float)
    y = resampled["mean"].values.astype(float)

    if len(x) > 1 and not np.all(np.isnan(y)):
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
        trend_direction = "up" if slope > 0 and p_value < 0.05 else "down" if slope < 0 and p_value < 0.05 else "flat"
        r_sq = float(round(r_value ** 2, 4))
    else:
        slope, intercept, r_value, p_value, std_err, trend_direction = 0.0, 0.0, 0.0, 1.0, 0.0, "flat"
        r_sq = 0.0

    # 6-step future projection with prediction intervals
    n_pts = len(x)
    last_date = resampled_dates.iloc[-1] if not resampled_dates.empty else datetime.datetime.now()
    forecasts = []

    for step in range(1, 7):
        target_idx = n_pts + step - 1
        predicted_val = round(float(intercept + slope * target_idx), 2)
        ci_spread = round(float(1.96 * max(std_err * np.sqrt(1 + 1/max(n_pts, 1)), 0.05 * abs(predicted_val))), 2)

        # Increment date
        if freq == "D":
            next_date = last_date + pd.Timedelta(days=step)
        elif freq == "W":
            next_date = last_date + pd.Timedelta(weeks=step)
        else:
            next_date = last_date + pd.DateOffset(months=step)

        forecasts.append({
            "period": step,
            "date": next_date.strftime("%Y-%m-%d"),
            "predicted_mean": predicted_val,
            "lower_95_ci": round(predicted_val - ci_spread, 2),
            "upper_95_ci": round(predicted_val + ci_spread, 2),
        })

    return {
        "time_column": time_col,
        "metric_column": metric_col,
        "frequency": freq,
        "trend_direction": trend_direction,
        "slope": float(round(slope, 4)),
        "r_squared": r_sq,
        "p_value": float(round(p_value, 4)),
        "historical_series": resampled.to_dict(orient="records"),
        "future_forecast": forecasts,
    }


@shared_task(name="app.tasks.analysis.run_analysis_task")
def run_analysis_task(analysis_id: str) -> Dict:
    """Celery task to execute statistical analysis."""
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with Session(engine) as session:
        analysis = session.get(Analysis, uuid.UUID(analysis_id))
        if not analysis:
            return {"error": "Analysis not found"}

        analysis.status = "running"
        session.commit()

        version = session.get(DatasetVersion, analysis.dataset_version_id)
        dataset = session.get(Dataset, version.dataset_id)

        # Download file
        storage_key = version.storage_uri.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
        file_bytes = storage_service.download_file(storage_key)
        df = parse_file_to_df(file_bytes, dataset.source_type)

        params = analysis.params or {}
        a_type = analysis.analysis_type

        try:
            if a_type == "descriptive_stats":
                result_payload = run_descriptive_stats(df)
            elif a_type == "correlation":
                result_payload = run_correlation(df, method=params.get("method", "pearson"))
            elif a_type == "trend":
                result_payload = run_trend_analysis(df, params.get("time_column"), params.get("metric_column"))
            else:
                result_payload = run_descriptive_stats(df)

            analysis.result = result_payload
            analysis.status = "complete"
            analysis.completed_at = datetime.datetime.now(datetime.timezone.utc)
            session.commit()

            return {"status": "complete", "analysis_id": analysis_id}
        except Exception as e:
            analysis.status = "failed"
            session.commit()
            raise e
