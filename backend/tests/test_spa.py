"""Production: the API process also serves the built frontend."""

from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app

pytestmark = pytest.mark.anyio

INDEX = "<!doctype html><title>TOOD</title>"


@pytest.fixture
def dist(tmp_path: Path) -> Path:
    root = tmp_path / "dist"
    (root / "assets").mkdir(parents=True)
    (root / "index.html").write_text(INDEX, encoding="utf-8")
    (root / "assets" / "app-1a2b3c.js").write_text("console.log(1);" * 200, encoding="utf-8")
    (root / "robots.txt").write_text("User-agent: *", encoding="utf-8")
    return root


@pytest.fixture
async def spa_client(database_url: str, dist: Path) -> AsyncIterator[AsyncClient]:
    app = create_app(Settings(database_url=database_url, static_dir=str(dist)))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    await app.state.engine.dispose()


async def test_root_serves_index_and_revalidates(spa_client: AsyncClient) -> None:
    response = await spa_client.get("/")
    assert response.status_code == 200
    assert response.text == INDEX
    assert response.headers["cache-control"] == "no-cache"
    # Static files never start a session.
    assert "set-cookie" not in response.headers


async def test_hashed_assets_are_cached_for_a_year(spa_client: AsyncClient) -> None:
    response = await spa_client.get("/assets/app-1a2b3c.js")
    assert response.status_code == 200
    assert "immutable" in response.headers["cache-control"]


async def test_other_files_are_served_as_is(spa_client: AsyncClient) -> None:
    response = await spa_client.get("/robots.txt")
    assert response.text == "User-agent: *"
    assert response.headers["cache-control"] == "no-cache"


@pytest.mark.parametrize("path", ["/?list=inbox", "/some/deep/link", "/assets/missing.js"])
async def test_unknown_paths_fall_back_to_the_app(spa_client: AsyncClient, path: str) -> None:
    response = await spa_client.get(path)
    assert response.status_code == 200
    assert response.text == INDEX


async def test_api_keeps_working_and_unknown_api_paths_stay_json_404(
    spa_client: AsyncClient,
) -> None:
    assert (await spa_client.get("/api/health")).status_code == 200
    assert (await spa_client.get("/api/tasks")).json() == []
    missing = await spa_client.get("/api/nope")
    assert missing.status_code == 404
    assert missing.headers["content-type"].startswith("application/json")


async def test_without_static_dir_nothing_is_mounted(client: AsyncClient) -> None:
    assert (await client.get("/")).status_code == 404


async def test_large_text_responses_are_gzipped(spa_client: AsyncClient) -> None:
    response = await spa_client.get("/assets/app-1a2b3c.js", headers={"Accept-Encoding": "gzip"})
    assert response.headers["content-encoding"] == "gzip"
    assert response.text == "console.log(1);" * 200
