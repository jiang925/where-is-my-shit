import json
import logging
import os
import secrets
import tempfile
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ServerConfig(BaseModel):
    """
    Persistent server configuration model.
    Saved to ~/.wims/server.json by default.
    """
    api_key: str
    port: int = 8000
    host: str = "127.0.0.1"


class ConfigManager:
    """
    Manages loading, saving, and hot-reloading of the server configuration.
    """

    def __init__(self, config_path: Path | str | None = None):
        if config_path is None:
            # Default to ~/.wims/server.json
            self.path = Path.home() / ".wims" / "server.json"
        else:
            self.path = Path(config_path)

        self._config: ServerConfig = self._load_or_create()

    @property
    def config(self) -> ServerConfig:
        return self._config

    def _load_or_create(self) -> ServerConfig:
        """
        Load config from disk or create a new one with a generated API key if missing.
        """
        if self.path.exists():
            try:
                with open(self.path, "r", encoding="utf-8") as f:
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

# Global instance will be added in Task 3
