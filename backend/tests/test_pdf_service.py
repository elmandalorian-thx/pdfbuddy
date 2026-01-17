import pytest
from pathlib import Path
from pypdf import PdfReader

from app.services.pdf_service import pdf_service


class TestPDFService:
    """Tests for the PDF service."""

    def test_get_pdf_info(self, sample_pdf):
        """Test getting PDF information."""
        info = pdf_service.get_pdf_info(sample_pdf)

        assert info["num_pages"] == 3
        assert len(info["page_sizes"]) == 3
        assert info["page_sizes"][0]["width"] > 0
        assert info["page_sizes"][0]["height"] > 0

    def test_generate_file_id(self):
        """Test file ID generation."""
        id1 = pdf_service.generate_file_id()
        id2 = pdf_service.generate_file_id()

        assert id1 != id2
        assert len(id1) == 36  # UUID format

    def test_remove_pages(self, sample_pdf, temp_dir):
        """Test removing pages from PDF."""
        output_path = temp_dir / "output.pdf"

        result = pdf_service.remove_pages(sample_pdf, [2], output_path)

        assert result.exists()
        reader = PdfReader(result)
        assert len(reader.pages) == 2

    def test_remove_multiple_pages(self, multi_page_pdf, temp_dir):
        """Test removing multiple pages."""
        output_path = temp_dir / "output.pdf"

        result = pdf_service.remove_pages(multi_page_pdf, [1, 3, 5], output_path)

        reader = PdfReader(result)
        assert len(reader.pages) == 2

    def test_reorder_pages(self, sample_pdf, temp_dir):
        """Test reordering pages."""
        output_path = temp_dir / "output.pdf"

        # Reverse the order: [3, 2, 1]
        result = pdf_service.reorder_pages(sample_pdf, [3, 2, 1], output_path)

        assert result.exists()
        reader = PdfReader(result)
        assert len(reader.pages) == 3

    def test_rotate_pages(self, sample_pdf, temp_dir):
        """Test rotating pages."""
        output_path = temp_dir / "output.pdf"

        result = pdf_service.rotate_pages(sample_pdf, output_path, [1], 90)

        assert result.exists()
        reader = PdfReader(result)
        # Check rotation was applied
        page = reader.pages[0]
        assert page.get('/Rotate') == 90 or page.mediabox.width != page.mediabox.height

    def test_merge_pdfs(self, sample_pdf, multi_page_pdf, temp_dir):
        """Test merging PDFs."""
        output_path = temp_dir / "merged.pdf"

        result = pdf_service.merge_pdfs([sample_pdf, multi_page_pdf], output_path)

        assert result.exists()
        reader = PdfReader(result)
        assert len(reader.pages) == 8  # 3 + 5

    def test_split_pdf_individual(self, sample_pdf, temp_dir):
        """Test splitting PDF into individual pages."""
        output_dir = temp_dir / "split"
        output_dir.mkdir()

        results = pdf_service.split_pdf(sample_pdf, output_dir, mode="individual")

        assert len(results) == 3
        for path in results:
            assert path.exists()
            reader = PdfReader(path)
            assert len(reader.pages) == 1

    def test_split_pdf_by_count(self, multi_page_pdf, temp_dir):
        """Test splitting PDF by page count."""
        output_dir = temp_dir / "split"
        output_dir.mkdir()

        results = pdf_service.split_pdf(
            multi_page_pdf, output_dir, mode="count", pages_per_file=2
        )

        assert len(results) == 3  # 5 pages / 2 = 3 files (2, 2, 1)

    def test_add_blank_page(self, sample_pdf, temp_dir):
        """Test adding a blank page."""
        output_path = temp_dir / "output.pdf"

        result = pdf_service.add_blank_page(sample_pdf, output_path, position=2)

        assert result.exists()
        reader = PdfReader(result)
        assert len(reader.pages) == 4

    def test_image_to_pdf_page(self, sample_image):
        """Test converting an image to a PDF page."""
        pdf_bytes = pdf_service.image_to_pdf_page(sample_image, "A4")

        assert len(pdf_bytes) > 0
        # Verify it's valid PDF
        from io import BytesIO
        reader = PdfReader(BytesIO(pdf_bytes))
        assert len(reader.pages) == 1

    def test_images_to_pdf(self, sample_image, sample_jpeg, temp_dir):
        """Test converting multiple images to PDF."""
        output_path = temp_dir / "images.pdf"

        result = pdf_service.images_to_pdf(
            [sample_image, sample_jpeg], output_path
        )

        assert result.exists()
        reader = PdfReader(result)
        assert len(reader.pages) == 2

    def test_insert_image_as_page(self, sample_pdf, sample_image, temp_dir):
        """Test inserting an image as a PDF page."""
        output_path = temp_dir / "output.pdf"

        result = pdf_service.insert_image_as_page(
            sample_pdf, sample_image, output_path, position=2
        )

        assert result.exists()
        reader = PdfReader(result)
        assert len(reader.pages) == 4

    def test_add_watermark(self, sample_pdf, temp_dir):
        """Test adding a watermark."""
        output_path = temp_dir / "watermarked.pdf"

        result = pdf_service.add_watermark(
            sample_pdf, output_path, text="CONFIDENTIAL", opacity=0.5
        )

        assert result.exists()
        reader = PdfReader(result)
        assert len(reader.pages) == 3

    def test_encrypt_pdf(self, sample_pdf, temp_dir):
        """Test encrypting a PDF."""
        output_path = temp_dir / "encrypted.pdf"

        result = pdf_service.encrypt_pdf(
            sample_pdf, output_path, user_password="test123"
        )

        assert result.exists()
        # Try to open without password should require decryption
        reader = PdfReader(result)
        assert reader.is_encrypted

    def test_extract_text(self, sample_pdf):
        """Test extracting text from PDF."""
        text = pdf_service.extract_text(sample_pdf)

        assert len(text) == 3
        assert "Test PDF" in text[1]
        assert "Page 1" in text[1]

    def test_extract_text_specific_pages(self, sample_pdf):
        """Test extracting text from specific pages."""
        text = pdf_service.extract_text(sample_pdf, pages=[1, 3])

        assert 1 in text
        assert 3 in text
        assert 2 not in text

    def test_get_metadata(self, sample_pdf):
        """Test getting PDF metadata."""
        metadata = pdf_service.get_metadata(sample_pdf)

        assert 'title' in metadata
        assert 'author' in metadata
        assert 'subject' in metadata
        assert 'keywords' in metadata

    def test_update_metadata(self, sample_pdf, temp_dir):
        """Test updating PDF metadata."""
        output_path = temp_dir / "updated.pdf"

        result = pdf_service.update_metadata(
            sample_pdf, output_path,
            {
                'title': 'Test Document',
                'author': 'Test Author',
                'subject': 'Testing',
                'keywords': 'test, pdf, sample'
            }
        )

        assert result.exists()

        # Verify metadata was updated
        metadata = pdf_service.get_metadata(result)
        assert metadata['title'] == 'Test Document'
        assert metadata['author'] == 'Test Author'

    def test_add_annotations_to_pdf(self, sample_pdf, temp_dir):
        """Test adding annotations to PDF."""
        output_path = temp_dir / "annotated.pdf"

        annotations = {
            1: [
                {
                    "type": "pen",
                    "points": [[100, 100], [150, 150], [200, 100]],
                    "color": "#FF0000",
                    "width": 2,
                    "opacity": 1.0
                }
            ]
        }

        result = pdf_service.add_annotations_to_pdf(
            sample_pdf, output_path, annotations
        )

        assert result.exists()
        reader = PdfReader(result)
        assert len(reader.pages) == 3
