"""
LLM Client Abstraction

Provides a unified interface for different LLM providers (Anthropic Claude, OpenAI).
Supports both synchronous and streaming responses.
"""

import os
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, AsyncIterator
from dataclasses import dataclass
from enum import Enum


class LLMProvider(Enum):
    """Supported LLM providers."""
    ANTHROPIC = "anthropic"
    OPENAI = "openai"


@dataclass
class Message:
    """A chat message."""
    role: str  # "user" or "assistant"
    content: str


@dataclass
class LLMResponse:
    """Response from an LLM."""
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    stop_reason: Optional[str] = None


class LLMClient(ABC):
    """Abstract base class for LLM clients."""

    @abstractmethod
    async def chat(
        self,
        messages: List[Message],
        system: str,
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> LLMResponse:
        """Send a chat request and get a response."""
        pass

    @abstractmethod
    async def stream(
        self,
        messages: List[Message],
        system: str,
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> AsyncIterator[str]:
        """Stream a chat response token by token."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the client is properly configured."""
        pass


class AnthropicClient(LLMClient):
    """Anthropic Claude API client."""

    def __init__(self, api_key: Optional[str] = None, model: str = "claude-sonnet-4-20250514"):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.model = model
        self._client = None

    def _get_client(self):
        """Lazy initialization of the Anthropic client."""
        if self._client is None:
            try:
                import anthropic
                self._client = anthropic.AsyncAnthropic(api_key=self.api_key)
            except ImportError:
                raise ImportError("anthropic package is not installed. Run: pip install anthropic")
        return self._client

    def is_available(self) -> bool:
        """Check if API key is configured."""
        return bool(self.api_key)

    async def chat(
        self,
        messages: List[Message],
        system: str,
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> LLMResponse:
        """Send a chat request to Claude."""
        client = self._get_client()

        # Convert messages to Anthropic format
        anthropic_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        response = await client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=anthropic_messages,
        )

        return LLMResponse(
            content=response.content[0].text,
            model=response.model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            stop_reason=response.stop_reason,
        )

    async def stream(
        self,
        messages: List[Message],
        system: str,
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> AsyncIterator[str]:
        """Stream a response from Claude."""
        client = self._get_client()

        anthropic_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        async with client.messages.stream(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=anthropic_messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text


class OpenAIClient(LLMClient):
    """OpenAI API client."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.model = model
        self._client = None

    def _get_client(self):
        """Lazy initialization of the OpenAI client."""
        if self._client is None:
            try:
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(api_key=self.api_key)
            except ImportError:
                raise ImportError("openai package is not installed. Run: pip install openai")
        return self._client

    def is_available(self) -> bool:
        """Check if API key is configured."""
        return bool(self.api_key)

    async def chat(
        self,
        messages: List[Message],
        system: str,
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> LLMResponse:
        """Send a chat request to OpenAI."""
        client = self._get_client()

        # Build messages with system prompt
        openai_messages = [{"role": "system", "content": system}]
        openai_messages.extend([
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ])

        response = await client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=openai_messages,
        )

        choice = response.choices[0]
        return LLMResponse(
            content=choice.message.content or "",
            model=response.model,
            input_tokens=response.usage.prompt_tokens if response.usage else 0,
            output_tokens=response.usage.completion_tokens if response.usage else 0,
            stop_reason=choice.finish_reason,
        )

    async def stream(
        self,
        messages: List[Message],
        system: str,
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> AsyncIterator[str]:
        """Stream a response from OpenAI."""
        client = self._get_client()

        openai_messages = [{"role": "system", "content": system}]
        openai_messages.extend([
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ])

        stream = await client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=openai_messages,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


def get_llm_client(provider: Optional[str] = None) -> LLMClient:
    """
    Factory function to get an LLM client.

    Tries providers in order of preference:
    1. Anthropic (if API key is set)
    2. OpenAI (if API key is set)

    Args:
        provider: Optional provider name to force a specific provider

    Returns:
        An LLM client instance

    Raises:
        ValueError: If no provider is available
    """
    if provider:
        if provider.lower() == "anthropic":
            client = AnthropicClient()
            if client.is_available():
                return client
            raise ValueError("Anthropic API key not configured")
        elif provider.lower() == "openai":
            client = OpenAIClient()
            if client.is_available():
                return client
            raise ValueError("OpenAI API key not configured")
        else:
            raise ValueError(f"Unknown provider: {provider}")

    # Try providers in order of preference
    anthropic_client = AnthropicClient()
    if anthropic_client.is_available():
        return anthropic_client

    openai_client = OpenAIClient()
    if openai_client.is_available():
        return openai_client

    raise ValueError(
        "No LLM provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable."
    )


def get_available_providers() -> List[Dict[str, Any]]:
    """Get list of available LLM providers and their status."""
    providers = []

    anthropic_client = AnthropicClient()
    providers.append({
        "name": "anthropic",
        "display_name": "Anthropic Claude",
        "available": anthropic_client.is_available(),
        "model": anthropic_client.model,
    })

    openai_client = OpenAIClient()
    providers.append({
        "name": "openai",
        "display_name": "OpenAI GPT",
        "available": openai_client.is_available(),
        "model": openai_client.model,
    })

    return providers
