import os
import json
import uuid
import asyncio
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import aiofiles

from app.config import (
    UPLOAD_DIR, PROCESSED_DIR, TEMP_DIR,
    MAX_FILE_SIZE, ALLOWED_PDF_TYPES, ALLOWED_IMAGE_TYPES,
    FILE_EXPIRY_HOURS
)

# Registry persistence file
REGISTRY_FILE = PROCESSED_DIR / ".file_registry.json"


class FileService:
    """Service for file management operations."""

    # In-memory storage for file metadata
    _file_registry: Dict[str, Dict[str, Any]] = {}
    _initialized: bool = False

    @classmethod
    def _save_registry(cls) -> None:
        """Persist the file registry to disk."""
        try:
            with open(REGISTRY_FILE, "w") as f:
                json.dump(cls._file_registry, f)
        except Exception as e:
            print(f"Warning: Failed to save file registry: {e}")

    @classmethod
    def _load_registry(cls) -> None:
        """Load the file registry from disk."""
        if cls._initialized:
            return
        cls._initialized = True

        if REGISTRY_FILE.exists():
            try:
                with open(REGISTRY_FILE, "r") as f:
                    cls._file_registry = json.load(f)
                # Validate entries - remove any with missing files
                invalid_ids = []
                for file_id, info in cls._file_registry.items():
                    if not Path(info.get("path", "")).exists():
                        invalid_ids.append(file_id)
                for file_id in invalid_ids:
                    del cls._file_registry[file_id]
                if invalid_ids:
                    cls._save_registry()
                print(f"Loaded {len(cls._file_registry)} files from registry")
            except Exception as e:
                print(f"Warning: Failed to load file registry: {e}")
                cls._file_registry = {}

    @classmethod
    def generate_file_id(cls) -> str:
        """Generate a unique file ID."""
        return str(uuid.uuid4())

    @classmethod
    async def save_upload(
        cls,
        file_content: bytes,
        filename: str,
        content_type: str
    ) -> Dict[str, Any]:
        """Save an uploaded file and return file info."""
        file_id = cls.generate_file_id()

        # Determine file type and directory
        if content_type in ALLOWED_PDF_TYPES:
            file_type = "pdf"
            ext = ".pdf"
        elif content_type in ALLOWED_IMAGE_TYPES:
            file_type = "image"
            ext = Path(filename).suffix.lower() or ".png"
        else:
            raise ValueError(f"Unsupported file type: {content_type}")

        # Create file directory
        file_dir = UPLOAD_DIR / file_id
        file_dir.mkdir(parents=True, exist_ok=True)

        # Save file
        safe_filename = f"original{ext}"
        file_path = file_dir / safe_filename

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(file_content)

        # Register file
        file_info = {
            "id": file_id,
            "original_name": filename,
            "file_type": file_type,
            "content_type": content_type,
            "path": str(file_path),
            "size": len(file_content),
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(hours=FILE_EXPIRY_HOURS)).isoformat()
        }

        cls._file_registry[file_id] = file_info
        cls._save_registry()

        return file_info

    @classmethod
    def get_file_info(cls, file_id: str) -> Optional[Dict[str, Any]]:
        """Get file information by ID."""
        cls._load_registry()
        return cls._file_registry.get(file_id)

    @classmethod
    def get_file_path(cls, file_id: str) -> Optional[Path]:
        """Get the file path for a given file ID."""
        info = cls.get_file_info(file_id)
        if info:
            return Path(info["path"])
        return None

    @classmethod
    def register_file(cls, file_id: str, file_info: Dict[str, Any]) -> None:
        """Register a file in the registry with persistence."""
        cls._load_registry()
        cls._file_registry[file_id] = file_info
        cls._save_registry()

    @classmethod
    def update_file_path(cls, file_id: str, new_path: Path) -> None:
        """Update the file path for a given file ID."""
        if file_id in cls._file_registry:
            cls._file_registry[file_id]["path"] = str(new_path)
            cls._file_registry[file_id]["modified_at"] = datetime.utcnow().isoformat()
            cls._save_registry()

    @classmethod
    async def save_processed_file(
        cls,
        file_id: str,
        content: bytes,
        suffix: str = ""
    ) -> Path:
        """Save a processed PDF file."""
        output_dir = PROCESSED_DIR / file_id
        output_dir.mkdir(parents=True, exist_ok=True)

        output_filename = f"processed{suffix}.pdf"
        output_path = output_dir / output_filename

        async with aiofiles.open(output_path, "wb") as f:
            await f.write(content)

        # Update registry
        cls.update_file_path(file_id, output_path)

        return output_path

    @classmethod
    def create_temp_directory(cls, file_id: str, subdir: str = "") -> Path:
        """Create a temporary directory for a file operation."""
        if subdir:
            temp_dir = TEMP_DIR / file_id / subdir
        else:
            temp_dir = TEMP_DIR / file_id
        temp_dir.mkdir(parents=True, exist_ok=True)
        return temp_dir

    @classmethod
    def delete_file(cls, file_id: str) -> bool:
        """Delete a file and all associated data."""
        success = True

        # Delete from upload directory
        upload_dir = UPLOAD_DIR / file_id
        if upload_dir.exists():
            try:
                shutil.rmtree(upload_dir)
            except Exception:
                success = False

        # Delete from processed directory
        processed_dir = PROCESSED_DIR / file_id
        if processed_dir.exists():
            try:
                shutil.rmtree(processed_dir)
            except Exception:
                success = False

        # Delete from temp directory
        temp_dir = TEMP_DIR / file_id
        if temp_dir.exists():
            try:
                shutil.rmtree(temp_dir)
            except Exception:
                success = False

        # Remove from registry
        if file_id in cls._file_registry:
            del cls._file_registry[file_id]
            cls._save_registry()

        return success

    @classmethod
    async def cleanup_expired_files(cls) -> int:
        """Clean up files that have expired."""
        cleaned_count = 0
        current_time = datetime.utcnow()

        expired_ids = []
        for file_id, info in cls._file_registry.items():
            expires_at = datetime.fromisoformat(info["expires_at"])
            if current_time > expires_at:
                expired_ids.append(file_id)

        for file_id in expired_ids:
            if cls.delete_file(file_id):
                cleaned_count += 1

        return cleaned_count

    @classmethod
    def list_files(cls) -> List[Dict[str, Any]]:
        """List all registered files."""
        return list(cls._file_registry.values())

    @classmethod
    async def copy_file(cls, source_path: Path, dest_path: Path) -> Path:
        """Asynchronously copy a file."""
        async with aiofiles.open(source_path, "rb") as src:
            content = await src.read()
        async with aiofiles.open(dest_path, "wb") as dst:
            await dst.write(content)
        return dest_path


# Create singleton instance and load persisted registry
file_service = FileService()
file_service._load_registry()
