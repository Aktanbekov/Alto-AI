"""Unified record schema for one interview review."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class Outcome(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    ADMIN_PROCESSING = "administrative_processing_221g"
    UNKNOWN = "unknown"


class QATurn(BaseModel):
    question: str
    answer: str = ""


class TestScore(BaseModel):
    test: str  # GRE, TOEFL, IELTS, Duolingo, GMAT, SAT, ACT...
    score: str


class Source(BaseModel):
    channel: str
    message_id: int
    date: str
    content_hash: str


class InterviewRecord(BaseModel):
    outcome: Outcome = Outcome.UNKNOWN
    attempt_number: int | None = None
    consulate_city: str | None = None
    consulate_country: str | None = None
    interview_date: str | None = None
    university: str | None = None
    course: str | None = None
    degree_level: str | None = None  # Undergrad / Masters / PhD ...
    major: str | None = None
    gpa: str | None = None
    test_scores: list[TestScore] = Field(default_factory=list)
    work_experience: str | None = None
    funding: str | None = None  # sponsorship / loan / self / assistantship
    scholarship: str | None = None
    intake: str | None = None  # e.g. "Fall 2022"
    qa_turns: list[QATurn] = Field(default_factory=list)
    tips: str | None = None
    raw_text: str = ""
    parse_method: str = "template"  # template | llm
    source: Source


class ExtractedFields(BaseModel):
    """LLM extraction target: InterviewRecord minus source/raw bookkeeping."""

    outcome: Outcome = Outcome.UNKNOWN
    attempt_number: int | None = None
    consulate_city: str | None = None
    consulate_country: str | None = None
    interview_date: str | None = None
    university: str | None = None
    course: str | None = None
    degree_level: str | None = None
    major: str | None = None
    gpa: str | None = None
    test_scores: list[TestScore] = Field(default_factory=list)
    work_experience: str | None = None
    funding: str | None = None
    scholarship: str | None = None
    intake: str | None = None
    qa_turns: list[QATurn] = Field(default_factory=list)
    tips: str | None = None
