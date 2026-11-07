"""Application settings read from the environment (and an optional .env file)."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Todo App"
    api_prefix: str = "/api"
    database_url: str = "sqlite+aiosqlite:///./todo.db"
    database_echo: bool = False

    @field_validator("database_url")
    @classmethod
    def use_async_driver(cls, value: str) -> str:
        """Hosting providers hand out sync URLs; the app needs the async driver."""
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+asyncpg://" + value.removeprefix(prefix)
        if value.startswith("sqlite://"):
            return "sqlite+aiosqlite://" + value.removeprefix("sqlite://")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
