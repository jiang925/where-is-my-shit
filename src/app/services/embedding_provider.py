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
                - provider: str (one of: "fastembed", "ollama", "openai")
                - model: str (model name)
                - base_url: str (for ollama/openai providers)
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

    elif provider_type in ("ollama", "openai"):
        from src.app.services.providers.ollama_provider import OllamaProvider

        model_name = config.get("model", "nomic-embed-text")
        base_url = config.get("base_url", "http://localhost:11434/v1")
        dimensions = config.get("dimensions")

        return OllamaProvider(
            model_name=model_name,
            base_url=base_url,
            dimensions=dimensions
        )

    else:
        raise ValueError(f"Unknown embedding provider: {provider_type}")
