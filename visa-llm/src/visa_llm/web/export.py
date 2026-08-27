"""Export the processed corpus as static JSON for the web frontend.

Sizing drives the split: the searchable index for all 16k records gzips to
~0.2 MB, so it ships whole and search runs entirely in the browser. Transcripts
are 25x larger, so they are sharded and fetched only when a record is opened.
"""

from __future__ import annotations

import json
import math
import re
import shutil
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd

from ..analytics.stats import _norm_city, _norm_country, _norm_degree
from ..analytics.taxonomy import PROCEDURAL, classify
from ..rag.embed import add_record_id

N_SHARDS = 64
MAX_EXAMPLES_PER_TYPE = 8
# Example questions are shown verbatim to students; skip fragments and essays.
_EXAMPLE_MIN_CHARS = 12
_EXAMPLE_MAX_CHARS = 160


def _clean(value: Any) -> Any:
    """JSON-safe scalar: NaN/NaT/empty become None."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if pd.isna(value):
        return None
    return value


def _year(value: Any) -> int | None:
    text = _clean(value)
    if not isinstance(text, str) or len(text) < 4:
        return None
    head = text[:4]
    return int(head) if head.isdigit() and 1990 <= int(head) <= 2100 else None


def _shard_of(idx: int) -> int:
    """Shard for a sequential id. Derivable in the browser, so it is not stored."""
    return idx % N_SHARDS


def build_index(df: pd.DataFrame) -> list[dict[str, Any]]:
    """One compact row per record: what search and faceting need, nothing more."""
    cities = df.consulate_city.map(_norm_city)
    countries = df.consulate_country.map(_norm_country)
    degrees = df.apply(_norm_degree, axis=1)

    rows: list[dict[str, Any]] = []
    for i, (_, row) in enumerate(df.iterrows()):
        turns = row.qa_turns
        city = _clean(cities.iloc[i])
        raw_city = _clean(row.consulate_city)
        entry = {
            "id": i,                               # sequential; shard = id % N_SHARDS
            "o": row.outcome,
            "c": city,                             # normalized city (facet)
            "cr": _clean(countries.iloc[i]),       # normalized country (facet)
            "d": _clean(degrees.iloc[i]),          # normalized degree (facet)
            # Keep the raw city only when normalization declined it, so it stays
            # searchable without duplicating the facet value on every row.
            "rc": None if city else raw_city,
            "u": _clean(row.university),
            "co": _clean(row.course),
            "g": _clean(row.gpa),
            "y": _year(row.interview_date),
            "n": len(turns) if turns is not None else 0,
        }
        # Null keys are dropped: most rows have several, and the frontend treats
        # a missing key and a null the same way.
        rows.append({k: v for k, v in entry.items() if v is not None})
    return rows


def build_shards(df: pd.DataFrame) -> dict[int, dict[str, Any]]:
    """Full transcripts + detail fields, grouped into lazily-fetched shards."""
    shards: dict[int, dict[str, Any]] = defaultdict(dict)
    for i, (_, row) in enumerate(df.iterrows()):
        turns = row.qa_turns
        if turns is None or len(turns) == 0:
            continue
        shards[_shard_of(i)][str(i)] = {
            # The content hash stays here so evaluator citations can resolve.
            "hash": row.record_id,
            "turns": [
                {"q": (t.get("question") or "").strip(), "a": (t.get("answer") or "").strip()}
                for t in turns
            ],
            "university": _clean(row.university),
            "course": _clean(row.course),
            "city": _clean(row.consulate_city),
            "country": _clean(row.consulate_country),
            "gpa": _clean(row.gpa),
            "work": _clean(row.work_experience),
            "funding": _clean(row.funding),
            "scholarship": _clean(row.scholarship),
            "attempt": _clean(row.attempt_number),
            "date": _clean(row.interview_date),
            "outcome": row.outcome,
            "tips": _clean(row.tips),
        }
    return shards


def _top_examples(variants: dict[str, list[str]]) -> list[str]:
    """Most-asked distinct questions, each shown in its most common spelling."""
    ranked = sorted(variants.values(), key=len, reverse=True)[:MAX_EXAMPLES_PER_TYPE]
    return [Counter(group).most_common(1)[0][0] for group in ranked]


def build_question_bank(df: pd.DataFrame, stats: dict[str, Any]) -> list[dict[str, Any]]:
    """Join question-type statistics with real example phrasings from the corpus."""
    cities = df.consulate_city.map(_norm_city)

    # canonical form -> every original spelling seen, so we can rank by
    # frequency and still display the most common casing.
    examples: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    by_city: dict[str, Counter] = defaultdict(Counter)
    for i, turns in enumerate(df.qa_turns):
        if turns is None or len(turns) == 0:
            continue
        city = _clean(cities.iloc[i])
        seen_here: set[str] = set()
        for turn in turns:
            question = (turn.get("question") or "").strip()
            if not question:
                continue
            label = classify(question)
            if label in PROCEDURAL or label == "other":
                continue
            if _EXAMPLE_MIN_CHARS <= len(question) <= _EXAMPLE_MAX_CHARS:
                key = re.sub(r"[^a-z0-9 ]", "", question.lower()).strip()
                key = re.sub(r"\s+", " ", key)
                if key:
                    examples[label][key].append(question)
            if city and label not in seen_here:
                by_city[label][city] += 1
                seen_here.add(label)

    bank: list[dict[str, Any]] = []
    for entry in stats.get("question_types", []):
        label = entry["question_type"]
        bank.append(
            {
                **entry,
                # Most-repeated phrasings are the most representative ones.
                "examples": _top_examples(examples[label]),
                "top_cities": [
                    {"city": c, "n": n} for c, n in by_city[label].most_common(5)
                ],
            }
        )
    return bank


def export(processed_dir: Path, web_dir: Path) -> dict[str, Any]:
    """Write index.json, transcript shards, questions.json, stats and manifest."""
    df = add_record_id(pd.read_parquet(processed_dir / "interviews.parquet"))
    stats = json.loads((processed_dir / "stats.json").read_text())

    data_dir = web_dir / "data"
    shard_dir = data_dir / "transcripts"
    if shard_dir.exists():
        shutil.rmtree(shard_dir)
    shard_dir.mkdir(parents=True, exist_ok=True)

    index = build_index(df)
    (data_dir / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    )

    shards = build_shards(df)
    for shard_id, payload in shards.items():
        (shard_dir / f"shard-{shard_id:02d}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        )

    # Hash -> sequential id, so evaluator citations (which use content hashes)
    # can deep-link into the explorer. Loaded lazily by the evaluator view only,
    # because it is incompressible and most visitors never need it.
    (data_dir / "hashmap.json").write_text(
        json.dumps(
            {row.record_id: i for i, (_, row) in enumerate(df.iterrows())},
            separators=(",", ":"),
        )
    )

    (data_dir / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, allow_nan=False))
    (data_dir / "questions.json").write_text(
        json.dumps(build_question_bank(df, stats), ensure_ascii=False, allow_nan=False)
    )

    manifest = {
        "built": date.today().isoformat(),
        "n_records": len(index),
        "n_with_transcript": sum(len(p) for p in shards.values()),
        "n_shards": N_SHARDS,
        "year_range": stats.get("meta", {}).get("year_range"),
        "outcome_counts": stats.get("meta", {}).get("outcome_counts", {}),
    }
    (data_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest
