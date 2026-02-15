"""
SentenceTransformer embedding provider implementation.

Uses the sentence-transformers library for local PyTorch-based embedding generation.
Supports bge-m3 and other HuggingFace sentence-transformer models.
"""

import structlog
from sentence_transformers import SentenceTransformer

from src.app.services.embedding_provider import EmbeddingProvider

logger = structlog.get_logger(__name__)


class SentenceTransformerProvider(EmbeddingProvider):
    """
    SentenceTransformer implementation of the EmbeddingProvider interface.

    This provider uses the sentence-transformers library to load and run
    models from HuggingFace. Models are automatically downloaded on first use
    and cached locally.

    Best for: Local GPU inference with PyTorch, supports latest transformer models.
    """

    def __init__(self, model_name: str = "BAAI/bge-m3"):
        """
        Initialize SentenceTransformer provider.

        Args:
            model_name: HuggingFace model identifier (default: BAAI/bge-m3)
        """
        self._model_name = model_name

        logger.info(f"Loading SentenceTransformer model: {model_name}")
        self._model = SentenceTransformer(model_name)
        logger.info(f"Model {model_name} loaded successfully")

        # Probe dimensions by encoding a test string
        test_embedding = self._model.encode("test", show_progress_bar=False)
        self._dimensions = len(test_embedding)
        logger.info(f"Model dimension: {self._dimensions}")

    def embed(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a batch of texts.

        Args:
            texts: List of text strings to embed

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        # SentenceTransformer returns numpy arrays
        embeddings = self._model.encode(texts, show_progress_bar=False)

        # Convert to list of lists
        return embeddings.tolist()

    def get_dimensions(self) -> int:
        """
        Get embedding dimensions.

        Returns:
            Dimension count
        """
        return self._dimensions

    def get_model_name(self) -> str:
        """
        Get the model identifier string.

        Returns:
            Model name
        """
        return self._model_name
