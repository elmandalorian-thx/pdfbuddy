"""
AI Router

API endpoints for AI-powered document analysis including chat, summarization, and data extraction.
Supports both regular and streaming responses.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import json

from app.services.ai_service import ai_service
from app.services.file_service import file_service


router = APIRouter(prefix="/api/ai", tags=["ai"])


# Pydantic models
class ChatRequest(BaseModel):
    """Request to chat with a document."""
    file_id: str = Field(..., description="The file ID of the document")
    message: str = Field(..., min_length=1, max_length=10000, description="The user's message")
    session_id: Optional[str] = Field(None, description="Optional session ID for conversation history")
    pages: Optional[List[int]] = Field(None, description="Specific pages to focus on")


class ChatResponse(BaseModel):
    """Response from chat."""
    success: bool
    session_id: str
    message: str
    model: str
    tokens_used: int


class SummarizeRequest(BaseModel):
    """Request to summarize a document."""
    file_id: str = Field(..., description="The file ID of the document")
    detail_level: str = Field("detailed", description="Summary detail level: brief, detailed, or executive")
    pages: Optional[List[int]] = Field(None, description="Specific pages to summarize")


class SummarizeResponse(BaseModel):
    """Response from summarization."""
    success: bool
    summary: str
    detail_level: str
    pages_summarized: List[int]
    model: str
    tokens_used: int


class ExtractRequest(BaseModel):
    """Request to extract data from a document."""
    file_id: str = Field(..., description="The file ID of the document")
    prompt: str = Field(..., min_length=1, max_length=2000, description="What to extract")
    output_format: str = Field("text", description="Output format: text, json, table, or list")
    pages: Optional[List[int]] = Field(None, description="Specific pages to extract from")


class ExtractResponse(BaseModel):
    """Response from data extraction."""
    success: bool
    data: str
    format: str
    model: str
    tokens_used: int


class SessionResponse(BaseModel):
    """Response for session operations."""
    success: bool
    session_id: str
    message: str


class AIStatusResponse(BaseModel):
    """Response for AI status check."""
    available: bool
    providers: List[Dict[str, Any]]
    active_provider: Optional[Dict[str, Any]]
    privacy_notice: str
    rate_limit: Dict[str, Any]


class QuickActionResponse(BaseModel):
    """Response for quick actions."""
    success: bool
    data: str
    model: str
    tokens_used: int


def get_client_id(request: Request) -> str:
    """Get a client ID for rate limiting."""
    # Use IP address as client ID
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(request: Request):
    """Check rate limit and raise exception if exceeded."""
    client_id = get_client_id(request)
    if not ai_service.check_rate_limit(client_id):
        rate_info = ai_service.get_rate_limit_info(client_id)
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "retry_after": rate_info["reset_at"],
                "limit": rate_info["limit"],
            }
        )


def verify_file_exists(file_id: str):
    """Verify that a file exists."""
    try:
        file_service.get_file_info(file_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")


# Status endpoints
@router.get("/status", response_model=AIStatusResponse)
async def get_status():
    """
    Get AI service status.

    Returns information about available providers, rate limits, and privacy notice.
    """
    status = ai_service.get_status()
    return AIStatusResponse(**status)


@router.get("/rate-limit")
async def get_rate_limit(request: Request):
    """Get current rate limit status for the client."""
    client_id = get_client_id(request)
    return ai_service.get_rate_limit_info(client_id)


# Chat endpoints
@router.post("/chat", response_model=ChatResponse)
async def chat(request: Request, body: ChatRequest):
    """
    Send a chat message about a document.

    Returns a response based on the document content. Maintains conversation
    history within a session for follow-up questions.
    """
    check_rate_limit(request)
    verify_file_exists(body.file_id)

    if not ai_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI service is not available. Configure ANTHROPIC_API_KEY or OPENAI_API_KEY."
        )

    try:
        result = await ai_service.chat(
            file_id=body.file_id,
            message=body.message,
            session_id=body.session_id,
            pages=body.pages,
        )
        return ChatResponse(
            success=True,
            session_id=result["session_id"],
            message=result["message"],
            model=result["model"],
            tokens_used=result["tokens_used"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/stream")
async def chat_stream(request: Request, body: ChatRequest):
    """
    Stream a chat response.

    Returns a Server-Sent Events stream with the response tokens.
    """
    check_rate_limit(request)
    verify_file_exists(body.file_id)

    if not ai_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI service is not available. Configure ANTHROPIC_API_KEY or OPENAI_API_KEY."
        )

    async def generate():
        try:
            async for chunk in ai_service.stream_chat(
                file_id=body.file_id,
                message=body.message,
                session_id=body.session_id,
                pages=body.pages,
            ):
                # Format as SSE
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


# Summarization endpoint
@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: Request, body: SummarizeRequest):
    """
    Generate a summary of the document.

    Supports three detail levels:
    - brief: 2-3 sentence summary
    - detailed: Comprehensive summary with key points
    - executive: Executive summary for stakeholders
    """
    check_rate_limit(request)
    verify_file_exists(body.file_id)

    if not ai_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI service is not available. Configure ANTHROPIC_API_KEY or OPENAI_API_KEY."
        )

    if body.detail_level not in ["brief", "detailed", "executive"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid detail_level. Must be: brief, detailed, or executive"
        )

    try:
        result = await ai_service.summarize(
            file_id=body.file_id,
            detail_level=body.detail_level,
            pages=body.pages,
        )
        return SummarizeResponse(
            success=True,
            summary=result["summary"],
            detail_level=result["detail_level"],
            pages_summarized=result["pages_summarized"],
            model=result["model"],
            tokens_used=result["tokens_used"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Data extraction endpoint
@router.post("/extract", response_model=ExtractResponse)
async def extract(request: Request, body: ExtractRequest):
    """
    Extract specific data from the document.

    Provide a natural language prompt describing what to extract.
    Supports multiple output formats: text, json, table, list.
    """
    check_rate_limit(request)
    verify_file_exists(body.file_id)

    if not ai_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI service is not available. Configure ANTHROPIC_API_KEY or OPENAI_API_KEY."
        )

    if body.output_format not in ["text", "json", "table", "list"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid output_format. Must be: text, json, table, or list"
        )

    try:
        result = await ai_service.extract_data(
            file_id=body.file_id,
            extraction_prompt=body.prompt,
            output_format=body.output_format,
            pages=body.pages,
        )
        return ExtractResponse(
            success=True,
            data=result["data"],
            format=result["format"],
            model=result["model"],
            tokens_used=result["tokens_used"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Quick actions
@router.post("/quick/key-points", response_model=QuickActionResponse)
async def get_key_points(request: Request, file_id: str):
    """Extract key points from the document."""
    check_rate_limit(request)
    verify_file_exists(file_id)

    if not ai_service.is_available():
        raise HTTPException(status_code=503, detail="AI service is not available.")

    try:
        result = await ai_service.get_key_points(file_id)
        return QuickActionResponse(
            success=True,
            data=result["data"],
            model=result["model"],
            tokens_used=result["tokens_used"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quick/action-items", response_model=QuickActionResponse)
async def get_action_items(request: Request, file_id: str):
    """Extract action items from the document."""
    check_rate_limit(request)
    verify_file_exists(file_id)

    if not ai_service.is_available():
        raise HTTPException(status_code=503, detail="AI service is not available.")

    try:
        result = await ai_service.get_action_items(file_id)
        return QuickActionResponse(
            success=True,
            data=result["data"],
            model=result["model"],
            tokens_used=result["tokens_used"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Session management
@router.post("/sessions", response_model=SessionResponse)
async def create_session(file_id: str):
    """Create a new chat session for a document."""
    verify_file_exists(file_id)

    session = ai_service.create_session(file_id)
    return SessionResponse(
        success=True,
        session_id=session.id,
        message="Session created successfully",
    )


@router.delete("/sessions/{session_id}", response_model=SessionResponse)
async def clear_session(session_id: str):
    """Clear a chat session."""
    success = ai_service.clear_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionResponse(
        success=True,
        session_id=session_id,
        message="Session cleared successfully",
    )


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session information."""
    session = ai_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    return {
        "session_id": session.id,
        "file_id": session.file_id,
        "message_count": len(session.messages),
        "created_at": session.created_at.isoformat(),
        "last_activity": session.last_activity.isoformat(),
    }
