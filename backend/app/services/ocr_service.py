"""
OCR Service for PDF Buddy

Provides optical character recognition functionality for scanned PDFs.
Uses pytesseract for text extraction.
"""

import io
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from PIL import Image
from pdf2image import convert_from_path
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False

from app.config import TEMP_DIR, PROCESSED_DIR


class OCRService:
    """Service for OCR processing of PDF documents."""

    # Supported languages
    SUPPORTED_LANGUAGES = {
        'eng': 'English',
        'fra': 'French',
        'deu': 'German',
        'spa': 'Spanish',
        'ita': 'Italian',
        'por': 'Portuguese',
        'nld': 'Dutch',
        'rus': 'Russian',
        'jpn': 'Japanese',
        'chi_sim': 'Chinese (Simplified)',
        'chi_tra': 'Chinese (Traditional)',
        'kor': 'Korean',
        'ara': 'Arabic',
    }

    @staticmethod
    def is_available() -> bool:
        """Check if OCR functionality is available."""
        if not TESSERACT_AVAILABLE:
            return False

        try:
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    @staticmethod
    def get_supported_languages() -> Dict[str, str]:
        """Get dictionary of supported OCR languages."""
        return OCRService.SUPPORTED_LANGUAGES.copy()

    @staticmethod
    def extract_text_from_image(
        image: Image.Image,
        language: str = 'eng',
        config: str = ''
    ) -> str:
        """
        Extract text from a PIL Image using OCR.

        Args:
            image: PIL Image object
            language: Tesseract language code
            config: Additional Tesseract configuration

        Returns:
            Extracted text string
        """
        if not TESSERACT_AVAILABLE:
            raise RuntimeError("Tesseract OCR is not available")

        try:
            text = pytesseract.image_to_string(image, lang=language, config=config)
            return text.strip()
        except Exception as e:
            raise RuntimeError(f"OCR processing failed: {str(e)}")

    @staticmethod
    def extract_text_from_pdf(
        file_path: Path,
        language: str = 'eng',
        pages: Optional[List[int]] = None,
        dpi: int = 300
    ) -> Dict[int, str]:
        """
        Extract text from a scanned PDF using OCR.

        Args:
            file_path: Path to the PDF file
            language: Tesseract language code
            pages: List of page numbers to process (1-indexed), None for all
            dpi: DPI for PDF to image conversion

        Returns:
            Dictionary mapping page numbers to extracted text
        """
        if not TESSERACT_AVAILABLE:
            raise RuntimeError("Tesseract OCR is not available")

        result = {}

        try:
            # Convert PDF pages to images
            images = convert_from_path(file_path, dpi=dpi)

            for i, image in enumerate(images):
                page_num = i + 1

                # Skip if specific pages requested and this isn't one
                if pages and page_num not in pages:
                    continue

                # Extract text using OCR
                text = pytesseract.image_to_string(image, lang=language)
                result[page_num] = text.strip()

            return result
        except Exception as e:
            raise RuntimeError(f"OCR processing failed: {str(e)}")

    @staticmethod
    def create_searchable_pdf(
        file_path: Path,
        output_path: Path,
        language: str = 'eng',
        pages: Optional[List[int]] = None,
        dpi: int = 300
    ) -> Path:
        """
        Create a searchable PDF by adding OCR text layer to a scanned PDF.

        This creates a PDF where the original images are preserved but
        searchable/selectable text is added as an invisible layer.

        Args:
            file_path: Path to the input PDF
            output_path: Path for the output PDF
            language: Tesseract language code
            pages: List of page numbers to process (1-indexed), None for all
            dpi: DPI for processing

        Returns:
            Path to the output PDF
        """
        if not TESSERACT_AVAILABLE:
            raise RuntimeError("Tesseract OCR is not available")

        try:
            # Convert PDF pages to images
            images = convert_from_path(file_path, dpi=dpi)

            # Create output PDF writer
            writer = PdfWriter()

            for i, image in enumerate(images):
                page_num = i + 1

                # Get page dimensions
                width, height = image.size
                page_width = width * 72 / dpi
                page_height = height * 72 / dpi

                # Create a page with the image
                img_buffer = io.BytesIO()
                image.save(img_buffer, format='PNG')
                img_buffer.seek(0)

                # Create PDF page with image
                page_buffer = io.BytesIO()
                c = canvas.Canvas(page_buffer, pagesize=(page_width, page_height))

                # Draw the image
                temp_img_path = TEMP_DIR / f"ocr_temp_{i}.png"
                image.save(temp_img_path)
                c.drawImage(str(temp_img_path), 0, 0, width=page_width, height=page_height)

                # If OCR is requested for this page, add invisible text layer
                if pages is None or page_num in pages:
                    try:
                        # Get OCR data with bounding boxes
                        ocr_data = pytesseract.image_to_data(
                            image, lang=language, output_type=pytesseract.Output.DICT
                        )

                        # Add invisible text
                        c.setFillAlpha(0)  # Make text invisible

                        for j, text in enumerate(ocr_data['text']):
                            if text.strip():
                                x = ocr_data['left'][j] * 72 / dpi
                                y = page_height - (ocr_data['top'][j] + ocr_data['height'][j]) * 72 / dpi
                                font_size = max(ocr_data['height'][j] * 72 / dpi * 0.8, 6)

                                c.setFont("Helvetica", font_size)
                                c.drawString(x, y, text)
                    except Exception:
                        # If OCR fails for a page, continue without text layer
                        pass

                c.save()
                page_buffer.seek(0)

                # Clean up temp image
                temp_img_path.unlink(missing_ok=True)

                # Add page to writer
                page_reader = PdfReader(page_buffer)
                writer.add_page(page_reader.pages[0])

            # Write output
            with open(output_path, 'wb') as f:
                writer.write(f)

            return output_path
        except Exception as e:
            raise RuntimeError(f"Failed to create searchable PDF: {str(e)}")

    @staticmethod
    def get_ocr_data(
        file_path: Path,
        page_num: int,
        language: str = 'eng',
        dpi: int = 300
    ) -> Dict[str, Any]:
        """
        Get detailed OCR data including word bounding boxes for a specific page.

        Args:
            file_path: Path to the PDF file
            page_num: Page number (1-indexed)
            language: Tesseract language code
            dpi: DPI for PDF to image conversion

        Returns:
            Dictionary with OCR data including text and bounding boxes
        """
        if not TESSERACT_AVAILABLE:
            raise RuntimeError("Tesseract OCR is not available")

        try:
            # Convert specific page to image
            images = convert_from_path(
                file_path,
                dpi=dpi,
                first_page=page_num,
                last_page=page_num
            )

            if not images:
                raise RuntimeError(f"Failed to convert page {page_num}")

            image = images[0]

            # Get OCR data with all details
            ocr_data = pytesseract.image_to_data(
                image, lang=language, output_type=pytesseract.Output.DICT
            )

            # Process and format the data
            words = []
            for i, text in enumerate(ocr_data['text']):
                if text.strip():
                    words.append({
                        'text': text,
                        'left': ocr_data['left'][i],
                        'top': ocr_data['top'][i],
                        'width': ocr_data['width'][i],
                        'height': ocr_data['height'][i],
                        'confidence': ocr_data['conf'][i]
                    })

            # Get full text
            full_text = pytesseract.image_to_string(image, lang=language)

            return {
                'page': page_num,
                'full_text': full_text.strip(),
                'words': words,
                'image_width': image.width,
                'image_height': image.height
            }
        except Exception as e:
            raise RuntimeError(f"OCR data extraction failed: {str(e)}")


# Create singleton instance
ocr_service = OCRService()
