from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.db import create_engine, create_session_factory
from app.core.errors import register_error_handlers
from app.core.session import WorkspaceSessionMiddleware
from app.core.spa import SpaStaticFiles


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    # The engine connects lazily, so creating it here is cheap and also works
    # in tests that drive the app without running the lifespan.
    engine = create_engine(settings.database_url, echo=settings.database_echo)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        yield
        await engine.dispose()

    app = FastAPI(
        title=settings.app_name,
        openapi_url=f"{settings.api_prefix}/openapi.json",
        docs_url=f"{settings.api_prefix}/docs",
        redoc_url=None,
        lifespan=lifespan,
    )
    session_factory = create_session_factory(engine)
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.add_middleware(
        WorkspaceSessionMiddleware,
        settings=settings,
        session_factory=session_factory,
        # Infrastructure endpoints must not create workspaces (health checks run often).
        exempt_paths={
            f"{settings.api_prefix}/health",
            f"{settings.api_prefix}/docs",
            f"{settings.api_prefix}/docs/oauth2-redirect",
            f"{settings.api_prefix}/openapi.json",
        },
    )
    register_error_handlers(app)
    app.include_router(api_router, prefix=settings.api_prefix)
    if settings.static_dir:
        # Mounted last: API routes match first, everything else is the frontend.
        app.mount("/", SpaStaticFiles(Path(settings.static_dir), settings.api_prefix), name="spa")
    return app


app = create_app()
