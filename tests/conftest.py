import os
import shutil
import tempfile
from unittest.mock import patch

import numpy as np
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
def mock_embedding_model():
    with patch("src.app.services.embedding.TextEmbedding") as mock:
        # Configure mock to return a generator with a dummy numpy array vector
        mock_instance = mock.return_value
        # embed returns a generator that yields numpy arrays
        mock_instance.embed.return_value = (np.array(x) for x in [[0.1, 0.2, 0.3]])
        yield mock


@pytest.fixture(scope="function")
def embedding_service(mock_embedding_model):
    # Reset singleton
    EmbeddingService._instance = None
    service = EmbeddingService()
    return service
