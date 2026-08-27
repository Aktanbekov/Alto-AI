"""Output schema for a grounded interview evaluation."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high"]


class AnswerFeedback(BaseModel):
    question: str = Field(description="The question this answer responds to.")
    verdict: Literal["strong", "adequate", "weak"]
    strengths: list[str] = Field(description="What already works, concretely.")
    risks: list[str] = Field(
        description="What an officer could read badly, in plain words a student "
        "understands on the first read. Where a real interview or a percentage "
        "backs the concern, say so without naming record ids or raw counts."
    )
    suggested_revision: str = Field(
        description="A rewritten answer the student could truthfully say, "
        "using only facts present in their own profile. Never invent "
        "credentials, funding, or ties they did not state."
    )


class LikelyQuestion(BaseModel):
    question_type: str = Field(description="Canonical type, e.g. funding_sponsor.")
    example_question: str = Field(description="Phrasing drawn from real reviews.")
    asked_in_share: str = Field(
        description="How often this came up for comparable applicants, as a "
        "percentage string. Must come from the supplied statistics."
    )
    why_likely: str
    how_to_prepare: str


class RiskFactor(BaseModel):
    factor: str
    severity: Severity
    evidence: str = Field(
        description="Why this is a real risk, in plain words. Any number must be "
        "a percentage, with what it means said right after it. Never a raw count, "
        "never a record id."
    )


class Evaluation(BaseModel):
    """The complete evaluation returned to the student."""

    readiness: Literal["strong", "moderate", "needs_work"]
    summary: str = Field(
        description="Two or three short sentences a student understands on the "
        "first read. No jargon, no record ids, no raw counts."
    )
    answer_feedback: list[AnswerFeedback]
    likely_questions: list[LikelyQuestion]
    risk_factors: list[RiskFactor]
    comparable_interviews: list[str] = Field(
        description="Internal audit trail, never shown to the student: the "
        "retrieved interviews actually used, each as "
        "'record_id — outcome — one-line relevance'. Record ids belong here and "
        "in no other field."
    )
    caveat: str = Field(
        description="One honest paragraph, in ordinary words, on what this "
        "cannot tell them: the data comes from people who chose to post, a "
        "question being asked does not cause an outcome, and nothing here "
        "predicts a decision. Say it without statistical vocabulary."
    )
