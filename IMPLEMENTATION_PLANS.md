# PDF Buddy - Implementation Plans

## Overview

This document outlines implementation plans for three major features to improve PDF Buddy's competitive position:

1. **AI Document Assistant** - Chat with PDFs, summarization, data extraction
2. **Smart Commands** - Natural language interface for PDF operations
3. **Real-time Collaboration** - Multi-user editing with presence and comments

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

### Implementation Timeline

| Phase | Tasks | Duration |
|-------|-------|----------|
| 1 | Backend foundation (LLM client, AI service) | 2 days |
| 2 | API endpoints & rate limiting | 2 days |
| 3 | Frontend state & API client | 2 days |
| 4 | UI components | 3 days |
| 5 | Testing & polish | 2 days |

---

## Feature 3: Smart Commands (Natural Language)

### Summary
Allow users to control PDF operations using natural language commands like "Remove pages 5-10" or "Add watermark DRAFT" via a Cmd+K command palette.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Command Palette                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🔍 "remove pages 5-10"                     ⌘K   │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Intent: REMOVE_PAGES                            │   │
│  │ Parameters: {pages: [5,6,7,8,9,10]}             │   │
│  │ Confidence: 0.95                                │   │
│  │ Preview: "Will remove 6 pages (5-10)"          │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│              [Cancel]  [Confirm]                        │
└─────────────────────────────────────────────────────────┘
```

### Supported Commands

| Category | Example Commands |
|----------|------------------|
| **Page Operations** | "Remove pages 5-10", "Rotate page 1 clockwise", "Add blank page after 5" |
| **Document Operations** | "Add watermark DRAFT", "Encrypt with password secret123", "Split into individual pages" |
| **Content Extraction** | "Extract text from all pages", "OCR this document", "Make this PDF searchable" |
| **Metadata** | "Set title to Annual Report", "Set author to John Doe" |

### New Files

**Backend:**
- `backend/app/services/command_parser.py` - NLP parsing & intent resolution
- `backend/app/routers/command_router.py` - Smart command endpoints

**Frontend:**
- `frontend/src/components/smart-commands/CommandPalette.tsx` - Main UI
- `frontend/src/components/smart-commands/CommandInput.tsx` - Input with autocomplete
- `frontend/src/components/smart-commands/CommandPreview.tsx` - Action preview
- `frontend/src/hooks/useSmartCommands.ts` - Command logic hook

### Parsing Strategy

**Hybrid approach:**
1. **Rule-based (primary)**: Regex patterns for common commands - fast, offline, handles 80%+ of inputs
2. **LLM fallback (optional)**: For complex/ambiguous queries

```python
COMMAND_PATTERNS = {
    Intent.REMOVE_PAGES: [
        r"(?:remove|delete|drop)\s+(?:pages?\s+)?(\d+(?:\s*[-,]\s*\d+)*)",
    ],
    Intent.ADD_WATERMARK: [
        r"(?:add\s+)?(?:a\s+)?watermark\s+(?:saying|with|text)?\s*[\"']?(.+?)[\"']?$",
    ],
    # ... more patterns
}
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/smart-command/parse` | POST | Parse command without executing |
| `/api/smart-command/execute` | POST | Execute validated command |
| `/api/smart-command/suggestions` | GET | Get command suggestions |
| `/api/smart-command/capabilities` | GET | List supported commands |

### UX Flow

1. User presses **Cmd+K** (Mac) / **Ctrl+K** (Windows)
2. Command palette opens with recent commands and suggestions
3. User types natural language command
4. System parses and shows preview with confidence score
5. For destructive actions, confirmation dialog appears
6. Command executes, user sees result

### Implementation Timeline

| Phase | Tasks | Duration |
|-------|-------|----------|
| 1 | Backend parser with regex patterns | 3-4 days |
| 2 | API endpoints | 1 day |
| 3 | Frontend CommandPalette component | 3-4 days |
| 4 | Integration with existing operations | 2-3 days |
| 5 | Optional LLM enhancement | 2-3 days |

---

## Feature 5: Real-time Collaborative Editing

### Summary
Enable multiple users to simultaneously annotate PDFs with real-time cursor tracking, threaded comments, and presence indicators.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                                │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────────┐ │
│  │ Collaboration  │  │   WebSocket    │  │    Zustand Store Extensions    │ │
│  │    Store       │◄─┤    Client      │◄─┤ - collaborationStore           │ │
│  │                │  │                │  │ - presenceStore                │ │
│  └────────────────┘  └────────────────┘  │ - commentStore                 │ │
│          │                   │           └────────────────────────────────┘ │
│          ▼                   │                                               │
│  ┌────────────────┐          │                                               │
│  │   Fabric.js    │          │                                               │
│  │  CRDT Adapter  │          │                                               │
│  └────────────────┘          │                                               │
└──────────────────────────────┼───────────────────────────────────────────────┘
                               │ WebSocket (wss://)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Backend (FastAPI)                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────────┐ │
│  │   WebSocket    │  │    Session     │  │      CRDT Engine               │ │
│  │    Manager     │◄─┤    Manager     │◄─┤  (Annotation State)            │ │
│  └────────────────┘  └────────────────┘  └────────────────────────────────┘ │
│          │                   │                         │                     │
│          ▼                   ▼                         ▼                     │
│  ┌────────────────┐  ┌────────────────┐                                     │
│  │  Redis Pub/Sub │  │   PostgreSQL   │                                     │
│  │   (Real-time)  │  │  (Persistence) │                                     │
│  └────────────────┘  └────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technology Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Real-time protocol | **WebSocket** | Bidirectional, low latency for cursors |
| Conflict resolution | **CRDTs** | Annotations are discrete objects, simpler than OT |
| Database | **PostgreSQL** | Reliable, ACID, JSON support |
| Real-time cache | **Redis** | Pub/Sub for cross-instance messaging |

### Database Schema (Key Tables)

```sql
-- Collaborative sessions
CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY,
    file_id VARCHAR(36) NOT NULL,
    share_token VARCHAR(64) UNIQUE,
    access_level VARCHAR(20) DEFAULT 'edit'
);

-- Participants (anonymous)
CREATE TABLE participants (
    id UUID PRIMARY KEY,
    display_name VARCHAR(100),
    avatar_color VARCHAR(7),
    session_token VARCHAR(64) UNIQUE
);

-- Annotations with CRDT metadata
CREATE TABLE collaborative_annotations (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES collaboration_sessions(id),
    page_number INTEGER,
    data JSONB,
    vector_clock JSONB
);

-- Comment threads
CREATE TABLE comment_threads (
    id UUID PRIMARY KEY,
    session_id UUID,
    page_number INTEGER,
    x_position FLOAT,
    y_position FLOAT,
    status VARCHAR(20) DEFAULT 'open'
);
```

### New Files

**Backend:**
- `backend/app/collaboration/websocket_manager.py` - Connection management
- `backend/app/collaboration/session_manager.py` - Session lifecycle
- `backend/app/collaboration/crdt_engine.py` - CRDT implementation
- `backend/app/collaboration/presence_tracker.py` - Cursor/presence tracking
- `backend/app/routers/collaboration_router.py` - REST + WebSocket endpoints

**Frontend:**
- `frontend/src/collaboration/WebSocketClient.ts` - WebSocket management
- `frontend/src/collaboration/CRDTClient.ts` - Client-side CRDT logic
- `frontend/src/store/collaborationStore.ts` - Session state
- `frontend/src/store/presenceStore.ts` - Cursor/presence state
- `frontend/src/store/commentStore.ts` - Comments state
- `frontend/src/components/collaboration/CollaborationPanel.tsx` - Main UI
- `frontend/src/components/collaboration/RemoteCursor.tsx` - Other users' cursors
- `frontend/src/components/collaboration/ParticipantList.tsx` - Active users
- `frontend/src/components/collaboration/CommentThread.tsx` - Threaded comments
- `frontend/src/components/collaboration/ShareDialog.tsx` - Share link creation

### WebSocket Message Types

```typescript
type MessageType =
    // Connection
    | 'join' | 'leave' | 'presence_update' | 'heartbeat'
    // Annotations
    | 'annotation_add' | 'annotation_update' | 'annotation_delete' | 'annotation_sync'
    // Cursors
    | 'cursor_move' | 'selection_update'
    // Comments
    | 'comment_add' | 'thread_resolve'
    // System
    | 'error' | 'ack';
```

### Authentication Strategy

Since the app has no accounts, use **anonymous guest sessions**:
1. Generate random session token (stored in localStorage)
2. Prompt for display name when joining
3. Auto-assign avatar color based on participant ID hash
4. Token persists across page reloads

### Dependencies

```
# Backend
websockets==12.0
redis==5.0.1
sqlalchemy==2.0.25
asyncpg==0.29.0
alembic==1.13.1
```

### Implementation Timeline

| Phase | Tasks | Duration |
|-------|-------|----------|
| 1 | Database setup (PostgreSQL + Redis) | 1 week |
| 2 | WebSocket infrastructure & session management | 1 week |
| 3 | CRDT engine & annotation sync | 1 week |
| 4 | Presence & cursor tracking | 1 week |
| 5 | Comments system | 1 week |
| 6 | Sharing, polish & testing | 1-2 weeks |

---

## Priority & Recommendations

### Recommended Implementation Order

| Priority | Feature | Effort | Impact | Rationale |
|----------|---------|--------|--------|-----------|
| **1** | Smart Commands | Medium | High | Quick win, improves UX dramatically, no external dependencies |
| **2** | AI Assistant | Medium | Very High | Major differentiator, API keys required |
| **3** | Collaboration | High | Very High | Most complex, requires infrastructure changes |

### Quick Wins First

Start with **Smart Commands** because:
- No external API dependencies
- No database changes required
- Immediate UX improvement
- Foundation for AI features (command palette can integrate with AI)

Then add **AI Assistant**:
- Requires API key setup but no database
- High value feature users expect in 2025
- Can be added incrementally

Finally tackle **Collaboration**:
- Largest scope, needs PostgreSQL + Redis
- Requires most testing (concurrent users, conflict resolution)
- Consider as v2.0 feature

---

## Common Infrastructure Needs

All three features benefit from:

1. **Command Palette UI** (Cmd+K) - Used by Smart Commands, can trigger AI actions
2. **Streaming Support** - AI responses and real-time collab both need streaming
3. **State Management Extensions** - New Zustand stores for each feature
4. **Error Handling Patterns** - Consistent error UI across features

---

## Next Steps

1. Review and approve plans
2. Set up development environment with required dependencies
3. Begin Phase 1 of chosen feature
4. Establish testing patterns early
5. Plan incremental releases (feature flags for gradual rollout)
