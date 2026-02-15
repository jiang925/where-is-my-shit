"""
ONNX embedding provider implementation.

Uses ONNX Runtime with Optimum for optimized inference with ONNX-exported models.
Provides better performance than PyTorch on CPU and supports various hardware accelerators.
"""

import structlog
import torch
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer

from src.app.services.embedding_provider import EmbeddingProvider

logger = structlog.get_logger(__name__)


class OnnxProvider(EmbeddingProvider):
    """
    ONNX Runtime embedding provider.

    This provider uses Optimum's ONNX Runtime integration to load and run
    transformer models in ONNX format. Models are automatically exported to
    ONNX format on first use if not already available.

    Best for: Optimized CPU inference, hardware accelerator support (DirectML, TensorRT).
    """

    def __init__(self, model_name: str = "BAAI/bge-m3"):
        """
        Initialize ONNX provider.

        Args:
            model_name: HuggingFace model identifier (default: BAAI/bge-m3)
        """
        self._model_name = model_name

        logger.info(f"Loading ONNX model: {model_name}")
        self._model = ORTModelForFeatureExtraction.from_pretrained(model_name, export=True)
        self._tokenizer = AutoTokenizer.from_pretrained(model_name)
        logger.info(f"Model {model_name} loaded successfully")

        # Probe dimensions by encoding a test string
        test_embedding = self._encode_single("test")
        self._dimensions = len(test_embedding)
        logger.info(f"Model dimension: {self._dimensions}")

    def _encode_single(self, text: str) -> list[float]:
        """
        Encode a single text (helper for probing).

        Args:
            text: Text string to encode

        Returns:
            Embedding vector
        """
        inputs = self._tokenizer([text], padding=True, truncation=True, return_tensors="pt")

        # Run model
        outputs = self._model(**inputs)

        # Mean pooling
        attention_mask = inputs["attention_mask"]
        token_embeddings = outputs.last_hidden_state

        # Compute attention mask expansion for broadcasting
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()

        # Mean pooling: sum embeddings and divide by number of tokens
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, dim=1)
        sum_mask = torch.clamp(input_mask_expanded.sum(dim=1), min=1e-9)
        mean_embeddings = sum_embeddings / sum_mask

        return mean_embeddings[0].tolist()

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

        # Tokenize
        inputs = self._tokenizer(texts, padding=True, truncation=True, return_tensors="pt")

        # Run model
        outputs = self._model(**inputs)

        # Mean pooling
        attention_mask = inputs["attention_mask"]
        token_embeddings = outputs.last_hidden_state

        # Compute attention mask expansion for broadcasting
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()

        # Mean pooling: sum embeddings and divide by number of tokens
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, dim=1)
        sum_mask = torch.clamp(input_mask_expanded.sum(dim=1), min=1e-9)
        mean_embeddings = sum_embeddings / sum_mask

        # Convert to list of lists
        return mean_embeddings.tolist()

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
