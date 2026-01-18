"""
PDF Digital Signature Service

Provides functionality for adding digital signatures to PDF documents.
Uses pyHanko for cryptographic signatures.
"""

import io
import uuid
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color
from pypdf import PdfReader, PdfWriter

try:
    from pyhanko.sign import signers, fields
    from pyhanko.sign.general import load_cert_from_pemder
    from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
    from pyhanko import stamp
    from pyhanko.pdf_utils.reader import PdfFileReader
    PYHANKO_AVAILABLE = True
except ImportError:
    PYHANKO_AVAILABLE = False

from app.config import TEMP_DIR


class SignatureService:
    """Service for handling PDF digital signatures."""

    @staticmethod
    def is_available() -> bool:
        """Check if digital signature functionality is available."""
        return PYHANKO_AVAILABLE

    @staticmethod
    def create_visual_signature(
        output_path: Path,
        signature_image: Optional[bytes] = None,
        name: str = "",
        reason: str = "",
        location: str = "",
        width: float = 200,
        height: float = 50
    ) -> Path:
        """
        Create a visual signature appearance (without cryptographic signing).
        This creates a visual representation that can be added to a PDF.
        """
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=(width, height))

        # Draw signature box
        c.setStrokeColorRGB(0.2, 0.2, 0.2)
        c.setLineWidth(1)
        c.rect(0, 0, width, height)

        # Add signature text
        c.setFillColorRGB(0.1, 0.1, 0.4)
        c.setFont("Helvetica-Bold", 10)

        y_pos = height - 15
        if name:
            c.drawString(10, y_pos, f"Signed by: {name}")
            y_pos -= 12

        if reason:
            c.setFont("Helvetica", 8)
            c.drawString(10, y_pos, f"Reason: {reason}")
            y_pos -= 10

        if location:
            c.setFont("Helvetica", 8)
            c.drawString(10, y_pos, f"Location: {location}")
            y_pos -= 10

        # Add timestamp
        c.setFont("Helvetica", 7)
        c.drawString(10, y_pos, f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        c.save()
        buffer.seek(0)

        with open(output_path, 'wb') as f:
            f.write(buffer.getvalue())

        return output_path

    @staticmethod
    def add_visual_signature_to_pdf(
        file_path: Path,
        output_path: Path,
        page_num: int,
        x: float,
        y: float,
        name: str = "",
        reason: str = "",
        location: str = "",
        signature_data: Optional[Dict[str, Any]] = None
    ) -> Path:
        """
        Add a visual signature to a specific page of a PDF.

        Args:
            file_path: Path to the input PDF
            output_path: Path for the output PDF
            page_num: Page number to add signature (1-indexed)
            x: X coordinate for signature placement
            y: Y coordinate for signature placement
            name: Signer's name
            reason: Reason for signing
            location: Location of signing
            signature_data: Optional dict with signature drawing data
        """
        reader = PdfReader(file_path)
        writer = PdfWriter()

        # Get page dimensions
        target_page = reader.pages[page_num - 1]
        page_height = float(target_page.mediabox.height)
        page_width = float(target_page.mediabox.width)

        # Create signature appearance
        sig_width = 200
        sig_height = 60

        sig_buffer = io.BytesIO()
        c = canvas.Canvas(sig_buffer, pagesize=(sig_width, sig_height))

        # Draw signature box with border
        c.setStrokeColorRGB(0.3, 0.3, 0.6)
        c.setLineWidth(1.5)
        c.rect(2, 2, sig_width - 4, sig_height - 4)

        # Draw signature content
        if signature_data and 'points' in signature_data:
            # Draw the signature path
            points = signature_data['points']
            if len(points) > 1:
                c.setStrokeColorRGB(0.1, 0.1, 0.3)
                c.setLineWidth(1.5)
                path = c.beginPath()

                # Scale points to fit within signature box
                min_x = min(p[0] for p in points)
                max_x = max(p[0] for p in points)
                min_y = min(p[1] for p in points)
                max_y = max(p[1] for p in points)

                scale_x = (sig_width - 20) / max(max_x - min_x, 1)
                scale_y = (sig_height - 30) / max(max_y - min_y, 1)
                scale = min(scale_x, scale_y)

                offset_x = 10
                offset_y = 20

                scaled_points = [
                    ((p[0] - min_x) * scale + offset_x,
                     sig_height - ((p[1] - min_y) * scale + offset_y))
                    for p in points
                ]

                path.moveTo(scaled_points[0][0], scaled_points[0][1])
                for px, py in scaled_points[1:]:
                    path.lineTo(px, py)
                c.drawPath(path, stroke=1, fill=0)

        # Add text info
        c.setFillColorRGB(0.2, 0.2, 0.4)
        c.setFont("Helvetica", 7)

        text_y = 12
        if name:
            c.drawString(10, text_y, f"Signed by: {name}")

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')
        c.drawString(sig_width - 80, text_y, timestamp)

        c.save()
        sig_buffer.seek(0)

        # Merge signature with PDF
        sig_reader = PdfReader(sig_buffer)
        sig_page = sig_reader.pages[0]

        for i, page in enumerate(reader.pages):
            if i == page_num - 1:
                # Calculate position (convert y from top-left to bottom-left)
                adjusted_y = page_height - y - sig_height

                # Create a transformation to position the signature
                sig_page_copy = sig_reader.pages[0]

                # Merge the signature onto the page at the specified position
                page.merge_transformed_page(
                    sig_page_copy,
                    (1, 0, 0, 1, x, adjusted_y)
                )

            writer.add_page(page)

        with open(output_path, 'wb') as f:
            writer.write(f)

        return output_path

    @staticmethod
    def get_signature_info(file_path: Path) -> Dict[str, Any]:
        """
        Get information about existing signatures in a PDF.
        """
        result = {
            'has_signatures': False,
            'signatures': [],
            'is_certified': False
        }

        try:
            reader = PdfReader(file_path)

            # Check for signature fields
            if reader.get_fields():
                for field_name, field in reader.get_fields().items():
                    field_type = field.get('/FT', '')
                    if str(field_type) == '/Sig':
                        result['has_signatures'] = True
                        sig_info = {
                            'field_name': field_name,
                            'is_signed': bool(field.get('/V')),
                        }
                        result['signatures'].append(sig_info)
        except Exception:
            pass

        return result


# Create singleton instance
signature_service = SignatureService()
