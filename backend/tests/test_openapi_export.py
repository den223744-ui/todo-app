import json
from pathlib import Path

import pytest

from app.openapi_export import build_openapi, main


def test_writes_the_app_schema(tmp_path: Path) -> None:
    target = tmp_path / "openapi.json"

    assert main(["openapi_export", str(target)]) == 0

    text = target.read_text(encoding="utf-8")
    assert json.loads(text) == build_openapi()
    assert text.endswith("}\n")
    assert "\r\n" not in text


def test_output_is_deterministic(tmp_path: Path) -> None:
    first, second = tmp_path / "a.json", tmp_path / "b.json"

    main(["openapi_export", str(first)])
    main(["openapi_export", str(second)])

    assert first.read_bytes() == second.read_bytes()


def test_requires_output_path(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["openapi_export"]) == 2
    assert "usage" in capsys.readouterr().err
