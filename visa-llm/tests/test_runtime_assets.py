"""The evaluator's data must reach production as real files.

Production builds from git with no Git LFS, so any runtime file stored in LFS
arrives as a ~130-byte placeholder. That is how every interview check failed
with numpy's "This file contains pickled (object) data" error while the status
endpoint still said ready. These tests fail before such a commit can ship.
"""

from __future__ import annotations

import fnmatch
import shutil
import subprocess
from pathlib import Path

import pytest

from visa_llm.rag.retrieve import (
    RUNTIME_FILES,
    InterviewIndex,
    is_lfs_pointer,
    runtime_assets_problem,
)

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
POINTER = (
    "version https://git-lfs.github.com/spec/v1\n"
    "oid sha256:7c7643986dfc451c7f3ce40cc661583f4e89f2d924e9514a235bfc5a006e529c\n"
    "size 24835712\n"
)


def _git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True)


@pytest.mark.parametrize("rel", RUNTIME_FILES)
def test_runtime_file_is_committed_as_real_data(rel):
    """What git will hand the build - the staged blob - is the data itself."""
    if shutil.which("git") is None or _git("rev-parse", "--git-dir").returncode != 0:
        pytest.skip("not in a git checkout")
    blob = _git("show", f":./data/processed/{rel}")
    assert blob.returncode == 0, f"data/processed/{rel} is not tracked in git"
    assert not blob.stdout.startswith(b"version https://git-lfs"), (
        f"data/processed/{rel} is stored in Git LFS; production builds get a "
        "placeholder. Add a -filter rule for it in .gitattributes and re-add it."
    )


@pytest.mark.parametrize("rel", RUNTIME_FILES)
def test_runtime_file_is_not_lfs_attributed(rel):
    """Catches a new .gitattributes rule before anyone re-adds the file."""
    if shutil.which("git") is None or _git("rev-parse", "--git-dir").returncode != 0:
        pytest.skip("not in a git checkout")
    out = _git("check-attr", "filter", "--", f"data/processed/{rel}").stdout.decode()
    assert "filter: lfs" not in out, f".gitattributes sends data/processed/{rel} to LFS"


def test_runtime_assets_present_and_loadable():
    assert runtime_assets_problem(PROCESSED) is None
    index = InterviewIndex(PROCESSED / "index")
    assert index.vectors.ndim == 2 and index.vectors.dtype.kind == "f"
    assert len(index.vectors) == len(index.meta) > 1000


def _processed_with_pointer(tmp_path: Path, rel: str) -> Path:
    out = tmp_path / "processed"
    for name in RUNTIME_FILES:
        (out / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(PROCESSED / name, out / name)
    (out / rel).write_text(POINTER)
    return out


@pytest.mark.parametrize("rel", RUNTIME_FILES)
def test_placeholder_is_reported(tmp_path, rel):
    out = _processed_with_pointer(tmp_path, rel)
    assert is_lfs_pointer(out / rel)
    problem = runtime_assets_problem(out)
    assert problem and rel in problem and "LFS" in problem


def test_missing_file_is_reported(tmp_path):
    out = _processed_with_pointer(tmp_path, "interviews.parquet")
    (out / "interviews.parquet").unlink()
    assert "missing" in runtime_assets_problem(out)


def test_index_refuses_placeholder_with_a_clear_error(tmp_path):
    out = _processed_with_pointer(tmp_path, "index/vectors.npy")
    with pytest.raises(RuntimeError, match="LFS placeholder"):
        InterviewIndex(out / "index")


def test_health_is_not_ready_with_placeholder(tmp_path, monkeypatch):
    """The status the Go app relays must say not ready, not just "file exists"."""
    pytest.importorskip("fastapi")
    from fastapi.testclient import TestClient

    from visa_llm import config
    from visa_llm.web.serve import create_app

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setattr(config, "ENV_PATH", tmp_path / ".env")
    monkeypatch.setattr(config, "_loaded", False)
    out = _processed_with_pointer(tmp_path, "index/vectors.npy")

    body = TestClient(create_app(out, ROOT / "web")).get("/api/health").json()
    assert body["api_key_configured"] is False
    assert "LFS" in body["detail"]

    ok = TestClient(create_app(PROCESSED, ROOT / "web")).get("/api/health").json()
    assert ok["api_key_configured"] is True, ok["detail"]


def test_docker_build_ships_processed_data():
    """The evaluator image copies data/ and does not ignore the runtime files."""
    dockerfile = (ROOT / "Dockerfile.vercel").read_text()
    assert "COPY data ./data" in dockerfile
    lines = (ROOT / ".dockerignore").read_text().splitlines()
    ignored = [ln.strip() for ln in lines if ln.strip() and not ln.lstrip().startswith("#")]
    for rel in RUNTIME_FILES:
        path = f"data/processed/{rel}"
        for pattern in ignored:
            p = pattern.rstrip("/")
            hit = fnmatch.fnmatch(path, p) or path.startswith(p + "/")
            assert not hit, f".dockerignore pattern {pattern!r} drops {path}"
