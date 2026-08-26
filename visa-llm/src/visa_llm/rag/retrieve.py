"""Retrieve comparable past interviews for a student profile.

Retrieval is deliberately two-stage: hard filters first (a Chennai applicant
should be compared against Chennai interviews), then cosine similarity within
the surviving pool. The final selection is *outcome-balanced* — an evaluator
shown only approvals would learn nothing about what sinks an interview.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .embed import MODEL_NAME

# Minimum pool size before a hard filter is considered too aggressive and is
# relaxed. Filtering to three Tashkent MBA records would make similarity noise.
_MIN_POOL = 40


@dataclass
class StudentProfile:
    """The subset of a student's profile that drives retrieval."""

    consulate_city: str | None = None
    consulate_country: str | None = None
    university: str | None = None
    course: str | None = None
    degree_level: str | None = None
    major: str | None = None
    gpa: str | None = None
    gpa_scale: str | None = None  # "4", "10", "100"…; see visa_llm.grading
    work_experience: str | None = None
    funding_source: str | None = None
    scholarship: str | None = None
    attempt_number: int | None = None
    test_scores: dict[str, str] = field(default_factory=dict)
    planned_answers: list[dict[str, str]] = field(default_factory=list)

    def _gpa_for_query(self) -> str | None:
        """Express GPA on the corpus's own 10-point scale so the embedding
        compares like with like; fall back to the raw text when unresolvable."""
        from ..grading import parse

        grade = parse(self.gpa, self.gpa_scale)
        if grade is None:
            return None
        if grade.percent is None:
            return grade.raw
        return f"{grade.percent / 10:.1f}"

    def to_query_text(self) -> str:
        """Mirror `embed.build_summary` so the query lands in the same space."""
        parts: list[str] = []
        for value, label in [
            (self.consulate_city, "Consulate"),
            (self.consulate_country, "Country"),
            (self.university, "University"),
            (self.course, "Course"),
            (self.degree_level, "Level"),
            (self.major, "Major"),
            (self._gpa_for_query(), "GPA"),
            (self.work_experience, "Work"),
            (self.funding_source, "Funding"),
            (self.scholarship, "Scholarship"),
            (self.attempt_number, "Attempt"),
        ]:
            if value is not None and str(value).strip():
                parts.append(f"{label}: {value}")
        if self.test_scores:
            joined = ", ".join(f"{k} {v}" for k, v in self.test_scores.items() if v)
            if joined:
                parts.append(f"Tests: {joined}")
        for qa in self.planned_answers[:6]:
            question = (qa.get("question") or "").strip()
            answer = (qa.get("answer") or "").strip()
            if question:
                parts.append(f"VO: {question[:200]}")
            if answer:
                parts.append(f"Me: {answer[:200]}")
        return "\n".join(parts)


class InterviewIndex:
    """Loaded vectors + metadata, with filtered similarity search."""

    def __init__(self, index_dir: Path):
        self.index_dir = Path(index_dir)
        self.vectors: np.ndarray = np.load(self.index_dir / "vectors.npy")
        self.meta: pd.DataFrame = pd.read_parquet(self.index_dir / "index_meta.parquet")
        self.manifest: dict[str, Any] = json.loads(
            (self.index_dir / "index_manifest.json").read_text()
        )
        self._model = None

    @property
    def model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.manifest.get("model", MODEL_NAME))
        return self._model

    def _candidate_mask(self, profile: StudentProfile) -> np.ndarray:
        """Hard filters, relaxed from most to least specific if the pool is thin."""
        meta = self.meta
        mask = np.ones(len(meta), dtype=bool)

        def narrowed(current: np.ndarray, column: str, value: str | None) -> np.ndarray:
            if not value or column not in meta.columns:
                return current
            candidate = current & (
                meta[column].astype("string").str.contains(
                    str(value).strip(), case=False, na=False, regex=False
                )
            )
            # Keep the narrower filter only if enough records survive it.
            return candidate if candidate.sum() >= _MIN_POOL else current

        mask = narrowed(mask, "consulate_city", profile.consulate_city)
        mask = narrowed(mask, "consulate_country", profile.consulate_country)
        mask = narrowed(mask, "degree_level", profile.degree_level)
        return mask

    def search(
        self,
        profile: StudentProfile,
        k: int = 10,
        min_rejected: int = 3,
    ) -> pd.DataFrame:
        """Top-k similar interviews, with at least `min_rejected` rejections.

        Rejections are rarer (~13% of the corpus) but carry the most corrective
        signal, so they get reserved slots rather than being crowded out.
        """
        query = self.model.encode(
            [profile.to_query_text()], convert_to_numpy=True, normalize_embeddings=True
        ).astype(np.float32)[0]

        mask = self._candidate_mask(profile)
        idx = np.flatnonzero(mask)
        if idx.size == 0:
            idx = np.arange(len(self.meta))

        scores = self.vectors[idx] @ query
        order = idx[np.argsort(-scores)]
        score_by_row = dict(zip(idx.tolist(), scores.tolist()))

        outcomes = self.meta["outcome"].to_numpy()
        rejected_wanted = min(min_rejected, max(0, k // 2))

        picked: list[int] = []
        rejected_picked = 0
        for row in order:
            if len(picked) >= k - max(0, rejected_wanted - rejected_picked):
                break
            picked.append(int(row))
            if outcomes[row] == "rejected":
                rejected_picked += 1

        if rejected_picked < rejected_wanted:
            for row in order:
                if len(picked) >= k:
                    break
                if int(row) not in picked and outcomes[row] == "rejected":
                    picked.append(int(row))
                    rejected_picked += 1

        for row in order:  # top up if rejections were scarce
            if len(picked) >= k:
                break
            if int(row) not in picked:
                picked.append(int(row))

        result = self.meta.iloc[picked].copy()
        result["similarity"] = [round(score_by_row.get(r, 0.0), 4) for r in picked]
        result["pool_size"] = int(mask.sum())
        return result.reset_index(drop=True)
