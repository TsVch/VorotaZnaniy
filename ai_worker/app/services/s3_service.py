"""Async S3 / object storage service for the AI Worker.

Wraps synchronous boto3 calls in asyncio.to_thread so the
event loop stays responsive during file I/O.
"""

import asyncio
import logging
import os
from pathlib import Path
from typing import BinaryIO

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


class S3Service:
    """Async-friendly wrapper around boto3 S3 operations.

    All public methods are async; the actual boto3 calls run
    in a thread pool executor to avoid blocking the event loop.
    """

    def __init__(self) -> None:
        self._client: object | None = None  # boto3 client, lazily created

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_client(self):  # noqa: ANN202
        """Lazy-init the low-level S3 client."""
        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint_url,
                aws_access_key_id=settings.s3_access_key_id,
                aws_secret_access_key=settings.s3_secret_access_key,
                region_name=settings.s3_region,
            )
        return self._client

    @property
    def bucket(self) -> str:
        return settings.s3_bucket_name

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def download_file(self, key: str, local_path: str | Path) -> None:
        """Download an object from S3 to a local file.

        Raises FileNotFoundError if the key does not exist.
        """
        client = self._get_client()
        try:
            await asyncio.to_thread(
                client.download_file, self.bucket, key, str(local_path)
            )
            logger.info("Downloaded s3://%s/%s → %s", self.bucket, key, local_path)
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "404":
                raise FileNotFoundError(f"S3 key not found: {key}") from exc
            raise

    async def upload_file(
        self,
        local_path: str | Path,
        key: str,
        content_type: str = "application/octet-stream",
        extra_args: dict | None = None,
    ) -> None:
        """Upload a local file to S3.

        Args:
            local_path: Path to the file on disk.
            key: Destination S3 object key.
            content_type: MIME type (e.g. 'image/webp').
            extra_args: Additional boto3 upload kwargs.
        """
        client = self._get_client()
        args: dict = {
            "Bucket": self.bucket,
            "Key": key,
            "Filename": str(local_path),
            "ExtraArgs": {"ContentType": content_type, **(extra_args or {})},
        }
        await asyncio.to_thread(client.upload_file, **args)
        logger.info("Uploaded %s → s3://%s/%s", local_path, self.bucket, key)

    async def object_exists(self, key: str) -> bool:
        """Check whether an object exists in S3 (via HeadObject)."""
        client = self._get_client()
        try:
            await asyncio.to_thread(
                client.head_object, Bucket=self.bucket, Key=key
            )
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "404":
                return False
            raise

    async def generate_presigned_upload_url(
        self,
        key: str,
        content_type: str,
        expires_in: int = 300,
    ) -> str:
        """Generate a presigned PUT URL for direct uploads.

        Args:
            key: S3 object key.
            content_type: Expected MIME type of the upload.
            expires_in: URL validity in seconds (default 5 min).

        Returns:
            Presigned URL string.
        """
        client = self._get_client()
        url = await asyncio.to_thread(
            client.generate_presigned_url,
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )
        return url

    async def generate_presigned_get_url(
        self, key: str, expires_in: int = 60
    ) -> str:
        """Generate a presigned GET URL for temporary access.

        Args:
            key: S3 object key.
            expires_in: URL validity in seconds (default 1 min).

        Returns:
            Presigned URL string.
        """
        client = self._get_client()
        url = await asyncio.to_thread(
            client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )
        return url

    async def close(self) -> None:
        """Close the underlying boto3 session (no-op for now)."""
        self._client = None
