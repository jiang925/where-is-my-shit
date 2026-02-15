import json
import logging
import os
import secrets
import tempfile
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class EmbeddingConfig(BaseModel):
    """
    Configuration for embedding generation.
    Supports multiple providers: fastembed (CPU), sentence-transformers (PyTorch),
    onnx (ONNX Runtime), openai (OpenAI-compatible API).
    """

    provider: str = "fastembed"  # One of: "fastembed", "sentence-transformers", "onnx", "openai"
    model: str = "BAAI/bge-small-en-v1.5"  # Model name for the provider
    base_url: str = "http://localhost:11434/v1"  # Only used for openai provider
    dimensions: int | None = None  # Optional override, auto-detected if not set
    api_key: str | None = None  # API key for external providers
    timeout: int = 30  # Request timeout in seconds for external API providers
    batch_size: int = 100  # Batch size for external API providers


class ServerConfig(BaseModel):
    """
    Persistent server configuration model.
    Saved to ~/.wims/server.json by default.
    """

    # Dynamic settings (persisted in JSON)
    api_key: str
    port: int = 8000
    host: str = "127.0.0.1"

    # Static/Legacy settings (defaults for now, can be overridden in JSON if needed)
    PROJECT_NAME: str = "WIMS Core"
    API_V1_STR: str = "/api/v1"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    DB_PATH: str = "data/wims.lance"
    AUTH_DB_PATH: str = "data/auth.db"

    # Security
    CORS_ORIGINS: list[str] = ["http://localhost", "http://127.0.0.1"]
    EXTENSION_ID: str = ""  # chrome-extension://<id>

    # Embedding configuration
    embedding: EmbeddingConfig = EmbeddingConfig()


class ConfigManager:
    """
    Manages loading, saving, and hot-reloading of the server configuration.
    """

    def __init__(self, config_path: Path | str | None = None):
        if config_path is None:
            # Check env var first
            env_path = os.environ.get("WIMS_CONFIG_FILE")
            if env_path:
                self.path = Path(env_path)
            else:
                # Default to ~/.wims/server.json
                self.path = Path.home() / ".wims" / "server.json"
        else:
            self.path = Path(config_path)

        self._config: ServerConfig = self._load_or_create()

    def set_config_path(self, config_path: Path | str):
        """Update config path and reload."""
        self.path = Path(config_path)
        self._config = self._load_or_create()

    @property
    def config(self) -> ServerConfig:
        return self._config

    async def watch_loop(self):
        """
        Watch for changes to the configuration file and reload automatically.
        """
        try:
            from watchfiles import awatch
        except ImportError:
            logger.warning("watchfiles not installed, hot reloading disabled")
            return

        logger.info(f"Starting configuration watcher on {self.path}")

        try:
            # watchfiles.awatch yields when changes occur
            async for _ in awatch(self.path):
                logger.info(f"Detected change in {self.path}, reloading...")
                self._reload()
        except Exception as e:
            logger.error(f"Error in config watcher: {e}")

    def _reload(self):
        """
        Reload configuration from disk and update internal state.
        """
        try:
            if not self.path.exists():
                logger.warning("Config file missing during reload, skipping...")
                return

            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)

            # We use model_validate to ensure the new config is valid before swapping
            new_config = ServerConfig.model_validate(data)
            self._config = new_config
            logger.info("Configuration reloaded successfully")

        except Exception as e:
            logger.error(f"Failed to reload configuration: {e}")

    def _load_or_create(self) -> ServerConfig:
        """
        Load config from disk or create a new one with a generated API key if missing.
        """
        if self.path.exists():
            try:
                with open(self.path, encoding="utf-8") as f:
                    data = json.load(f)
                logger.info(f"Loaded configuration from {self.path}")
                return ServerConfig.model_validate(data)
            except Exception as e:
                logger.error(f"Failed to load config from {self.path}: {e}. Backing up and recreating.")
                # Backup corrupt config
                backup_path = self.path.with_suffix(".json.bak")
                try:
                    os.replace(self.path, backup_path)
                    logger.info(f"Backed up corrupt config to {backup_path}")
                except OSError:
                    pass

        # Create new config
        logger.info(f"Creating new configuration at {self.path}")
        return self._create_new_config()

    def _create_new_config(self) -> ServerConfig:
        """
        Generate a new configuration with a secure API key.
        """
        # Generate a secure API key: sk-wims-<32-byte-hex>
        api_key = f"sk-wims-{secrets.token_urlsafe(32)}"
        config = ServerConfig(api_key=api_key)
        self._save(config)
        return config

    def _save(self, config: ServerConfig) -> None:
        """
        Atomically save configuration to disk.
        """
        # Ensure directory exists
        self.path.parent.mkdir(parents=True, exist_ok=True)

        # Atomic write: write to temp file, then rename
        # We use the same directory for the temp file to ensure atomic rename works across filesystems
        with tempfile.NamedTemporaryFile("w", dir=self.path.parent, delete=False, encoding="utf-8") as tmp:
            json.dump(config.model_dump(), tmp, indent=2)
            tmp_path = Path(tmp.name)

        try:
            os.replace(tmp_path, self.path)
            # Ensure permissions are restrictive (rw-------)
            os.chmod(self.path, 0o600)
        except OSError as e:
            logger.error(f"Failed to save config to {self.path}: {e}")
            # Try to clean up temp file if rename failed
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise


# Global instance
config_manager = ConfigManager()


def get_settings() -> ServerConfig:
    """
    Get the current snapshot of the server configuration.
    """
    return config_manager.config


# Backward compatibility
settings = config_manager.config
