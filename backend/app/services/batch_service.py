"""
Batch Processing Service for PDF Buddy

Provides functionality to process multiple PDF files in batch.
"""

import asyncio
import io
import zipfile
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime
import uuid

from app.services.pdf_service import pdf_service
from app.services.file_service import file_service
from app.config import TEMP_DIR, PROCESSED_DIR


class BatchJob:
    """Represents a batch processing job."""

    def __init__(self, job_id: str, operation: str, files: List[str]):
        self.job_id = job_id
        self.operation = operation
        self.files = files
        self.status = 'pending'
        self.progress = 0
        self.total = len(files)
        self.results: List[Dict[str, Any]] = []
        self.errors: List[Dict[str, Any]] = []
        self.created_at = datetime.now()
        self.completed_at: Optional[datetime] = None


class BatchService:
    """Service for batch processing of PDF files."""

    # Active jobs storage
    _jobs: Dict[str, BatchJob] = {}

    # Supported batch operations
    OPERATIONS = {
        'watermark': 'Add watermark to PDFs',
        'encrypt': 'Encrypt PDFs with password',
        'rotate': 'Rotate all pages',
        'compress': 'Compress PDFs',
        'convert_images': 'Convert images to PDFs',
        'extract_text': 'Extract text from PDFs',
        'merge': 'Merge all PDFs into one',
    }

    @staticmethod
    def get_supported_operations() -> Dict[str, str]:
        """Get dictionary of supported batch operations."""
        return BatchService.OPERATIONS.copy()

    @staticmethod
    def create_job(operation: str, file_ids: List[str]) -> BatchJob:
        """Create a new batch processing job."""
        job_id = str(uuid.uuid4())
        job = BatchJob(job_id, operation, file_ids)
        BatchService._jobs[job_id] = job
        return job

    @staticmethod
    def get_job(job_id: str) -> Optional[BatchJob]:
        """Get a batch job by ID."""
        return BatchService._jobs.get(job_id)

    @staticmethod
    def get_all_jobs() -> List[BatchJob]:
        """Get all batch jobs."""
        return list(BatchService._jobs.values())

    @staticmethod
    async def process_watermark(
        file_ids: List[str],
        text: str,
        opacity: float = 0.3,
        rotation: int = 45,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> Dict[str, Any]:
        """
        Add watermark to multiple PDFs.

        Returns dict with results and any errors.
        """
        results = []
        errors = []

        for i, file_id in enumerate(file_ids):
            try:
                file_info = file_service.get_file_info(file_id)
                if not file_info:
                    errors.append({'file_id': file_id, 'error': 'File not found'})
                    continue

                file_path = Path(file_info['path'])
                output_dir = PROCESSED_DIR / f"batch_{file_id}"
                output_dir.mkdir(parents=True, exist_ok=True)
                output_path = output_dir / "watermarked.pdf"

                pdf_service.add_watermark(
                    file_path,
                    output_path,
                    text=text,
                    opacity=opacity,
                    rotation=rotation
                )

                # Register output file
                output_id = f"batch_wm_{file_id}"
                file_service._file_registry[output_id] = {
                    'id': output_id,
                    'original_name': f"watermarked_{file_info.get('original_name', 'document.pdf')}",
                    'file_type': 'pdf',
                    'path': str(output_path)
                }

                results.append({
                    'file_id': output_id,
                    'original_file_id': file_id,
                    'download_url': f'/api/download/{output_id}'
                })

                if progress_callback:
                    progress_callback(i + 1, len(file_ids))

            except Exception as e:
                errors.append({'file_id': file_id, 'error': str(e)})

        return {'results': results, 'errors': errors}

    @staticmethod
    async def process_encrypt(
        file_ids: List[str],
        password: str,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> Dict[str, Any]:
        """Encrypt multiple PDFs with password."""
        results = []
        errors = []

        for i, file_id in enumerate(file_ids):
            try:
                file_info = file_service.get_file_info(file_id)
                if not file_info:
                    errors.append({'file_id': file_id, 'error': 'File not found'})
                    continue

                file_path = Path(file_info['path'])
                output_dir = PROCESSED_DIR / f"batch_{file_id}"
                output_dir.mkdir(parents=True, exist_ok=True)
                output_path = output_dir / "encrypted.pdf"

                pdf_service.encrypt_pdf(file_path, output_path, password)

                output_id = f"batch_enc_{file_id}"
                file_service._file_registry[output_id] = {
                    'id': output_id,
                    'original_name': f"encrypted_{file_info.get('original_name', 'document.pdf')}",
                    'file_type': 'pdf',
                    'path': str(output_path)
                }

                results.append({
                    'file_id': output_id,
                    'original_file_id': file_id,
                    'download_url': f'/api/download/{output_id}'
                })

                if progress_callback:
                    progress_callback(i + 1, len(file_ids))

            except Exception as e:
                errors.append({'file_id': file_id, 'error': str(e)})

        return {'results': results, 'errors': errors}

    @staticmethod
    async def process_rotate(
        file_ids: List[str],
        rotation: int,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> Dict[str, Any]:
        """Rotate all pages in multiple PDFs."""
        results = []
        errors = []

        for i, file_id in enumerate(file_ids):
            try:
                file_info = file_service.get_file_info(file_id)
                if not file_info:
                    errors.append({'file_id': file_id, 'error': 'File not found'})
                    continue

                file_path = Path(file_info['path'])
                output_dir = PROCESSED_DIR / f"batch_{file_id}"
                output_dir.mkdir(parents=True, exist_ok=True)
                output_path = output_dir / "rotated.pdf"

                # Get all pages
                pdf_info = pdf_service.get_pdf_info(file_path)
                all_pages = list(range(1, pdf_info['num_pages'] + 1))

                pdf_service.rotate_pages(file_path, output_path, all_pages, rotation)

                output_id = f"batch_rot_{file_id}"
                file_service._file_registry[output_id] = {
                    'id': output_id,
                    'original_name': f"rotated_{file_info.get('original_name', 'document.pdf')}",
                    'file_type': 'pdf',
                    'path': str(output_path)
                }

                results.append({
                    'file_id': output_id,
                    'original_file_id': file_id,
                    'download_url': f'/api/download/{output_id}'
                })

                if progress_callback:
                    progress_callback(i + 1, len(file_ids))

            except Exception as e:
                errors.append({'file_id': file_id, 'error': str(e)})

        return {'results': results, 'errors': errors}

    @staticmethod
    async def process_extract_text(
        file_ids: List[str],
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> Dict[str, Any]:
        """Extract text from multiple PDFs."""
        results = []
        errors = []

        for i, file_id in enumerate(file_ids):
            try:
                file_info = file_service.get_file_info(file_id)
                if not file_info:
                    errors.append({'file_id': file_id, 'error': 'File not found'})
                    continue

                file_path = Path(file_info['path'])
                text_by_page = pdf_service.extract_text(file_path)

                # Save text to file
                output_dir = PROCESSED_DIR / f"batch_{file_id}"
                output_dir.mkdir(parents=True, exist_ok=True)
                text_path = output_dir / "extracted_text.txt"

                with open(text_path, 'w', encoding='utf-8') as f:
                    for page_num, text in text_by_page.items():
                        f.write(f"--- Page {page_num} ---\n")
                        f.write(text)
                        f.write("\n\n")

                output_id = f"batch_txt_{file_id}"
                file_service._file_registry[output_id] = {
                    'id': output_id,
                    'original_name': f"text_{file_info.get('original_name', 'document')}.txt",
                    'file_type': 'text',
                    'path': str(text_path)
                }

                results.append({
                    'file_id': output_id,
                    'original_file_id': file_id,
                    'text_preview': list(text_by_page.values())[0][:200] if text_by_page else '',
                    'download_url': f'/api/download/{output_id}'
                })

                if progress_callback:
                    progress_callback(i + 1, len(file_ids))

            except Exception as e:
                errors.append({'file_id': file_id, 'error': str(e)})

        return {'results': results, 'errors': errors}

    @staticmethod
    async def process_merge(
        file_ids: List[str],
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> Dict[str, Any]:
        """Merge multiple PDFs into one."""
        results = []
        errors = []

        try:
            file_paths = []
            for file_id in file_ids:
                file_info = file_service.get_file_info(file_id)
                if not file_info:
                    errors.append({'file_id': file_id, 'error': 'File not found'})
                    continue
                file_paths.append(Path(file_info['path']))

            if len(file_paths) < 2:
                return {
                    'results': [],
                    'errors': [{'error': 'At least 2 valid files required for merge'}]
                }

            # Merge PDFs
            output_id = str(uuid.uuid4())
            output_dir = PROCESSED_DIR / output_id
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / "merged.pdf"

            pdf_service.merge_pdfs(file_paths, output_path)

            file_service._file_registry[output_id] = {
                'id': output_id,
                'original_name': 'merged.pdf',
                'file_type': 'pdf',
                'path': str(output_path)
            }

            # Get info about merged PDF
            pdf_info = pdf_service.get_pdf_info(output_path)

            results.append({
                'file_id': output_id,
                'num_pages': pdf_info['num_pages'],
                'download_url': f'/api/download/{output_id}'
            })

            if progress_callback:
                progress_callback(len(file_ids), len(file_ids))

        except Exception as e:
            errors.append({'error': str(e)})

        return {'results': results, 'errors': errors}

    @staticmethod
    def create_download_zip(file_ids: List[str], zip_name: str = "batch_results.zip") -> Path:
        """
        Create a ZIP file containing multiple processed PDFs.

        Args:
            file_ids: List of file IDs to include in ZIP
            zip_name: Name for the ZIP file

        Returns:
            Path to the created ZIP file
        """
        zip_id = str(uuid.uuid4())
        zip_dir = PROCESSED_DIR / zip_id
        zip_dir.mkdir(parents=True, exist_ok=True)
        zip_path = zip_dir / zip_name

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for file_id in file_ids:
                file_info = file_service.get_file_info(file_id)
                if file_info:
                    file_path = Path(file_info['path'])
                    if file_path.exists():
                        zf.write(file_path, file_info.get('original_name', file_path.name))

        # Register ZIP file
        file_service._file_registry[zip_id] = {
            'id': zip_id,
            'original_name': zip_name,
            'file_type': 'zip',
            'path': str(zip_path)
        }

        return zip_path


# Create singleton instance
batch_service = BatchService()
