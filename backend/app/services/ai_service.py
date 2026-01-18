"""
AI Service for Document Processing

Handles document context preparation, chat sessions, summarization, and data extraction.
Integrates with existing PDF text extraction and OCR services.
"""

import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, AsyncIterator
from dataclasses import dataclass, field
from collections import defaultdict
import time

from app.services.llm_client import get_llm_client, get_available_providers, Message, LLMResponse
from app.services.pdf_service import pdf_service
from app.services.file_service import file_service


@dataclass
class DocumentContext:
    """Prepared document context for AI processing."""
    file_id: str
    text_by_page: Dict[int, str]
    total_pages: int
    estimated_tokens: int
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ChatSession:
    """A chat session with history."""
    id: str
    file_id: str
    messages: List[Message]
    created_at: datetime
    last_activity: datetime
    document_context: Optional[DocumentContext] = None


# System prompts
DOCUMENT_CHAT_SYSTEM = """You are an AI assistant helping users understand and extract information from PDF documents.

DOCUMENT CONTEXT:
The user has uploaded a PDF document. Below is the extracted text content:

---
{document_text}
---

GUIDELINES:
1. Answer questions based ONLY on the document content provided above
2. If information is not in the document, say so clearly - don't make up information
3. Quote relevant sections when appropriate using quotation marks
4. For page references, use the format "Page X: ..."
5. Be concise but thorough
6. If the question is ambiguous, ask for clarification

FORMATTING:
- Use markdown for structured responses
- Use bullet points for lists
- Use code blocks for data, numbers, or technical content
- Keep responses focused and readable"""

SUMMARY_PROMPTS = {
    "brief": """Provide a 2-3 sentence summary of this document, capturing the main topic and key conclusion.

Document:
{document_text}""",

    "detailed": """Provide a comprehensive summary of this document including:

1. **Main Topic/Purpose**: What is this document about?
2. **Key Points**: List 5-7 main points as bullet points
3. **Important Conclusions**: What are the main takeaways?
4. **Notable Data**: Any significant statistics, dates, or figures mentioned

Document:
{document_text}""",

    "executive": """Create an executive summary suitable for busy stakeholders:

**Overview** (one paragraph)
**Key Takeaways** (3-5 bullet points)
**Action Items** (if any are mentioned)
**Business Implications** (if applicable)

Document:
{document_text}""",
}

EXTRACTION_SYSTEM = """You are a data extraction assistant. Extract the requested information from the document below.

Document:
{document_text}

---

Instructions: {extraction_prompt}

Important:
- Only extract information that is explicitly stated in the document
- If information is not found, indicate "Not found in document"
- Format the output as requested"""


class AIService:
    """Service for AI-powered document analysis."""

    def __init__(self):
        self._sessions: Dict[str, ChatSession] = {}
        self._rate_limits: Dict[str, List[float]] = defaultdict(list)
        self._session_expiry = timedelta(hours=1)

        # Rate limiting settings
        self.rate_limit_requests = 20
        self.rate_limit_window = 60  # seconds

    def is_available(self) -> bool:
        """Check if AI service is available."""
        try:
            get_llm_client()
            return True
        except ValueError:
            return False

    def get_status(self) -> Dict[str, Any]:
        """Get AI service status."""
        providers = get_available_providers()
        any_available = any(p["available"] for p in providers)

        active_provider = None
        if any_available:
            try:
                client = get_llm_client()
                for p in providers:
                    if p["available"]:
                        active_provider = p
                        break
            except ValueError:
                pass

        return {
            "available": any_available,
            "providers": providers,
            "active_provider": active_provider,
            "privacy_notice": self._get_privacy_notice(active_provider),
            "rate_limit": {
                "requests_per_minute": self.rate_limit_requests,
                "window_seconds": self.rate_limit_window,
            },
        }

    def _get_privacy_notice(self, provider: Optional[Dict[str, Any]]) -> str:
        """Get privacy notice for the active provider."""
        if not provider:
            return "AI features are not configured."

        notices = {
            "anthropic": (
                "Your document content will be sent to Anthropic's Claude API for processing. "
                "Anthropic does not train on API data by default. Data is encrypted in transit. "
                "Consider removing sensitive information before using AI features."
            ),
            "openai": (
                "Your document content will be sent to OpenAI's API for processing. "
                "Check OpenAI's data usage policies. API data may be used for model improvement "
                "unless opted out. Consider sensitive data implications."
            ),
        }
        return notices.get(provider["name"], "Document content will be sent to an external AI service.")

    def check_rate_limit(self, client_id: str) -> bool:
        """Check if client has exceeded rate limit."""
        current_time = time.time()
        window_start = current_time - self.rate_limit_window

        # Clean old entries
        self._rate_limits[client_id] = [
            t for t in self._rate_limits[client_id] if t > window_start
        ]

        # Check limit
        if len(self._rate_limits[client_id]) >= self.rate_limit_requests:
            return False

        # Record this request
        self._rate_limits[client_id].append(current_time)
        return True

    def get_rate_limit_info(self, client_id: str) -> Dict[str, Any]:
        """Get rate limit information for a client."""
        current_time = time.time()
        window_start = current_time - self.rate_limit_window

        recent_requests = [
            t for t in self._rate_limits[client_id] if t > window_start
        ]

        return {
            "requests_remaining": max(0, self.rate_limit_requests - len(recent_requests)),
            "reset_at": datetime.fromtimestamp(window_start + self.rate_limit_window).isoformat(),
            "limit": self.rate_limit_requests,
        }

    async def prepare_document_context(self, file_id: str) -> DocumentContext:
        """Prepare document text for AI processing."""
        file_info = file_service.get_file_info(file_id)
        file_path = Path(file_info["path"])

        # Extract text from PDF
        text_by_page = pdf_service.extract_text(file_path)

        # If text is very sparse, might be a scanned document
        total_text = sum(len(str(t)) for t in text_by_page.values())

        # Get metadata
        try:
            pdf_info = pdf_service.get_pdf_info(file_path)
            metadata = pdf_info.get("metadata", {})
        except Exception:
            metadata = {}

        # Estimate tokens (rough: ~4 chars per token)
        estimated_tokens = total_text // 4

        return DocumentContext(
            file_id=file_id,
            text_by_page=text_by_page,
            total_pages=len(text_by_page),
            estimated_tokens=estimated_tokens,
            metadata=metadata,
        )

    def _format_document_text(
        self,
        context: DocumentContext,
        pages: Optional[List[int]] = None,
        max_chars: int = 150000,
    ) -> str:
        """Format document text for LLM context."""
        parts = []

        target_pages = pages or list(context.text_by_page.keys())

        for page_num in sorted(target_pages):
            if page_num in context.text_by_page:
                text = context.text_by_page[page_num]
                if text.strip():
                    parts.append(f"--- Page {page_num} ---\n{text}")

        full_text = "\n\n".join(parts)

        # Truncate if too long
        if len(full_text) > max_chars:
            # Keep beginning and end
            half = max_chars // 2
            full_text = (
                full_text[:half] +
                "\n\n[... content truncated due to length ...]\n\n" +
                full_text[-half:]
            )

        return full_text

    # Session management
    def create_session(self, file_id: str) -> ChatSession:
        """Create a new chat session."""
        session_id = str(uuid.uuid4())
        session = ChatSession(
            id=session_id,
            file_id=file_id,
            messages=[],
            created_at=datetime.utcnow(),
            last_activity=datetime.utcnow(),
        )
        self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[ChatSession]:
        """Get an existing session."""
        session = self._sessions.get(session_id)
        if session:
            # Check if expired
            if datetime.utcnow() - session.last_activity > self._session_expiry:
                del self._sessions[session_id]
                return None
        return session

    def clear_session(self, session_id: str) -> bool:
        """Clear a chat session."""
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions."""
        now = datetime.utcnow()
        expired = [
            sid for sid, session in self._sessions.items()
            if now - session.last_activity > self._session_expiry
        ]
        for sid in expired:
            del self._sessions[sid]
        return len(expired)

    # Chat functionality
    async def chat(
        self,
        file_id: str,
        message: str,
        session_id: Optional[str] = None,
        pages: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Send a chat message and get a response."""
        client = get_llm_client()

        # Get or create session
        if session_id:
            session = self.get_session(session_id)
            if not session:
                session = self.create_session(file_id)
        else:
            session = self.create_session(file_id)

        # Prepare document context if not already done
        if not session.document_context:
            session.document_context = await self.prepare_document_context(file_id)

        # Format document text
        document_text = self._format_document_text(session.document_context, pages)

        # Build system prompt with document
        system = DOCUMENT_CHAT_SYSTEM.format(document_text=document_text)

        # Add user message to history
        session.messages.append(Message(role="user", content=message))
        session.last_activity = datetime.utcnow()

        # Get response
        response = await client.chat(
            messages=session.messages,
            system=system,
            max_tokens=4096,
            temperature=0.3,
        )

        # Add assistant response to history
        session.messages.append(Message(role="assistant", content=response.content))

        return {
            "session_id": session.id,
            "message": response.content,
            "model": response.model,
            "tokens_used": response.input_tokens + response.output_tokens,
        }

    async def stream_chat(
        self,
        file_id: str,
        message: str,
        session_id: Optional[str] = None,
        pages: Optional[List[int]] = None,
    ) -> AsyncIterator[str]:
        """Stream a chat response."""
        client = get_llm_client()

        # Get or create session
        if session_id:
            session = self.get_session(session_id)
            if not session:
                session = self.create_session(file_id)
        else:
            session = self.create_session(file_id)

        # Prepare document context if not already done
        if not session.document_context:
            session.document_context = await self.prepare_document_context(file_id)

        # Format document text
        document_text = self._format_document_text(session.document_context, pages)

        # Build system prompt with document
        system = DOCUMENT_CHAT_SYSTEM.format(document_text=document_text)

        # Add user message to history
        session.messages.append(Message(role="user", content=message))
        session.last_activity = datetime.utcnow()

        # Collect full response for history
        full_response = ""

        # Stream response
        async for chunk in client.stream(
            messages=session.messages,
            system=system,
            max_tokens=4096,
            temperature=0.3,
        ):
            full_response += chunk
            yield chunk

        # Add assistant response to history
        session.messages.append(Message(role="assistant", content=full_response))

        # Yield session info at the end
        yield f"\n\n[SESSION:{session.id}]"

    # Summarization
    async def summarize(
        self,
        file_id: str,
        detail_level: str = "detailed",
        pages: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Generate a summary of the document."""
        client = get_llm_client()

        # Get document context
        context = await self.prepare_document_context(file_id)
        document_text = self._format_document_text(context, pages)

        # Get prompt template
        if detail_level not in SUMMARY_PROMPTS:
            detail_level = "detailed"

        prompt = SUMMARY_PROMPTS[detail_level].format(document_text=document_text)

        # Generate summary
        response = await client.chat(
            messages=[Message(role="user", content=prompt)],
            system="You are a document summarization assistant. Provide clear, well-structured summaries.",
            max_tokens=2048,
            temperature=0.3,
        )

        return {
            "summary": response.content,
            "detail_level": detail_level,
            "pages_summarized": pages or list(range(1, context.total_pages + 1)),
            "model": response.model,
            "tokens_used": response.input_tokens + response.output_tokens,
        }

    # Data extraction
    async def extract_data(
        self,
        file_id: str,
        extraction_prompt: str,
        output_format: str = "text",
        pages: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Extract specific data from the document."""
        client = get_llm_client()

        # Get document context
        context = await self.prepare_document_context(file_id)
        document_text = self._format_document_text(context, pages)

        # Build extraction prompt
        format_instructions = {
            "text": "Provide the extracted information as plain text.",
            "json": "Format the output as valid JSON.",
            "table": "Format the output as a markdown table.",
            "list": "Format the output as a bullet-point list.",
        }

        full_prompt = f"{extraction_prompt}\n\n{format_instructions.get(output_format, format_instructions['text'])}"

        system = EXTRACTION_SYSTEM.format(
            document_text=document_text,
            extraction_prompt=full_prompt,
        )

        response = await client.chat(
            messages=[Message(role="user", content="Please extract the requested information.")],
            system=system,
            max_tokens=4096,
            temperature=0.1,  # Lower temperature for extraction
        )

        return {
            "data": response.content,
            "format": output_format,
            "extraction_prompt": extraction_prompt,
            "model": response.model,
            "tokens_used": response.input_tokens + response.output_tokens,
        }

    # Quick actions
    async def get_key_points(self, file_id: str) -> Dict[str, Any]:
        """Extract key points from the document."""
        return await self.extract_data(
            file_id,
            "Extract the 5-7 most important key points from this document. Focus on main ideas, conclusions, and significant facts.",
            output_format="list",
        )

    async def get_action_items(self, file_id: str) -> Dict[str, Any]:
        """Extract action items from the document."""
        return await self.extract_data(
            file_id,
            "Extract any action items, tasks, recommendations, or next steps mentioned in this document. If none are found, say 'No action items found.'",
            output_format="list",
        )

    async def answer_questions(self, file_id: str, questions: List[str]) -> Dict[str, Any]:
        """Answer specific questions about the document."""
        questions_text = "\n".join(f"- {q}" for q in questions)
        return await self.extract_data(
            file_id,
            f"Answer the following questions based on the document:\n{questions_text}",
            output_format="text",
        )


# Singleton instance
ai_service = AIService()
