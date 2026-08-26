"""Prompt-assembly and profile-loading tests (no API calls)."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from visa_llm.evaluator.evaluate import build_messages, load_profile
from visa_llm.evaluator.prompts import format_retrieved, format_statistics, format_student
from visa_llm.evaluator.schema import Evaluation
from visa_llm.rag.retrieve import StudentProfile

STATS = {
    "overall": {"n_decided": 100, "approved": 87, "rejected": 13, "approval_rate": 0.87},
    "by_city": {"Chennai": {"n_decided": 40, "approval_rate": 0.8}},
    "by_country": {"India": {"n_decided": 90, "approval_rate": 0.88}},
    "by_degree": {"Masters": {"n_decided": 60, "approval_rate": 0.92}},
    "by_attempt": {},
    "question_types": [
        {
            "question_type": "funding_sponsor",
            "asked_in": 300,
            "share_of_interviews": 0.30,
            "approval_rate_when_asked": 0.87,
            "delta_vs_base": 0.002,
        },
        # Below the n>=100 reporting floor: must not reach the prompt.
        {
            "question_type": "rare_type",
            "asked_in": 12,
            "share_of_interviews": 0.01,
            "approval_rate_when_asked": 1.0,
            "delta_vs_base": 0.13,
        },
    ],
    "question_mix_by_city": {
        "Chennai": {"n": 40, "top_types": [{"question_type": "why_university", "share": 0.5}]}
    },
}


def test_statistics_block_reports_and_filters():
    text = format_statistics(STATS, profile_city="Chennai")
    assert "87.2%" not in text  # only numbers actually in STATS
    assert "funding_sponsor" in text
    assert "rare_type" not in text, "low-n question types must not be quoted at students"
    assert "Most common question types at Chennai" in text


def test_statistics_block_without_city_omits_city_mix():
    assert "Most common question types at" not in format_statistics(STATS)


def test_retrieved_block_includes_transcripts_by_record_id():
    retrieved = pd.DataFrame(
        [{"record_id": "abc123", "outcome": "rejected", "similarity": 0.71,
          "consulate_city": "Chennai", "university": "UTD", "funding": "loan"}]
    )
    full = pd.DataFrame(
        [{"record_id": "abc123",
          "qa_turns": [{"question": "Who funds you?", "answer": "My father."}]}]
    )
    text = format_retrieved(retrieved, full)
    assert "abc123" in text
    assert "outcome: rejected" in text
    assert "Funding: loan" in text
    assert "VO: Who funds you?" in text


def test_retrieved_block_survives_missing_transcript():
    retrieved = pd.DataFrame([{"record_id": "zz", "outcome": "approved", "similarity": 0.5}])
    text = format_retrieved(retrieved, pd.DataFrame({"record_id": [], "qa_turns": []}))
    assert "zz" in text
    assert "Transcript" not in text


def test_student_block_lists_answers():
    profile = StudentProfile(
        consulate_city="Chennai",
        planned_answers=[{"question": "Why UTD?", "answer": "STEM."}],
    )
    text = format_student(profile)
    assert "Consulate city: Chennai" in text
    assert "1. Q: Why UTD?" in text
    assert "A: STEM." in text


def test_student_block_handles_no_answers():
    assert "(none supplied" in format_student(StudentProfile(consulate_city="Mumbai"))


def test_build_messages_puts_cache_breakpoint_on_static_prefix():
    retrieved = pd.DataFrame([{"record_id": "r1", "outcome": "approved", "similarity": 0.6}])
    system_blocks, messages = build_messages(
        StudentProfile(consulate_city="Chennai"), STATS, retrieved, None
    )
    assert len(system_blocks) == 2
    # The statistics block is the last cached block; per-student text must not be cached.
    assert system_blocks[1].get("cache_control") == {"type": "ephemeral"}
    assert "cache_control" not in system_blocks[0]
    assert messages[0]["role"] == "user"
    assert "RETRIEVED COMPARABLE INTERVIEWS" in messages[0]["content"]
    assert "THIS STUDENT" in messages[0]["content"]


def test_load_profile_roundtrip(tmp_path: Path):
    p = tmp_path / "profile.yaml"
    p.write_text(
        "consulate_city: Chennai\n"
        "degree_level: Masters\n"
        "unknown_field: ignored\n"
        "test_scores:\n  GRE: '324'\n"
        "planned_answers:\n"
        "  - question: Why UTD?\n    answer: STEM program.\n"
    )
    profile = load_profile(p)
    assert profile.consulate_city == "Chennai"
    assert profile.test_scores == {"GRE": "324"}
    assert profile.planned_answers == [{"question": "Why UTD?", "answer": "STEM program."}]
    assert not hasattr(profile, "unknown_field")


def test_load_profile_empty_file(tmp_path: Path):
    p = tmp_path / "empty.yaml"
    p.write_text("")
    assert load_profile(p).planned_answers == []


def test_evaluation_schema_rejects_bad_readiness():
    with pytest.raises(Exception):
        Evaluation.model_validate(
            {"readiness": "definitely_approved", "summary": "x", "answer_feedback": [],
             "likely_questions": [], "risk_factors": [], "comparable_interviews": [], "caveat": "c"}
        )


def test_profile_labels_distinguish_the_three_study_fields():
    """The form's three study fields were confusable; the prompt must not be.

    `degree_level` is the level applied for, `course` the field they will study,
    `major` the field already studied. A student applying for a Masters in CS
    after a Mechanical Engineering bachelor's is exactly the field-switch setup
    officers probe, so all three must reach the model distinctly.
    """
    text = format_student(StudentProfile(
        degree_level="Masters", course="Computer Science", major="Mechanical Engineering"))
    assert "Applying for: Masters" in text
    assert "Field they will study: Computer Science" in text
    assert "Field already studied: Mechanical Engineering" in text


def test_degree_level_values_match_the_corpus_filter():
    """The form's dropdown emits these exact strings; retrieval filters on them.

    If either side drifts the filter stops matching and silently returns a
    worse comparable set, with no error anywhere.
    """
    import pandas as pd

    from visa_llm.analytics.stats import _norm_degree

    canonical = {"Bachelors", "Masters", "MBA", "PhD"}
    produced = {
        _norm_degree(pd.Series({"degree_level": level, "course": "", "raw_text": ""}))
        for level in canonical
    }
    assert produced == canonical
