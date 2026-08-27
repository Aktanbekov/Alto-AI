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

from ..evaluator.schema import Evaluation
from ..rag.retrieve import StudentProfile

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

    def to_profile(self) -> StudentProfile:
        data = self.model_dump()
        answers = data.pop("planned_answers", [])
        return StudentProfile(**data, planned_answers=answers)


# Per-million-token rates, so a run reports what it actually cost instead of a
# token count someone has to price by hand. Cache reads bill at a tenth of the
# input rate; cache writes at 1.25x.
PRICES = {
    "claude-opus-5": (5.0, 25.0),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-sonnet-5": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}


def usage_cost(meta: dict[str, Any]) -> float:
    """Dollar cost of one evaluation from its token counts."""
    model = str(meta.get("model", ""))
    rate_in, rate_out = next(
        (v for k, v in PRICES.items() if model.startswith(k)), (5.0, 25.0)
    )
    fresh = meta.get("input_tokens", 0) or 0
    cached = meta.get("cache_read_input_tokens", 0) or 0
    written = meta.get("cache_creation_input_tokens", 0) or 0
    out = meta.get("output_tokens", 0) or 0
    return (
        fresh * rate_in
        + cached * rate_in * 0.1
        + written * rate_in * 1.25
        + out * rate_out
    ) / 1_000_000


def create_app(processed_dir: Path, web_dir: Path):
    import logging

    from fastapi import FastAPI, HTTPException, Response
    from fastapi.responses import FileResponse
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
            )
        except Exception as exc:  # surface the real cause, not a generic 500
            message = str(exc)
            # Billing and auth failures are the common ones and are actionable;
            # they should not read as "the app is broken".
            if "credit balance" in message.lower():
                raise HTTPException(
                    402,
                    "The Anthropic account has no credits. Add credits in the "
                    "console under Plans & Billing, then try again.",
                ) from exc
            if "authentication" in message.lower() or "api key" in message.lower():
                raise HTTPException(401, "The API key was rejected. Check ANTHROPIC_API_KEY.") from exc
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
            cost,
        )
        # Headers rather than body fields: the response schema is the Evaluation
        # itself, and the caller should not have to parse a wrapper to get this.
        response.headers["X-Eval-Model"] = str(meta.get("model", ""))
        response.headers["X-Eval-Input-Tokens"] = str(meta.get("input_tokens", 0))
        response.headers["X-Eval-Cached-Tokens"] = str(meta.get("cache_read_input_tokens", 0))
        response.headers["X-Eval-Output-Tokens"] = str(meta.get("output_tokens", 0))
        response.headers["X-Eval-Cost-Usd"] = f"{cost:.4f}"
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
