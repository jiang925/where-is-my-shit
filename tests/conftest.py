import os
import shutil
import tempfile
from unittest.mock import patch

import pytest

from src.app.core.config import settings
from src.app.db.client import DBClient
from src.app.services.embedding import EmbeddingService


@pytest.fixture(scope="function")
def test_db_path():
    # Create a temporary directory for the database
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test.lance")

    # Override settings
    original_db_path = settings.DB_PATH
    settings.DB_PATH = db_path

    yield db_path

    # Cleanup
    settings.DB_PATH = original_db_path
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)


@pytest.fixture(scope="function")
def db_client(test_db_path):
    # Reset singleton state if necessary
    client = DBClient()
    client._db = None  # Force reconnection with new path
    return client


@pytest.fixture(scope="function")
def mock_embedding_provider():
    """Create a mock embedding provider for testing."""
    from unittest.mock import MagicMock

    mock_provider = MagicMock()
    # Configure mock to return dummy vectors
    mock_provider.embed_text.return_value = [0.1, 0.2, 0.3]
    mock_provider.embed.return_value = [[0.1, 0.2, 0.3], [0.1, 0.2, 0.3], [0.1, 0.2, 0.3]]
    mock_provider.get_dimensions.return_value = 3
    mock_provider.get_model_name.return_value = "mock-model"
    return mock_provider


@pytest.fixture(scope="function")
def embedding_service(mock_embedding_provider):
    """Create an EmbeddingService with a mocked provider."""
    # Reset singleton
    EmbeddingService._instance = None

    # Patch the provider creation to return our mock
    with patch("src.app.services.embedding.create_embedding_provider") as mock_create:
        mock_create.return_value = mock_embedding_provider
        service = EmbeddingService()
        yield service

    # Cleanup
    EmbeddingService._instance = None
