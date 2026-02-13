from unittest.mock import MagicMock, patch

from src.app.services.embedding import EmbeddingService
from src.app.services.providers import FastEmbedProvider


def test_embedding_service_singleton(embedding_service):
    """Test that EmbeddingService is a singleton."""
    s1 = EmbeddingService()
    s2 = EmbeddingService()
    assert s1 is s2


def test_embed_text(embedding_service):
    """Test embedding generation with mocked model."""
    text = "Hello world"
    vector = embedding_service.embed_text(text)

    # Check result
    assert isinstance(vector, list)
    assert len(vector) == 3  # Based on our mock in conftest
    assert vector == [0.1, 0.2, 0.3]

    # Verify mock interaction via provider
    embedding_service._provider.embed_text.assert_called_once_with(text)


def test_embed_empty_text(embedding_service):
    """Test behavior with empty text."""
    vector = embedding_service.embed_text("")
    assert vector == []


def test_default_config_creates_fastembed_provider():
    """Test that default configuration creates a FastEmbedProvider."""
    # Reset singleton
    EmbeddingService._instance = None

    # Mock the config to ensure we get default values
    with patch("src.app.services.embedding.get_settings") as mock_settings:
        mock_config = MagicMock()
        mock_config.embedding.model_dump.return_value = {
            "provider": "fastembed",
            "model": "BAAI/bge-small-en-v1.5",
            "base_url": "http://localhost:11434/v1",
            "dimensions": None,
        }
        mock_settings.return_value = mock_config

        # Mock the FastEmbedProvider to avoid actually loading the model
        with patch("src.app.services.providers.fastembed_provider.TextEmbedding"):
            service = EmbeddingService()
            assert isinstance(service.get_provider(), FastEmbedProvider)

    # Cleanup
    EmbeddingService._instance = None


def test_ollama_config_creates_ollama_provider():
    """Test that ollama configuration creates an OllamaProvider."""
    # Reset singleton
    EmbeddingService._instance = None

    # Mock the config for Ollama
    with patch("src.app.services.embedding.get_settings") as mock_settings:
        mock_config = MagicMock()
        mock_config.embedding.model_dump.return_value = {
            "provider": "ollama",
            "model": "nomic-embed-text",
            "base_url": "http://192.168.50.202:11434/v1",
            "dimensions": 768,
        }
        mock_settings.return_value = mock_config

        # Mock the OpenAI client to avoid actual network calls
        with patch("src.app.services.providers.ollama_provider.OpenAI") as mock_openai:
            # Mock the client's embeddings.create() method
            mock_client = MagicMock()
            mock_openai.return_value = mock_client

            service = EmbeddingService()
            provider = service.get_provider()

            # Check that it's an OllamaProvider
            from src.app.services.providers import OllamaProvider

            assert isinstance(provider, OllamaProvider)
            assert provider.get_model_name() == "nomic-embed-text"
            assert provider.get_dimensions() == 768

    # Cleanup
    EmbeddingService._instance = None


def test_get_dimensions_returns_correct_value(embedding_service):
    """Test that get_dimensions returns the correct dimension count."""
    dimensions = embedding_service.get_dimensions()
    assert isinstance(dimensions, int)
    assert dimensions == 3  # Based on our mock


def test_embed_documents_batch(embedding_service):
    """Test batch embedding with embed_documents."""
    texts = ["Hello", "World", "Test"]
    vectors = embedding_service.embed_documents(texts)

    assert isinstance(vectors, list)
    assert len(vectors) == 3
    for vector in vectors:
        assert isinstance(vector, list)
        assert len(vector) == 3


def test_embed_documents_empty(embedding_service):
    """Test embed_documents with empty list."""
    vectors = embedding_service.embed_documents([])
    assert vectors == []
