"""Environment loading: .env support and precedence."""

from __future__ import annotations

import os

import pytest

from visa_llm import config


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    # load_env caches; each test needs a clean slate.
    monkeypatch.setattr(config, "_loaded", False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


def test_loads_key_from_env_file(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("ANTHROPIC_API_KEY=sk-ant-from-file\n")
    assert config.load_env(env) is True
    assert os.environ["ANTHROPIC_API_KEY"] == "sk-ant-from-file"


def test_shell_export_wins_over_env_file(tmp_path, monkeypatch):
    # An explicit export is a deliberate override and must not be replaced.
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-from-shell")
    env = tmp_path / ".env"
    env.write_text("ANTHROPIC_API_KEY=sk-ant-from-file\n")
    config.load_env(env)
    assert os.environ["ANTHROPIC_API_KEY"] == "sk-ant-from-shell"


def test_missing_file_is_not_an_error(tmp_path):
    assert config.load_env(tmp_path / "nope.env") is False


def test_simple_parser_handles_quotes_comments_and_export(tmp_path):
    env = tmp_path / ".env"
    env.write_text(
        "# a comment\n"
        "\n"
        'export ANTHROPIC_API_KEY="sk-ant-quoted"\n'
        "OTHER_SETTING='single'\n"
        "malformed line without equals\n"
    )
    config._load_simple(env)
    assert os.environ["ANTHROPIC_API_KEY"] == "sk-ant-quoted"
    assert os.environ["OTHER_SETTING"] == "single"


def test_status_reports_missing_key(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "ENV_PATH", tmp_path / ".env")
    ok, detail = config.api_key_status()
    assert ok is False
    assert "ANTHROPIC_API_KEY" in detail


def test_status_reports_present_key(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-x")
    ok, detail = config.api_key_status()
    assert ok is True
    assert "Loaded from" in detail
