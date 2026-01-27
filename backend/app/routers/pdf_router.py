import io
import json
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.services.pdf_service import pdf_service
from app.services.file_service import file_service
from app.services.signature_service import signature_service
from app.services.ocr_service import ocr_service
from app.services.batch_service import batch_service
from app.config import MAX_FILE_SIZE, ALLOWED_PDF_TYPES, ALLOWED_IMAGE_TYPES, TEMP_DIR, PROCESSED_DIR

router = APIRouter(prefix="/api", tags=["pdf"])


# Pydantic models for request/response
class FileUploadResponse(BaseModel):
    file_id: str
    original_name: str
    num_pages: int
    page_sizes: list
    thumbnail_urls: list


class RemovePagesRequest(BaseModel):
    file_id: str
    pages: List[int]


class ReorderPagesRequest(BaseModel):
    file_id: str
    new_order: List[int]


class RotatePagesRequest(BaseModel):
    file_id: str
    pages: List[int]
    rotation: int  # 90, 180, or 270


class SplitPDFRequest(BaseModel):
    file_id: str
    mode: str  # "individual", "ranges", "count"
    ranges: Optional[List[List[int]]] = None  # For ranges mode: [[1, 5], [6, 10]]
    pages_per_file: Optional[int] = 1  # For count mode


class AddBlankPageRequest(BaseModel):
    file_id: str
    position: int
    page_size: str = "A4"


class InsertImageRequest(BaseModel):
    file_id: str
    position: int
    page_size: str = "A4"


class WatermarkRequest(BaseModel):
    file_id: str
    text: Optional[str] = None
    position: str = "center"
    opacity: float = 0.3
    rotation: int = 45
    pages: Optional[List[int]] = None


class EncryptRequest(BaseModel):
    file_id: str
    user_password: str
    owner_password: Optional[str] = None


class ExtractTextRequest(BaseModel):
    file_id: str
    pages: Optional[List[int]] = None
    format: str = "json"  # json, txt, csv


class AnnotationsRequest(BaseModel):
    file_id: str
    annotations: dict  # {page_number: [annotation_objects]}
    quality: str = "high"


# Helper function to parse page ranges
def parse_page_range(range_str: str) -> List[int]:
    """Parse a page range string like '1-5, 8, 10-12' into a list of page numbers."""
    pages = []
    parts = range_str.replace(" ", "").split(",")

    for part in parts:
        if "-" in part:
            start, end = part.split("-")
            pages.extend(range(int(start), int(end) + 1))
        else:
            pages.append(int(part))

    return sorted(set(pages))


@router.post("/upload", response_model=FileUploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a PDF file."""
    # Validate file type
    if file.content_type not in ALLOWED_PDF_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files are allowed.")

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB.")

    # Save file
    file_info = await file_service.save_upload(content, file.filename, file.content_type)
    file_path = Path(file_info["path"])

    # Get PDF info
    pdf_info = pdf_service.get_pdf_info(file_path)

    # Generate thumbnails
    thumbnail_paths = pdf_service.generate_thumbnails(file_path, file_info["id"])
    thumbnail_urls = [f"/api/thumbnail/{file_info['id']}/{i+1}" for i in range(len(thumbnail_paths))]

    return FileUploadResponse(
        file_id=file_info["id"],
        original_name=file_info["original_name"],
        num_pages=pdf_info["num_pages"],
        page_sizes=pdf_info["page_sizes"],
        thumbnail_urls=thumbnail_urls
    )


@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image file."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Supported: JPG, PNG, WEBP, GIF, TIFF.")

    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB.")

    file_info = await file_service.save_upload(content, file.filename, file.content_type)

    return {
        "file_id": file_info["id"],
        "original_name": file_info["original_name"],
        "file_type": "image"
    }


@router.get("/thumbnail/{file_id}/{page_num}")
async def get_thumbnail(file_id: str, page_num: int):
    """Get a thumbnail image for a specific page."""
    thumbnail_path = TEMP_DIR / file_id / "thumbnails" / f"page_{page_num}.png"

    if not thumbnail_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    return FileResponse(thumbnail_path, media_type="image/png")


@router.get("/preview/{file_id}/{page_num}")
async def get_preview(file_id: str, page_num: int, dpi: int = Query(150, ge=72, le=600)):
    """Get a high-quality preview for a specific page."""
    file_info = file_service.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])

    try:
        preview_path = pdf_service.generate_preview(file_path, page_num, file_id, dpi)
        return FileResponse(preview_path, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/remove-pages")
async def remove_pages(request: RemovePagesRequest):
    """Remove specified pages from the PDF."""
    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_path = PROCESSED_DIR / request.file_id / "processed.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        pdf_service.remove_pages(file_path, request.pages, output_path)
        file_service.update_file_path(request.file_id, output_path)

        # Regenerate thumbnails
        pdf_info = pdf_service.get_pdf_info(output_path)
        pdf_service.generate_thumbnails(output_path, request.file_id)
        thumbnail_urls = [f"/api/thumbnail/{request.file_id}/{i+1}" for i in range(pdf_info["num_pages"])]

        return {
            "success": True,
            "file_id": request.file_id,
            "num_pages": pdf_info["num_pages"],
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reorder-pages")
async def reorder_pages(request: ReorderPagesRequest):
    """Reorder pages in the PDF."""
    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_path = PROCESSED_DIR / request.file_id / "processed.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        pdf_service.reorder_pages(file_path, request.new_order, output_path)
        file_service.update_file_path(request.file_id, output_path)

        # Regenerate thumbnails
        pdf_service.generate_thumbnails(output_path, request.file_id)
        thumbnail_urls = [f"/api/thumbnail/{request.file_id}/{i+1}" for i in range(len(request.new_order))]

        return {
            "success": True,
            "file_id": request.file_id,
            "new_order": request.new_order,
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/merge")
async def merge_pdfs(files: List[UploadFile] = File(...)):
    """Merge multiple PDF files into one."""
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least 2 files required for merge")

    temp_paths = []
    try:
        # Save uploaded files temporarily
        for file in files:
            if file.content_type not in ALLOWED_PDF_TYPES:
                raise HTTPException(status_code=400, detail=f"Invalid file type: {file.filename}")

            content = await file.read()
            file_info = await file_service.save_upload(content, file.filename, file.content_type)
            temp_paths.append(Path(file_info["path"]))

        # Generate output file ID
        output_id = file_service.generate_file_id()
        output_path = PROCESSED_DIR / output_id / "merged.pdf"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Merge PDFs
        pdf_service.merge_pdfs(temp_paths, output_path)

        # Register the merged file
        file_service.register_file(output_id, {
            "id": output_id,
            "original_name": "merged.pdf",
            "file_type": "pdf",
            "path": str(output_path)
        })

        # Generate info and thumbnails
        pdf_info = pdf_service.get_pdf_info(output_path)
        pdf_service.generate_thumbnails(output_path, output_id)
        thumbnail_urls = [f"/api/thumbnail/{output_id}/{i+1}" for i in range(pdf_info["num_pages"])]

        return {
            "success": True,
            "file_id": output_id,
            "num_pages": pdf_info["num_pages"],
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AppendPDFRequest(BaseModel):
    file_id: str


@router.post("/append")
async def append_pdf(file_id: str = Form(...), file: UploadFile = File(...)):
    """Append a PDF file to an existing document."""
    # Validate the new file
    if file.content_type not in ALLOWED_PDF_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files are allowed.")

    # Get existing file info
    file_info = file_service.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="Original file not found")

    existing_path = Path(file_info["path"])

    try:
        # Save the new PDF temporarily
        content = await file.read()
        new_file_info = await file_service.save_upload(content, file.filename, file.content_type)
        new_path = Path(new_file_info["path"])

        # Output path
        output_path = PROCESSED_DIR / file_id / "processed.pdf"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Merge the two PDFs
        pdf_service.merge_pdfs([existing_path, new_path], output_path)
        file_service.update_file_path(file_id, output_path)

        # Clean up temporary file
        file_service.delete_file(new_file_info["id"])

        # Regenerate info and thumbnails
        pdf_info = pdf_service.get_pdf_info(output_path)
        pdf_service.generate_thumbnails(output_path, file_id)
        thumbnail_urls = [f"/api/thumbnail/{file_id}/{i+1}" for i in range(pdf_info["num_pages"])]

        return {
            "success": True,
            "file_id": file_id,
            "num_pages": pdf_info["num_pages"],
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/split")
async def split_pdf(request: SplitPDFRequest):
    """Split a PDF into multiple files."""
    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_dir = PROCESSED_DIR / request.file_id / "split"
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        ranges = None
        if request.ranges:
            ranges = [(r[0], r[1]) for r in request.ranges]

        output_paths = pdf_service.split_pdf(
            file_path,
            output_dir,
            mode=request.mode,
            ranges=ranges,
            pages_per_file=request.pages_per_file or 1
        )

        # Generate download URLs for split files
        split_files = []
        for path in output_paths:
            split_id = f"{request.file_id}_split_{path.stem}"
            file_service.register_file(split_id, {
                "id": split_id,
                "original_name": path.name,
                "file_type": "pdf",
                "path": str(path)
            })
            split_files.append({
                "file_id": split_id,
                "filename": path.name,
                "download_url": f"/api/download/{split_id}"
            })

        return {
            "success": True,
            "split_files": split_files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rotate")
async def rotate_pages(request: RotatePagesRequest):
    """Rotate specified pages."""
    if request.rotation not in [90, 180, 270]:
        raise HTTPException(status_code=400, detail="Rotation must be 90, 180, or 270 degrees")

    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_path = PROCESSED_DIR / request.file_id / "processed.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        pdf_service.rotate_pages(file_path, output_path, request.pages, request.rotation)
        file_service.update_file_path(request.file_id, output_path)

        # Regenerate thumbnails
        pdf_info = pdf_service.get_pdf_info(output_path)
        pdf_service.generate_thumbnails(output_path, request.file_id)
        thumbnail_urls = [f"/api/thumbnail/{request.file_id}/{i+1}" for i in range(pdf_info["num_pages"])]

        return {
            "success": True,
            "file_id": request.file_id,
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/add-blank-page")
async def add_blank_page(request: AddBlankPageRequest):
    """Add a blank page at the specified position."""
    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_path = PROCESSED_DIR / request.file_id / "processed.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        pdf_service.add_blank_page(file_path, output_path, request.position)
        file_service.update_file_path(request.file_id, output_path)

        pdf_info = pdf_service.get_pdf_info(output_path)
        pdf_service.generate_thumbnails(output_path, request.file_id)
        thumbnail_urls = [f"/api/thumbnail/{request.file_id}/{i+1}" for i in range(pdf_info["num_pages"])]

        return {
            "success": True,
            "file_id": request.file_id,
            "num_pages": pdf_info["num_pages"],
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/insert-image")
async def insert_image(
    file_id: str = Form(...),
    position: int = Form(...),
    page_size: str = Form("A4"),
    image: UploadFile = File(...)
):
    """Insert an image as a PDF page at the specified position."""
    file_info = file_service.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="PDF file not found")

    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image type")

    file_path = Path(file_info["path"])
    output_path = PROCESSED_DIR / file_id / "processed.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        # Save image temporarily
        image_content = await image.read()
        image_info = await file_service.save_upload(image_content, image.filename, image.content_type)
        image_path = Path(image_info["path"])

        pdf_service.insert_image_as_page(file_path, image_path, output_path, position, page_size)
        file_service.update_file_path(file_id, output_path)

        pdf_info = pdf_service.get_pdf_info(output_path)
        pdf_service.generate_thumbnails(output_path, file_id)
        thumbnail_urls = [f"/api/thumbnail/{file_id}/{i+1}" for i in range(pdf_info["num_pages"])]

        # Clean up temporary image
        file_service.delete_file(image_info["id"])

        return {
            "success": True,
            "file_id": file_id,
            "num_pages": pdf_info["num_pages"],
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image-to-pdf")
async def images_to_pdf(
    files: List[UploadFile] = File(...),
    page_size: str = Form("A4")
):
    """Convert one or more images to a PDF."""
    image_paths = []

    try:
        for file in files:
            if file.content_type not in ALLOWED_IMAGE_TYPES:
                raise HTTPException(status_code=400, detail=f"Invalid image type: {file.filename}")

            content = await file.read()
            file_info = await file_service.save_upload(content, file.filename, file.content_type)
            image_paths.append(Path(file_info["path"]))

        # Generate output
        output_id = file_service.generate_file_id()
        output_path = PROCESSED_DIR / output_id / "converted.pdf"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        pdf_service.images_to_pdf(image_paths, output_path, page_size)

        # Register file
        file_service.register_file(output_id, {
            "id": output_id,
            "original_name": "converted.pdf",
            "file_type": "pdf",
            "path": str(output_path)
        })

        pdf_info = pdf_service.get_pdf_info(output_path)
        pdf_service.generate_thumbnails(output_path, output_id)
        thumbnail_urls = [f"/api/thumbnail/{output_id}/{i+1}" for i in range(pdf_info["num_pages"])]

        return {
            "success": True,
            "file_id": output_id,
            "num_pages": pdf_info["num_pages"],
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/watermark")
async def add_watermark(request: WatermarkRequest):
    """Add a watermark to the PDF."""
    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_path = PROCESSED_DIR / request.file_id / "processed.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        pdf_service.add_watermark(
            file_path,
            output_path,
            text=request.text,
            position=request.position,
            opacity=request.opacity,
            rotation=request.rotation,
            pages=request.pages
        )
        file_service.update_file_path(request.file_id, output_path)

        pdf_info = pdf_service.get_pdf_info(output_path)
        pdf_service.generate_thumbnails(output_path, request.file_id)
        thumbnail_urls = [f"/api/thumbnail/{request.file_id}/{i+1}" for i in range(pdf_info["num_pages"])]

        return {
            "success": True,
            "file_id": request.file_id,
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/encrypt")
async def encrypt_pdf(request: EncryptRequest):
    """Encrypt a PDF with a password."""
    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_path = PROCESSED_DIR / request.file_id / "encrypted.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        pdf_service.encrypt_pdf(
            file_path,
            output_path,
            request.user_password,
            request.owner_password
        )
        file_service.update_file_path(request.file_id, output_path)

        return {
            "success": True,
            "file_id": request.file_id,
            "message": "PDF encrypted successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-text")
async def extract_text(request: ExtractTextRequest):
    """Extract text from PDF pages."""
    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])

    try:
        text_by_page = pdf_service.extract_text(file_path, request.pages)

        if request.format == "txt":
            text_content = "\n\n".join([f"--- Page {p} ---\n{t}" for p, t in text_by_page.items()])
            return StreamingResponse(
                io.StringIO(text_content),
                media_type="text/plain",
                headers={"Content-Disposition": "attachment; filename=extracted_text.txt"}
            )
        else:
            return {"success": True, "text": text_by_page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-tables")
async def extract_tables(file_id: str, pages: Optional[List[int]] = None):
    """Extract tables from PDF pages."""
    file_info = file_service.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])

    try:
        tables = pdf_service.extract_tables(file_path, pages)
        return {"success": True, "tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-images")
async def extract_images(file_id: str):
    """Extract all images from a PDF."""
    file_info = file_service.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_dir = PROCESSED_DIR / file_id / "images"

    try:
        image_paths = pdf_service.extract_images(file_path, output_dir)

        images = []
        for path in image_paths:
            img_id = f"{file_id}_img_{path.stem}"
            file_service.register_file(img_id, {
                "id": img_id,
                "original_name": path.name,
                "file_type": "image",
                "path": str(path)
            })
            images.append({
                "file_id": img_id,
                "filename": path.name,
                "download_url": f"/api/download/{img_id}"
            })

        return {"success": True, "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/annotate")
async def add_annotations(request: AnnotationsRequest):
    """Add annotations to a PDF."""
    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_path = PROCESSED_DIR / request.file_id / "annotated.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        # Convert string keys to integers
        annotations = {int(k): v for k, v in request.annotations.items()}

        pdf_service.add_annotations_to_pdf(
            file_path,
            output_path,
            annotations,
            request.quality
        )
        file_service.update_file_path(request.file_id, output_path)

        pdf_info = pdf_service.get_pdf_info(output_path)
        pdf_service.generate_thumbnails(output_path, request.file_id)
        thumbnail_urls = [f"/api/thumbnail/{request.file_id}/{i+1}" for i in range(pdf_info["num_pages"])]

        return {
            "success": True,
            "file_id": request.file_id,
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{file_id}")
async def download_file(file_id: str, quality: str = Query("high")):
    """Download a processed PDF file."""
    file_info = file_service.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    filename = file_info.get("original_name", "download.pdf")

    return FileResponse(
        file_path,
        media_type="application/pdf" if file_path.suffix == ".pdf" else "application/octet-stream",
        filename=filename
    )


@router.delete("/file/{file_id}")
async def delete_file(file_id: str):
    """Delete a file and all associated data."""
    if file_service.delete_file(file_id):
        return {"success": True, "message": "File deleted"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete file")


@router.get("/file/{file_id}/info")
async def get_file_info(file_id: str):
    """Get information about a file."""
    file_info = file_service.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    if file_info["file_type"] == "pdf":
        pdf_info = pdf_service.get_pdf_info(file_path)
        return {**file_info, **pdf_info}

    return file_info


# Form filling endpoints
class FillFormRequest(BaseModel):
    file_id: str
    field_values: dict  # {field_name: value}


@router.get("/form-fields/{file_id}")
async def get_form_fields(file_id: str):
    """Get all form fields from a PDF."""
    file_info = file_service.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])

    try:
        fields = pdf_service.get_form_fields(file_path)
        return {
            "success": True,
            "file_id": file_id,
            "fields": fields,
            "has_forms": len(fields) > 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fill-form")
async def fill_form(request: FillFormRequest):
    """Fill form fields in a PDF."""
    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_path = PROCESSED_DIR / request.file_id / "filled.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        pdf_service.fill_form_fields(file_path, output_path, request.field_values)
        file_service.update_file_path(request.file_id, output_path)

        pdf_info = pdf_service.get_pdf_info(output_path)
        pdf_service.generate_thumbnails(output_path, request.file_id)
        thumbnail_urls = [f"/api/thumbnail/{request.file_id}/{i+1}" for i in range(pdf_info["num_pages"])]

        return {
            "success": True,
            "file_id": request.file_id,
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Metadata endpoints
class UpdateMetadataRequest(BaseModel):
    file_id: str
    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    keywords: Optional[str] = None


@router.get("/metadata/{file_id}")
async def get_metadata(file_id: str):
    """Get PDF metadata."""
    file_info = file_service.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])

    try:
        metadata = pdf_service.get_metadata(file_path)
        return {
            "success": True,
            "file_id": file_id,
            "metadata": metadata
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/metadata")
async def update_metadata(request: UpdateMetadataRequest):
    """Update PDF metadata."""
    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_path = PROCESSED_DIR / request.file_id / "metadata_updated.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        metadata = {}
        if request.title:
            metadata['title'] = request.title
        if request.author:
            metadata['author'] = request.author
        if request.subject:
            metadata['subject'] = request.subject
        if request.keywords:
            metadata['keywords'] = request.keywords

        pdf_service.update_metadata(file_path, output_path, metadata)
        file_service.update_file_path(request.file_id, output_path)

        return {
            "success": True,
            "file_id": request.file_id,
            "message": "Metadata updated successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Compare/Preview endpoints
@router.get("/compare/{file_id}/{page_num}")
async def compare_pages(file_id: str, page_num: int, original_file_id: Optional[str] = None):
    """Generate before/after comparison for a page."""
    file_info = file_service.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    current_path = Path(file_info["path"])

    # Try to find original file
    original_path = None
    if original_file_id:
        original_info = file_service.get_file_info(original_file_id)
        if original_info:
            original_path = Path(original_info["path"])

    output_dir = TEMP_DIR / file_id / "compare"

    try:
        if original_path and original_path.exists():
            before_path, after_path = pdf_service.compare_pdfs(
                original_path, current_path, page_num, output_dir
            )
            return {
                "success": True,
                "before_url": f"/api/compare-image/{file_id}/before/{page_num}",
                "after_url": f"/api/compare-image/{file_id}/after/{page_num}"
            }
        else:
            # Just return current preview
            return {
                "success": True,
                "before_url": None,
                "after_url": f"/api/preview/{file_id}/{page_num}"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/compare-image/{file_id}/{type}/{page_num}")
async def get_compare_image(file_id: str, type: str, page_num: int):
    """Get comparison image (before or after)."""
    if type not in ["before", "after"]:
        raise HTTPException(status_code=400, detail="Type must be 'before' or 'after'")

    image_path = TEMP_DIR / file_id / "compare" / f"{type}_page_{page_num}.png"

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Comparison image not found")

    return FileResponse(image_path, media_type="image/png")


# =============================================================================
# Health Check Endpoint (for E2E tests)
# =============================================================================

@router.get("/health")
async def api_health():
    """API health check endpoint."""
    return {
        "status": "healthy",
        "service": "pdf-buddy-api",
        "features": {
            "signatures": signature_service.is_available(),
            "ocr": ocr_service.is_available()
        }
    }


# =============================================================================
# Digital Signature Endpoints
# =============================================================================

class SignatureRequest(BaseModel):
    file_id: str
    page_num: int
    x: float
    y: float
    name: str = ""
    reason: str = ""
    location: str = ""
    signature_data: Optional[dict] = None


@router.get("/signature/status")
async def get_signature_status():
    """Check if digital signature functionality is available."""
    return {
        "available": signature_service.is_available(),
        "message": "Digital signature functionality is available" if signature_service.is_available()
                   else "Digital signature libraries not installed"
    }


@router.get("/signature/info/{file_id}")
async def get_signature_info(file_id: str):
    """Get information about existing signatures in a PDF."""
    file_info = file_service.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])

    try:
        sig_info = signature_service.get_signature_info(file_path)
        return {
            "success": True,
            "file_id": file_id,
            **sig_info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/signature/add")
async def add_signature(request: SignatureRequest):
    """Add a visual signature to a PDF."""
    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_path = PROCESSED_DIR / request.file_id / "signed.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        signature_service.add_visual_signature_to_pdf(
            file_path,
            output_path,
            page_num=request.page_num,
            x=request.x,
            y=request.y,
            name=request.name,
            reason=request.reason,
            location=request.location,
            signature_data=request.signature_data
        )

        file_service.update_file_path(request.file_id, output_path)

        # Regenerate thumbnails
        pdf_info = pdf_service.get_pdf_info(output_path)
        pdf_service.generate_thumbnails(output_path, request.file_id)
        thumbnail_urls = [f"/api/thumbnail/{request.file_id}/{i+1}" for i in range(pdf_info["num_pages"])]

        return {
            "success": True,
            "file_id": request.file_id,
            "message": "Signature added successfully",
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# OCR Endpoints
# =============================================================================

class OCRRequest(BaseModel):
    file_id: str
    language: str = "eng"
    pages: Optional[List[int]] = None


class OCRSearchableRequest(BaseModel):
    file_id: str
    language: str = "eng"
    pages: Optional[List[int]] = None
    dpi: int = 300


@router.get("/ocr/status")
async def get_ocr_status():
    """Check if OCR functionality is available."""
    return {
        "available": ocr_service.is_available(),
        "message": "OCR functionality is available" if ocr_service.is_available()
                   else "Tesseract OCR not installed",
        "supported_languages": ocr_service.get_supported_languages() if ocr_service.is_available() else {}
    }


@router.get("/ocr/languages")
async def get_ocr_languages():
    """Get list of supported OCR languages."""
    return {
        "languages": ocr_service.get_supported_languages()
    }


@router.post("/ocr/extract")
async def ocr_extract_text(request: OCRRequest):
    """Extract text from a scanned PDF using OCR."""
    if not ocr_service.is_available():
        raise HTTPException(status_code=503, detail="OCR functionality is not available")

    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])

    try:
        text_by_page = ocr_service.extract_text_from_pdf(
            file_path,
            language=request.language,
            pages=request.pages
        )

        return {
            "success": True,
            "file_id": request.file_id,
            "text": text_by_page,
            "language": request.language
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ocr/searchable")
async def ocr_create_searchable(request: OCRSearchableRequest):
    """Create a searchable PDF from a scanned document."""
    if not ocr_service.is_available():
        raise HTTPException(status_code=503, detail="OCR functionality is not available")

    file_info = file_service.get_file_info(request.file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])
    output_path = PROCESSED_DIR / request.file_id / "searchable.pdf"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        ocr_service.create_searchable_pdf(
            file_path,
            output_path,
            language=request.language,
            pages=request.pages,
            dpi=request.dpi
        )

        file_service.update_file_path(request.file_id, output_path)

        # Regenerate thumbnails
        pdf_info = pdf_service.get_pdf_info(output_path)
        pdf_service.generate_thumbnails(output_path, request.file_id)
        thumbnail_urls = [f"/api/thumbnail/{request.file_id}/{i+1}" for i in range(pdf_info["num_pages"])]

        return {
            "success": True,
            "file_id": request.file_id,
            "message": "Searchable PDF created successfully",
            "thumbnail_urls": thumbnail_urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ocr/data/{file_id}/{page_num}")
async def ocr_get_data(file_id: str, page_num: int, language: str = "eng"):
    """Get detailed OCR data including word bounding boxes for a page."""
    if not ocr_service.is_available():
        raise HTTPException(status_code=503, detail="OCR functionality is not available")

    file_info = file_service.get_file_info(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(file_info["path"])

    try:
        ocr_data = ocr_service.get_ocr_data(file_path, page_num, language)
        return {
            "success": True,
            "file_id": file_id,
            **ocr_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Batch Processing Endpoints
# =============================================================================

class BatchWatermarkRequest(BaseModel):
    file_ids: List[str]
    text: str
    opacity: float = 0.3
    rotation: int = 45


class BatchEncryptRequest(BaseModel):
    file_ids: List[str]
    password: str


class BatchRotateRequest(BaseModel):
    file_ids: List[str]
    rotation: int  # 90, 180, or 270


class BatchExtractTextRequest(BaseModel):
    file_ids: List[str]


class BatchMergeRequest(BaseModel):
    file_ids: List[str]


class BatchDownloadRequest(BaseModel):
    file_ids: List[str]


@router.get("/batch/operations")
async def get_batch_operations():
    """Get list of supported batch operations."""
    return {
        "operations": batch_service.get_supported_operations()
    }


@router.post("/batch/upload")
async def batch_upload(files: List[UploadFile] = File(...)):
    """Upload multiple files for batch processing."""
    results = []
    errors = []

    for file in files:
        try:
            if file.content_type not in ALLOWED_PDF_TYPES:
                errors.append({
                    "filename": file.filename,
                    "error": "Invalid file type"
                })
                continue

            content = await file.read()

            if len(content) > MAX_FILE_SIZE:
                errors.append({
                    "filename": file.filename,
                    "error": "File too large"
                })
                continue

            file_info = await file_service.save_upload(content, file.filename, file.content_type)
            pdf_info = pdf_service.get_pdf_info(Path(file_info["path"]))

            results.append({
                "file_id": file_info["id"],
                "original_name": file_info["original_name"],
                "num_pages": pdf_info["num_pages"]
            })
        except Exception as e:
            errors.append({
                "filename": file.filename,
                "error": str(e)
            })

    return {
        "success": len(results) > 0,
        "uploaded": results,
        "errors": errors,
        "total_uploaded": len(results),
        "total_errors": len(errors)
    }


@router.post("/batch/watermark")
async def batch_watermark(request: BatchWatermarkRequest):
    """Add watermark to multiple PDFs."""
    try:
        result = await batch_service.process_watermark(
            request.file_ids,
            request.text,
            request.opacity,
            request.rotation
        )
        return {
            "success": True,
            "operation": "watermark",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch/encrypt")
async def batch_encrypt(request: BatchEncryptRequest):
    """Encrypt multiple PDFs with password."""
    try:
        result = await batch_service.process_encrypt(
            request.file_ids,
            request.password
        )
        return {
            "success": True,
            "operation": "encrypt",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch/rotate")
async def batch_rotate(request: BatchRotateRequest):
    """Rotate all pages in multiple PDFs."""
    if request.rotation not in [90, 180, 270]:
        raise HTTPException(status_code=400, detail="Rotation must be 90, 180, or 270 degrees")

    try:
        result = await batch_service.process_rotate(
            request.file_ids,
            request.rotation
        )
        return {
            "success": True,
            "operation": "rotate",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch/extract-text")
async def batch_extract_text(request: BatchExtractTextRequest):
    """Extract text from multiple PDFs."""
    try:
        result = await batch_service.process_extract_text(request.file_ids)
        return {
            "success": True,
            "operation": "extract_text",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch/merge")
async def batch_merge(request: BatchMergeRequest):
    """Merge multiple PDFs into one."""
    if len(request.file_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 files required for merge")

    try:
        result = await batch_service.process_merge(request.file_ids)
        return {
            "success": True,
            "operation": "merge",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch/download-zip")
async def batch_download_zip(request: BatchDownloadRequest):
    """Create a ZIP file containing multiple processed PDFs."""
    try:
        zip_path = batch_service.create_download_zip(request.file_ids)

        # Get the zip file ID from the path
        zip_id = zip_path.parent.name

        return {
            "success": True,
            "zip_file_id": zip_id,
            "download_url": f"/api/download/{zip_id}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
