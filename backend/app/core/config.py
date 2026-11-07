"""Application settings read from the environment."""

import os
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str
    api_prefix: str


def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "Todo App"),
        api_prefix="/api",
    )
