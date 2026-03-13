import json
import os
import tempfile
from pathlib import Path

import pytest

from src.app.core.config import ConfigManager, EmbeddingConfig, ServerConfig


# ========== ConfigManager Tests ==========


def test_config_create_new_when_missing():
    """Test that ConfigManager creates a new config when file doesn't exist."""
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = Path(tmpdir) / "server.json"
        assert not config_path.exists()

        manager = ConfigManager(config_path=config_path)

        # Config should be created
        assert config_path.exists()
        assert manager.config.api_key.startswith("sk-wims-")
        assert manager.config.port == 8000
        assert manager.config.host == "127.0.0.1"


def test_config_load_existing():
    """Test that ConfigManager loads an existing valid config file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = Path(tmpdir) / "server.json"

        # Write a valid config
        config_data = {
            "api_key": "my-test-api-key",
            "port": 9000,
            "host": "0.0.0.0",
        }
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f)

        manager = ConfigManager(config_path=config_path)

        assert manager.config.api_key == "my-test-api-key"
        assert manager.config.port == 9000
        assert manager.config.host == "0.0.0.0"


def test_config_corrupt_file_backup():
    """Test that ConfigManager backs up corrupt config and creates new one."""
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = Path(tmpdir) / "server.json"

        # Write invalid JSON
        with open(config_path, "w", encoding="utf-8") as f:
            f.write("{invalid json content!!")

        manager = ConfigManager(config_path=config_path)

        # Backup file should exist
        backup_path = config_path.with_suffix(".json.bak")
        assert backup_path.exists()

        # New config should be generated with a fresh API key
        assert manager.config.api_key.startswith("sk-wims-")

        # Original config should be overwritten with valid config
        assert config_path.exists()


def test_config_reload():
    """Test that _reload updates config from disk."""
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = Path(tmpdir) / "server.json"

        # Create initial config
        initial_data = {"api_key": "initial-key", "port": 8000}
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(initial_data, f)

        manager = ConfigManager(config_path=config_path)
        assert manager.config.api_key == "initial-key"
        assert manager.config.port == 8000

        # Update config on disk
        updated_data = {"api_key": "updated-key", "port": 9000}
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(updated_data, f)

        # Trigger reload
        manager._reload()

        assert manager.config.api_key == "updated-key"
        assert manager.config.port == 9000


def test_config_reload_missing_file():
    """Test that _reload skips when config file is missing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = Path(tmpdir) / "server.json"

        # Create initial config
        initial_data = {"api_key": "initial-key"}
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(initial_data, f)

        manager = ConfigManager(config_path=config_path)
        assert manager.config.api_key == "initial-key"

        # Remove config file
        os.remove(config_path)

        # Reload should not crash, and config should remain unchanged
        manager._reload()
        assert manager.config.api_key == "initial-key"


def test_config_atomic_save():
    """Test that _save writes config atomically and sets permissions."""
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = Path(tmpdir) / "server.json"
        manager = ConfigManager(config_path=config_path)

        # Verify the file was created with restrictive permissions
        assert config_path.exists()
        file_mode = oct(os.stat(config_path).st_mode & 0o777)
        assert file_mode == "0o600", f"Expected 0o600 but got {file_mode}"

        # Verify it's valid JSON
        with open(config_path, encoding="utf-8") as f:
            data = json.load(f)
        assert "api_key" in data


def test_config_env_var_path(monkeypatch):
    """Test that ConfigManager uses WIMS_CONFIG_FILE env var."""
    with tempfile.TemporaryDirectory() as tmpdir:
        env_config_path = os.path.join(tmpdir, "custom_config.json")
        monkeypatch.setenv("WIMS_CONFIG_FILE", env_config_path)

        manager = ConfigManager()

        assert str(manager.path) == env_config_path
        assert os.path.exists(env_config_path)
        assert manager.config.api_key.startswith("sk-wims-")


def test_config_api_key_generation():
    """Test that generated API keys have the correct format."""
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = Path(tmpdir) / "server.json"
        manager = ConfigManager(config_path=config_path)

        api_key = manager.config.api_key
        assert api_key.startswith("sk-wims-")
        # sk-wims- prefix (8 chars) + 32-byte urlsafe base64 (43 chars)
        assert len(api_key) > 8


def test_config_set_config_path():
    """Test that set_config_path updates path and reloads."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # First config
        path1 = Path(tmpdir) / "config1.json"
        config1_data = {"api_key": "key-one"}
        with open(path1, "w", encoding="utf-8") as f:
            json.dump(config1_data, f)

        # Second config
        path2 = Path(tmpdir) / "config2.json"
        config2_data = {"api_key": "key-two", "port": 9999}
        with open(path2, "w", encoding="utf-8") as f:
            json.dump(config2_data, f)

        manager = ConfigManager(config_path=path1)
        assert manager.config.api_key == "key-one"

        manager.set_config_path(path2)
        assert manager.config.api_key == "key-two"
        assert manager.config.port == 9999


def test_embedding_config_defaults():
    """Test that EmbeddingConfig has sensible defaults."""
    config = EmbeddingConfig()
    assert config.provider == "sentence-transformers"
    assert config.model == "BAAI/bge-m3"
    assert config.base_url == "http://localhost:11434/v1"
    assert config.dimensions is None
    assert config.api_key is None
    assert config.timeout == 30
    assert config.batch_size == 100
