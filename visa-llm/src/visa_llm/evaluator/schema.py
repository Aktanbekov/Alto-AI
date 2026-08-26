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
        description="What an officer could read badly. Cite the retrieved "
        "interviews or the statistics when they support the concern."
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
        description="The statistic or retrieved interview supporting this. "
        "State the number and where it came from."
    )


class Evaluation(BaseModel):
    """The complete evaluation returned to the student."""

    readiness: Literal["strong", "moderate", "needs_work"]
    summary: str = Field(description="Two or three sentences, plain and direct.")
    answer_feedback: list[AnswerFeedback]
    likely_questions: list[LikelyQuestion]
    risk_factors: list[RiskFactor]
    comparable_interviews: list[str] = Field(
        description="Short references to the retrieved interviews actually used, "
        "each as 'record_id — outcome — one-line relevance'."
    )
    caveat: str = Field(
        description="One honest paragraph on what this analysis cannot tell "
        "them: self-selected data, correlation not causation, no guarantee."
    )
