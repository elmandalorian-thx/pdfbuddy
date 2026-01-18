# PDF Buddy

**Live App:** https://pdfbuddy-production.up.railway.app

## Project Overview

PDF Buddy is a comprehensive, privacy-focused PDF editor that runs in the browser. It's built with a React/TypeScript frontend and Python/FastAPI backend.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, @dnd-kit, Fabric.js, Radix UI
- **Backend:** Python 3.11+, FastAPI, pypdf, pdfplumber, reportlab, Pillow, pdf2image, pikepdf

## Project Structure

```
pdfbuddy/
├── backend/           # Python FastAPI backend
│   ├── app/
│   │   ├── main.py           # FastAPI app entry point
│   │   ├── config.py         # Settings & constants
│   │   ├── routers/
│   │   │   └── pdf_router.py # All API endpoints
│   │   └── services/
│   │       ├── pdf_service.py   # PDF manipulation logic
│   │       └── file_service.py  # File storage management
│   └── requirements.txt
│
├── frontend/          # React TypeScript frontend
│   ├── src/
│   │   ├── api/client.ts       # Axios API client
│   │   ├── components/
│   │   │   ├── ui/             # Reusable UI components (Button, Dialog, etc.)
│   │   │   ├── pdf/            # PDF components (FileUpload, PageGrid, Toolbar)
│   │   │   └── annotations/    # Annotation components (Canvas, Editor, Toolbar)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── store/pdfStore.ts   # Zustand state management
│   │   ├── types/index.ts      # TypeScript definitions
│   │   └── App.tsx             # Main app component
│   └── package.json
│
├── docker-compose.yml      # Development Docker setup
├── Dockerfile.production   # Production Docker image
├── fly.toml               # Fly.io deployment config
├── railway.toml           # Railway deployment config
└── render.yaml            # Render deployment config
```

## Key Features

- **Page Operations:** Drag-and-drop reorder, remove, add blank pages, rotate, split, merge
- **Annotations:** Pen tool, highlighter, text (with formatting), eraser, undo/redo
- **Image Support:** Insert images, convert images to PDF
- **Advanced:** Watermarks, encryption (AES-256), text extraction, form filling, metadata editing
- **UX:** Dark mode, keyboard shortcuts, touch gestures, drag-drop file append

## Development

```bash
# Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

## Deployment

The app is deployed on Railway. Use `railway up` to deploy or push to the connected Git repository.

## API Base URL

- Local: `http://localhost:8000/api`
- Production: `https://pdfbuddy-production.up.railway.app/api`
