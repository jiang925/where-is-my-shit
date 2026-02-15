from typing import Optional

from src.app.core.config import get_settings
from src.app.services.embedding_provider import EmbeddingProvider, create_embedding_provider


class EmbeddingService:
    """
    Singleton service for generating text embeddings.

    This service delegates to a configurable EmbeddingProvider backend
    (fastembed, ollama, openai, etc.) based on the server configuration.

    Default behavior: Uses sentence-transformers with BAAI/bge-m3 (1024 dimensions).
    """

    _instance: Optional["EmbeddingService"] = None
    _provider: EmbeddingProvider | None = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            # Initialize provider from config
            config = get_settings().embedding.model_dump()
            cls._provider = create_embedding_provider(config)
        return cls._instance

    @classmethod
    def reset(cls):
        """Reset the singleton instance. Used in tests to reinitialize with different configs."""
        cls._instance = None
        cls._provider = None

    def embed_text(self, text: str) -> list[float]:
        """
        Generates a vector embedding for the given text.

        Args:
            text: Text string to embed

        Returns:
            Embedding vector as list of floats
        """
        if not text:
            return []

        return self._provider.embed_text(text)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a batch of document texts.

        This is useful for ingestion workflows where multiple texts
        need to be embedded efficiently.

        Args:
            texts: List of text strings to embed

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        return self._provider.embed(texts)

    def get_provider(self) -> EmbeddingProvider:
        """
        Get the underlying provider instance.

        This allows direct access to provider-specific functionality
        (e.g., embed_query vs embed_documents for e5 models).

        Returns:
            The current EmbeddingProvider instance
        """
        return self._provider

    def get_dimensions(self) -> int:
        """
        Get the dimensionality of embedding vectors.

        Returns:
            Integer dimension count
        """
        return self._provider.get_dimensions()

    def get_model_name(self) -> str:
        """
        Get the model identifier string.

        Returns:
            Model name
        """
        return self._provider.get_model_name()
