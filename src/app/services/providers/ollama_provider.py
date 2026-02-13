"""
Ollama/OpenAI-compatible embedding provider implementation.

Uses the OpenAI client library to connect to Ollama or any OpenAI-compatible
embedding API endpoint. This enables GPU acceleration and remote embedding
generation.
"""

from openai import OpenAI

from src.app.services.embedding_provider import EmbeddingProvider


class OllamaProvider(EmbeddingProvider):
    """
    Ollama/OpenAI-compatible embedding provider.

    This provider uses the OpenAI Python client with a configurable base_url
    to connect to:
    - Local Ollama server (http://localhost:11434/v1)
    - Remote Ollama server (e.g., http://192.168.50.202:11434/v1)
    - Actual OpenAI API (https://api.openai.com/v1)
    - Any other OpenAI-compatible embedding API

    The provider probes the model on initialization to determine embedding
    dimensions automatically.
    """

    def __init__(
        self,
        model_name: str = "nomic-embed-text",
        base_url: str = "http://localhost:11434/v1",
        dimensions: int | None = None,
    ):
        """
        Initialize Ollama/OpenAI-compatible provider.

        Args:
            model_name: Model identifier (e.g., "nomic-embed-text", "text-embedding-3-small")
            base_url: API endpoint URL (default: local Ollama)
            dimensions: Optional dimension override (auto-detected if None)
        """
        self._model_name = model_name
        self._base_url = base_url

        # Initialize OpenAI client
        # For Ollama, api_key can be any non-empty string
        self._client = OpenAI(base_url=base_url, api_key="ollama")

        # Determine dimensions
        if dimensions is not None:
            self._dimensions = dimensions
        else:
            # Probe dimensions by embedding a test string
            self._dimensions = self._probe_dimensions()

    def _probe_dimensions(self) -> int:
        """
        Probe the model to determine embedding dimensions.

        Returns:
            Dimension count
        """
        try:
            response = self._client.embeddings.create(
                model=self._model_name,
                input="test"
            )
            return len(response.data[0].embedding)
        except Exception as e:
            # If probe fails, fall back to common dimension
            # nomic-embed-text uses 768, text-embedding-3-small uses 1536
            raise RuntimeError(
                f"Failed to probe embedding dimensions for model {self._model_name}: {e}"
            )

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

        response = self._client.embeddings.create(
            model=self._model_name,
            input=texts
        )

        # Extract embeddings in order
        return [item.embedding for item in response.data]

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
