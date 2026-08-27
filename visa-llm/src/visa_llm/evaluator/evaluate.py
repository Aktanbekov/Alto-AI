"""Run a grounded evaluation against Claude."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from ..rag.embed import add_record_id
from ..rag.retrieve import InterviewIndex, StudentProfile
from .prompts import (
    SYSTEM_PROMPT,
    TASK_INSTRUCTION,
    format_retrieved,
    format_statistics,
    format_student,
)
from .schema import Evaluation

MODEL = "claude-opus-5"
# Streaming keeps a large max_tokens from hitting the SDK's HTTP timeout.
MAX_TOKENS = 16000

# How many comparable interviews to retrieve. The set is repetitive enough that
# the last few rarely add an argument the first few did not already make, and
# every one of them is uncached input on every call. See MAX_TURNS in prompts.py
# for the other half of this budget.
DEFAULT_K = 6


def build_messages(
    profile: StudentProfile,
    stats: dict[str, Any],
    retrieved: pd.DataFrame,
    full_df: pd.DataFrame | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (system_blocks, messages).

    The system blocks carry the cache breakpoint: prompt + corpus statistics are
    the same for every student, so they stay a stable cached prefix while the
    per-student material rides in the user turn.
    """
    system_blocks = [
        {"type": "text", "text": SYSTEM_PROMPT},
        {
            "type": "text",
            "text": format_statistics(stats, profile.consulate_city),
            "cache_control": {"type": "ephemeral"},
        },
    ]
    user_text = "\n\n".join(
        [
            format_retrieved(retrieved, full_df),
            format_student(profile),
            TASK_INSTRUCTION,
        ]
    )
    return system_blocks, [{"role": "user", "content": user_text}]


def evaluate(
    profile: StudentProfile,
    index_dir: Path,
    stats_path: Path,
    parquet_path: Path | None = None,
    k: int = DEFAULT_K,
    model: str = MODEL,
) -> tuple[Evaluation, dict[str, Any]]:
    """Retrieve comparables, call Claude, and validate the structured result."""
    import anthropic

    stats = json.loads(Path(stats_path).read_text())
    index = InterviewIndex(Path(index_dir))
    retrieved = index.search(profile, k=k)

    full_df = None
    if parquet_path is not None and Path(parquet_path).exists():
        full_df = add_record_id(pd.read_parquet(parquet_path))

    system_blocks, messages = build_messages(profile, stats, retrieved, full_df)

    client = anthropic.Anthropic()
    # `parse` takes the pydantic model directly: the SDK generates a strict
    # schema from it and validates the reply, so no hand-built JSON schema and
    # no manual model_validate_json. `betas`/`fallbacks` are beta-client only.
    message = client.beta.messages.parse(
        model=model,
        max_tokens=MAX_TOKENS,
        system=system_blocks,
        messages=messages,
        output_format=Evaluation,
        # Medium effort: the analysis is a fixed-shape read of supplied data,
        # not open-ended reasoning, and thinking tokens bill at the output rate.
        output_config={"effort": "medium"},
        # Safety classifiers can decline; fall back rather than failing the run.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )

    if message.stop_reason == "refusal":
        raise RuntimeError(
            "The model declined this request "
            f"({getattr(message.stop_details, 'category', 'unspecified')}). "
            "Check the profile text for anything asking for misrepresentation."
        )

    evaluation = message.parsed_output
    if evaluation is None:
        raise RuntimeError(
            f"No structured output returned (stop_reason={message.stop_reason}). "
            "If this is max_tokens, raise MAX_TOKENS."
        )

    usage = message.usage
    meta = {
        "model": message.model,
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", 0),
        "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", 0),
        "retrieved": retrieved[["record_id", "outcome", "similarity"]].to_dict("records")
        if "record_id" in retrieved.columns
        else [],
        "pool_size": int(retrieved["pool_size"].iloc[0]) if len(retrieved) else 0,
    }
    return evaluation, meta


def load_profile(path: Path) -> StudentProfile:
    """Read a student profile from YAML."""
    import yaml

    data = yaml.safe_load(Path(path).read_text()) or {}
    answers = data.get("planned_answers") or []
    normalized = [
        {"question": str(a.get("question", "")), "answer": str(a.get("answer", ""))}
        for a in answers
        if isinstance(a, dict)
    ]
    known = {f for f in StudentProfile.__dataclass_fields__ if f != "planned_answers"}
    kwargs = {k: v for k, v in data.items() if k in known}
    return StudentProfile(**kwargs, planned_answers=normalized)


def render(evaluation: Evaluation, meta: dict[str, Any]) -> str:
    """Human-readable evaluation for the terminal."""
    out: list[str] = []
    out.append(f"READINESS: {evaluation.readiness.upper()}")
    out.append(evaluation.summary)
    out.append("")

    if evaluation.answer_feedback:
        out.append("=" * 70)
        out.append("ANSWER FEEDBACK")
        out.append("=" * 70)
        for fb in evaluation.answer_feedback:
            out.append(f"\nQ: {fb.question}")
            out.append(f"   verdict: {fb.verdict}")
            for s in fb.strengths:
                out.append(f"   + {s}")
            for r in fb.risks:
                out.append(f"   ! {r}")
            out.append(f"   -> suggested: {fb.suggested_revision}")

    out.append("")
    out.append("=" * 70)
    out.append("LIKELY QUESTIONS FOR THIS PROFILE")
    out.append("=" * 70)
    for q in evaluation.likely_questions:
        out.append(f"\n[{q.question_type}] asked in {q.asked_in_share}")
        out.append(f'   e.g. "{q.example_question}"')
        out.append(f"   why: {q.why_likely}")
        out.append(f"   prep: {q.how_to_prepare}")

    out.append("")
    out.append("=" * 70)
    out.append("RISK FACTORS")
    out.append("=" * 70)
    for rf in evaluation.risk_factors:
        out.append(f"\n[{rf.severity}] {rf.factor}")
        out.append(f"   evidence: {rf.evidence}")

    if evaluation.comparable_interviews:
        out.append("")
        out.append("COMPARABLE INTERVIEWS USED")
        for c in evaluation.comparable_interviews:
            out.append(f"  - {c}")

    out.append("")
    out.append("CAVEAT")
    out.append(evaluation.caveat)
    out.append("")
    out.append(
        f"[{meta['model']} | in {meta['input_tokens']} "
        f"(cache read {meta['cache_read_input_tokens']}) "
        f"out {meta['output_tokens']} | pool {meta['pool_size']}]"
    )
    return "\n".join(out)


def run_evaluation(
    profile_path: Path,
    processed_dir: Path,
    model: str = MODEL,
    k: int = DEFAULT_K,
    json_out: Path | None = None,
) -> Evaluation:
    """CLI entry point: load YAML profile, evaluate, print, optionally save."""
    profile = load_profile(profile_path)
    evaluation, meta = evaluate(
        profile,
        index_dir=processed_dir / "index",
        stats_path=processed_dir / "stats.json",
        parquet_path=processed_dir / "interviews.parquet",
        k=k,
        model=model,
    )
    print(render(evaluation, meta))
    if json_out is not None:
        Path(json_out).write_text(evaluation.model_dump_json(indent=2))
    return evaluation


def dry_run_prompt(profile_path: Path, processed_dir: Path, k: int = DEFAULT_K) -> str:
    """Assemble and return the exact prompt, without calling the API."""
    profile = load_profile(profile_path)
    stats = json.loads((processed_dir / "stats.json").read_text())
    index = InterviewIndex(processed_dir / "index")
    retrieved = index.search(profile, k=k)
    parquet = processed_dir / "interviews.parquet"
    full_df = add_record_id(pd.read_parquet(parquet)) if parquet.exists() else None
    system_blocks, messages = build_messages(profile, stats, retrieved, full_df)

    system_text = "\n\n".join(b["text"] for b in system_blocks)
    user_text = messages[0]["content"]
    approx = (len(system_text) + len(user_text)) // 4
    header = (
        f"[dry run] system {len(system_text):,} chars (cached prefix) | "
        f"user {len(user_text):,} chars | ~{approx:,} tokens | "
        f"retrieved {len(retrieved)} "
        f"({ {k: int(v) for k, v in retrieved.outcome.value_counts().items()} })\n"
    )
    return header + "\n" + "=" * 70 + "\nSYSTEM\n" + "=" * 70 + "\n" + system_text + \
        "\n\n" + "=" * 70 + "\nUSER\n" + "=" * 70 + "\n" + user_text
