"""Unit tests for S3Service."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.s3_service import S3Service


@pytest.fixture
def s3_service() -> S3Service:
    svc = S3Service()
    # Prevent lazy-init from connecting to real S3
    svc._client = MagicMock()
    return svc


class TestS3Service:
    """Tests for S3Service async wrapper."""

    @pytest.mark.asyncio
    async def test_download_file_success(self, s3_service: S3Service) -> None:
        """download_file should delegate to boto3 download_file."""
        await s3_service.download_file("some/key.pdf", "/tmp/out.pdf")
        s3_service._get_client().download_file.assert_called_once_with(
            s3_service.bucket, "some/key.pdf", "/tmp/out.pdf",
        )

    @pytest.mark.asyncio
    async def test_download_file_not_found(self, s3_service: S3Service) -> None:
        """download_file should raise FileNotFoundError on 404."""
        client = s3_service._get_client()
        exc = client.download_file  # access the mock property

        # Make the mock raise a 404 ClientError
        error_response = {
            "Error": {"Code": "404", "Message": "Not Found"},
        }
        from botocore.exceptions import ClientError

        client.download_file.side_effect = ClientError(
            error_response, "download_file",
        )

        with pytest.raises(FileNotFoundError, match="S3 key not found"):
            await s3_service.download_file("missing/key.pdf", "/tmp/out.pdf")

    @pytest.mark.asyncio
    async def test_upload_file_with_content_type(
        self, s3_service: S3Service,
    ) -> None:
        """upload_file should pass ContentType in ExtraArgs."""
        await s3_service.upload_file(
            "/tmp/page.webp",
            "pages/page-1.webp",
            content_type="image/webp",
        )
        client = s3_service._get_client()
        client.upload_file.assert_called_once()
        _call_kwargs = client.upload_file.call_args[1]
        extra = _call_kwargs.get("ExtraArgs", {})
        assert extra.get("ContentType") == "image/webp"

    @pytest.mark.asyncio
    async def test_object_exists_true(self, s3_service: S3Service) -> None:
        """object_exists returns True for existing objects."""
        result = await s3_service.object_exists("existing/key.pdf")
        assert result is True

    @pytest.mark.asyncio
    async def test_object_exists_false(self, s3_service: S3Service) -> None:
        """object_exists returns False for missing objects."""
        client = s3_service._get_client()
        from botocore.exceptions import ClientError

        client.head_object.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}},
            "head_object",
        )
        result = await s3_service.object_exists("missing/key.pdf")
        assert result is False

    @pytest.mark.asyncio
    async def test_generate_presigned_upload_url(
        self, s3_service: S3Service,
    ) -> None:
        """generate_presigned_upload_url returns a URL string."""
        client = s3_service._get_client()
        client.generate_presigned_url.return_value = (
            "https://storage.example.com/upload?token=abc"
        )
        url = await s3_service.generate_presigned_upload_url(
            "key.pdf", "application/pdf", 300,
        )
        assert url.startswith("https://")
        client.generate_presigned_url.assert_called_once_with(
            "put_object",
            Params={
                "Bucket": s3_service.bucket,
                "Key": "key.pdf",
                "ContentType": "application/pdf",
            },
            ExpiresIn=300,
        )

    @pytest.mark.asyncio
    async def test_generate_presigned_get_url(
        self, s3_service: S3Service,
    ) -> None:
        """generate_presigned_get_url returns a URL string."""
        client = s3_service._get_client()
        client.generate_presigned_url.return_value = (
            "https://storage.example.com/get?token=xyz"
        )
        url = await s3_service.generate_presigned_get_url("key.pdf", 60)
        assert url.startswith("https://")
        client.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={"Bucket": s3_service.bucket, "Key": "key.pdf"},
            ExpiresIn=60,
        )
