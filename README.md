# PDF Buddy - Comprehensive PDF Editor

A full-featured PDF editing web application with annotation tools, drag-and-drop page reordering, and image-to-PDF conversion.

## Features

### Page Operations
- **Remove Pages**: Select multiple pages or specify ranges (e.g., "1-5, 8, 10-12")
- **Add Pages**: Upload additional PDFs or images, insert blank pages
- **Reorder Pages**: Visual drag-and-drop interface with smooth animations
- **Rotate Pages**: 90°, 180°, 270° rotation for individual or batch pages
- **Split PDFs**: Extract ranges, split into individual files, or by page count
- **Merge PDFs**: Combine multiple PDFs with drag-and-drop ordering

### Annotation Tools
- **Pen Tool**: Freehand drawing with adjustable stroke width (1-10px) and colors
- **Highlighter Tool**: Semi-transparent highlighting with multiple colors and opacity control
- **Eraser Tool**: Remove specific annotations
- **Undo/Redo**: Full support for annotation history

### Advanced Features
- Add text watermarks with customizable opacity
- Password protect/encrypt PDFs
- Extract text from pages
- Convert images to PDF pages (JPG, PNG, WEBP, GIF, TIFF)

## Tech Stack

### Backend
- Python 3.11+
- FastAPI (async web framework)
- pypdf (PDF manipulation)
- pdfplumber (text/table extraction)
- reportlab (PDF creation)
- Pillow (image processing)
- pdf2image (rendering)
- pikepdf (encryption)

### Frontend
- React 18 with TypeScript
- Vite (build tool)
- @dnd-kit (drag-and-drop)
- Fabric.js (canvas/annotations)
- Zustand (state management)
- Tailwind CSS (styling)
- Radix UI (accessible components)

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- poppler-utils (for pdf2image)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The application will be available at `http://localhost:5173`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload PDF file |
| `/api/upload-image` | POST | Upload image file |
| `/api/remove-pages` | POST | Remove specified pages |
| `/api/reorder-pages` | POST | Reorder pages |
| `/api/merge` | POST | Merge multiple PDFs |
| `/api/split` | POST | Split PDF |
| `/api/rotate` | POST | Rotate pages |
| `/api/add-blank-page` | POST | Insert blank page |
| `/api/insert-image` | POST | Insert image as page |
| `/api/image-to-pdf` | POST | Convert images to PDF |
| `/api/watermark` | POST | Add watermark |
| `/api/encrypt` | POST | Password protect PDF |
| `/api/extract-text` | POST | Extract text |
| `/api/annotate` | POST | Save annotations |
| `/api/thumbnail/{file_id}/{page}` | GET | Get page thumbnail |
| `/api/preview/{file_id}/{page}` | GET | Get high-quality preview |
| `/api/download/{file_id}` | GET | Download processed PDF |

## Project Structure

```
pdfbuddy/
├── backend/
│   ├── app/
│   │   ├── config.py           # Configuration settings
│   │   ├── main.py             # FastAPI application
│   │   ├── routers/
│   │   │   └── pdf_router.py   # API endpoints
│   │   └── services/
│   │       ├── pdf_service.py  # PDF manipulation
│   │       └── file_service.py # File management
│   ├── uploads/                # Uploaded files
│   ├── processed/              # Processed files
│   ├── temp/                   # Temporary files
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts       # API client
│   │   ├── components/
│   │   │   ├── ui/             # Reusable UI components
│   │   │   ├── pdf/            # PDF-specific components
│   │   │   └── annotations/    # Annotation tools
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   └── utils.ts        # Utility functions
│   │   ├── store/
│   │   │   └── pdfStore.ts     # Zustand state management
│   │   ├── types/
│   │   │   └── index.ts        # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── README.md
```

## Configuration

### Backend Environment Variables
- `MAX_FILE_SIZE`: Maximum upload size (default: 100MB)
- `FILE_EXPIRY_HOURS`: Auto-cleanup interval (default: 1 hour)

### Frontend Environment Variables
- `VITE_API_URL`: Backend API URL (default: `/api`)

## License

MIT License
