"""Local server: static frontend + the evaluator endpoint.

Deliberately thin — it wraps `evaluator.evaluate.evaluate()` and adds no
evaluation logic of its own. The only real responsibilities are reporting
whether the evaluator is usable and passing API errors through intelligibly.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from ..evaluator.providers import DEFAULT_PROVIDER, PROVIDERS, cost_of, resolve
from ..evaluator.schema import Evaluation
from ..rag.retrieve import StudentProfile

# Imported here rather than inside create_app, where the rest of the FastAPI
# names live.
#
# This module sets `from __future__ import annotations`, so every route
# annotation is stored as a string and FastAPI resolves it later against the
# function's *module* globals. A name imported inside the factory is invisible
# there: `response: Response` failed to resolve as the ASGI response object and
# quietly degraded into a required query parameter, so every POST /api/evaluate
# answered 422 "field required: query.response" before reaching the evaluator.
#
# The try/except keeps fastapi optional — it belongs to the `web` extra, and
# importing this module must not require it. Anything that calls create_app has
# it installed by definition.
try:
    from fastapi import Response
    from fastapi.responses import FileResponse
except ImportError:  # pragma: no cover - the web extra is not installed
    Response = None  # type: ignore[assignment,misc]
    FileResponse = None  # type: ignore[assignment,misc]

# One evaluation costs real money, so cap what a single caller can submit.
MAX_ANSWERS = 12
MAX_FIELD_CHARS = 2000


class PlannedAnswer(BaseModel):
    question: str = Field(max_length=MAX_FIELD_CHARS)
    answer: str = Field(max_length=MAX_FIELD_CHARS)


class ProfileRequest(BaseModel):
    consulate_city: str | None = Field(default=None, max_length=120)
    consulate_country: str | None = Field(default=None, max_length=120)
    university: str | None = Field(default=None, max_length=300)
    course: str | None = Field(default=None, max_length=300)
    degree_level: str | None = Field(default=None, max_length=120)
    major: str | None = Field(default=None, max_length=200)
    gpa: str | None = Field(default=None, max_length=60)
    # Grading scales are not comparable across countries; see visa_llm.grading.
    gpa_scale: str | None = Field(default=None, max_length=10)
    work_experience: str | None = Field(default=None, max_length=MAX_FIELD_CHARS)
    funding_source: str | None = Field(default=None, max_length=MAX_FIELD_CHARS)
    scholarship: str | None = Field(default=None, max_length=500)
    attempt_number: int | None = Field(default=1, ge=1, le=20)
    test_scores: dict[str, str] = Field(default_factory=dict)
    planned_answers: list[PlannedAnswer] = Field(default_factory=list, max_length=MAX_ANSWERS)
    # Which model scores this. Omitted by real users, who always get the
    # production provider; the admin comparison names one per call.
    model: str | None = Field(default=None, max_length=64)

    def to_profile(self) -> StudentProfile:
        data = self.model_dump()
        answers = data.pop("planned_answers", [])
        # `model` is a routing instruction, not part of the student's profile -
        # StudentProfile has no such field and would reject it.
        data.pop("model", None)
        return StudentProfile(**data, planned_answers=answers)


def usage_cost(meta: dict[str, Any]) -> float | None:
    """Dollar cost of one evaluation, or None when the model's rate is unknown.

    The rate table lives in evaluator.providers, next to the models it prices,
    so adding a provider cannot leave its cost silently defaulted. None rather
    than 0.0 matters in the comparison view: an unpriced model showing "$0.0000"
    beside two real figures reads as free.
    """
    return cost_of(meta)


def create_app(processed_dir: Path, web_dir: Path):
    import logging

    from fastapi import FastAPI, HTTPException
    from fastapi.staticfiles import StaticFiles

    log = logging.getLogger("visa_llm.evaluate")

    app = FastAPI(title="visa-llm", docs_url=None, redoc_url=None)

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        from ..config import api_key_status

        configured, detail = api_key_status()
        index_ready = (processed_dir / "index" / "vectors.npy").exists()
        if configured and not index_ready:
            detail = "The retrieval index is missing — run `visa-llm index`."
        return {
            "api_key_configured": configured and index_ready,
            "detail": detail,
            # The comparison models, and whether each has a usable credential.
            # Readiness here is "a key is present", not "the account has money" -
            # only a real call can tell you that.
            "providers": [
                {
                    "key": p.key,
                    "label": p.label,
                    "model": p.model,
                    "configured": p.configured(),
                }
                for p in PROVIDERS.values()
            ],
        }

    @app.post("/api/evaluate", response_model=Evaluation)
    def evaluate_endpoint(req: ProfileRequest, response: Response) -> Evaluation:
        if not req.planned_answers:
            raise HTTPException(400, "Add at least one question and answer.")
        from ..config import api_key_status

        configured, detail = api_key_status()
        if not configured:
            raise HTTPException(503, detail)

        from ..evaluator.evaluate import evaluate as run

        try:
            evaluation, meta = run(
                req.to_profile(),
                index_dir=processed_dir / "index",
                stats_path=processed_dir / "stats.json",
                parquet_path=processed_dir / "interviews.parquet",
                model=req.model or DEFAULT_PROVIDER,
            )
        except Exception as exc:  # surface the real cause, not a generic 500
            message = str(exc)
            # Billing and auth failures are the common ones and are actionable;
            # they should not read as "the app is broken". Since more than one
            # vendor can raise them, the message has to name the one that
            # actually failed - telling an operator to top up Anthropic because
            # DeepSeek is empty sends them to the wrong console.
            try:
                provider = resolve(req.model or DEFAULT_PROVIDER)
                vendor, env_key = provider.label, provider.env_key
            except Exception:  # noqa: BLE001 - an unknown model is reported below
                vendor, env_key = "The model provider", "the provider API key"
            lowered = message.lower()
            if any(
                phrase in lowered
                for phrase in ("credit balance", "insufficient balance", "quota")
            ):
                raise HTTPException(
                    402,
                    f"The {vendor} account has no credits. Add credits in that "
                    "provider's console, then try again.",
                ) from exc
            if "authentication" in lowered or "api key" in lowered or "invalid_api_key" in lowered:
                raise HTTPException(
                    401, f"The {vendor} API key was rejected. Check {env_key}."
                ) from exc
            raise HTTPException(500, message) from exc

        # What the call actually cost. This used to be discarded, which left no
        # way to tell an expensive prompt from an expensive answer.
        cost = usage_cost(meta)
        log.info(
            "evaluate: %s in=%s cached=%s out=%s cost=$%.4f",
            meta.get("model"),
            meta.get("input_tokens"),
            meta.get("cache_read_input_tokens"),
            meta.get("output_tokens"),
            cost if cost is not None else float("nan"),
        )
        # Headers rather than body fields: the response schema is the Evaluation
        # itself, and the caller should not have to parse a wrapper to get this.
        response.headers["X-Eval-Model"] = str(meta.get("model", ""))
        response.headers["X-Eval-Input-Tokens"] = str(meta.get("input_tokens", 0))
        response.headers["X-Eval-Cached-Tokens"] = str(meta.get("cache_read_input_tokens", 0))
        response.headers["X-Eval-Output-Tokens"] = str(meta.get("output_tokens", 0))
        response.headers["X-Eval-Cost-Usd"] = f"{cost:.4f}" if cost is not None else "0"
        # Without this a model we have no rate for is indistinguishable from a
        # free one, since the header is parsed into a float either way.
        response.headers["X-Eval-Cost-Known"] = "true" if cost is not None else "false"
        return evaluation

    if web_dir.exists():
        @app.get("/")
        def root() -> FileResponse:
            return FileResponse(web_dir / "index.html")

        app.mount("/", StaticFiles(directory=web_dir, html=True), name="web")

    return app


def serve(processed_dir: Path, web_dir: Path, host: str = "127.0.0.1", port: int = 8000) -> None:
    import uvicorn

    uvicorn.run(create_app(processed_dir, web_dir), host=host, port=port)
