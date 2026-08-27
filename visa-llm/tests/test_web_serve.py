"""Backend contract tests. No API key is needed — these cover validation,
health reporting, and the error translation that keeps failures actionable."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

from visa_llm.web.serve import ProfileRequest, create_app  # noqa: E402

PROCESSED = Path("data/processed")
WEB = Path("web")


@pytest.fixture
def client(monkeypatch, tmp_path):
    # Isolate from the developer's real .env: these tests describe the
    # no-key behaviour and must not depend on the local machine.
    from visa_llm import config

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setattr(config, "ENV_PATH", tmp_path / ".env")
    monkeypatch.setattr(config, "_loaded", False)
    return TestClient(create_app(PROCESSED, WEB))


def test_health_reports_missing_key(client):
    body = client.get("/api/health").json()
    assert body["api_key_configured"] is False
    assert "ANTHROPIC_API_KEY" in body["detail"]


def test_evaluate_requires_answers(client):
    res = client.post("/api/evaluate", json={"planned_answers": []})
    assert res.status_code == 400


def test_evaluate_refuses_without_key(client):
    res = client.post("/api/evaluate", json={
        "consulate_city": "Chennai",
        "planned_answers": [{"question": "Why UTD?", "answer": "STEM program."}],
    })
    assert res.status_code == 503


def test_request_caps_answer_count():
    # One evaluation costs real money; the cap is part of the contract.
    with pytest.raises(Exception):
        ProfileRequest(planned_answers=[{"question": "q", "answer": "a"}] * 13)


def test_request_caps_field_length():
    with pytest.raises(Exception):
        ProfileRequest(planned_answers=[{"question": "q", "answer": "x" * 2001}])


def test_request_rejects_absurd_attempt_number():
    with pytest.raises(Exception):
        ProfileRequest(attempt_number=99)


def test_profile_maps_to_student_profile():
    req = ProfileRequest(
        consulate_city="Chennai", degree_level="Masters",
        planned_answers=[{"question": "Why UTD?", "answer": "STEM."}],
    )
    profile = req.to_profile()
    assert profile.consulate_city == "Chennai"
    assert profile.planned_answers == [{"question": "Why UTD?", "answer": "STEM."}]
