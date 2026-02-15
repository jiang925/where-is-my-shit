from unittest.mock import MagicMock, patch

import pytest

from src.app.services.embedding import EmbeddingService
from src.app.services.embedding_provider import create_embedding_provider
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


def test_default_config_creates_sentence_transformer_provider():
    """Test that default configuration creates a SentenceTransformerProvider."""
    EmbeddingService.reset()

    with patch("src.app.services.embedding.get_settings") as mock_settings:
        mock_config = MagicMock()
        mock_config.embedding.model_dump.return_value = {
            "provider": "sentence-transformers",
            "model": "BAAI/bge-m3",
            "base_url": "http://localhost:11434/v1",
            "dimensions": None,
            "api_key": None,
            "timeout": 30,
            "batch_size": 100,
        }
        mock_settings.return_value = mock_config

        import numpy as np

        with patch(
            "src.app.services.providers.sentence_transformer_provider.SentenceTransformer"
        ) as mock_st:
            mock_model = MagicMock()
            mock_model.encode.return_value = np.array([0.1] * 1024)
            mock_st.return_value = mock_model

            service = EmbeddingService()
            from src.app.services.providers.sentence_transformer_provider import SentenceTransformerProvider

            assert isinstance(service.get_provider(), SentenceTransformerProvider)

    EmbeddingService.reset()


def test_explicit_fastembed_config_still_works():
    """Test that explicit fastembed configuration creates a FastEmbedProvider."""
    EmbeddingService.reset()

    with patch("src.app.services.embedding.get_settings") as mock_settings:
        mock_config = MagicMock()
        mock_config.embedding.model_dump.return_value = {
            "provider": "fastembed",
            "model": "BAAI/bge-small-en-v1.5",
            "base_url": "http://localhost:11434/v1",
            "dimensions": None,
            "api_key": None,
            "timeout": 30,
            "batch_size": 100,
        }
        mock_settings.return_value = mock_config

        with patch("src.app.services.providers.fastembed_provider.TextEmbedding"):
            service = EmbeddingService()
            assert isinstance(service.get_provider(), FastEmbedProvider)

    EmbeddingService.reset()


def test_ollama_config_creates_openai_compatible_provider():
    """Test that ollama configuration creates an OpenAICompatibleProvider."""
    EmbeddingService.reset()

    with patch("src.app.services.embedding.get_settings") as mock_settings:
        mock_config = MagicMock()
        mock_config.embedding.model_dump.return_value = {
            "provider": "ollama",
            "model": "nomic-embed-text",
            "base_url": "http://192.168.50.202:11434/v1",
            "dimensions": None,
            "api_key": None,
            "timeout": 30,
            "batch_size": 100,
        }
        mock_settings.return_value = mock_config

        # Mock the OpenAI client to avoid actual network calls
        with patch("src.app.services.providers.external_api_provider.OpenAI") as mock_openai:
            mock_client = MagicMock()
            # Mock probe_dimensions response
            mock_response = MagicMock()
            mock_embedding = MagicMock()
            mock_embedding.embedding = [0.1] * 768
            mock_response.data = [mock_embedding]
            mock_client.embeddings.create.return_value = mock_response
            mock_openai.return_value = mock_client

            service = EmbeddingService()
            provider = service.get_provider()

            from src.app.services.providers.external_api_provider import OpenAICompatibleProvider

            assert isinstance(provider, OpenAICompatibleProvider)
            assert provider.get_model_name() == "nomic-embed-text"
            assert provider.get_dimensions() == 768

    EmbeddingService.reset()


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


# --- Factory function tests ---


class TestCreateEmbeddingProvider:
    """Tests for the create_embedding_provider factory function."""

    def test_factory_creates_fastembed_provider(self):
        """Test factory creates FastEmbedProvider for fastembed config."""
        with patch("src.app.services.providers.fastembed_provider.TextEmbedding") as mock_te:
            mock_model = MagicMock()
            mock_model.embed.return_value = iter([[0.1, 0.2, 0.3]])
            mock_te.return_value = mock_model

            provider = create_embedding_provider({"provider": "fastembed", "model": "BAAI/bge-small-en-v1.5"})
            assert isinstance(provider, FastEmbedProvider)
            assert provider.get_model_name() == "BAAI/bge-small-en-v1.5"

    def test_factory_creates_sentence_transformer_provider(self):
        """Test factory creates SentenceTransformerProvider."""
        with patch(
            "src.app.services.providers.sentence_transformer_provider.SentenceTransformer"
        ) as mock_st:
            import numpy as np

            mock_model = MagicMock()
            mock_model.encode.return_value = np.array([0.1] * 1024)
            mock_st.return_value = mock_model

            provider = create_embedding_provider(
                {"provider": "sentence-transformers", "model": "BAAI/bge-m3"}
            )
            from src.app.services.providers.sentence_transformer_provider import SentenceTransformerProvider

            assert isinstance(provider, SentenceTransformerProvider)
            assert provider.get_model_name() == "BAAI/bge-m3"
            assert provider.get_dimensions() == 1024

    def test_factory_creates_openai_compatible_provider(self):
        """Test factory creates OpenAICompatibleProvider for openai config."""
        with patch("src.app.services.providers.external_api_provider.OpenAI") as mock_openai:
            mock_client = MagicMock()
            mock_response = MagicMock()
            mock_embedding = MagicMock()
            mock_embedding.embedding = [0.1] * 1536
            mock_response.data = [mock_embedding]
            mock_client.embeddings.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = create_embedding_provider({
                "provider": "openai",
                "model": "text-embedding-3-small",
                "base_url": "https://api.openai.com/v1",
                "api_key": "sk-test",
                "timeout": 60,
                "batch_size": 50,
            })
            from src.app.services.providers.external_api_provider import OpenAICompatibleProvider

            assert isinstance(provider, OpenAICompatibleProvider)
            assert provider.get_model_name() == "text-embedding-3-small"
            assert provider.get_dimensions() == 1536

    def test_factory_ollama_alias_creates_openai_compatible_provider(self):
        """Test factory creates OpenAICompatibleProvider for ollama config (backward compat)."""
        with patch("src.app.services.providers.external_api_provider.OpenAI") as mock_openai:
            mock_client = MagicMock()
            mock_response = MagicMock()
            mock_embedding = MagicMock()
            mock_embedding.embedding = [0.1] * 768
            mock_response.data = [mock_embedding]
            mock_client.embeddings.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = create_embedding_provider({
                "provider": "ollama",
                "model": "nomic-embed-text",
                "base_url": "http://localhost:11434/v1",
            })
            from src.app.services.providers.external_api_provider import OpenAICompatibleProvider

            assert isinstance(provider, OpenAICompatibleProvider)

    def test_factory_raises_for_unknown_provider(self):
        """Test factory raises ValueError for unknown provider."""
        with pytest.raises(ValueError, match="Unknown embedding provider: unknown"):
            create_embedding_provider({"provider": "unknown"})

    def test_factory_defaults_to_fastembed(self):
        """Test factory defaults to fastembed when no provider specified."""
        with patch("src.app.services.providers.fastembed_provider.TextEmbedding") as mock_te:
            mock_model = MagicMock()
            mock_model.embed.return_value = iter([[0.1, 0.2, 0.3]])
            mock_te.return_value = mock_model

            provider = create_embedding_provider({})
            assert isinstance(provider, FastEmbedProvider)


class TestEmbeddingConfig:
    """Tests for the EmbeddingConfig model."""

    def test_default_config(self):
        """Test default EmbeddingConfig values use bge-m3."""
        from src.app.core.config import EmbeddingConfig

        config = EmbeddingConfig()
        assert config.provider == "sentence-transformers"
        assert config.model == "BAAI/bge-m3"
        assert config.api_key is None
        assert config.timeout == 30
        assert config.batch_size == 100

    def test_config_with_api_fields(self):
        """Test EmbeddingConfig with api_key, timeout, batch_size."""
        from src.app.core.config import EmbeddingConfig

        config = EmbeddingConfig(
            provider="openai",
            model="text-embedding-3-small",
            base_url="https://api.openai.com/v1",
            api_key="sk-test",
            timeout=60,
            batch_size=50,
        )
        assert config.provider == "openai"
        assert config.api_key == "sk-test"
        assert config.timeout == 60
        assert config.batch_size == 50

    def test_config_model_dump_includes_new_fields(self):
        """Test that model_dump includes the new fields."""
        from src.app.core.config import EmbeddingConfig

        config = EmbeddingConfig(provider="openai", api_key="sk-test")
        dumped = config.model_dump()
        assert "api_key" in dumped
        assert "timeout" in dumped
        assert "batch_size" in dumped


class TestEmbeddingServiceReset:
    """Tests for EmbeddingService.reset()."""

    def test_reset_clears_instance(self):
        """Test that reset() clears the singleton."""
        EmbeddingService.reset()
        assert EmbeddingService._instance is None
        assert EmbeddingService._provider is None

    def test_reset_allows_reinitialization(self):
        """Test that after reset, a new instance can be created with different config."""
        EmbeddingService.reset()

        with patch("src.app.services.embedding.get_settings") as mock_settings:
            mock_config = MagicMock()
            mock_config.embedding.model_dump.return_value = {
                "provider": "fastembed",
                "model": "BAAI/bge-small-en-v1.5",
                "base_url": "http://localhost:11434/v1",
                "dimensions": None,
                "api_key": None,
                "timeout": 30,
                "batch_size": 100,
            }
            mock_settings.return_value = mock_config

            with patch("src.app.services.providers.fastembed_provider.TextEmbedding"):
                s1 = EmbeddingService()
                assert isinstance(s1.get_provider(), FastEmbedProvider)

        EmbeddingService.reset()
