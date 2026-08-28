"""Datasets API routes (Refactored to lean controller pattern)."""

import os
from typing import Optional, List
import uuid
from uuid import UUID
import numpy as np
import pandas as pd

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Response
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.deps import get_current_user, require_role, CurrentUser, PaginationParams
from app.models.dataset import Dataset
from app.models.dataset_version import DatasetVersion
from app.models.project import Project
from app.models.table_schema import TableSchema
from app.models.column_schema import ColumnSchema
from app.schemas.dataset import (
    DatasetResponse,
    DatasetVersionResponse,
    DatasetUploadResponse,
    DataPreviewResponse,
    ColumnSchemaResponse,
    CleanDatasetRequest,
    CleanDatasetResponse,
)
from app.schemas.common import PaginatedResponse
from app.services.storage import storage_service
from app.services.dataset_cleaning import execute_cleaning_pipeline
from app.services.dataset_analytics import generate_dataset_report_data
from app.services.dataset_export import generate_dataset_pdf
from app.core import settings

router = APIRouter(tags=["Datasets"])


async def _process_dataset_upload(
    project_id: UUID,
    file: UploadFile,
    name: str,
    current_user: CurrentUser,
    db: AsyncSession,
) -> DatasetUploadResponse:
    """Fast non-blocking upload handler: stores raw file in MinIO and dispatches async parsing/profiling."""
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"
    source_type_map = {"csv": "csv", "xlsx": "xlsx", "xls": "xlsx", "json": "json"}
    source_type = source_type_map.get(ext, "csv")

    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit",
        )

    checksum = storage_service.compute_checksum(content)

    dataset = Dataset(
        project_id=project_id,
        name=name,
        source_type=source_type,
        created_by=current_user.user_id,
    )
    db.add(dataset)
    await db.flush()

    storage_key = f"datasets/{dataset.id}/v1/raw/{filename}"
    storage_uri = storage_service.upload_file(storage_key, content, file.content_type or "application/octet-stream")

    version = DatasetVersion(
        dataset_id=dataset.id,
        version_number=1,
        storage_uri=storage_uri,
        file_checksum=checksum,
        stage="raw",
        byte_size=len(content),
    )
    db.add(version)
    await db.flush()
    await db.commit()

    # Fast initial inline parse for immediate preview availability, plus async worker dispatch
    try:
        from app.tasks.ingestion import parse_file_to_df, infer_column_type, is_column_pii_suspect
        df = parse_file_to_df(content, source_type)
        version.row_count = len(df)

        table_schema = TableSchema(
            dataset_version_id=version.id,
            table_name="main",
        )
        db.add(table_schema)
        await db.flush()

        for idx, col_name in enumerate(df.columns):
            series = df[col_name]
            col_obj = ColumnSchema(
                table_schema_id=table_schema.id,
                name=str(col_name),
                ordinal_position=idx,
                inferred_type=infer_column_type(series),
                is_pii_suspect=is_column_pii_suspect(str(col_name), series.head(20).tolist()),
            )
            db.add(col_obj)
        await db.commit()
    except Exception as e:
        print(f"Inline schema parse note: {e}")

    # Dispatch Celery background task for full schema inference & statistical profiling
    try:
        from app.tasks.ingestion import parse_and_infer_schema
        parse_and_infer_schema.delay(str(version.id))
    except Exception as e:
        print(f"Celery dispatch note: {e}")

    ds_res = await db.execute(
        select(Dataset).options(selectinload(Dataset.versions)).where(Dataset.id == dataset.id)
    )
    dataset = ds_res.scalar_one()

    return DatasetUploadResponse(
        dataset=DatasetResponse.model_validate(dataset),
        version=DatasetVersionResponse.model_validate(version),
    )


@router.post(
    "/datasets/upload",
    response_model=DatasetUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_dataset_standalone(
    file: UploadFile = File(...),
    name: str = Form(...),
    project_id: Optional[UUID] = Form(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Standalone dataset upload. Auto-provisions or selects a workspace project."""
    target_project = None
    if project_id:
        proj_res = await db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.organization_id == current_user.organization_id,
            )
        )
        target_project = proj_res.scalar_one_or_none()

    if not target_project:
        proj_result = await db.execute(
            select(Project).where(
                Project.organization_id == current_user.organization_id,
                Project.archived_at.is_(None),
            ).limit(1)
        )
        target_project = proj_result.scalar_one_or_none()

    if not target_project:
        target_project = Project(
            organization_id=current_user.organization_id,
            name="General Workspace",
            description="Default analytics workspace",
            created_by=current_user.user_id,
        )
        db.add(target_project)
        await db.flush()

    return await _process_dataset_upload(
        project_id=target_project.id,
        file=file,
        name=name,
        current_user=current_user,
        db=db,
    )


@router.post(
    "/projects/{project_id}/datasets",
    response_model=DatasetUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_dataset(
    project_id: UUID,
    file: UploadFile = File(...),
    name: str = Form(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a dataset file under a specific project."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return await _process_dataset_upload(
        project_id=project_id,
        file=file,
        name=name,
        current_user=current_user,
        db=db,
    )


def _build_dataset_response(dataset: Dataset) -> DatasetResponse:
    """Helper to convert Dataset model to DatasetResponse with latest_version and top-level version metadata populated."""
    response = DatasetResponse.model_validate(dataset)
    if dataset.versions:
        latest = max(dataset.versions, key=lambda v: v.version_number or 0)
        latest_ver_resp = DatasetVersionResponse.model_validate(latest)
        response.latest_version = latest_ver_resp
        response.version = latest.version_number
        response.stage = latest.stage
        response.rows = latest.row_count
        response.versions_count = len(dataset.versions)
    return response


@router.get(
    "/datasets",
    response_model=PaginatedResponse[DatasetResponse],
)
async def list_organization_datasets(
    project_id: Optional[UUID] = None,
    pagination: PaginationParams = Depends(),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all datasets uploaded by the current user with optional project_id filter."""
    base_query = (
        select(Dataset)
        .options(selectinload(Dataset.versions))
        .where(
            Dataset.created_by == current_user.user_id,
            Dataset.deleted_at.is_(None),
        )
    )

    if project_id:
        base_query = base_query.where(Dataset.project_id == project_id)

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar()

    result = await db.execute(
        base_query.order_by(Dataset.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    datasets = result.scalars().all()

    return PaginatedResponse(
        items=[_build_dataset_response(d) for d in datasets],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get(
    "/projects/{project_id}/datasets",
    response_model=PaginatedResponse[DatasetResponse],
)
async def list_datasets(
    project_id: UUID,
    pagination: PaginationParams = Depends(),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List datasets in a project uploaded by the current user."""
    base_query = (
        select(Dataset)
        .options(selectinload(Dataset.versions))
        .where(
            Dataset.project_id == project_id,
            Dataset.created_by == current_user.user_id,
            Dataset.deleted_at.is_(None),
        )
    )

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar()

    result = await db.execute(
        base_query.order_by(Dataset.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    datasets = result.scalars().all()

    return PaginatedResponse(
        items=[_build_dataset_response(d) for d in datasets],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get(
    "/datasets/{dataset_id}/preview",
    response_model=DataPreviewResponse,
)
async def preview_dataset(
    dataset_id: UUID,
    limit: int = 50,
    version_number: Optional[int] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Preview dataset rows and column schemas directly from file storage."""
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    if version_number:
        matched = [v for v in dataset.versions if v.version_number == version_number]
        latest_version = matched[0] if matched else sorted(dataset.versions, key=lambda v: v.version_number, reverse=True)[0]
    else:
        latest_version = sorted(dataset.versions, key=lambda v: v.version_number, reverse=True)[0]

    try:
        file_bytes = storage_service.download_file(latest_version.storage_uri)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Dataset file content unreachable: {e}")

    from app.tasks.ingestion import parse_file_to_df, infer_column_type, is_column_pii_suspect
    df = parse_file_to_df(file_bytes, dataset.source_type)

    cols_schema = [
        ColumnSchemaResponse(
            name=str(col_name),
            ordinal_position=idx + 1,
            inferred_type=infer_column_type(df[col_name]),
            is_pii_suspect=is_column_pii_suspect(str(col_name), df[col_name].head(20).tolist()),
        )
        for idx, col_name in enumerate(df.columns)
    ]

    sample_df = df.head(limit).copy()
    sample_df = sample_df.replace([np.inf, -np.inf], None)
    rows_data = []
    for record in sample_df.to_dict(orient="records"):
        clean_record = {}
        for k, v in record.items():
            if pd.isna(v) or v is None:
                clean_record[str(k)] = None
            elif isinstance(v, (pd.Timestamp, pd.Timedelta)):
                clean_record[str(k)] = v.isoformat() if not pd.isna(v) else None
            elif isinstance(v, (np.integer, int)):
                clean_record[str(k)] = int(v)
            elif isinstance(v, (np.floating, float)):
                if np.isnan(v) or np.isinf(v):
                    clean_record[str(k)] = None
                else:
                    clean_record[str(k)] = float(v)
            elif isinstance(v, (np.bool_, bool)):
                clean_record[str(k)] = bool(v)
            else:
                clean_record[str(k)] = v
        rows_data.append(clean_record)

    return DataPreviewResponse(
        columns=cols_schema,
        rows=rows_data,
        total_rows=len(df),
        sampled=len(df) > limit,
        version_number=latest_version.version_number,
        stage=latest_version.stage,
        dataset_name=dataset.name,
    )


@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a dataset by ID with its latest version summary."""
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
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    response = DatasetResponse.model_validate(dataset)
    if dataset.versions:
        latest = max(dataset.versions, key=lambda v: v.version_number)
        response.latest_version = DatasetVersionResponse.model_validate(latest)

    return response


@router.get(
    "/datasets/{dataset_id}/download",
    status_code=status.HTTP_200_OK,
)
async def download_dataset(
    dataset_id: UUID,
    version_number: Optional[int] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download raw or cleaned dataset CSV file from storage."""
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset file not found")

    if version_number:
        matched = [v for v in dataset.versions if v.version_number == version_number]
        target_ver = matched[0] if matched else sorted(dataset.versions, key=lambda v: v.version_number or 0, reverse=True)[0]
    else:
        target_ver = sorted(dataset.versions, key=lambda v: v.version_number or 0, reverse=True)[0]

    try:
        file_bytes = storage_service.download_file(target_ver.storage_uri)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to download dataset file: {e}")

    safe_name = dataset.name.lower().replace(" ", "_")
    ver_suffix = f"v{target_ver.version_number}_{target_ver.stage}"
    filename = f"{safe_name}_{ver_suffix}.csv"

    return Response(
        content=file_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.delete(
    "/datasets/{dataset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_dataset_permanently(
    dataset_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a dataset, all its versions, schemas, cleaning jobs, and storage files."""
    from app.models.cleaning_job import CleaningJob
    from app.models.ai_conversation import AiConversation

    result = await db.execute(
        select(Dataset)
        .options(selectinload(Dataset.versions))
        .where(
            Dataset.id == dataset_id,
            Dataset.created_by == current_user.user_id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    for ver in dataset.versions:
        try:
            storage_service.delete_file(ver.storage_uri)
        except Exception as ex:
            print(f"File cleanup note: {ex}")

        await db.execute(
            delete(CleaningJob).where(
                (CleaningJob.dataset_version_id == ver.id) |
                (CleaningJob.result_dataset_version_id == ver.id)
            )
        )

    await db.execute(delete(AiConversation).where(AiConversation.dataset_id == dataset.id))
    await db.delete(dataset)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/datasets/{dataset_id}/versions",
    response_model=PaginatedResponse[DatasetVersionResponse],
)
async def list_versions(
    dataset_id: UUID,
    pagination: PaginationParams = Depends(),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all versions of a dataset."""
    base_query = (
        select(DatasetVersion)
        .join(Dataset)
        .where(
            DatasetVersion.dataset_id == dataset_id,
            Dataset.created_by == current_user.user_id,
        )
    )

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar()

    result = await db.execute(
        base_query.order_by(DatasetVersion.version_number.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    versions = result.scalars().all()

    return PaginatedResponse(
        items=[DatasetVersionResponse.model_validate(v) for v in versions],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.delete(
    "/datasets/{dataset_id}/versions/{version_number}",
    status_code=status.HTTP_200_OK,
)
async def delete_dataset_version(
    dataset_id: UUID,
    version_number: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific version of a dataset, its storage file, schemas, reports, and cleaning jobs."""
    from app.models.cleaning_job import CleaningJob
    from app.models.report import Report

    # 1. Fetch dataset and its versions
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    if len(dataset.versions) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the only version of a dataset. Please delete the entire dataset if you wish to remove it.",
        )

    # 2. Find target version
    target_ver = next((v for v in dataset.versions if v.version_number == version_number), None)
    if not target_ver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset version v{version_number} not found",
        )

    # 3. Clear parent_version_id references on child versions
    child_versions_res = await db.execute(
        select(DatasetVersion).where(DatasetVersion.parent_version_id == target_ver.id)
    )
    for child in child_versions_res.scalars().all():
        child.parent_version_id = None

    # 4. Clean up cleaning jobs referencing this version
    await db.execute(
        delete(CleaningJob).where(
            (CleaningJob.dataset_version_id == target_ver.id) |
            (CleaningJob.result_dataset_version_id == target_ver.id)
        )
    )

    # 5. Clean up reports referencing this version
    await db.execute(
        delete(Report).where(Report.dataset_version_id == target_ver.id)
    )

    # 6. Delete physical storage file
    try:
        storage_service.delete_file(target_ver.storage_uri)
    except Exception as ex:
        print(f"Version file cleanup note: {ex}")

    # 7. Delete version record
    await db.delete(target_ver)
    await db.commit()

    # 8. Fetch remaining versions
    remaining_res = await db.execute(
        select(DatasetVersion)
        .where(DatasetVersion.dataset_id == dataset.id)
        .order_by(DatasetVersion.version_number.desc())
    )
    remaining_versions = remaining_res.scalars().all()
    latest_remaining = remaining_versions[0] if remaining_versions else None

    return {
        "message": f"Successfully deleted Version {version_number} of dataset '{dataset.name}'.",
        "deleted_version_number": version_number,
        "active_version_number": latest_remaining.version_number if latest_remaining else None,
        "remaining_versions": [DatasetVersionResponse.model_validate(v) for v in remaining_versions],
    }


@router.post(
    "/datasets/{dataset_id}/clean",
    response_model=CleanDatasetResponse,
    status_code=status.HTTP_200_OK,
)
async def clean_dataset(
    dataset_id: UUID,
    payload: CleanDatasetRequest = CleanDatasetRequest(),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply data cleaning transformations to dataset via the cleaning service pipeline."""
    try:
        return await execute_cleaning_pipeline(
            dataset_id=dataset_id,
            payload=payload,
            current_user=current_user,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/datasets/{dataset_id}/report")
async def generate_dataset_report(
    dataset_id: UUID,
    version: Optional[int] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze the full dataset using Python (pandas & numpy) and return data-driven insights."""
    try:
        return await generate_dataset_report_data(
            dataset_id=dataset_id,
            version=version,
            current_user=current_user,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/datasets/{dataset_id}/export-pdf")
async def export_dataset_pdf_report(
    dataset_id: UUID,
    version: Optional[int] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate and stream a professional executive PDF report compiled by Python ReportLab."""
    try:
        report_data = await generate_dataset_report_data(
            dataset_id=dataset_id,
            version=version,
            current_user=current_user,
            db=db,
        )
        pdf_bytes = generate_dataset_pdf(report_data)
        clean_name = report_data['dataset_name'].replace(' ', '_')
        filename = f"{clean_name}_Python_Report.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to generate PDF: {e}")
