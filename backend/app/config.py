import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
PROCESSED_DIR = BASE_DIR / "processed"
TEMP_DIR = BASE_DIR / "temp"

# Ensure directories exist
UPLOAD_DIR.mkdir(exist_ok=True)
PROCESSED_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

# File settings
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_PDF_TYPES = ["application/pdf"]
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/tiff"]

# Quality settings
QUALITY_SETTINGS = {
    "standard": {"dpi": 150, "quality": 75},
    "high": {"dpi": 300, "quality": 85},
    "maximum": {"dpi": 600, "quality": 95}
}

# Preview settings
THUMBNAIL_SIZE = (200, 280)  # Width x Height for thumbnails
PREVIEW_DPI = 150

# Cleanup settings
FILE_EXPIRY_HOURS = 1

# CORS settings
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]
