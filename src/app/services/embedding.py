from typing import Optional

from fastembed import TextEmbedding


class EmbeddingService:
    """
    Singleton service for generating text embeddings using fastembed.
    Uses BAAI/bge-small-en-v1.5 model (384 dimensions).
    """

    _instance: Optional["EmbeddingService"] = None
    _model: TextEmbedding | None = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            # Initialize the model once
            # This downloads the model if not present
            cls._model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        return cls._instance

    def embed_text(self, text: str) -> list[float]:
        """
        Generates a vector embedding for the given text.
        Returns a list of floats (vector).
        """
        if not text:
            # Return zero vector or empty?
            # For 384 dimensions, returning empty list might break validation if used directly.
            # But the schema expects Vector(384).
            # Let's assume caller handles empty text or we return a zero vector.
            # But typically we just don't embed empty text.
            # Let's return empty list and let caller handle.
            return []

        # embed returns a generator of numpy arrays
        embeddings_generator = self._model.embed([text])
        # Get the first result
        vector = next(embeddings_generator)
        return vector.tolist()
