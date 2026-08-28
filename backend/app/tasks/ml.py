"""Celery ML task module: scikit-learn training, metric evaluation, feature importance, and joblib serialization to storage."""

import datetime
import io
import uuid
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from celery import shared_task
from sklearn.cluster import KMeans
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    calinski_harabasz_score,
    explained_variance_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    silhouette_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.analysis import Analysis
from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.models.ml_model import MLModel
from app.services.storage import storage_service
from app.tasks.ingestion import parse_file_to_df


@shared_task(name="app.tasks.ml.train_ml_model_task")
def train_ml_model_task(ml_model_id: str) -> Dict:
    """Celery task to train an ML pipeline, evaluate metrics, and save serialized joblib file."""
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with Session(engine) as session:
        model_obj = session.get(MLModel, uuid.UUID(ml_model_id))
        if not model_obj:
            return {"error": "MLModel not found"}

        analysis = session.get(Analysis, model_obj.analysis_id)
        version = session.get(DatasetVersion, analysis.dataset_version_id)
        dataset = session.get(Dataset, version.dataset_id)

        # Download dataset
        storage_key = version.storage_uri.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
        file_bytes = storage_service.download_file(storage_key)
        df = parse_file_to_df(file_bytes, dataset.source_type)

        m_type = model_obj.model_type.lower()
        target_col = model_obj.target_column
        feature_cols = model_obj.feature_columns or []

        # Determine feature columns if not specified
        if not feature_cols:
            all_cols = list(df.columns)
            feature_cols = [c for c in all_cols if c != target_col]

        if not feature_cols:
            return {"error": "No valid feature columns found for training"}

        # Filter available features
        feature_cols = [c for c in feature_cols if c in df.columns]
        num_features = [c for c in feature_cols if pd.api.types.is_numeric_dtype(df[c])]
        cat_features = [c for c in feature_cols if c not in num_features]

        # Build robust preprocessor pipeline
        transformers = []
        if num_features:
            num_pipe = Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
            ])
            transformers.append(("num", num_pipe, num_features))

        if cat_features:
            cat_pipe = Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
            ])
            transformers.append(("cat", cat_pipe, cat_features))

        preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")

        metrics: Dict[str, Any] = {}
        feature_importance_list: List[Dict[str, Any]] = []

        # ── 1. REGRESSION MODELS ─────────────────────────────────────────────
        if m_type in ["linear_regression", "ridge", "random_forest_regressor", "gradient_boosting_regressor"]:
            if not target_col or target_col not in df.columns:
                return {"error": f"Target column '{target_col}' not found"}

            valid_mask = df[target_col].notnull()
            clean_df = df[valid_mask]
            if len(clean_df) < 8:
                return {"error": "Insufficient valid rows with target values"}

            X = clean_df[feature_cols]
            y = clean_df[target_col].astype(float)

            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

            if m_type == "linear_regression":
                estimator = LinearRegression()
            elif m_type == "ridge":
                estimator = Ridge(alpha=1.0)
            elif m_type == "gradient_boosting_regressor":
                estimator = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, random_state=42)
            else:
                estimator = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42)

            full_pipeline = Pipeline([
                ("preprocessor", preprocessor),
                ("estimator", estimator),
            ])

            full_pipeline.fit(X_train, y_train)
            preds = full_pipeline.predict(X_test)

            r2 = float(r2_score(y_test, preds))
            rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
            mae = float(mean_absolute_error(y_test, preds))
            exp_var = float(explained_variance_score(y_test, preds))

            # MAPE
            non_zero_mask = y_test != 0
            mape = float(np.mean(np.abs((y_test[non_zero_mask] - preds[non_zero_mask]) / y_test[non_zero_mask])) * 100) if np.any(non_zero_mask) else 0.0

            metrics = {
                "r2_score": round(r2, 4),
                "rmse": round(rmse, 4),
                "mae": round(mae, 4),
                "mape_pct": round(mape, 2),
                "explained_variance": round(exp_var, 4),
                "train_samples": len(X_train),
                "test_samples": len(X_test),
            }

            # Feature importance
            fitted_estimator = full_pipeline.named_steps["estimator"]
            if hasattr(fitted_estimator, "feature_importances_"):
                imp = fitted_estimator.feature_importances_
                all_transformed_features = num_features + cat_features
                if len(imp) == len(all_transformed_features):
                    for f_name, val in zip(all_transformed_features, imp):
                        feature_importance_list.append({"feature": f_name, "importance": float(round(val, 4))})
            elif hasattr(fitted_estimator, "coef_"):
                coefs = np.abs(fitted_estimator.coef_)
                total_c = np.sum(coefs) or 1.0
                all_transformed_features = num_features + cat_features
                if len(coefs) == len(all_transformed_features):
                    for f_name, val in zip(all_transformed_features, coefs):
                        feature_importance_list.append({"feature": f_name, "importance": float(round(val / total_c, 4))})

        # ── 2. CLASSIFICATION MODELS ─────────────────────────────────────────
        elif m_type in ["logistic_regression", "random_forest", "random_forest_classifier", "gradient_boosting_classifier"]:
            if not target_col or target_col not in df.columns:
                return {"error": f"Target column '{target_col}' not found"}

            valid_mask = df[target_col].notnull()
            clean_df = df[valid_mask]
            if len(clean_df) < 8:
                return {"error": "Insufficient valid rows with target values"}

            X = clean_df[feature_cols]
            y = clean_df[target_col]

            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

            if m_type == "logistic_regression":
                estimator = LogisticRegression(max_iter=1000)
            elif m_type == "gradient_boosting_classifier":
                estimator = GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, random_state=42)
            else:
                estimator = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42)

            full_pipeline = Pipeline([
                ("preprocessor", preprocessor),
                ("estimator", estimator),
            ])

            full_pipeline.fit(X_train, y_train)
            preds = full_pipeline.predict(X_test)

            acc = float(accuracy_score(y_test, preds))
            bal_acc = float(balanced_accuracy_score(y_test, preds))
            f1 = float(f1_score(y_test, preds, average="weighted", zero_division=0))
            prec = float(precision_score(y_test, preds, average="weighted", zero_division=0))
            rec = float(recall_score(y_test, preds, average="weighted", zero_division=0))

            metrics = {
                "accuracy": round(acc, 4),
                "balanced_accuracy": round(bal_acc, 4),
                "f1_score": round(f1, 4),
                "precision": round(prec, 4),
                "recall": round(rec, 4),
                "classes": [str(c) for c in np.unique(y)],
                "train_samples": len(X_train),
                "test_samples": len(X_test),
            }

            fitted_estimator = full_pipeline.named_steps["estimator"]
            if hasattr(fitted_estimator, "feature_importances_"):
                imp = fitted_estimator.feature_importances_
                all_transformed_features = num_features + cat_features
                if len(imp) == len(all_transformed_features):
                    for f_name, val in zip(all_transformed_features, imp):
                        feature_importance_list.append({"feature": f_name, "importance": float(round(val, 4))})

        # ── 3. CLUSTERING MODELS ─────────────────────────────────────────────
        elif m_type in ["kmeans", "k_means"]:
            X = df[feature_cols]
            n_clusters = min(4, max(2, len(X) // 10))

            full_pipeline = Pipeline([
                ("preprocessor", preprocessor),
                ("estimator", KMeans(n_clusters=n_clusters, random_state=42, n_init=10)),
            ])

            X_trans = preprocessor.fit_transform(X)
            cluster_labels = full_pipeline.named_steps["estimator"].fit_predict(X_trans)
            full_pipeline.fit(X)

            sil_score = float(silhouette_score(X_trans, cluster_labels)) if len(X) > n_clusters else 0.0
            cal_score = float(calinski_harabasz_score(X_trans, cluster_labels)) if len(X) > n_clusters else 0.0

            unique, counts = np.unique(cluster_labels, return_counts=True)
            cluster_distribution = {f"cluster_{k}": int(v) for k, v in zip(unique, counts)}

            metrics = {
                "silhouette_score": round(sil_score, 4),
                "calinski_harabasz_score": round(cal_score, 2),
                "n_clusters": n_clusters,
                "cluster_distribution": cluster_distribution,
                "total_samples": len(X),
            }

        else:
            return {"error": f"Unsupported model_type: {m_type}"}

        # Sort feature importances descending
        if feature_importance_list:
            feature_importance_list.sort(key=lambda f: f["importance"], reverse=True)
            metrics["feature_importance"] = feature_importance_list

        # Serialize complete end-to-end pipeline to joblib
        joblib_buf = io.BytesIO()
        joblib.dump(full_pipeline, joblib_buf)
        artifact_bytes = joblib_buf.getvalue()

        artifact_key = f"models/{model_obj.id}/model.joblib"
        artifact_uri = storage_service.upload_file(artifact_key, artifact_bytes, "application/octet-stream")

        model_obj.metrics = metrics
        model_obj.artifact_uri = artifact_uri
        model_obj.feature_columns = feature_cols
        session.commit()

        return {
            "status": "complete",
            "model_id": ml_model_id,
            "metrics": metrics,
            "artifact_uri": artifact_uri,
        }
