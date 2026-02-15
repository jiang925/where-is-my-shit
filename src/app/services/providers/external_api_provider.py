"""
External API embedding provider implementations.

Provides an abstract base class for external/remote embedding providers
and a concrete OpenAI-compatible implementation that works with OpenAI API,
Ollama, and other compatible endpoints.
"""

import structlog
from openai import OpenAI

from src.app.services.embedding_provider import EmbeddingProvider

logger = structlog.get_logger(__name__)


class ExternalAPIProvider(EmbeddingProvider):
    """
    Abstract base class for external/remote embedding providers.

    This serves as a type marker to distinguish external API-based providers
    from local embedding providers (FastEmbed, SentenceTransformer, ONNX).

    External providers require network connectivity and may have rate limits,
    but offer benefits like GPU acceleration without local GPU requirements.
    """

    pass


class OpenAICompatibleProvider(ExternalAPIProvider):
    """
    OpenAI-compatible embedding provider.

    This provider uses the OpenAI Python client with a configurable base_url
    to connect to:
    - OpenAI API (https://api.openai.com/v1)
    - Local Ollama server (http://localhost:11434/v1)
    - Remote Ollama server (e.g., http://192.168.50.202:11434/v1)
    - Any other OpenAI-compatible embedding API

    This replaces the previous OllamaProvider with a more flexible implementation
    that supports API keys, timeouts, and configurable batch sizes.
    """

    def __init__(
        self,
        model: str,
        base_url: str,
        api_key: str | None = None,
        timeout: int = 30,
        batch_size: int = 100,
    ):
        """
        Initialize OpenAI-compatible provider.

        Args:
            model: Model identifier (e.g., "nomic-embed-text", "text-embedding-3-small")
            base_url: API endpoint URL
            api_key: API key (optional, uses "dummy-key" if not provided for local servers)
            timeout: Request timeout in seconds (default: 30)
            batch_size: Maximum batch size for embedding requests (default: 100)
        """
        self._model = model
        self._base_url = base_url
        self._batch_size = batch_size

        logger.info(f"Initializing OpenAI-compatible provider: model={model}, base_url={base_url}")

        # Initialize OpenAI client
        # For local servers like Ollama, api_key can be any non-empty string
        self._client = OpenAI(
            base_url=base_url,
            api_key=api_key or "dummy-key",
            timeout=timeout,
        )

        # Probe dimensions by embedding a test string
        self._dimensions = self._probe_dimensions()
        logger.info(f"Model dimension: {self._dimensions}")

    def _probe_dimensions(self) -> int:
        """
        Probe the model to determine embedding dimensions.

        Returns:
            Dimension count

        Raises:
            RuntimeError: If probe fails
        """
        try:
            response = self._client.embeddings.create(model=self._model, input="test")
            return len(response.data[0].embedding)
        except Exception as e:
            raise RuntimeError(f"Failed to probe embedding dimensions for model {self._model}: {e}")

    def embed(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a batch of texts.

        Processes texts in chunks according to batch_size to avoid
        exceeding API limits.

        Args:
            texts: List of text strings to embed

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        all_embeddings = []

        # Process in chunks of batch_size
        for i in range(0, len(texts), self._batch_size):
            chunk = texts[i : i + self._batch_size]

            response = self._client.embeddings.create(model=self._model, input=chunk)

            # Extract embeddings in order
            chunk_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(chunk_embeddings)

        return all_embeddings

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
        return self._model
