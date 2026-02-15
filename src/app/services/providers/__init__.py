"""Embedding provider implementations."""

from .external_api_provider import ExternalAPIProvider, OpenAICompatibleProvider
from .fastembed_provider import FastEmbedProvider
from .sentence_transformer_provider import SentenceTransformerProvider

# OnnxProvider requires optional 'optimum' package - lazy import only
try:
    from .onnx_provider import OnnxProvider
except ImportError:
    OnnxProvider = None  # type: ignore[assignment,misc]

# Backward compatibility
from .ollama_provider import OllamaProvider

__all__ = [
    "FastEmbedProvider",
    "SentenceTransformerProvider",
    "OnnxProvider",
    "ExternalAPIProvider",
    "OpenAICompatibleProvider",
    "OllamaProvider",  # Deprecated, use OpenAICompatibleProvider
]
