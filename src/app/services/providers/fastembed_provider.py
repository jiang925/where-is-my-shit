"""
FastEmbed embedding provider implementation.

Uses the fastembed library for local CPU-based embedding generation.
Supports e5 models with automatic query/passage prefixing.
"""

from fastembed import TextEmbedding

from src.app.services.embedding_provider import EmbeddingProvider


class FastEmbedProvider(EmbeddingProvider):
    """
    FastEmbed implementation of the EmbeddingProvider interface.

    This provider uses the fastembed library to generate embeddings locally
    on CPU. It's the default provider and maintains backward compatibility
    with the original WIMS implementation.

    Special handling for e5 models: If the model name contains "e5", this
    provider automatically prefixes queries with "query: " and documents
    with "passage: " as recommended by the e5 model authors.
    """

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        """
        Initialize FastEmbed provider.

        Args:
            model_name: FastEmbed model identifier (default: BAAI/bge-small-en-v1.5)
        """
        self._model_name = model_name
        self._model = TextEmbedding(model_name=model_name)
        self._is_e5_model = "e5" in model_name.lower()

        # Probe dimensions by embedding a test string
        test_embedding = next(self._model.embed(["test"]))
        self._dimensions = len(test_embedding)

    def embed(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a batch of texts (document mode).

        For e5 models, prefixes each text with "passage: ".

        Args:
            texts: List of text strings to embed

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        # Apply e5 document prefix if needed
        if self._is_e5_model:
            texts = [f"passage: {text}" for text in texts]

        # fastembed returns a generator of numpy arrays
        embeddings_generator = self._model.embed(texts)

        # Convert to list of lists
        return [vec.tolist() for vec in embeddings_generator]

    def embed_query(self, text: str) -> list[float]:
        """
        Generate embedding for a query text (query mode).

        For e5 models, prefixes with "query: ".

        Args:
            text: Query text string

        Returns:
            Embedding vector
        """
        if not text:
            return []

        # Apply e5 query prefix if needed
        query_text = f"query: {text}" if self._is_e5_model else text

        embeddings_generator = self._model.embed([query_text])
        vector = next(embeddings_generator)
        return vector.tolist()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for document texts (explicit document mode).

        This is an alias for embed() to make the document/query distinction clear.

        Args:
            texts: List of document text strings

        Returns:
            List of embedding vectors
        """
        return self.embed(texts)

    def get_dimensions(self) -> int:
        """
        Get embedding dimensions from the fastembed model.

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
