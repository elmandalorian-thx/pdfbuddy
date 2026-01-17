import pytest
import io
from pathlib import Path


class TestUploadEndpoints:
    """Tests for file upload endpoints."""

    def test_upload_pdf(self, test_client, sample_pdf):
        """Test uploading a PDF file."""
        with open(sample_pdf, "rb") as f:
            response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )

        assert response.status_code == 200
        data = response.json()
        assert "file_id" in data
        assert data["num_pages"] == 3
        assert len(data["thumbnail_urls"]) == 3

    def test_upload_invalid_file_type(self, test_client, temp_dir):
        """Test uploading an invalid file type."""
        txt_file = temp_dir / "test.txt"
        txt_file.write_text("Hello World")

        with open(txt_file, "rb") as f:
            response = test_client.post(
                "/api/upload",
                files={"file": ("test.txt", f, "text/plain")}
            )

        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]

    def test_upload_image(self, test_client, sample_image):
        """Test uploading an image file."""
        with open(sample_image, "rb") as f:
            response = test_client.post(
                "/api/upload-image",
                files={"file": ("test.png", f, "image/png")}
            )

        assert response.status_code == 200
        data = response.json()
        assert "file_id" in data
        assert data["file_type"] == "image"


class TestPageOperations:
    """Tests for page manipulation endpoints."""

    def test_remove_pages(self, test_client, sample_pdf):
        """Test removing pages from a PDF."""
        # First upload the PDF
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        # Remove page 2
        response = test_client.post(
            "/api/remove-pages",
            json={"file_id": file_id, "pages": [2]}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["num_pages"] == 2

    def test_reorder_pages(self, test_client, sample_pdf):
        """Test reordering pages."""
        # Upload PDF
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        # Reorder pages
        response = test_client.post(
            "/api/reorder-pages",
            json={"file_id": file_id, "new_order": [3, 1, 2]}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["new_order"] == [3, 1, 2]

    def test_rotate_pages(self, test_client, sample_pdf):
        """Test rotating pages."""
        # Upload PDF
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        # Rotate page 1
        response = test_client.post(
            "/api/rotate",
            json={"file_id": file_id, "pages": [1], "rotation": 90}
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_rotate_invalid_rotation(self, test_client, sample_pdf):
        """Test rotating with invalid rotation value."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.post(
            "/api/rotate",
            json={"file_id": file_id, "pages": [1], "rotation": 45}
        )

        assert response.status_code == 400

    def test_add_blank_page(self, test_client, sample_pdf):
        """Test adding a blank page."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.post(
            "/api/add-blank-page",
            json={"file_id": file_id, "position": 2}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["num_pages"] == 4


class TestMergeSplit:
    """Tests for merge and split operations."""

    def test_merge_pdfs(self, test_client, sample_pdf, multi_page_pdf):
        """Test merging multiple PDFs."""
        with open(sample_pdf, "rb") as f1, open(multi_page_pdf, "rb") as f2:
            response = test_client.post(
                "/api/merge",
                files=[
                    ("files", ("test1.pdf", f1, "application/pdf")),
                    ("files", ("test2.pdf", f2, "application/pdf"))
                ]
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["num_pages"] == 8

    def test_merge_single_file(self, test_client, sample_pdf):
        """Test merging with only one file (should fail)."""
        with open(sample_pdf, "rb") as f:
            response = test_client.post(
                "/api/merge",
                files=[("files", ("test.pdf", f, "application/pdf"))]
            )

        assert response.status_code == 400

    def test_split_individual(self, test_client, sample_pdf):
        """Test splitting into individual pages."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.post(
            "/api/split",
            json={"file_id": file_id, "mode": "individual"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["split_files"]) == 3


class TestImageOperations:
    """Tests for image-related operations."""

    def test_insert_image(self, test_client, sample_pdf, sample_image):
        """Test inserting an image as a PDF page."""
        # Upload PDF
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        # Insert image
        with open(sample_image, "rb") as f:
            response = test_client.post(
                "/api/insert-image",
                data={"file_id": file_id, "position": "2", "page_size": "A4"},
                files={"image": ("test.png", f, "image/png")}
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["num_pages"] == 4

    def test_images_to_pdf(self, test_client, sample_image, sample_jpeg):
        """Test converting images to PDF."""
        with open(sample_image, "rb") as f1, open(sample_jpeg, "rb") as f2:
            response = test_client.post(
                "/api/image-to-pdf",
                data={"page_size": "A4"},
                files=[
                    ("files", ("test1.png", f1, "image/png")),
                    ("files", ("test2.jpg", f2, "image/jpeg"))
                ]
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["num_pages"] == 2


class TestAdvancedFeatures:
    """Tests for advanced PDF features."""

    def test_add_watermark(self, test_client, sample_pdf):
        """Test adding a watermark."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.post(
            "/api/watermark",
            json={
                "file_id": file_id,
                "text": "CONFIDENTIAL",
                "opacity": 0.3,
                "rotation": 45
            }
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_encrypt_pdf(self, test_client, sample_pdf):
        """Test encrypting a PDF."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.post(
            "/api/encrypt",
            json={
                "file_id": file_id,
                "user_password": "test123"
            }
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_extract_text(self, test_client, sample_pdf):
        """Test extracting text from PDF."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.post(
            "/api/extract-text",
            json={"file_id": file_id, "format": "json"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "text" in data

    def test_get_metadata(self, test_client, sample_pdf):
        """Test getting PDF metadata."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.get(f"/api/metadata/{file_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "metadata" in data

    def test_update_metadata(self, test_client, sample_pdf):
        """Test updating PDF metadata."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.post(
            "/api/metadata",
            json={
                "file_id": file_id,
                "title": "Test Title",
                "author": "Test Author"
            }
        )

        assert response.status_code == 200
        assert response.json()["success"] is True


class TestDownloadAndPreview:
    """Tests for download and preview endpoints."""

    def test_get_thumbnail(self, test_client, sample_pdf):
        """Test getting a thumbnail."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.get(f"/api/thumbnail/{file_id}/1")

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"

    def test_get_preview(self, test_client, sample_pdf):
        """Test getting a preview."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.get(f"/api/preview/{file_id}/1?dpi=150")

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"

    def test_download(self, test_client, sample_pdf):
        """Test downloading a PDF."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.get(f"/api/download/{file_id}")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"

    def test_file_not_found(self, test_client):
        """Test accessing non-existent file."""
        response = test_client.get("/api/download/non-existent-id")
        assert response.status_code == 404


class TestFileManagement:
    """Tests for file management endpoints."""

    def test_delete_file(self, test_client, sample_pdf):
        """Test deleting a file."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.delete(f"/api/file/{file_id}")

        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify file is gone
        response = test_client.get(f"/api/download/{file_id}")
        assert response.status_code == 404

    def test_get_file_info(self, test_client, sample_pdf):
        """Test getting file info."""
        with open(sample_pdf, "rb") as f:
            upload_response = test_client.post(
                "/api/upload",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        file_id = upload_response.json()["file_id"]

        response = test_client.get(f"/api/file/{file_id}/info")

        assert response.status_code == 200
        data = response.json()
        assert data["num_pages"] == 3


class TestHealthCheck:
    """Tests for health check endpoint."""

    def test_health_check(self, test_client):
        """Test the health check endpoint."""
        response = test_client.get("/health")

        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_root_endpoint(self, test_client):
        """Test the root endpoint."""
        response = test_client.get("/")

        assert response.status_code == 200
        assert "service" in response.json()
