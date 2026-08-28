"""S3-compatible object storage service with local filesystem fallback."""

import hashlib
import io
import os
from pathlib import Path
from typing import Optional

import boto3
from botocore.config import Config

from app.core.config import settings


class StorageService:
    """Storage client with S3/MinIO and local filesystem fallback."""

    def __init__(self):
        self.bucket = settings.S3_BUCKET_NAME
        self.local_upload_dir = Path("uploads")
        self.local_upload_dir.mkdir(exist_ok=True)
        self.use_s3 = False

        try:
            self.client = boto3.client(
                "s3",
                endpoint_url=settings.S3_ENDPOINT_URL,
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY,
                region_name=settings.S3_REGION,
                config=Config(signature_version="s3v4", connect_timeout=1, retries={"max_attempts": 1}),
            )
            # Ping bucket check
            self.client.head_bucket(Bucket=self.bucket)
            self.use_s3 = True
        except Exception:
            self.use_s3 = False

    def _clean_s3_key(self, key: str) -> str:
        """Strip s3:// or s3://<bucket>/ prefixes to return a clean relative S3 object key."""
        clean = str(key).strip()
        if clean.startswith(f"s3://{self.bucket}/"):
            clean = clean[len(f"s3://{self.bucket}/"):]
        elif clean.startswith("s3://"):
            parts = clean[5:].split("/", 1)
            clean = parts[1] if len(parts) > 1 else parts[0]
        return clean

    def _clean_file_path(self, key: str) -> str:
        """Strip file:// prefixes."""
        clean = str(key).strip()
        if clean.startswith("file://"):
            clean = clean[7:]
        return clean

    def upload_file(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Upload a file to S3 or local storage."""
        s3_key = self._clean_s3_key(key)
        if self.use_s3:
            try:
                self.client.put_object(Bucket=self.bucket, Key=s3_key, Body=data, ContentType=content_type)
                return f"s3://{self.bucket}/{s3_key}"
            except Exception:
                pass

        # Fallback to local filesystem
        file_path = self.local_upload_dir / s3_key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)
        return f"file://{file_path.absolute().as_posix()}"

    def download_file(self, key: str) -> bytes:
        """Download a file from S3 or local storage."""
        if not key:
            raise FileNotFoundError("Storage key cannot be empty")

        clean_str = str(key).strip()

        # 1. If key is file:// or explicit local file path that exists
        if clean_str.startswith("file://"):
            file_path_str = self._clean_file_path(clean_str)
            direct_path = Path(file_path_str)
            if direct_path.exists() and direct_path.is_file():
                return direct_path.read_bytes()
            # Try uploads relative path fallback
            rel_key = file_path_str.split("uploads/")[-1] if "uploads/" in file_path_str else file_path_str
            fallback_path = self.local_upload_dir / rel_key
            if fallback_path.exists() and fallback_path.is_file():
                return fallback_path.read_bytes()

        # 2. Try S3 with normalized key
        s3_key = self._clean_s3_key(clean_str)
        if self.use_s3:
            try:
                response = self.client.get_object(Bucket=self.bucket, Key=s3_key)
                return response["Body"].read()
            except Exception:
                pass

        # 3. Local filesystem fallback for s3_key or direct path
        direct_path = Path(self._clean_file_path(clean_str))
        if direct_path.exists() and direct_path.is_file():
            return direct_path.read_bytes()

        rel_key = s3_key.split("uploads/")[-1] if "uploads/" in s3_key else s3_key
        fallback_path = self.local_upload_dir / rel_key
        if fallback_path.exists() and fallback_path.is_file():
            return fallback_path.read_bytes()

        raise FileNotFoundError(f"Storage key '{key}' not found locally or in S3")

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate presigned or local file URL."""
        s3_key = self._clean_s3_key(key)
        if self.use_s3:
            try:
                return self.client.generate_presigned_url("get_object", Params={"Bucket": self.bucket, "Key": s3_key}, ExpiresIn=expires_in)
            except Exception:
                pass
        return f"/api/v1/datasets/files/{s3_key}"

    def delete_file(self, key: str) -> None:
        """Delete a file from S3 or local storage."""
        if not key:
            return

        clean_str = str(key).strip()
        s3_key = self._clean_s3_key(clean_str)

        if self.use_s3:
            try:
                self.client.delete_object(Bucket=self.bucket, Key=s3_key)
            except Exception:
                pass

        file_path_str = self._clean_file_path(clean_str)
        direct_path = Path(file_path_str)
        if direct_path.exists() and direct_path.is_file():
            try:
                direct_path.unlink()
            except Exception:
                pass

        rel_key = s3_key.split("uploads/")[-1] if "uploads/" in s3_key else s3_key
        fallback_path = self.local_upload_dir / rel_key
        if fallback_path.exists() and fallback_path.is_file():
            try:
                fallback_path.unlink()
            except Exception:
                pass

    @staticmethod
    def compute_checksum(data: bytes) -> str:
        """Compute SHA-256 checksum of file data."""
        return hashlib.sha256(data).hexdigest()


# Singleton
storage_service = StorageService()

