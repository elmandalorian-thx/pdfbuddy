# CLAUDE.md

This file provides context for Claude Code when working on this project.

## Project Overview

PDF Buddy is a comprehensive PDF editing web application with a React + TypeScript frontend and FastAPI Python backend.

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite for build/dev
- Zustand for state management
- Tailwind CSS + Radix UI components
- Fabric.js for canvas annotations

**Backend:**
- FastAPI + Python 3.11+
- PyPDF, pikepdf, pdfplumber for PDF processing
- Tesseract OCR for text recognition
- Anthropic/OpenAI APIs for AI features

## Commands

### Frontend (from `frontend/` directory)
```bash
npm run dev          # Start dev server (port 5173)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run test         # Run unit tests (Vitest)
npm run test:e2e     # Run E2E tests (Playwright)
```

### Backend (from `backend/` directory)
```bash
uvicorn app.main:app --reload --port 8000   # Start dev server
pytest                                       # Run tests
pytest tests/test_api.py                    # Run specific test file
```

## Project Structure

```
pdfbuddy/
├── frontend/
│   ├── src/
│   │   ├── api/client.ts           # API client
│   │   ├── components/             # React components
│   │   │   ├── ai/                 # AI Assistant panel
│   │   │   ├── pdf/                # PDF viewer/editor components
│   │   │   ├── smart-commands/     # Command palette
│   │   │   └── ui/                 # Shared UI components
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── store/pdfStore.ts       # Zustand store
│   │   └── types/index.ts          # TypeScript types
│   └── e2e/                        # Playwright E2E tests
├── backend/
│   └── app/
│       ├── main.py                 # FastAPI app entry
│       ├── routers/
│       │   ├── pdf_router.py       # PDF operations API
│       │   ├── ai_router.py        # AI chat/summarize API
│       │   └── command_router.py   # Smart commands API
│       └── services/
│           ├── pdf_service.py      # PDF manipulation
│           ├── ai_service.py       # AI document processing
│           ├── llm_client.py       # LLM provider abstraction
│           └── command_parser.py   # NLP command parsing
└── browser-extension/              # Chrome/Edge extension
    ├── manifest.json
    └── src/
        ├── popup/                  # Extension popup UI
        ├── background/             # Service worker
        └── content/                # Content scripts
```

## Key Features

1. **PDF Operations**: Upload, view, rotate, delete, reorder, merge, split pages
2. **Annotations**: Draw, text, shapes, signatures on PDF pages
3. **Smart Commands**: Natural language commands via Cmd+K (e.g., "rotate page 3")
4. **AI Assistant**: Chat with PDFs, summarization, data extraction
5. **Browser Extension**: Capture web pages as PDFs

## Environment Variables

```bash
# Backend (.env in backend/)
ANTHROPIC_API_KEY=sk-ant-...    # For AI features
OPENAI_API_KEY=sk-...           # Alternative AI provider
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/pdf/upload` | Upload PDF file |
| `GET /api/pdf/{file_id}/info` | Get PDF info |
| `POST /api/pdf/{file_id}/rotate` | Rotate pages |
| `POST /api/pdf/{file_id}/delete` | Delete pages |
| `POST /api/smart-command/parse` | Parse natural language command |
| `POST /api/ai/chat` | Chat with document |
| `POST /api/ai/summarize` | Generate summary |

## Code Conventions

- Frontend uses path aliases (`@/` maps to `src/`)
- Components use named exports
- API calls go through `frontend/src/api/client.ts`
- Backend services are in `backend/app/services/`
- Routers are in `backend/app/routers/`

## Testing

- Unit tests: `*.test.ts` files alongside source
- E2E tests: `frontend/e2e/*.spec.ts`
- Backend tests: `backend/tests/`
