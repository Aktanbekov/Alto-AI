"""LLM extraction for the residue the template parser could not handle.

Only records missing an outcome or a transcript are sent. The corpus is small
enough that this is a batch job, not a streaming pipeline: the Message Batches
API halves the cost and the results are merged back into the parquet.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from ..rag.embed import add_record_id
from .schema import ExtractedFields

MODEL = "claude-opus-5"
MAX_TOKENS = 4000
# Opus 5 list price per million tokens; batch halves both sides.
_INPUT_PER_MTOK = 5.00
_OUTPUT_PER_MTOK = 25.00
_BATCH_DISCOUNT = 0.5
_CHARS_PER_TOKEN = 3.6  # measured on this corpus, which is emoji-heavy

SYSTEM_PROMPT = """\
You extract structured data from F-1 visa interview reviews posted to Telegram.

Return only what the text actually states. Use null for anything absent — never
infer, complete, or normalize away a missing value. In particular:
- outcome: "approved" only if the text says the visa was approved/issued;
  "rejected" only if refused/denied; "administrative_processing_221g" for 221g
  or administrative processing; otherwise "unknown".
- qa_turns: the officer/applicant exchange in order. The officer's line goes in
  `question` and the applicant's reply in `answer`, even when the officer's line
  is not literally a question (greetings, document requests, the verdict).
- Keep the original wording of each turn. Do not paraphrase, summarize, or
  translate.
"""


def select_residue(df: pd.DataFrame) -> pd.DataFrame:
    """Records the template parser left without an outcome or without dialogue."""
    missing_outcome = df.outcome == "unknown"
    missing_turns = df.qa_turns.map(lambda t: t is None or len(t) == 0)
    return df[missing_outcome | missing_turns]


def estimate_cost(residue: pd.DataFrame) -> dict[str, Any]:
    """Token/dollar estimate, printed before anything is submitted."""
    system_tokens = len(SYSTEM_PROMPT) / _CHARS_PER_TOKEN
    input_tokens = sum(
        system_tokens + len(str(text)) / _CHARS_PER_TOKEN for text in residue.raw_text
    )
    # Extracted JSON runs well under the input; assume a third as a safe upper bound.
    output_tokens = sum(len(str(t)) / _CHARS_PER_TOKEN / 3 for t in residue.raw_text)
    cost = (
        input_tokens / 1e6 * _INPUT_PER_MTOK + output_tokens / 1e6 * _OUTPUT_PER_MTOK
    ) * _BATCH_DISCOUNT
    return {
        "records": int(len(residue)),
        "est_input_tokens": int(input_tokens),
        "est_output_tokens": int(output_tokens),
        "est_cost_usd_batch": round(cost, 2),
        "est_cost_usd_standard": round(cost / _BATCH_DISCOUNT, 2),
    }


def _requests(residue: pd.DataFrame, model: str) -> list[dict[str, Any]]:
    schema = ExtractedFields.model_json_schema()
    out = []
    for _, row in residue.iterrows():
        out.append(
            {
                "custom_id": str(row.record_id),
                "params": {
                    "model": model,
                    "max_tokens": MAX_TOKENS,
                    "system": [
                        {
                            "type": "text",
                            "text": SYSTEM_PROMPT,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    "messages": [{"role": "user", "content": str(row.raw_text)}],
                    "output_config": {
                        "format": {"type": "json_schema", "schema": schema}
                    },
                },
            }
        )
    return out


def submit(residue: pd.DataFrame, model: str = MODEL) -> str:
    """Submit the batch and return its id."""
    import anthropic

    client = anthropic.Anthropic()
    batch = client.messages.batches.create(requests=_requests(residue, model))
    return batch.id


def collect(batch_id: str, out_path: Path) -> int:
    """Write completed batch results to JSONL, keyed by record_id."""
    import anthropic

    client = anthropic.Anthropic()
    batch = client.messages.batches.retrieve(batch_id)
    if batch.processing_status != "ended":
        raise RuntimeError(f"batch {batch_id} is {batch.processing_status}, not ended")

    written = 0
    with open(out_path, "w", encoding="utf-8") as f:
        for result in client.messages.batches.results(batch_id):
            if result.result.type != "succeeded":
                continue
            message = result.result.message
            text = "".join(b.text for b in message.content if b.type == "text")
            try:
                fields = json.loads(text)
            except json.JSONDecodeError:
                continue
            f.write(
                json.dumps(
                    {"record_id": result.custom_id, "fields": fields},
                    ensure_ascii=False,
                )
                + "\n"
            )
            written += 1
    return written


def merge(parquet_path: Path, results_path: Path) -> dict[str, int]:
    """Merge LLM-extracted fields into the parquet, filling only empty values."""
    df = add_record_id(pd.read_parquet(parquet_path))
    by_id: dict[str, dict[str, Any]] = {}
    with open(results_path, encoding="utf-8") as f:
        for line in f:
            row = json.loads(line)
            by_id[row["record_id"]] = row["fields"]

    filled_outcome = filled_turns = 0
    for i, rid in enumerate(df.record_id):
        fields = by_id.get(rid)
        if not fields:
            continue
        if df.at[i, "outcome"] == "unknown" and fields.get("outcome"):
            df.at[i, "outcome"] = fields["outcome"]
            df.at[i, "parse_method"] = "llm"
            filled_outcome += 1
        turns = df.at[i, "qa_turns"]
        if (turns is None or len(turns) == 0) and fields.get("qa_turns"):
            df.at[i, "qa_turns"] = fields["qa_turns"]
            df.at[i, "parse_method"] = "llm"
            filled_turns += 1

    df.to_parquet(parquet_path, index=False)
    return {"filled_outcome": filled_outcome, "filled_turns": filled_turns}


def run_llm_extraction(
    parquet_path: Path, model: str = MODEL, dry_run: bool = False
) -> dict[str, Any]:
    """Estimate cost, and unless `dry_run`, submit the batch."""
    df = add_record_id(pd.read_parquet(parquet_path))
    residue = select_residue(df)
    estimate = estimate_cost(residue)

    print(f"LLM residue: {estimate['records']:,} of {len(df):,} records")
    print(f"  est. input tokens : {estimate['est_input_tokens']:,}")
    print(f"  est. output tokens: {estimate['est_output_tokens']:,}")
    print(
        f"  est. cost: ${estimate['est_cost_usd_batch']} via Batches API "
        f"(${estimate['est_cost_usd_standard']} standard), model {model}"
    )
    if dry_run:
        print("\ndry run — nothing submitted.")
        return estimate

    batch_id = submit(residue, model=model)
    print(f"\nsubmitted batch {batch_id}")
    print(f"collect with: visa-llm extract-llm-collect {batch_id}")
    estimate["batch_id"] = batch_id
    return estimate
