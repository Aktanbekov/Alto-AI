"""Build the retrieval index over extracted interview records.

16k records is small enough that a dense float32 matrix (16k x 384 ~= 25MB)
beats a vector database: it loads in milliseconds and a full cosine scan is a
single matmul. No DuckDB vector extension, no FAISS.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_MAX_TURNS_IN_SUMMARY = 6


def add_record_id(df: pd.DataFrame) -> pd.DataFrame:
    """Attach a short stable `record_id` derived from the source content hash.

    Both the index metadata and the full parquet need the same id so the
    evaluator can join retrieved rows back to their transcripts.
    """
    if "record_id" in df.columns:
        return df
    df = df.copy()
    df["record_id"] = [
        (src or {}).get("content_hash", "")[:12] if isinstance(src, dict) else ""
        for src in df.get("source", [None] * len(df))
    ]
    return df


def build_summary(row: pd.Series) -> str:
    """One compact text blob per interview, used as the embedding input.

    Profile fields come first so that profile similarity dominates; the opening
    Q&A turns follow because they carry the officer's line of questioning.
    """
    parts: list[str] = []
    field_labels = [
        ("consulate_city", "Consulate"),
        ("consulate_country", "Country"),
        ("university", "University"),
        ("course", "Course"),
        ("degree_level", "Level"),
        ("major", "Major"),
        ("gpa", "GPA"),
        ("work_experience", "Work"),
        ("funding", "Funding"),
        ("scholarship", "Scholarship"),
        ("attempt_number", "Attempt"),
    ]
    for field, label in field_labels:
        value = row.get(field)
        if value is None or (isinstance(value, float) and pd.isna(value)):
            continue
        text = str(value).strip()
        if text:
            parts.append(f"{label}: {text}")

    scores = row.get("test_scores")
    if isinstance(scores, dict) and scores:
        joined = ", ".join(f"{k} {v}" for k, v in scores.items() if v)
        if joined:
            parts.append(f"Tests: {joined}")

    turns = row.get("qa_turns")
    if turns is not None and len(turns) > 0:
        for turn in list(turns)[:_MAX_TURNS_IN_SUMMARY]:
            question = (turn.get("question") or "").strip()
            answer = (turn.get("answer") or "").strip()
            if question:
                parts.append(f"VO: {question[:200]}")
            if answer:
                parts.append(f"Me: {answer[:200]}")

    return "\n".join(parts)


def build_index(
    parquet_path: Path,
    out_dir: Path,
    model_name: str = MODEL_NAME,
    batch_size: int = 256,
) -> dict[str, Any]:
    """Embed every record and write vectors + aligned metadata to `out_dir`."""
    from sentence_transformers import SentenceTransformer

    df = add_record_id(pd.read_parquet(parquet_path))
    summaries = [build_summary(row) for _, row in df.iterrows()]

    keep = [i for i, s in enumerate(summaries) if s.strip()]
    df = df.iloc[keep].reset_index(drop=True)
    summaries = [summaries[i] for i in keep]

    model = SentenceTransformer(model_name)
    vectors = model.encode(
        summaries,
        batch_size=batch_size,
        convert_to_numpy=True,
        normalize_embeddings=True,  # cosine similarity becomes a plain dot product
        show_progress_bar=True,
    ).astype(np.float32)

    out_dir.mkdir(parents=True, exist_ok=True)
    np.save(out_dir / "vectors.npy", vectors)

    meta_cols = [
        c
        for c in [
            "record_id", "outcome", "consulate_city", "consulate_country",
            "university", "course", "degree_level", "major", "gpa",
            "work_experience", "funding", "scholarship",
            "attempt_number", "interview_date", "channel", "message_id",
        ]
        if c in df.columns
    ]
    meta = df[meta_cols].copy()
    meta["summary"] = summaries
    meta["n_turns"] = [len(t) if t is not None else 0 for t in df.qa_turns]
    meta.to_parquet(out_dir / "index_meta.parquet", index=False)

    manifest = {
        "model": model_name,
        "n_records": int(len(df)),
        "dim": int(vectors.shape[1]),
    }
    (out_dir / "index_manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def build_index_default(processed_dir: Path) -> dict[str, Any]:
    """CLI convenience: standard paths under `data/processed`."""
    return build_index(processed_dir / "interviews.parquet", processed_dir / "index")
