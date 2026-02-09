from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "WIMS Core"
    API_V1_STR: str = "/api/v1"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    DB_PATH: str = "data/wims.lance"
    AUTH_DB_PATH: str = "data/auth.db"

    # Security
    CORS_ORIGINS: list[str] = ["http://localhost", "http://127.0.0.1"]
    EXTENSION_ID: str = ""  # chrome-extension://<id>


settings = Settings()


def get_settings() -> Settings:
    return settings
