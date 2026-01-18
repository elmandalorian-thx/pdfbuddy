"""
Smart Command Parser Service

Parses natural language commands into structured operations that map to existing PDF API endpoints.
Uses a hybrid approach: rule-based regex patterns for common commands with fuzzy matching for typos.
"""

import re
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from difflib import SequenceMatcher


class Intent(Enum):
    """Supported command intents mapping to PDF operations."""
    REMOVE_PAGES = "remove_pages"
    ROTATE_PAGES = "rotate_pages"
    ADD_WATERMARK = "add_watermark"
    ENCRYPT = "encrypt"
    SPLIT = "split"
    MERGE = "merge"
    EXTRACT_TEXT = "extract_text"
    ADD_BLANK_PAGE = "add_blank_page"
    REORDER_PAGES = "reorder_pages"
    OCR = "ocr"
    UPDATE_METADATA = "update_metadata"
    EXTRACT_IMAGES = "extract_images"
    EXTRACT_TABLES = "extract_tables"
    UNKNOWN = "unknown"


@dataclass
class DocumentContext:
    """Context about the current document for validation."""
    file_id: str
    num_pages: int
    has_text: bool = True
    has_images: bool = True


@dataclass
class ParsedCommand:
    """Result of parsing a natural language command."""
    intent: Intent
    parameters: Dict[str, Any]
    confidence: float  # 0.0 - 1.0
    original_text: str
    api_endpoint: str
    api_payload: Dict[str, Any]
    is_destructive: bool
    human_readable_action: str
    warnings: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


@dataclass
class CommandSuggestion:
    """A suggested command for autocomplete."""
    command: str
    description: str
    intent: Intent
    category: str


# Intent to API endpoint mapping
INTENT_ENDPOINTS = {
    Intent.REMOVE_PAGES: "/api/remove-pages",
    Intent.ROTATE_PAGES: "/api/rotate",
    Intent.ADD_WATERMARK: "/api/watermark",
    Intent.ENCRYPT: "/api/encrypt",
    Intent.SPLIT: "/api/split",
    Intent.ADD_BLANK_PAGE: "/api/add-blank-page",
    Intent.REORDER_PAGES: "/api/reorder-pages",
    Intent.EXTRACT_TEXT: "/api/extract-text",
    Intent.OCR: "/api/ocr/extract",
    Intent.UPDATE_METADATA: "/api/metadata",
    Intent.EXTRACT_IMAGES: "/api/extract-images",
    Intent.EXTRACT_TABLES: "/api/extract-tables",
}

# Destructive operations that modify the document
DESTRUCTIVE_INTENTS = {
    Intent.REMOVE_PAGES,
    Intent.ROTATE_PAGES,
    Intent.ADD_WATERMARK,
    Intent.ENCRYPT,
    Intent.SPLIT,
    Intent.ADD_BLANK_PAGE,
    Intent.REORDER_PAGES,
}

# Command patterns for intent recognition
# Each pattern is a tuple of (regex_pattern, parameter_extractor_function)
COMMAND_PATTERNS: Dict[Intent, List[Tuple[str, Any]]] = {
    Intent.REMOVE_PAGES: [
        (r"(?:remove|delete|drop|get rid of|take out)\s+(?:pages?\s+)?(.+)", "extract_pages"),
        (r"(?:remove|delete)\s+(?:the\s+)?(?:last|first)\s+(\d+)\s+pages?", "extract_relative_pages"),
    ],
    Intent.ROTATE_PAGES: [
        (r"rotate\s+(?:pages?\s+)?(.+?)?\s*(?:by\s+)?(\d+)?\s*(?:degrees?)?(?:\s+(clockwise|counterclockwise|left|right))?", "extract_rotation"),
        (r"turn\s+(?:pages?\s+)?(.+?)?\s+(clockwise|counterclockwise|right|left|upside down)", "extract_rotation_direction"),
        (r"flip\s+(?:pages?\s+)?(.+?)?\s*(?:upside down)?", "extract_flip"),
    ],
    Intent.ADD_WATERMARK: [
        (r"(?:add\s+)?(?:a\s+)?watermark\s+(?:saying\s+|with\s+(?:text\s+)?|text\s+)?[\"']?(.+?)[\"']?(?:\s+(?:at\s+)?(\d+)%?\s*(?:opacity)?)?$", "extract_watermark"),
        (r"watermark\s+(?:all\s+)?(?:pages?\s+)?(?:with\s+)?[\"']?(.+?)[\"']?$", "extract_watermark_simple"),
        (r"(?:add|put)\s+[\"'](.+?)[\"']\s+(?:as\s+)?(?:a\s+)?watermark", "extract_watermark_quoted"),
    ],
    Intent.ENCRYPT: [
        (r"(?:encrypt|protect|password[- ]?protect|lock)\s+(?:with\s+)?(?:password\s+)?[\"']?(.+?)[\"']?$", "extract_password"),
        (r"(?:add|set)\s+(?:a\s+)?password\s+[\"']?(.+?)[\"']?$", "extract_password"),
        (r"(?:secure|lock)\s+(?:the\s+)?(?:document|pdf|file)(?:\s+with\s+[\"']?(.+?)[\"']?)?$", "extract_password_optional"),
    ],
    Intent.SPLIT: [
        (r"split\s+(?:into\s+)?(?:individual\s+|separate\s+)?pages?", "extract_split_individual"),
        (r"split\s+(?:every|each)\s+(\d+)\s+pages?", "extract_split_count"),
        (r"split\s+(?:at\s+)?pages?\s+(.+)", "extract_split_at"),
        (r"(?:extract|separate)\s+pages?\s+(.+?)(?:\s+(?:as|into)\s+(?:a\s+)?(?:separate|new)\s+(?:file|pdf))?", "extract_split_pages"),
    ],
    Intent.ADD_BLANK_PAGE: [
        (r"(?:add|insert)\s+(?:a\s+)?blank\s+page\s+(?:at\s+)?(?:position\s+)?(\d+)", "extract_position"),
        (r"(?:add|insert)\s+(?:a\s+)?blank\s+page\s+(?:after|before)\s+(?:page\s+)?(\d+)", "extract_position_relative"),
        (r"(?:add|insert)\s+(?:a\s+)?(?:new\s+)?(?:empty|blank)\s+page(?:\s+(?:at\s+)?(?:the\s+)?(?:end|beginning|start))?", "extract_position_keyword"),
    ],
    Intent.EXTRACT_TEXT: [
        (r"(?:extract|get|copy|grab|pull)\s+(?:all\s+)?(?:the\s+)?text(?:\s+from\s+(?:pages?\s+)?(.+))?", "extract_text_pages"),
        (r"(?:copy|get)\s+(?:the\s+)?(?:text|content)(?:\s+from\s+(?:pages?\s+)?(.+))?", "extract_text_pages"),
    ],
    Intent.OCR: [
        (r"(?:ocr|recognize\s+text\s+in)\s+(?:this\s+)?(?:document|pdf|file)?(?:\s+(?:pages?\s+)?(.+))?", "extract_ocr_pages"),
        (r"(?:make|convert)\s+(?:this\s+)?(?:pdf\s+)?searchable", "extract_ocr_searchable"),
        (r"(?:extract|recognize)\s+text\s+(?:from\s+)?(?:scanned?\s+)?(?:images?|pages?)", "extract_ocr_simple"),
    ],
    Intent.UPDATE_METADATA: [
        (r"(?:set|change|update)\s+(?:the\s+)?title\s+(?:to\s+)?[\"']?(.+?)[\"']?$", "extract_metadata_title"),
        (r"(?:set|change|update)\s+(?:the\s+)?author\s+(?:to\s+)?[\"']?(.+?)[\"']?$", "extract_metadata_author"),
        (r"(?:set|change|update)\s+(?:the\s+)?subject\s+(?:to\s+)?[\"']?(.+?)[\"']?$", "extract_metadata_subject"),
    ],
    Intent.REORDER_PAGES: [
        (r"(?:reorder|rearrange)\s+pages?\s+(?:to|as)\s+(.+)", "extract_new_order"),
        (r"(?:move|put)\s+page\s+(\d+)\s+(?:to\s+)?(?:position\s+)?(\d+)", "extract_move_page"),
        (r"(?:swap|switch)\s+pages?\s+(\d+)\s+(?:and|with)\s+(\d+)", "extract_swap_pages"),
    ],
    Intent.EXTRACT_IMAGES: [
        (r"(?:extract|get|save|export)\s+(?:all\s+)?(?:the\s+)?images?(?:\s+from\s+(?:pages?\s+)?(.+))?", "extract_image_pages"),
    ],
    Intent.EXTRACT_TABLES: [
        (r"(?:extract|get|export)\s+(?:all\s+)?(?:the\s+)?tables?(?:\s+from\s+(?:pages?\s+)?(.+))?", "extract_table_pages"),
    ],
}

# Keywords for fuzzy matching intent detection
INTENT_KEYWORDS = {
    Intent.REMOVE_PAGES: ["remove", "delete", "drop", "rid", "take out"],
    Intent.ROTATE_PAGES: ["rotate", "turn", "flip", "orientation"],
    Intent.ADD_WATERMARK: ["watermark", "stamp", "mark"],
    Intent.ENCRYPT: ["encrypt", "protect", "password", "lock", "secure"],
    Intent.SPLIT: ["split", "separate", "divide", "extract"],
    Intent.ADD_BLANK_PAGE: ["blank", "empty", "new page", "insert page"],
    Intent.EXTRACT_TEXT: ["extract text", "get text", "copy text", "grab text"],
    Intent.OCR: ["ocr", "searchable", "recognize", "scan"],
    Intent.UPDATE_METADATA: ["title", "author", "subject", "metadata"],
    Intent.REORDER_PAGES: ["reorder", "rearrange", "move page", "swap"],
    Intent.EXTRACT_IMAGES: ["extract image", "get image", "save image"],
    Intent.EXTRACT_TABLES: ["extract table", "get table"],
}


class CommandParser:
    """Parses natural language commands into structured operations."""

    def __init__(self):
        self._compile_patterns()

    def _compile_patterns(self):
        """Pre-compile regex patterns for performance."""
        self._compiled_patterns: Dict[Intent, List[Tuple[re.Pattern, str]]] = {}
        for intent, patterns in COMMAND_PATTERNS.items():
            self._compiled_patterns[intent] = [
                (re.compile(pattern, re.IGNORECASE), extractor)
                for pattern, extractor in patterns
            ]

    def parse(self, command: str, context: DocumentContext) -> ParsedCommand:
        """Parse a natural language command into a structured operation."""
        command = command.strip()

        # Try pattern matching first
        for intent, patterns in self._compiled_patterns.items():
            for pattern, extractor_name in patterns:
                match = pattern.match(command)
                if match:
                    extractor = getattr(self, f"_{extractor_name}", None)
                    if extractor:
                        params = extractor(match, context)
                        return self._build_result(intent, params, command, context, confidence=0.95)

        # Fallback to fuzzy keyword matching
        intent, confidence = self._fuzzy_match_intent(command)
        if intent != Intent.UNKNOWN and confidence > 0.5:
            params = self._extract_generic_params(command, intent, context)
            result = self._build_result(intent, params, command, context, confidence=confidence)
            result.suggestions = self._generate_suggestions(command, intent)
            return result

        # Unknown command
        return ParsedCommand(
            intent=Intent.UNKNOWN,
            parameters={},
            confidence=0.0,
            original_text=command,
            api_endpoint="",
            api_payload={},
            is_destructive=False,
            human_readable_action="Unknown command",
            suggestions=self._get_all_suggestions(command),
        )

    def _fuzzy_match_intent(self, command: str) -> Tuple[Intent, float]:
        """Use fuzzy matching to detect intent from keywords."""
        command_lower = command.lower()
        best_intent = Intent.UNKNOWN
        best_score = 0.0

        for intent, keywords in INTENT_KEYWORDS.items():
            for keyword in keywords:
                if keyword in command_lower:
                    # Direct keyword match
                    score = 0.8
                    if score > best_score:
                        best_score = score
                        best_intent = intent
                else:
                    # Fuzzy match
                    for word in command_lower.split():
                        ratio = SequenceMatcher(None, keyword, word).ratio()
                        if ratio > 0.7 and ratio > best_score:
                            best_score = ratio * 0.7  # Discount fuzzy matches
                            best_intent = intent

        return best_intent, best_score

    # Parameter extractors
    def _extract_pages(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract page numbers from a match."""
        pages_str = match.group(1)
        pages = self._parse_page_range(pages_str, context.num_pages)
        return {"pages": pages}

    def _extract_relative_pages(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract relative page references (first/last N pages)."""
        count = int(match.group(1))
        command = match.group(0).lower()
        if "last" in command:
            pages = list(range(context.num_pages - count + 1, context.num_pages + 1))
        else:  # first
            pages = list(range(1, count + 1))
        return {"pages": pages}

    def _extract_rotation(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract rotation parameters."""
        pages_str = match.group(1)
        degrees_str = match.group(2)
        direction = match.group(3) if match.lastindex >= 3 else None

        pages = self._parse_page_range(pages_str, context.num_pages) if pages_str else list(range(1, context.num_pages + 1))

        if degrees_str:
            rotation = int(degrees_str)
        elif direction:
            direction = direction.lower()
            if direction in ["counterclockwise", "left"]:
                rotation = 270
            elif direction in ["clockwise", "right"]:
                rotation = 90
            else:
                rotation = 90
        else:
            rotation = 90  # Default

        return {"pages": pages, "rotation": rotation}

    def _extract_rotation_direction(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract rotation from direction words."""
        pages_str = match.group(1)
        direction = match.group(2).lower()

        pages = self._parse_page_range(pages_str, context.num_pages) if pages_str else list(range(1, context.num_pages + 1))

        rotation_map = {
            "clockwise": 90,
            "right": 90,
            "counterclockwise": 270,
            "left": 270,
            "upside down": 180,
        }
        rotation = rotation_map.get(direction, 90)

        return {"pages": pages, "rotation": rotation}

    def _extract_flip(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract flip (180 degree rotation)."""
        pages_str = match.group(1)
        pages = self._parse_page_range(pages_str, context.num_pages) if pages_str else list(range(1, context.num_pages + 1))
        return {"pages": pages, "rotation": 180}

    def _extract_watermark(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract watermark text and optional opacity."""
        text = match.group(1).strip()
        opacity = float(match.group(2)) / 100 if match.lastindex >= 2 and match.group(2) else 0.3
        return {"text": text, "opacity": opacity}

    def _extract_watermark_simple(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract simple watermark text."""
        text = match.group(1).strip()
        return {"text": text, "opacity": 0.3}

    def _extract_watermark_quoted(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract quoted watermark text."""
        text = match.group(1).strip()
        return {"text": text, "opacity": 0.3}

    def _extract_password(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract password for encryption."""
        password = match.group(1).strip() if match.group(1) else ""
        return {"user_password": password}

    def _extract_password_optional(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract optional password."""
        password = match.group(1).strip() if match.lastindex >= 1 and match.group(1) else ""
        return {"user_password": password, "needs_password": not password}

    def _extract_split_individual(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract split into individual pages."""
        return {"mode": "individual"}

    def _extract_split_count(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract split by page count."""
        count = int(match.group(1))
        return {"mode": "count", "pages_per_file": count}

    def _extract_split_at(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract split at specific pages."""
        pages_str = match.group(1)
        pages = self._parse_page_range(pages_str, context.num_pages)
        return {"mode": "ranges", "split_at": pages}

    def _extract_split_pages(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract pages to split/extract."""
        pages_str = match.group(1)
        pages = self._parse_page_range(pages_str, context.num_pages)
        return {"mode": "ranges", "ranges": [[min(pages), max(pages)]]}

    def _extract_position(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract position for blank page."""
        position = int(match.group(1))
        return {"position": position}

    def _extract_position_relative(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract relative position (after/before page X)."""
        page = int(match.group(1))
        command = match.group(0).lower()
        position = page + 1 if "after" in command else page
        return {"position": position}

    def _extract_position_keyword(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract position from keyword (end/beginning)."""
        command = match.group(0).lower()
        if "end" in command:
            position = context.num_pages + 1
        elif "beginning" in command or "start" in command:
            position = 1
        else:
            position = context.num_pages + 1  # Default to end
        return {"position": position}

    def _extract_text_pages(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract pages for text extraction."""
        pages_str = match.group(1) if match.lastindex >= 1 and match.group(1) else None
        pages = self._parse_page_range(pages_str, context.num_pages) if pages_str else None
        return {"pages": pages}

    def _extract_ocr_pages(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract pages for OCR."""
        pages_str = match.group(1) if match.lastindex >= 1 and match.group(1) else None
        pages = self._parse_page_range(pages_str, context.num_pages) if pages_str else None
        return {"pages": pages, "mode": "extract"}

    def _extract_ocr_searchable(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract OCR searchable mode."""
        return {"mode": "searchable"}

    def _extract_ocr_simple(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Simple OCR extraction."""
        return {"mode": "extract"}

    def _extract_metadata_title(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract title metadata."""
        title = match.group(1).strip()
        return {"title": title}

    def _extract_metadata_author(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract author metadata."""
        author = match.group(1).strip()
        return {"author": author}

    def _extract_metadata_subject(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract subject metadata."""
        subject = match.group(1).strip()
        return {"subject": subject}

    def _extract_new_order(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract new page order."""
        order_str = match.group(1)
        order = self._parse_page_list(order_str)
        return {"new_order": order}

    def _extract_move_page(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract move page operation."""
        from_page = int(match.group(1))
        to_position = int(match.group(2))
        # Build new order
        pages = list(range(1, context.num_pages + 1))
        pages.remove(from_page)
        pages.insert(to_position - 1, from_page)
        return {"new_order": pages}

    def _extract_swap_pages(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract swap pages operation."""
        page1 = int(match.group(1))
        page2 = int(match.group(2))
        pages = list(range(1, context.num_pages + 1))
        idx1, idx2 = pages.index(page1), pages.index(page2)
        pages[idx1], pages[idx2] = pages[idx2], pages[idx1]
        return {"new_order": pages}

    def _extract_image_pages(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract pages for image extraction."""
        pages_str = match.group(1) if match.lastindex >= 1 and match.group(1) else None
        pages = self._parse_page_range(pages_str, context.num_pages) if pages_str else None
        return {"pages": pages}

    def _extract_table_pages(self, match: re.Match, context: DocumentContext) -> Dict[str, Any]:
        """Extract pages for table extraction."""
        pages_str = match.group(1) if match.lastindex >= 1 and match.group(1) else None
        pages = self._parse_page_range(pages_str, context.num_pages) if pages_str else None
        return {"pages": pages}

    def _extract_generic_params(self, command: str, intent: Intent, context: DocumentContext) -> Dict[str, Any]:
        """Extract generic parameters when pattern matching fails."""
        params = {}

        # Try to extract page numbers
        page_match = re.search(r'pages?\s+(\d+(?:\s*[-,]\s*\d+)*)', command, re.IGNORECASE)
        if page_match:
            params["pages"] = self._parse_page_range(page_match.group(1), context.num_pages)

        # Try to extract quoted text
        quoted_match = re.search(r'["\'](.+?)["\']', command)
        if quoted_match:
            text = quoted_match.group(1)
            if intent == Intent.ADD_WATERMARK:
                params["text"] = text
            elif intent == Intent.ENCRYPT:
                params["user_password"] = text

        return params

    def _parse_page_range(self, range_str: str, max_pages: int) -> List[int]:
        """Parse a page range string like '1-5, 8, 10-12' into a list of page numbers."""
        if not range_str:
            return list(range(1, max_pages + 1))

        pages = []
        range_str = range_str.strip()

        # Handle "all" keyword
        if range_str.lower() == "all":
            return list(range(1, max_pages + 1))

        parts = re.split(r'[,\s]+', range_str)

        for part in parts:
            part = part.strip()
            if not part:
                continue
            if "-" in part:
                try:
                    start, end = part.split("-")
                    start, end = int(start.strip()), int(end.strip())
                    pages.extend(range(start, end + 1))
                except ValueError:
                    continue
            else:
                try:
                    pages.append(int(part))
                except ValueError:
                    continue

        # Filter valid pages and remove duplicates
        pages = sorted(set(p for p in pages if 1 <= p <= max_pages))
        return pages

    def _parse_page_list(self, list_str: str) -> List[int]:
        """Parse a page list like '3, 1, 2, 4, 5' into ordered list."""
        pages = []
        parts = re.split(r'[,\s]+', list_str)
        for part in parts:
            try:
                pages.append(int(part.strip()))
            except ValueError:
                continue
        return pages

    def _build_result(
        self,
        intent: Intent,
        params: Dict[str, Any],
        command: str,
        context: DocumentContext,
        confidence: float
    ) -> ParsedCommand:
        """Build a ParsedCommand result."""
        endpoint = INTENT_ENDPOINTS.get(intent, "")
        is_destructive = intent in DESTRUCTIVE_INTENTS

        # Build API payload
        api_payload = {"file_id": context.file_id, **params}

        # Generate human-readable action description
        action = self._generate_action_description(intent, params, context)

        # Generate warnings
        warnings = self._generate_warnings(intent, params, context)

        return ParsedCommand(
            intent=intent,
            parameters=params,
            confidence=confidence,
            original_text=command,
            api_endpoint=endpoint,
            api_payload=api_payload,
            is_destructive=is_destructive,
            human_readable_action=action,
            warnings=warnings,
        )

    def _generate_action_description(self, intent: Intent, params: Dict[str, Any], context: DocumentContext) -> str:
        """Generate a human-readable description of the action."""
        descriptions = {
            Intent.REMOVE_PAGES: lambda p: f"Remove {len(p.get('pages', []))} page(s): {self._format_page_list(p.get('pages', []))}",
            Intent.ROTATE_PAGES: lambda p: f"Rotate {len(p.get('pages', []))} page(s) by {p.get('rotation', 90)}°",
            Intent.ADD_WATERMARK: lambda p: f"Add watermark \"{p.get('text', '')}\" with {int(p.get('opacity', 0.3) * 100)}% opacity",
            Intent.ENCRYPT: lambda p: f"Encrypt document with password",
            Intent.SPLIT: lambda p: self._describe_split(p, context),
            Intent.ADD_BLANK_PAGE: lambda p: f"Add blank page at position {p.get('position', 1)}",
            Intent.EXTRACT_TEXT: lambda p: f"Extract text from {self._format_page_list(p.get('pages')) if p.get('pages') else 'all pages'}",
            Intent.OCR: lambda p: f"{'Make PDF searchable' if p.get('mode') == 'searchable' else 'Extract text using OCR'}",
            Intent.UPDATE_METADATA: lambda p: self._describe_metadata(p),
            Intent.REORDER_PAGES: lambda p: f"Reorder pages to: {', '.join(map(str, p.get('new_order', [])))}",
            Intent.EXTRACT_IMAGES: lambda p: f"Extract images from {self._format_page_list(p.get('pages')) if p.get('pages') else 'all pages'}",
            Intent.EXTRACT_TABLES: lambda p: f"Extract tables from {self._format_page_list(p.get('pages')) if p.get('pages') else 'all pages'}",
        }

        formatter = descriptions.get(intent, lambda p: "Unknown action")
        return formatter(params)

    def _describe_split(self, params: Dict[str, Any], context: DocumentContext) -> str:
        """Describe split operation."""
        mode = params.get("mode", "individual")
        if mode == "individual":
            return f"Split into {context.num_pages} individual pages"
        elif mode == "count":
            count = params.get("pages_per_file", 1)
            return f"Split every {count} pages"
        elif mode == "ranges":
            return f"Split at specified pages"
        return "Split document"

    def _describe_metadata(self, params: Dict[str, Any]) -> str:
        """Describe metadata update."""
        parts = []
        if "title" in params:
            parts.append(f"title to \"{params['title']}\"")
        if "author" in params:
            parts.append(f"author to \"{params['author']}\"")
        if "subject" in params:
            parts.append(f"subject to \"{params['subject']}\"")
        return f"Set {', '.join(parts)}" if parts else "Update metadata"

    def _format_page_list(self, pages: List[int]) -> str:
        """Format a page list for display."""
        if not pages:
            return "none"
        if len(pages) <= 5:
            return ", ".join(map(str, pages))
        return f"{pages[0]}-{pages[-1]}" if pages == list(range(pages[0], pages[-1] + 1)) else f"{pages[0]}, {pages[1]}, ... {pages[-1]}"

    def _generate_warnings(self, intent: Intent, params: Dict[str, Any], context: DocumentContext) -> List[str]:
        """Generate warnings for potentially dangerous operations."""
        warnings = []

        if intent == Intent.REMOVE_PAGES:
            pages = params.get("pages", [])
            if len(pages) >= context.num_pages:
                warnings.append("Cannot remove all pages. At least one page must remain.")
            elif len(pages) > context.num_pages // 2:
                warnings.append(f"This will remove more than half of the document ({len(pages)} of {context.num_pages} pages).")

        if intent == Intent.ENCRYPT:
            if not params.get("user_password"):
                warnings.append("No password provided. Please specify a password.")
            elif len(params.get("user_password", "")) < 4:
                warnings.append("Password is very short. Consider using a longer password.")

        if intent == Intent.SPLIT and params.get("mode") == "individual":
            if context.num_pages > 50:
                warnings.append(f"This will create {context.num_pages} separate files.")

        return warnings

    def _generate_suggestions(self, command: str, intent: Intent) -> List[str]:
        """Generate alternative command suggestions."""
        suggestions_map = {
            Intent.ROTATE_PAGES: [
                "rotate all pages 90 degrees",
                "rotate page 1 clockwise",
                "rotate pages 1-5 counterclockwise",
            ],
            Intent.REMOVE_PAGES: [
                "remove pages 1-5",
                "delete the last 3 pages",
                "remove page 1",
            ],
            Intent.ADD_WATERMARK: [
                "add watermark \"CONFIDENTIAL\"",
                "watermark DRAFT at 50% opacity",
            ],
        }
        return suggestions_map.get(intent, [])

    def _get_all_suggestions(self, command: str) -> List[str]:
        """Get suggestions for unknown commands."""
        return [
            "remove pages 1-5",
            "rotate page 1 clockwise",
            "add watermark \"DRAFT\"",
            "encrypt with password secret",
            "split into individual pages",
            "extract text",
            "make searchable",
        ]

    def get_capabilities(self) -> List[CommandSuggestion]:
        """Return list of all supported commands with examples."""
        return [
            CommandSuggestion("remove pages 1-5", "Remove specified pages from the document", Intent.REMOVE_PAGES, "Page Operations"),
            CommandSuggestion("delete the last 3 pages", "Remove the last N pages", Intent.REMOVE_PAGES, "Page Operations"),
            CommandSuggestion("rotate page 1 clockwise", "Rotate pages by 90°", Intent.ROTATE_PAGES, "Page Operations"),
            CommandSuggestion("rotate all pages 180 degrees", "Rotate all pages", Intent.ROTATE_PAGES, "Page Operations"),
            CommandSuggestion("add blank page after 5", "Insert a blank page", Intent.ADD_BLANK_PAGE, "Page Operations"),
            CommandSuggestion("reorder pages as 3, 1, 2", "Change page order", Intent.REORDER_PAGES, "Page Operations"),
            CommandSuggestion("add watermark \"DRAFT\"", "Add text watermark", Intent.ADD_WATERMARK, "Document Operations"),
            CommandSuggestion("encrypt with password secret", "Password protect the PDF", Intent.ENCRYPT, "Document Operations"),
            CommandSuggestion("split into individual pages", "Split into separate files", Intent.SPLIT, "Document Operations"),
            CommandSuggestion("split every 5 pages", "Split by page count", Intent.SPLIT, "Document Operations"),
            CommandSuggestion("extract text", "Extract text content", Intent.EXTRACT_TEXT, "Content Extraction"),
            CommandSuggestion("extract tables", "Extract table data", Intent.EXTRACT_TABLES, "Content Extraction"),
            CommandSuggestion("extract images", "Extract embedded images", Intent.EXTRACT_IMAGES, "Content Extraction"),
            CommandSuggestion("make searchable", "OCR scanned documents", Intent.OCR, "Content Extraction"),
            CommandSuggestion("set title to \"Report\"", "Update document title", Intent.UPDATE_METADATA, "Metadata"),
            CommandSuggestion("set author to \"John\"", "Update document author", Intent.UPDATE_METADATA, "Metadata"),
        ]


# Singleton instance
command_parser = CommandParser()
