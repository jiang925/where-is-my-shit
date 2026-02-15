"""
Abstract embedding provider interface and factory function.

This module defines the embedding provider abstraction layer that allows
the application to use different embedding backends (fastembed, Ollama, OpenAI, etc.)
without changing the consuming code.
"""

from abc import ABC, abstractmethod


class EmbeddingProvider(ABC):
    """
    Abstract base class for embedding providers.

    All embedding providers must implement these methods to ensure
    consistent behavior across different backends.
    """

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a batch of texts.

        Args:
            texts: List of text strings to embed

        Returns:
            List of embedding vectors (each vector is a list of floats)
        """
        pass

    def embed_text(self, text: str) -> list[float]:
        """
        Generate embedding for a single text (convenience method).

        Args:
            text: Single text string to embed

        Returns:
            Embedding vector as list of floats
        """
        if not text:
            return []

        result = self.embed([text])
        return result[0] if result else []

    @abstractmethod
    def get_dimensions(self) -> int:
        """
        Get the dimensionality of the embedding vectors.

        Returns:
            Integer dimension count
        """
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """
        Get the model identifier string.

        Returns:
            Model name or identifier
        """
        pass


def create_embedding_provider(config: dict) -> EmbeddingProvider:
    """
    Factory function to create the appropriate embedding provider.

    Args:
        config: Dictionary with at least a 'provider' key.
                Expected keys:
                - provider: str (one of: "fastembed", "sentence-transformers", "onnx", "openai", "ollama")
                - model: str (model name)
                - base_url: str (for openai provider)
                - api_key: str | None (for openai provider)
                - timeout: int (for openai provider, default 30)
                - batch_size: int (for openai provider, default 100)
                - dimensions: int | None (optional dimension override)

    Returns:
        Instantiated EmbeddingProvider

    Raises:
        ValueError: If provider type is unknown or config is invalid
    """
    provider_type = config.get("provider", "fastembed").lower()

    if provider_type == "fastembed":
        from src.app.services.providers.fastembed_provider import FastEmbedProvider

        model_name = config.get("model", "BAAI/bge-small-en-v1.5")
        return FastEmbedProvider(model_name=model_name)

    elif provider_type == "sentence-transformers":
        from src.app.services.providers.sentence_transformer_provider import SentenceTransformerProvider

        model_name = config.get("model", "BAAI/bge-m3")
        return SentenceTransformerProvider(model_name=model_name)

    elif provider_type == "onnx":
        from src.app.services.providers.onnx_provider import OnnxProvider

        model_name = config.get("model", "BAAI/bge-m3")
        return OnnxProvider(model_name=model_name)

    elif provider_type in ("openai", "ollama"):
        from src.app.services.providers.external_api_provider import OpenAICompatibleProvider

        model_name = config.get("model", "nomic-embed-text")
        base_url = config.get("base_url", "http://localhost:11434/v1")
        api_key = config.get("api_key")
        timeout = config.get("timeout", 30)
        batch_size = config.get("batch_size", 100)

        return OpenAICompatibleProvider(
            model=model_name,
            base_url=base_url,
            api_key=api_key,
            timeout=timeout,
            batch_size=batch_size,
        )

    else:
        raise ValueError(f"Unknown embedding provider: {provider_type}")
