import pytest
import os
import tempfile
import shutil
from pathlib import Path
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from PIL import Image

from app.main import app
from app.config import UPLOAD_DIR, PROCESSED_DIR, TEMP_DIR


@pytest.fixture(scope="session")
def test_client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture(scope="function")
def temp_dir():
    """Create a temporary directory for test files."""
    temp = tempfile.mkdtemp()
    yield Path(temp)
    shutil.rmtree(temp, ignore_errors=True)


@pytest.fixture
def sample_pdf(temp_dir):
    """Create a sample PDF file for testing."""
    pdf_path = temp_dir / "sample.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=A4)

    # Page 1
    c.drawString(100, 700, "Test PDF - Page 1")
    c.drawString(100, 680, "This is a sample PDF for testing.")
    c.showPage()

    # Page 2
    c.drawString(100, 700, "Test PDF - Page 2")
    c.drawString(100, 680, "Second page content.")
    c.showPage()

    # Page 3
    c.drawString(100, 700, "Test PDF - Page 3")
    c.showPage()

    c.save()
    return pdf_path


@pytest.fixture
def sample_pdf_with_form(temp_dir):
    """Create a sample PDF with form fields."""
    from pypdf import PdfWriter
    from pypdf.generic import NameObject, DictionaryObject, ArrayObject, TextStringObject

    pdf_path = temp_dir / "sample_form.pdf"

    # Create a simple PDF first
    c = canvas.Canvas(str(temp_dir / "temp.pdf"), pagesize=A4)
    c.drawString(100, 700, "Form PDF")
    c.save()

    # Add form fields
    writer = PdfWriter()
    writer.append(str(temp_dir / "temp.pdf"))

    writer.add_js("// Form ready")

    with open(pdf_path, "wb") as f:
        writer.write(f)

    return pdf_path


@pytest.fixture
def sample_image(temp_dir):
    """Create a sample image file for testing."""
    img_path = temp_dir / "sample.png"
    img = Image.new('RGB', (200, 300), color='red')
    img.save(img_path)
    return img_path


@pytest.fixture
def sample_jpeg(temp_dir):
    """Create a sample JPEG image for testing."""
    img_path = temp_dir / "sample.jpg"
    img = Image.new('RGB', (400, 600), color='blue')
    img.save(img_path, 'JPEG')
    return img_path


@pytest.fixture
def multi_page_pdf(temp_dir):
    """Create a multi-page PDF for testing."""
    pdf_path = temp_dir / "multi_page.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=A4)

    for i in range(5):
        c.drawString(100, 700, f"Page {i + 1}")
        c.showPage()

    c.save()
    return pdf_path


@pytest.fixture(autouse=True)
def cleanup_test_files():
    """Clean up test files after each test."""
    yield
    # Clean up uploaded/processed files created during tests
    for dir_path in [UPLOAD_DIR, PROCESSED_DIR, TEMP_DIR]:
        if dir_path.exists():
            for item in dir_path.iterdir():
                if item.is_dir():
                    shutil.rmtree(item, ignore_errors=True)
                else:
                    item.unlink(missing_ok=True)
