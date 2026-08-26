"""Retrieval and prompt-assembly tests (no API calls)."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from visa_llm.rag.embed import add_record_id, build_summary
from visa_llm.rag.retrieve import StudentProfile


def test_add_record_id_derives_from_content_hash():
    df = pd.DataFrame({"source": [{"content_hash": "abcdef1234567890"}, {"content_hash": "ff" * 16}]})
    out = add_record_id(df)
    assert list(out.record_id) == ["abcdef123456", "ffffffffffff"]


def test_add_record_id_is_idempotent():
    df = pd.DataFrame({"record_id": ["keepme"], "source": [{"content_hash": "zzz"}]})
    assert list(add_record_id(df).record_id) == ["keepme"]


def test_add_record_id_tolerates_missing_source():
    df = pd.DataFrame({"source": [None, {"no_hash": 1}]})
    assert list(add_record_id(df).record_id) == ["", ""]


def test_build_summary_uses_funding_field_not_funding_source():
    row = pd.Series(
        {
            "consulate_city": "Chennai",
            "funding": "education loan",
            "qa_turns": [],
            "test_scores": {},
        }
    )
    summary = build_summary(row)
    assert "Funding: education loan" in summary
    assert "Consulate: Chennai" in summary


def test_build_summary_includes_turns_and_skips_blanks():
    row = pd.Series(
        {
            "university": "UTD",
            "gpa": None,
            "test_scores": {"GRE": "324"},
            "qa_turns": [{"question": "Who is funding?", "answer": "My father."}],
        }
    )
    summary = build_summary(row)
    assert "University: UTD" in summary
    assert "Tests: GRE 324" in summary
    assert "VO: Who is funding?" in summary
    assert "Me: My father." in summary
    assert "GPA" not in summary


def test_student_profile_query_text_mirrors_summary_labels():
    profile = StudentProfile(
        consulate_city="Chennai",
        university="UTD",
        test_scores={"GRE": "324"},
        planned_answers=[{"question": "Why UTD?", "answer": "STEM program."}],
    )
    text = profile.to_query_text()
    # Same label vocabulary as build_summary, so query and corpus share a space.
    assert "Consulate: Chennai" in text
    assert "University: UTD" in text
    assert "Tests: GRE 324" in text
    assert "VO: Why UTD?" in text


def test_student_profile_empty_is_safe():
    assert StudentProfile().to_query_text() == ""
