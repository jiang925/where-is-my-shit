from src.app.services.embedding import EmbeddingService


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

    # Verify mock interaction
    embedding_service._model.embed.assert_called_once()


def test_embed_empty_text(embedding_service):
    """Test behavior with empty text."""
    vector = embedding_service.embed_text("")
    assert vector == []
