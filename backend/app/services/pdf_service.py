import io
import uuid
import json
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from PIL import Image
from pypdf import PdfReader, PdfWriter, PageObject
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, LETTER
from reportlab.lib.units import inch
from reportlab.lib.colors import Color
import pdfplumber
from pdf2image import convert_from_path
import pikepdf

from app.config import (
    UPLOAD_DIR, PROCESSED_DIR, TEMP_DIR,
    THUMBNAIL_SIZE, PREVIEW_DPI, QUALITY_SETTINGS
)


class PDFService:
    """Service for PDF manipulation operations."""

    @staticmethod
    def generate_file_id() -> str:
        """Generate a unique file ID."""
        return str(uuid.uuid4())

    @staticmethod
    def get_pdf_info(file_path: Path) -> Dict[str, Any]:
        """Get information about a PDF file."""
        reader = PdfReader(file_path)
        info = {
            "num_pages": len(reader.pages),
            "metadata": {},
            "page_sizes": []
        }

        # Extract metadata
        if reader.metadata:
            info["metadata"] = {
                "title": reader.metadata.title,
                "author": reader.metadata.author,
                "subject": reader.metadata.subject,
                "creator": reader.metadata.creator,
            }

        # Get page sizes
        for page in reader.pages:
            box = page.mediabox
            info["page_sizes"].append({
                "width": float(box.width),
                "height": float(box.height)
            })

        return info

    @staticmethod
    def generate_thumbnails(file_path: Path, file_id: str) -> List[str]:
        """Generate thumbnail images for all pages in the PDF."""
        thumbnails_dir = TEMP_DIR / file_id / "thumbnails"
        thumbnails_dir.mkdir(parents=True, exist_ok=True)

        try:
            images = convert_from_path(
                file_path,
                dpi=72,
                size=THUMBNAIL_SIZE
            )

            thumbnail_paths = []
            for i, image in enumerate(images):
                thumb_path = thumbnails_dir / f"page_{i + 1}.png"
                image.save(thumb_path, "PNG", optimize=True)
                thumbnail_paths.append(str(thumb_path))

            return thumbnail_paths
        except Exception as e:
            raise Exception(f"Failed to generate thumbnails: {str(e)}")

    @staticmethod
    def generate_preview(file_path: Path, page_num: int, file_id: str, dpi: int = PREVIEW_DPI) -> Path:
        """Generate a high-quality preview for a specific page."""
        preview_dir = TEMP_DIR / file_id / "previews"
        preview_dir.mkdir(parents=True, exist_ok=True)

        preview_path = preview_dir / f"page_{page_num}_dpi{dpi}.png"

        if preview_path.exists():
            return preview_path

        try:
            images = convert_from_path(
                file_path,
                dpi=dpi,
                first_page=page_num,
                last_page=page_num
            )

            if images:
                images[0].save(preview_path, "PNG", optimize=True)
                return preview_path

            raise Exception("No image generated")
        except Exception as e:
            raise Exception(f"Failed to generate preview: {str(e)}")

    @staticmethod
    def remove_pages(file_path: Path, pages_to_remove: List[int], output_path: Path) -> Path:
        """Remove specified pages from the PDF."""
        reader = PdfReader(file_path)
        writer = PdfWriter()

        total_pages = len(reader.pages)
        pages_to_keep = [i for i in range(total_pages) if (i + 1) not in pages_to_remove]

        for page_idx in pages_to_keep:
            writer.add_page(reader.pages[page_idx])

        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path

    @staticmethod
    def reorder_pages(file_path: Path, new_order: List[int], output_path: Path) -> Path:
        """Reorder pages in the PDF according to new_order (1-indexed)."""
        reader = PdfReader(file_path)
        writer = PdfWriter()

        for page_num in new_order:
            writer.add_page(reader.pages[page_num - 1])

        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path

    @staticmethod
    def merge_pdfs(file_paths: List[Path], output_path: Path) -> Path:
        """Merge multiple PDFs into one."""
        writer = PdfWriter()

        for file_path in file_paths:
            reader = PdfReader(file_path)
            for page in reader.pages:
                writer.add_page(page)

        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path

    @staticmethod
    def split_pdf(
        file_path: Path,
        output_dir: Path,
        mode: str = "individual",
        ranges: Optional[List[Tuple[int, int]]] = None,
        pages_per_file: int = 1
    ) -> List[Path]:
        """
        Split a PDF file.

        Modes:
        - individual: Split into individual pages
        - ranges: Split by specified page ranges
        - count: Split by page count
        """
        reader = PdfReader(file_path)
        total_pages = len(reader.pages)
        output_paths = []

        if mode == "individual":
            for i, page in enumerate(reader.pages):
                writer = PdfWriter()
                writer.add_page(page)
                out_path = output_dir / f"page_{i + 1}.pdf"
                with open(out_path, "wb") as f:
                    writer.write(f)
                output_paths.append(out_path)

        elif mode == "ranges" and ranges:
            for idx, (start, end) in enumerate(ranges):
                writer = PdfWriter()
                for i in range(start - 1, min(end, total_pages)):
                    writer.add_page(reader.pages[i])
                out_path = output_dir / f"pages_{start}-{end}.pdf"
                with open(out_path, "wb") as f:
                    writer.write(f)
                output_paths.append(out_path)

        elif mode == "count":
            for start in range(0, total_pages, pages_per_file):
                writer = PdfWriter()
                end = min(start + pages_per_file, total_pages)
                for i in range(start, end):
                    writer.add_page(reader.pages[i])
                out_path = output_dir / f"pages_{start + 1}-{end}.pdf"
                with open(out_path, "wb") as f:
                    writer.write(f)
                output_paths.append(out_path)

        return output_paths

    @staticmethod
    def rotate_pages(
        file_path: Path,
        output_path: Path,
        pages: List[int],
        rotation: int
    ) -> Path:
        """Rotate specified pages by rotation degrees (90, 180, 270)."""
        reader = PdfReader(file_path)
        writer = PdfWriter()

        for i, page in enumerate(reader.pages):
            if (i + 1) in pages:
                page.rotate(rotation)
            writer.add_page(page)

        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path

    @staticmethod
    def add_blank_page(
        file_path: Path,
        output_path: Path,
        position: int,
        page_size: Tuple[float, float] = A4
    ) -> Path:
        """Insert a blank page at the specified position."""
        reader = PdfReader(file_path)
        writer = PdfWriter()

        # Create blank page
        blank_page = PageObject.create_blank_page(width=page_size[0], height=page_size[1])

        for i, page in enumerate(reader.pages):
            if i + 1 == position:
                writer.add_page(blank_page)
            writer.add_page(page)

        # If position is after all pages
        if position > len(reader.pages):
            writer.add_page(blank_page)

        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path

    @staticmethod
    def image_to_pdf_page(
        image_path: Path,
        page_size: str = "A4",
        fit_mode: str = "fit"  # fit, fill, stretch
    ) -> bytes:
        """Convert an image to a PDF page."""
        # Page sizes
        sizes = {
            "A4": A4,
            "LETTER": LETTER,
            "CUSTOM": None
        }

        page_dims = sizes.get(page_size.upper(), A4)

        # Open image
        img = Image.open(image_path)
        img_width, img_height = img.size

        # Create PDF buffer
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=page_dims)

        page_width, page_height = page_dims

        if fit_mode == "fit":
            # Maintain aspect ratio, fit within page
            ratio = min(page_width / img_width, page_height / img_height)
            new_width = img_width * ratio
            new_height = img_height * ratio
            x = (page_width - new_width) / 2
            y = (page_height - new_height) / 2
        elif fit_mode == "fill":
            # Maintain aspect ratio, fill page (may crop)
            ratio = max(page_width / img_width, page_height / img_height)
            new_width = img_width * ratio
            new_height = img_height * ratio
            x = (page_width - new_width) / 2
            y = (page_height - new_height) / 2
        else:  # stretch
            new_width = page_width
            new_height = page_height
            x, y = 0, 0

        # Save image temporarily for reportlab
        temp_img_path = TEMP_DIR / f"temp_img_{uuid.uuid4()}.png"
        img.save(temp_img_path, "PNG")

        c.drawImage(str(temp_img_path), x, y, new_width, new_height, preserveAspectRatio=True)
        c.save()

        # Clean up temp image
        temp_img_path.unlink(missing_ok=True)

        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def insert_image_as_page(
        file_path: Path,
        image_path: Path,
        output_path: Path,
        position: int,
        page_size: str = "A4"
    ) -> Path:
        """Insert an image as a PDF page at the specified position."""
        reader = PdfReader(file_path)
        writer = PdfWriter()

        # Convert image to PDF
        img_pdf_bytes = PDFService.image_to_pdf_page(image_path, page_size)
        img_reader = PdfReader(io.BytesIO(img_pdf_bytes))
        img_page = img_reader.pages[0]

        for i, page in enumerate(reader.pages):
            if i + 1 == position:
                writer.add_page(img_page)
            writer.add_page(page)

        if position > len(reader.pages):
            writer.add_page(img_page)

        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path

    @staticmethod
    def images_to_pdf(
        image_paths: List[Path],
        output_path: Path,
        page_size: str = "A4"
    ) -> Path:
        """Convert multiple images to a single PDF."""
        writer = PdfWriter()

        for image_path in image_paths:
            img_pdf_bytes = PDFService.image_to_pdf_page(image_path, page_size)
            img_reader = PdfReader(io.BytesIO(img_pdf_bytes))
            writer.add_page(img_reader.pages[0])

        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path

    @staticmethod
    def add_watermark(
        file_path: Path,
        output_path: Path,
        text: Optional[str] = None,
        image_path: Optional[Path] = None,
        position: str = "center",
        opacity: float = 0.3,
        rotation: int = 45,
        pages: Optional[List[int]] = None
    ) -> Path:
        """Add a text or image watermark to the PDF."""
        reader = PdfReader(file_path)
        writer = PdfWriter()

        for i, page in enumerate(reader.pages):
            if pages and (i + 1) not in pages:
                writer.add_page(page)
                continue

            # Get page dimensions
            page_width = float(page.mediabox.width)
            page_height = float(page.mediabox.height)

            # Create watermark
            watermark_buffer = io.BytesIO()
            c = canvas.Canvas(watermark_buffer, pagesize=(page_width, page_height))

            if text:
                c.saveState()
                c.setFillAlpha(opacity)
                c.translate(page_width / 2, page_height / 2)
                c.rotate(rotation)
                c.setFont("Helvetica", 60)
                c.setFillColorRGB(0.5, 0.5, 0.5)
                c.drawCentredString(0, 0, text)
                c.restoreState()

            c.save()
            watermark_buffer.seek(0)

            # Merge watermark with page
            watermark_reader = PdfReader(watermark_buffer)
            watermark_page = watermark_reader.pages[0]
            page.merge_page(watermark_page)
            writer.add_page(page)

        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path

    @staticmethod
    def encrypt_pdf(
        file_path: Path,
        output_path: Path,
        user_password: str,
        owner_password: Optional[str] = None
    ) -> Path:
        """Encrypt a PDF with a password."""
        with pikepdf.open(file_path) as pdf:
            pdf.save(
                output_path,
                encryption=pikepdf.Encryption(
                    user=user_password,
                    owner=owner_password or user_password,
                    R=6  # AES-256 encryption
                )
            )
        return output_path

    @staticmethod
    def extract_text(file_path: Path, pages: Optional[List[int]] = None) -> Dict[int, str]:
        """Extract text from PDF pages."""
        text_by_page = {}

        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                if pages and (i + 1) not in pages:
                    continue
                text_by_page[i + 1] = page.extract_text() or ""

        return text_by_page

    @staticmethod
    def extract_tables(file_path: Path, pages: Optional[List[int]] = None) -> Dict[int, List]:
        """Extract tables from PDF pages."""
        tables_by_page = {}

        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                if pages and (i + 1) not in pages:
                    continue
                tables = page.extract_tables()
                if tables:
                    tables_by_page[i + 1] = tables

        return tables_by_page

    @staticmethod
    def extract_images(file_path: Path, output_dir: Path) -> List[Path]:
        """Extract all images from a PDF."""
        output_dir.mkdir(parents=True, exist_ok=True)
        extracted_paths = []

        reader = PdfReader(file_path)

        for page_num, page in enumerate(reader.pages):
            if "/XObject" in page["/Resources"]:
                x_objects = page["/Resources"]["/XObject"].get_object()

                for obj_name in x_objects:
                    obj = x_objects[obj_name]

                    if obj["/Subtype"] == "/Image":
                        try:
                            # Extract image data
                            size = (obj["/Width"], obj["/Height"])
                            data = obj.get_data()

                            if obj["/ColorSpace"] == "/DeviceRGB":
                                mode = "RGB"
                            else:
                                mode = "P"

                            img = Image.frombytes(mode, size, data)
                            img_path = output_dir / f"page{page_num + 1}_{obj_name[1:]}.png"
                            img.save(img_path)
                            extracted_paths.append(img_path)
                        except Exception:
                            # Skip images that can't be extracted
                            continue

        return extracted_paths

    @staticmethod
    def add_annotations_to_pdf(
        file_path: Path,
        output_path: Path,
        annotations: Dict[int, List[Dict]],
        quality: str = "high"
    ) -> Path:
        """
        Add annotations to a PDF.

        annotations format: {
            page_number: [
                {
                    "type": "pen" | "highlighter",
                    "points": [[x, y], ...],
                    "color": "#RRGGBB",
                    "width": float,
                    "opacity": float
                },
                {
                    "type": "text",
                    "text": "string",
                    "x": float,
                    "y": float,
                    "fontSize": int,
                    "fontFamily": str,
                    "color": "#RRGGBB",
                    "bold": bool,
                    "italic": bool,
                    "underline": bool
                },
                ...
            ]
        }
        """
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.lib.fonts import addMapping

        reader = PdfReader(file_path)
        writer = PdfWriter()

        settings = QUALITY_SETTINGS.get(quality, QUALITY_SETTINGS["high"])

        # Font mapping for common fonts
        font_mapping = {
            "Arial": "Helvetica",
            "Helvetica": "Helvetica",
            "Times New Roman": "Times-Roman",
            "Georgia": "Times-Roman",
            "Verdana": "Helvetica",
            "Courier New": "Courier",
            "Courier": "Courier",
        }

        for i, page in enumerate(reader.pages):
            page_num = i + 1

            if page_num in annotations and annotations[page_num]:
                # Get page dimensions
                page_width = float(page.mediabox.width)
                page_height = float(page.mediabox.height)

                # Create annotation layer
                annotation_buffer = io.BytesIO()
                c = canvas.Canvas(annotation_buffer, pagesize=(page_width, page_height))

                for annotation in annotations[page_num]:
                    ann_type = annotation.get("type", "pen")

                    if ann_type == "text":
                        # Handle text annotation
                        text = annotation.get("text", "")
                        if not text:
                            continue

                        x = annotation.get("x", 0)
                        y = annotation.get("y", 0)
                        font_size = annotation.get("fontSize", 16)
                        font_family = annotation.get("fontFamily", "Arial")
                        color_hex = annotation.get("color", "#000000").lstrip("#")
                        bold = annotation.get("bold", False)
                        italic = annotation.get("italic", False)
                        underline = annotation.get("underline", False)

                        # Parse color
                        r = int(color_hex[0:2], 16) / 255
                        g = int(color_hex[2:4], 16) / 255
                        b = int(color_hex[4:6], 16) / 255

                        # Map font family
                        base_font = font_mapping.get(font_family, "Helvetica")

                        # Apply bold/italic variants
                        if base_font == "Helvetica":
                            if bold and italic:
                                font_name = "Helvetica-BoldOblique"
                            elif bold:
                                font_name = "Helvetica-Bold"
                            elif italic:
                                font_name = "Helvetica-Oblique"
                            else:
                                font_name = "Helvetica"
                        elif base_font == "Times-Roman":
                            if bold and italic:
                                font_name = "Times-BoldItalic"
                            elif bold:
                                font_name = "Times-Bold"
                            elif italic:
                                font_name = "Times-Italic"
                            else:
                                font_name = "Times-Roman"
                        elif base_font == "Courier":
                            if bold and italic:
                                font_name = "Courier-BoldOblique"
                            elif bold:
                                font_name = "Courier-Bold"
                            elif italic:
                                font_name = "Courier-Oblique"
                            else:
                                font_name = "Courier"
                        else:
                            font_name = base_font

                        c.saveState()
                        c.setFillColorRGB(r, g, b)
                        c.setFont(font_name, font_size)

                        # Convert y coordinate (PDF origin is bottom-left)
                        pdf_y = page_height - y - font_size

                        # Handle multi-line text
                        lines = text.split('\n')
                        for line_idx, line in enumerate(lines):
                            line_y = pdf_y - (line_idx * font_size * 1.2)
                            c.drawString(x, line_y, line)

                            # Draw underline if needed
                            if underline and line:
                                text_width = c.stringWidth(line, font_name, font_size)
                                c.setStrokeColorRGB(r, g, b)
                                c.setLineWidth(1)
                                c.line(x, line_y - 2, x + text_width, line_y - 2)

                        c.restoreState()
                    else:
                        # Handle pen/highlighter annotation
                        points = annotation.get("points", [])
                        color_hex = annotation.get("color", "#000000")
                        width = annotation.get("width", 2)
                        opacity = annotation.get("opacity", 1.0)

                        if not points or len(points) < 2:
                            continue

                        # Parse color
                        color_hex = color_hex.lstrip("#")
                        r = int(color_hex[0:2], 16) / 255
                        g = int(color_hex[2:4], 16) / 255
                        b = int(color_hex[4:6], 16) / 255

                        c.saveState()

                        if ann_type == "highlighter":
                            c.setStrokeAlpha(opacity)
                            c.setFillAlpha(opacity)
                        else:
                            c.setStrokeAlpha(opacity)

                        c.setStrokeColorRGB(r, g, b)
                        c.setLineWidth(width)
                        c.setLineCap(1)  # Round cap
                        c.setLineJoin(1)  # Round join

                        # Draw path
                        path = c.beginPath()
                        path.moveTo(points[0][0], page_height - points[0][1])

                        for point in points[1:]:
                            path.lineTo(point[0], page_height - point[1])

                        c.drawPath(path, stroke=1, fill=0)
                        c.restoreState()

                c.save()
                annotation_buffer.seek(0)

                # Merge annotation with page
                annotation_reader = PdfReader(annotation_buffer)
                annotation_page = annotation_reader.pages[0]
                page.merge_page(annotation_page)

            writer.add_page(page)

        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path

    @staticmethod
    def get_form_fields(file_path: Path) -> Dict[str, Any]:
        """Get all form fields from a PDF."""
        fields = {}

        try:
            reader = PdfReader(file_path)

            if reader.get_fields():
                for field_name, field_data in reader.get_fields().items():
                    field_type = field_data.get('/FT', '')
                    field_value = field_data.get('/V', '')

                    # Convert field type to readable format
                    type_map = {
                        '/Tx': 'text',
                        '/Btn': 'checkbox',
                        '/Ch': 'choice',
                        '/Sig': 'signature'
                    }

                    fields[field_name] = {
                        'type': type_map.get(str(field_type), 'unknown'),
                        'value': str(field_value) if field_value else '',
                        'name': field_name,
                        'readonly': bool(field_data.get('/Ff', 0) & 1)
                    }

                    # Get options for choice fields
                    if field_type == '/Ch':
                        options = field_data.get('/Opt', [])
                        fields[field_name]['options'] = [str(o) for o in options]

        except Exception as e:
            # PDF might not have form fields
            pass

        return fields

    @staticmethod
    def fill_form_fields(
        file_path: Path,
        output_path: Path,
        field_values: Dict[str, str]
    ) -> Path:
        """Fill form fields in a PDF."""
        reader = PdfReader(file_path)
        writer = PdfWriter()

        # Clone the PDF
        writer.append(reader)

        # Update form fields
        if writer.pages:
            writer.update_page_form_field_values(
                writer.pages[0],
                field_values
            )

        with open(output_path, "wb") as f:
            writer.write(f)

        return output_path

    @staticmethod
    def get_metadata(file_path: Path) -> Dict[str, Any]:
        """Get PDF metadata."""
        metadata = {
            'title': '',
            'author': '',
            'subject': '',
            'keywords': '',
            'creator': '',
            'producer': '',
            'creation_date': '',
            'modification_date': ''
        }

        try:
            reader = PdfReader(file_path)
            if reader.metadata:
                metadata['title'] = reader.metadata.title or ''
                metadata['author'] = reader.metadata.author or ''
                metadata['subject'] = reader.metadata.subject or ''
                metadata['creator'] = reader.metadata.creator or ''
                metadata['producer'] = reader.metadata.producer or ''

                # Handle creation date
                if reader.metadata.creation_date:
                    metadata['creation_date'] = str(reader.metadata.creation_date)

                # Handle modification date
                if reader.metadata.modification_date:
                    metadata['modification_date'] = str(reader.metadata.modification_date)

            # Try to get keywords from XMP metadata
            with pikepdf.open(file_path) as pdf:
                if pdf.docinfo:
                    keywords = pdf.docinfo.get('/Keywords', '')
                    if keywords:
                        metadata['keywords'] = str(keywords)

        except Exception:
            pass

        return metadata

    @staticmethod
    def update_metadata(
        file_path: Path,
        output_path: Path,
        metadata: Dict[str, str]
    ) -> Path:
        """Update PDF metadata."""
        with pikepdf.open(file_path) as pdf:
            with pdf.open_metadata() as meta:
                if metadata.get('title'):
                    meta['dc:title'] = metadata['title']
                if metadata.get('author'):
                    meta['dc:creator'] = [metadata['author']]
                if metadata.get('subject'):
                    meta['dc:description'] = metadata['subject']
                if metadata.get('keywords'):
                    meta['pdf:Keywords'] = metadata['keywords']

            # Also update docinfo for compatibility
            if metadata.get('title'):
                pdf.docinfo['/Title'] = metadata['title']
            if metadata.get('author'):
                pdf.docinfo['/Author'] = metadata['author']
            if metadata.get('subject'):
                pdf.docinfo['/Subject'] = metadata['subject']
            if metadata.get('keywords'):
                pdf.docinfo['/Keywords'] = metadata['keywords']

            pdf.save(output_path)

        return output_path

    @staticmethod
    def compare_pdfs(
        file_path1: Path,
        file_path2: Path,
        page_num: int,
        output_dir: Path
    ) -> Tuple[Path, Path]:
        """Generate comparison images for two PDFs at a specific page."""
        output_dir.mkdir(parents=True, exist_ok=True)

        # Generate images for both PDFs
        images1 = convert_from_path(
            file_path1,
            dpi=150,
            first_page=page_num,
            last_page=page_num
        )

        images2 = convert_from_path(
            file_path2,
            dpi=150,
            first_page=page_num,
            last_page=page_num
        )

        path1 = output_dir / f"before_page_{page_num}.png"
        path2 = output_dir / f"after_page_{page_num}.png"

        if images1:
            images1[0].save(path1, "PNG")
        if images2:
            images2[0].save(path2, "PNG")

        return path1, path2


# Create singleton instance
pdf_service = PDFService()
