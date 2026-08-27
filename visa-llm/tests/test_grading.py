"""Grading-scale tests.

The corpus is ~97% Indian 10-point CGPA, so a bare number silently read as /10
would misjudge every applicant from a 4.0 country. These tests pin that down.
"""

from __future__ import annotations

import pytest

from visa_llm.grading import CORPUS_SCALE, DEFAULT_SCALE, parse
from visa_llm.rag.retrieve import StudentProfile


def test_same_number_differs_by_scale():
    strong = parse("3.5", "4")
    weak = parse("3.5", "10")
    assert strong.percent == pytest.approx(87.5)
    assert weak.percent == pytest.approx(35.0)


def test_bare_number_is_never_guessed():
    # Guessing a scale here is the exact bug this module prevents.
    grade = parse("3.5", None)
    assert grade.scale == DEFAULT_SCALE
    assert grade.percent is None
    assert "do not compare" in grade.describe()


def test_explicit_scale_in_text_wins_over_argument():
    # The applicant was unambiguous in the text; trust it over the dropdown.
    grade = parse("3.6/4", "10")
    assert grade.scale == "4"
    assert grade.percent == pytest.approx(90.0)


def test_percentage_is_recognized():
    grade = parse("82%", None)
    assert grade.scale == "100"
    assert grade.percent == pytest.approx(82.0)


def test_value_exceeding_its_scale_is_read_as_percentage():
    # "85" on a 4.0 scale is a percentage the user mislabelled.
    grade = parse("85", "4")
    assert grade.scale == "100"
    assert grade.percent == pytest.approx(85.0)


def test_absurd_value_yields_no_percent():
    assert parse("850", "4").percent is None


def test_corpus_scale_needs_no_conversion_note():
    assert "approximate bridge" not in parse("8.5", CORPUS_SCALE).describe()
    assert "approximate bridge" in parse("3.4", "4").describe()


def test_empty_and_missing():
    assert parse(None) is None
    assert parse("   ") is None


def test_non_numeric_survives_without_percent():
    grade = parse("First Class", "10")
    assert grade.percent is None
    assert "First Class" in grade.describe()


def test_query_text_converts_to_corpus_scale():
    # Retrieval must compare like with like: 3.5/4 should look like ~8.8/10,
    # not like a 3.5 CGPA.
    us = StudentProfile(gpa="3.5", gpa_scale="4").to_query_text()
    assert "GPA: 8.8" in us


def test_query_text_keeps_raw_when_scale_unknown():
    assert "GPA: 3.5" in StudentProfile(gpa="3.5").to_query_text()
