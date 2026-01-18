<p align="center">
  <img src="https://img.shields.io/badge/PDF-Editor-blue?style=for-the-badge&logo=adobe-acrobat-reader" alt="PDF Editor"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react" alt="React 18"/>
  <img src="https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python" alt="Python"/>
</p>

<h1 align="center">PDF Buddy</h1>

<p align="center">
  <strong>A comprehensive, privacy-focused PDF editor that runs entirely in your browser</strong>
</p>

<p align="center">
  Edit PDFs with drag-and-drop simplicity. Annotate with pen and highlighter tools.<br/>
  Merge, split, rotate, and convert images to PDF. No account required.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Features

<table>
<tr>
<td width="50%">

### Page Operations
- **Drag & Drop Reordering** - Intuitive page management with smooth animations
- **Remove Pages** - Select multiple or use ranges like `1-5, 8, 10-12`
- **Add Pages** - Insert blank pages or upload additional PDFs
- **Rotate** - 90°, 180°, 270° rotation (individual or batch)
- **Split** - Extract ranges, individual pages, or by count
- **Merge** - Combine multiple PDFs into one

</td>
<td width="50%">

### Annotation Tools
- **Pen Tool** - Freehand drawing with 6+ colors and adjustable width (1-10px)
- **Highlighter** - Semi-transparent with 5 colors and opacity control (20-60%)
- **Eraser** - Remove specific annotations
- **Undo/Redo** - Full history support for all operations

</td>
</tr>
<tr>
<td width="50%">

### Image Support
- **Formats** - JPG, PNG, WEBP, GIF, TIFF
- **Convert to PDF** - Single or batch image conversion
- **Insert into PDF** - Add images as new pages at any position
- **Quality Preservation** - Maintains original image resolution

</td>
<td width="50%">

### Advanced Features
- **Watermarks** - Add text with customizable opacity and rotation
- **Encryption** - Password protect PDFs with AES-256
- **Text Extraction** - Export text content to TXT
- **Auto Cleanup** - Temporary files deleted after 1 hour

</td>
</tr>
</table>

## Demo

<p align="center">
  <em>Screenshots coming soon</em>
</p>

<!--
Add screenshots here:
![Upload](docs/screenshots/upload.png)
![Editor](docs/screenshots/editor.png)
![Annotations](docs/screenshots/annotations.png)
-->

### Key Interactions

| Action | How To |
|--------|--------|
| Select page | Click on thumbnail |
| Select multiple | Ctrl/Cmd + Click |
| Select range | Shift + Click |
| Reorder pages | Drag and drop thumbnails |
| Rotate page | Hover → Click rotate icon |
| Delete page | Hover → Click trash icon |
| Annotate | Hover → Click pencil icon |

## Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| poppler-utils | Latest (for PDF rendering) |

<details>
<summary><strong>Install poppler-utils</strong></summary>

```bash
# macOS
brew install poppler

# Ubuntu/Debian
sudo apt-get install poppler-utils

# Windows (via Chocolatey)
choco install poppler
```
</details>

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/pdfbuddy.git
cd pdfbuddy
```

#### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open **http://localhost:5173** in your browser.

## Tech Stack

<table>
<tr>
<th>Backend</th>
<th>Frontend</th>
</tr>
<tr>
<td>

| Package | Purpose |
|---------|---------|
| FastAPI | Async web framework |
| pypdf | PDF manipulation |
| pdfplumber | Text/table extraction |
| reportlab | PDF creation |
| Pillow | Image processing |
| pdf2image | PDF rendering |
| pikepdf | Encryption |

</td>
<td>

| Package | Purpose |
|---------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool |
| @dnd-kit | Drag and drop |
| Fabric.js | Canvas/annotations |
| Zustand | State management |
| Tailwind CSS | Styling |
| Radix UI | Accessible components |

</td>
</tr>
</table>

## API Reference

### File Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload PDF file |
| `/api/upload-image` | POST | Upload image file |
| `/api/download/{file_id}` | GET | Download processed PDF |
| `/api/file/{file_id}` | DELETE | Delete file |

### Page Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/remove-pages` | POST | Remove specified pages |
| `/api/reorder-pages` | POST | Reorder pages |
| `/api/rotate` | POST | Rotate pages (90°, 180°, 270°) |
| `/api/add-blank-page` | POST | Insert blank page |
| `/api/merge` | POST | Merge multiple PDFs |
| `/api/split` | POST | Split PDF |

### Image & Annotation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/insert-image` | POST | Insert image as PDF page |
| `/api/image-to-pdf` | POST | Convert images to PDF |
| `/api/annotate` | POST | Save annotations to PDF |
| `/api/thumbnail/{file_id}/{page}` | GET | Get page thumbnail |
| `/api/preview/{file_id}/{page}` | GET | Get high-quality preview |

### Advanced

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/watermark` | POST | Add text watermark |
| `/api/encrypt` | POST | Password protect PDF |
| `/api/extract-text` | POST | Extract text content |
| `/api/extract-tables` | POST | Extract tables |
| `/api/extract-images` | POST | Extract embedded images |

### Digital Signatures

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/signature/status` | GET | Check signature availability |
| `/api/signature/info/{file_id}` | GET | Get existing signature info |
| `/api/signature/add` | POST | Add visual signature to PDF |

### OCR (Optical Character Recognition)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ocr/status` | GET | Check OCR availability |
| `/api/ocr/languages` | GET | Get supported languages |
| `/api/ocr/extract` | POST | Extract text using OCR |
| `/api/ocr/searchable` | POST | Create searchable PDF |

### Batch Processing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/batch/operations` | GET | List available operations |
| `/api/batch/upload` | POST | Upload multiple files |
| `/api/batch/watermark` | POST | Batch add watermarks |
| `/api/batch/encrypt` | POST | Batch encrypt PDFs |
| `/api/batch/rotate` | POST | Batch rotate pages |
| `/api/batch/extract-text` | POST | Batch extract text |
| `/api/batch/merge` | POST | Merge multiple PDFs |
| `/api/batch/download-zip` | POST | Download results as ZIP |

<details>
<summary><strong>Example: Reorder Pages</strong></summary>

```bash
curl -X POST http://localhost:8000/api/reorder-pages \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "abc123",
    "new_order": [3, 1, 2, 4]
  }'
```
</details>

<details>
<summary><strong>Example: Add Watermark</strong></summary>

```bash
curl -X POST http://localhost:8000/api/watermark \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "abc123",
    "text": "CONFIDENTIAL",
    "opacity": 0.3,
    "rotation": 45
  }'
```
</details>

## Project Structure

```
pdfbuddy/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py            # Settings & constants
│   │   ├── main.py              # FastAPI app & lifecycle
│   │   ├── routers/
│   │   │   └── pdf_router.py    # All API endpoints
│   │   └── services/
│   │       ├── pdf_service.py   # PDF manipulation logic
│   │       └── file_service.py  # File storage management
│   ├── uploads/                  # Uploaded files (gitignored)
│   ├── processed/                # Output files (gitignored)
│   ├── temp/                     # Thumbnails & previews (gitignored)
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts        # Axios API client
│   │   ├── components/
│   │   │   ├── ui/              # Button, Dialog, Input, etc.
│   │   │   ├── pdf/             # FileUpload, PageGrid, Toolbar
│   │   │   └── annotations/     # Canvas, Editor, Toolbar
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/
│   │   │   └── utils.ts         # Helper functions
│   │   ├── store/
│   │   │   └── pdfStore.ts      # Zustand state
│   │   ├── types/
│   │   │   └── index.ts         # TypeScript definitions
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css            # Tailwind + custom styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
└── README.md
```

## Configuration

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_FILE_SIZE` | 100MB | Maximum upload file size |
| `FILE_EXPIRY_HOURS` | 1 | Hours before auto-cleanup |
| `CORS_ORIGINS` | localhost:3000,5173 | Allowed frontend origins |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | Backend API base URL |

## Privacy & Security

- **No cloud storage** - Files are processed locally and deleted within 1 hour
- **No accounts** - Start editing immediately without registration
- **No tracking** - No analytics or user tracking
- **Encrypted exports** - Optional AES-256 password protection

## Deployment

### One-Click Deploy

| Platform | Deploy Button |
|----------|---------------|
| Railway | [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template) |
| Render | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy) |

### Manual Deployment

#### Using Docker (Recommended)

```bash
# Build and run with Docker Compose (development)
docker-compose up --build

# Or build production image
docker build -f Dockerfile.production -t pdfbuddy .
docker run -p 8080:8080 pdfbuddy
```

#### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login and deploy
fly auth login
fly launch
fly deploy
```

#### Render

1. Connect your GitHub repository to Render
2. Create a new "Web Service"
3. Render will auto-detect the `render.yaml` configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | Server port |
| `MAX_FILE_SIZE` | 100MB | Maximum upload size |
| `FILE_EXPIRY_HOURS` | 1 | Auto-cleanup interval |

## Completed Features

- [x] Dark mode theme with system preference detection
- [x] Keyboard shortcuts (Ctrl+Z/Y, Delete, arrows, Ctrl+A)
- [x] Touch gestures for mobile (pinch-to-zoom, swipe)
- [x] PDF form filling
- [x] Metadata editor (title, author, subject, keywords)
- [x] Docker deployment (development & production)
- [x] Unit tests (pytest + vitest)
- [x] Modern responsive UI with animations
- [x] E2E tests with Playwright
- [x] PDF digital signatures (visual signatures with name, reason, location)
- [x] OCR for scanned documents (text extraction and searchable PDF creation)
- [x] Batch processing UI (watermark, encrypt, rotate, merge, extract text)

## Roadmap

All planned features have been implemented! Future enhancements may include:

- [ ] Cryptographic digital signatures with certificates
- [ ] Cloud storage integration
- [ ] Collaboration features
- [ ] PDF/A compliance conversion

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development

```bash
# Run backend tests
cd backend && pytest

# Run frontend in development
cd frontend && npm run dev

# Run frontend unit tests
cd frontend && npm run test

# Run E2E tests with Playwright
cd frontend && npm run test:e2e

# Run E2E tests in headed mode (see browser)
cd frontend && npm run test:e2e:headed

# Build for production
cd frontend && npm run build
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with <a href="https://fastapi.tiangolo.com/">FastAPI</a> and <a href="https://react.dev/">React</a>
</p>

<p align="center">
  <a href="#pdf-buddy">Back to top</a>
</p>
