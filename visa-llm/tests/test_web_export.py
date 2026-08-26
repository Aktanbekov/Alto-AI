"""Exporter tests: JSON validity, id/shard consistency, and NaN safety."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest

from visa_llm.web.export import (
    N_SHARDS,
    _clean,
    _shard_of,
    _top_examples,
    _year,
    build_index,
    build_question_bank,
    build_shards,
)


def _frame():
    return pd.DataFrame([
        {
            "record_id": "aaaabbbbcccc", "outcome": "approved",
            "consulate_city": "Chennai", "consulate_country": "India",
            "university": "UTD", "course": "MS Business Analytics",
            "degree_level": "Masters", "gpa": "8.1", "interview_date": "2023-06-13",
            "work_experience": "2 years", "funding": "loan", "scholarship": None,
            "attempt_number": 1.0, "tips": None,
            "qa_turns": [{"question": "Who is funding you?", "answer": "My father."}],
        },
        {
            "record_id": "ddddeeeeffff", "outcome": "rejected",
            "consulate_city": None, "consulate_country": None,
            "university": None, "course": None, "degree_level": None,
            "gpa": np.nan, "interview_date": None, "work_experience": None,
            "funding": None, "scholarship": None, "attempt_number": np.nan,
            "tips": None, "qa_turns": [],
        },
    ])


def test_clean_normalizes_missing_values():
    assert _clean(np.nan) is None
    assert _clean(None) is None
    assert _clean("  ") is None
    assert _clean("  Chennai ") == "Chennai"
    assert _clean(3) == 3


def test_year_rejects_garbage_dates():
    # The corpus contains parse artifacts like year 1 and year 3023.
    assert _year("2023-06-13") == 2023
    assert _year("3023-04-17") is None
    assert _year("1.0") is None
    assert _year(None) is None


def test_shard_is_derivable_and_in_range():
    for idx in (0, 1, 63, 64, 16203):
        assert _shard_of(idx) == idx % N_SHARDS
        assert 0 <= _shard_of(idx) < N_SHARDS


def test_index_is_json_safe_and_drops_nulls():
    rows = build_index(_frame())
    # allow_nan=False is the guard that caught a real NaN leak; keep it tested.
    json.dumps(rows, allow_nan=False)
    assert rows[0]["id"] == 0 and rows[1]["id"] == 1
    assert rows[0]["c"] == "Chennai"
    assert "g" not in rows[1], "null keys must be omitted, not emitted as null"
    assert rows[0]["n"] == 1 and rows[1]["n"] == 0


def test_index_keeps_raw_city_only_when_normalization_declined():
    df = _frame()
    df.loc[0, "consulate_city"] = "Chennai"
    df.loc[1, "consulate_city"] = "Some Unlisted Post"
    rows = build_index(df)
    assert "rc" not in rows[0], "raw city is redundant once normalized"
    assert rows[1]["rc"] == "Some Unlisted Post"


def test_shards_only_contain_records_with_transcripts():
    shards = build_shards(_frame())
    stored = {k: v for payload in shards.values() for k, v in payload.items()}
    assert list(stored) == ["0"]
    assert stored["0"]["turns"][0]["q"] == "Who is funding you?"
    assert stored["0"]["hash"] == "aaaabbbbcccc", "hash must survive for citation lookup"
    json.dumps(shards, allow_nan=False)


def test_shard_placement_matches_index_ids():
    df = _frame()
    rows = build_index(df)
    shards = build_shards(df)
    for row in rows:
        if row["n"]:
            assert str(row["id"]) in shards[row["id"] % N_SHARDS]


def test_question_bank_skips_nan_cities():
    # pandas .map turns None into NaN, and NaN is truthy — the bug that produced
    # invalid JSON. Cities must never leak in as NaN keys.
    stats = {"question_types": [
        {"question_type": "funding_sponsor", "asked_in": 1, "share_of_interviews": 0.5,
         "approval_rate_when_asked": 1.0, "delta_vs_base": 0.1}]}
    bank = build_question_bank(_frame(), stats)
    json.dumps(bank, allow_nan=False)
    cities = [c["city"] for entry in bank for c in entry["top_cities"]]
    assert all(isinstance(c, str) for c in cities)


def test_top_examples_dedupes_case_variants():
    variants = {
        "what does your father do": ["What does your father do?"] * 3 + ["what does your father do?"],
        "who is funding you": ["Who is funding you?"],
    }
    out = _top_examples(variants)
    # Most-frequent group first, rendered in its most common spelling.
    assert out[0] == "What does your father do?"
    assert len(out) == 2
