# PDF Buddy - Implementation Plans

## Overview

This document outlines implementation plans for two major features to improve PDF Buddy's competitive position:

1. **AI Document Assistant** - Chat with PDFs, summarization, data extraction
2. **Smart Commands** - Natural language interface for PDF operations ✅ **IMPLEMENTED**

---

## Feature 1: AI Document Assistant

### Summary
Enable users to chat with their PDFs, get summaries, and extract specific data using AI (Claude/OpenAI APIs).

### Architecture

```
Frontend (React)                    Backend (FastAPI)
┌─────────────────┐                ┌─────────────────┐
│ AIAssistantPanel│◄──────────────►│   ai_router.py  │
│ ChatMessage     │                │   ai_service.py │
│ QuickActions    │                │   llm_client.py │
└─────────────────┘                └─────────────────┘
                                           │
                                           ▼
                                   ┌─────────────────┐
                                   │  Claude API     │
                                   │  (or OpenAI)    │
                                   └─────────────────┘
```

### New Files

**Backend:**
- `backend/app/services/llm_client.py` - LLM provider abstraction
- `backend/app/services/ai_service.py` - Document processing & chat logic
- `backend/app/routers/ai_router.py` - API endpoints

**Frontend:**
- `frontend/src/store/aiStore.ts` - Zustand store for AI state
- `frontend/src/components/ai/AIAssistantPanel.tsx` - Main chat UI
- `frontend/src/components/ai/ChatMessage.tsx` - Message display
- `frontend/src/components/ai/QuickActions.tsx` - Preset prompts

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/status` | GET | Check AI availability |
| `/api/ai/chat` | POST | Send chat message |
| `/api/ai/chat/stream` | POST | Streaming chat (SSE) |
| `/api/ai/summarize` | POST | Generate summary |
| `/api/ai/extract` | POST | Extract specific data |
| `/api/ai/sessions` | POST/DELETE | Manage chat sessions |

### Key Features

- **Document Chat**: Ask questions about PDF content
- **Summarization**: Brief, detailed, or executive summaries
- **Data Extraction**: Extract tables, dates, names, etc.
- **Streaming Responses**: Real-time token streaming
- **Privacy Notice**: Clear disclosure before cloud processing
- **Rate Limiting**: 20 requests/minute default

### Dependencies

```
# Backend
anthropic>=0.18.0
tiktoken>=0.6.0
```

---

## Feature 2: Smart Commands (Natural Language) ✅ IMPLEMENTED

### Summary
Allow users to control PDF operations using natural language commands like "Remove pages 5-10" or "Add watermark DRAFT" via a Cmd+K command palette.

### Supported Commands

| Category | Example Commands |
|----------|------------------|
| **Page Operations** | "Remove pages 5-10", "Rotate page 1 clockwise", "Add blank page after 5" |
| **Document Operations** | "Add watermark DRAFT", "Encrypt with password secret123", "Split into individual pages" |
| **Content Extraction** | "Extract text from all pages", "OCR this document", "Make this PDF searchable" |
| **Metadata** | "Set title to Annual Report", "Set author to John Doe" |

### Files Created

**Backend:**
- `backend/app/services/command_parser.py` - NLP parsing & intent resolution
- `backend/app/routers/command_router.py` - Smart command endpoints

**Frontend:**
- `frontend/src/components/smart-commands/CommandPalette.tsx` - Main UI
- `frontend/src/hooks/useSmartCommands.ts` - Command logic hook

### How to Use

1. Open a PDF in the app
2. Press **Cmd+K** (Mac) / **Ctrl+K** (Windows)
3. Type natural language commands
4. Review preview and confirm

---

## Next Steps

1. ✅ Smart Commands - Completed
2. 🔄 AI Document Assistant - In Progress
3. Future: Browser extension, PDF/A compliance, cloud storage integration
