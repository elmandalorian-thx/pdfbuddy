"""
Smart Command Router

Provides API endpoints for natural language command parsing and execution.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.command_parser import command_parser, DocumentContext, Intent, CommandSuggestion
from app.services.file_service import file_service
from app.services.pdf_service import pdf_service


router = APIRouter(prefix="/api/smart-command", tags=["smart-commands"])


# Pydantic models
class SmartCommandRequest(BaseModel):
    """Request to parse a natural language command."""
    command: str = Field(..., min_length=1, max_length=500, description="The natural language command")
    file_id: str = Field(..., description="The file ID of the document")
    selected_pages: Optional[List[int]] = Field(None, description="Currently selected pages (for context)")


class ParsedCommandResponse(BaseModel):
    """Response containing the parsed command."""
    success: bool
    intent: str
    parameters: Dict[str, Any]
    confidence: float = Field(..., ge=0.0, le=1.0)
    action_preview: str
    api_endpoint: str
    api_payload: Dict[str, Any]
    is_destructive: bool
    requires_confirmation: bool
    warnings: List[str]
    suggestions: List[str]


class ExecuteCommandRequest(BaseModel):
    """Request to execute a validated command."""
    file_id: str
    intent: str
    parameters: Dict[str, Any]
    confirmed: bool = False


class ExecuteCommandResponse(BaseModel):
    """Response from command execution."""
    success: bool
    message: str
    result: Optional[Dict[str, Any]] = None


class SuggestionItem(BaseModel):
    """A command suggestion."""
    command: str
    description: str
    intent: str
    category: str


class SuggestionsResponse(BaseModel):
    """Response containing command suggestions."""
    suggestions: List[SuggestionItem]
    recent: List[str] = []


class CapabilitiesResponse(BaseModel):
    """Response listing all supported commands."""
    categories: Dict[str, List[SuggestionItem]]
    total_commands: int


@router.post("/parse", response_model=ParsedCommandResponse)
async def parse_command(request: SmartCommandRequest) -> ParsedCommandResponse:
    """
    Parse a natural language command without executing it.

    Returns the parsed intent, parameters, and a preview of the action.
    Use this to show users what will happen before they confirm.
    """
    # Get file info for context
    try:
        file_info = file_service.get_file_info(request.file_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")

    # Build document context
    context = DocumentContext(
        file_id=request.file_id,
        num_pages=file_info.get("num_pages", 1),
        has_text=True,
        has_images=True
    )

    # Parse the command
    result = command_parser.parse(request.command, context)

    # Determine if confirmation is required
    requires_confirmation = (
        result.is_destructive or
        result.intent == Intent.ENCRYPT or
        len(result.warnings) > 0
    )

    return ParsedCommandResponse(
        success=result.intent != Intent.UNKNOWN,
        intent=result.intent.value,
        parameters=result.parameters,
        confidence=result.confidence,
        action_preview=result.human_readable_action,
        api_endpoint=result.api_endpoint,
        api_payload=result.api_payload,
        is_destructive=result.is_destructive,
        requires_confirmation=requires_confirmation,
        warnings=result.warnings,
        suggestions=result.suggestions,
    )


@router.post("/execute", response_model=ExecuteCommandResponse)
async def execute_command(request: ExecuteCommandRequest) -> ExecuteCommandResponse:
    """
    Execute a previously parsed and confirmed command.

    This endpoint maps the parsed intent to the actual PDF operation
    and returns the result.
    """
    # Verify file exists
    try:
        file_info = file_service.get_file_info(request.file_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")

    # Map intent to operation
    try:
        intent = Intent(request.intent)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown intent: {request.intent}")

    # Check confirmation for destructive operations
    if intent in {Intent.REMOVE_PAGES, Intent.ENCRYPT, Intent.SPLIT} and not request.confirmed:
        raise HTTPException(
            status_code=400,
            detail="This operation requires confirmation. Set confirmed=true to proceed."
        )

    # Execute the operation
    try:
        result = await _execute_intent(intent, request.file_id, request.parameters, file_info)
        return ExecuteCommandResponse(
            success=True,
            message=f"Successfully executed: {intent.value}",
            result=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _execute_intent(
    intent: Intent,
    file_id: str,
    parameters: Dict[str, Any],
    file_info: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute an intent by calling the appropriate service method."""
    from pathlib import Path

    file_path = Path(file_info["path"])

    if intent == Intent.REMOVE_PAGES:
        pages = parameters.get("pages", [])
        result_path = pdf_service.remove_pages(file_path, pages, file_id)
        return {"result_path": str(result_path), "pages_removed": len(pages)}

    elif intent == Intent.ROTATE_PAGES:
        pages = parameters.get("pages", [])
        rotation = parameters.get("rotation", 90)
        result_path = pdf_service.rotate_pages(file_path, pages, rotation, file_id)
        return {"result_path": str(result_path), "pages_rotated": len(pages), "rotation": rotation}

    elif intent == Intent.ADD_WATERMARK:
        text = parameters.get("text", "")
        opacity = parameters.get("opacity", 0.3)
        result_path = pdf_service.add_watermark(
            file_path,
            text=text,
            opacity=opacity,
            file_id=file_id
        )
        return {"result_path": str(result_path), "watermark_text": text}

    elif intent == Intent.ENCRYPT:
        user_password = parameters.get("user_password", "")
        owner_password = parameters.get("owner_password", user_password)
        result_path = pdf_service.encrypt_pdf(
            file_path,
            user_password=user_password,
            owner_password=owner_password,
            file_id=file_id
        )
        return {"result_path": str(result_path), "encrypted": True}

    elif intent == Intent.SPLIT:
        mode = parameters.get("mode", "individual")
        if mode == "individual":
            result_paths = pdf_service.split_pdf(file_path, mode="individual", file_id=file_id)
        elif mode == "count":
            pages_per_file = parameters.get("pages_per_file", 1)
            result_paths = pdf_service.split_pdf(
                file_path,
                mode="count",
                pages_per_file=pages_per_file,
                file_id=file_id
            )
        else:
            ranges = parameters.get("ranges", [])
            result_paths = pdf_service.split_pdf(
                file_path,
                mode="ranges",
                ranges=ranges,
                file_id=file_id
            )
        return {"result_paths": [str(p) for p in result_paths], "files_created": len(result_paths)}

    elif intent == Intent.ADD_BLANK_PAGE:
        position = parameters.get("position", 1)
        page_size = parameters.get("page_size", "A4")
        result_path = pdf_service.add_blank_page(file_path, position, page_size, file_id)
        return {"result_path": str(result_path), "position": position}

    elif intent == Intent.REORDER_PAGES:
        new_order = parameters.get("new_order", [])
        result_path = pdf_service.reorder_pages(file_path, new_order, file_id)
        return {"result_path": str(result_path), "new_order": new_order}

    elif intent == Intent.EXTRACT_TEXT:
        pages = parameters.get("pages")
        text_by_page = pdf_service.extract_text(file_path, pages)
        return {"text": text_by_page}

    elif intent == Intent.OCR:
        from app.services.ocr_service import ocr_service
        mode = parameters.get("mode", "extract")
        pages = parameters.get("pages")

        if mode == "searchable":
            result_path = ocr_service.create_searchable_pdf(file_path, file_id)
            return {"result_path": str(result_path), "mode": "searchable"}
        else:
            text = ocr_service.extract_text_from_pdf(file_path, pages)
            return {"text": text, "mode": "extract"}

    elif intent == Intent.UPDATE_METADATA:
        metadata = {}
        if "title" in parameters:
            metadata["title"] = parameters["title"]
        if "author" in parameters:
            metadata["author"] = parameters["author"]
        if "subject" in parameters:
            metadata["subject"] = parameters["subject"]

        result_path = pdf_service.update_metadata(file_path, metadata, file_id)
        return {"result_path": str(result_path), "updated_fields": list(metadata.keys())}

    elif intent == Intent.EXTRACT_IMAGES:
        pages = parameters.get("pages")
        images = pdf_service.extract_images(file_path, pages, file_id)
        return {"images": images, "count": len(images)}

    elif intent == Intent.EXTRACT_TABLES:
        pages = parameters.get("pages")
        tables = pdf_service.extract_tables(file_path, pages)
        return {"tables": tables, "count": len(tables)}

    else:
        raise ValueError(f"Unsupported intent: {intent}")


@router.get("/suggestions", response_model=SuggestionsResponse)
async def get_suggestions(
    prefix: str = "",
    file_id: Optional[str] = None
) -> SuggestionsResponse:
    """
    Get command suggestions based on optional prefix.

    Use this for autocomplete as the user types.
    """
    capabilities = command_parser.get_capabilities()

    # Filter by prefix if provided
    if prefix:
        prefix_lower = prefix.lower()
        filtered = [
            SuggestionItem(
                command=cap.command,
                description=cap.description,
                intent=cap.intent.value,
                category=cap.category
            )
            for cap in capabilities
            if prefix_lower in cap.command.lower() or prefix_lower in cap.description.lower()
        ]
    else:
        filtered = [
            SuggestionItem(
                command=cap.command,
                description=cap.description,
                intent=cap.intent.value,
                category=cap.category
            )
            for cap in capabilities
        ]

    return SuggestionsResponse(
        suggestions=filtered[:10],  # Limit to 10 suggestions
        recent=[]  # Could be populated from user session/storage
    )


@router.get("/capabilities", response_model=CapabilitiesResponse)
async def get_capabilities() -> CapabilitiesResponse:
    """
    Get all supported commands organized by category.

    Use this to show users what commands are available.
    """
    capabilities = command_parser.get_capabilities()

    # Group by category
    categories: Dict[str, List[SuggestionItem]] = {}
    for cap in capabilities:
        if cap.category not in categories:
            categories[cap.category] = []
        categories[cap.category].append(
            SuggestionItem(
                command=cap.command,
                description=cap.description,
                intent=cap.intent.value,
                category=cap.category
            )
        )

    return CapabilitiesResponse(
        categories=categories,
        total_commands=len(capabilities)
    )
