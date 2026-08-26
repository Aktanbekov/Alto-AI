"""Grading-scale handling.

The corpus is overwhelmingly Indian: 3,060 of the 3,158 records that state a GPA
use India's 10-point CGPA, and only 118 name their scale at all. So a bare number
in this dataset means "out of 10". An applicant from a 4.0 country entering 3.5
would otherwise be compared against 10-point grades and read as near-failing.

Percent-of-maximum is used as the common denominator. It is a rough bridge, not
an official conversion — national systems are not linearly comparable, and the
prompt says so rather than implying false precision.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# label -> maximum value on that scale
SCALES: dict[str, float] = {
    "10": 10.0,      # India, and most of this corpus
    "4": 4.0,        # US and much of North America
    "4.3": 4.3,      # some Canadian and US institutions
    "5": 5.0,        # parts of Europe, Central Asia, Nigeria
    "100": 100.0,    # percentage marks
}
CORPUS_SCALE = "10"
DEFAULT_SCALE = "unknown"


@dataclass
class GradePoint:
    raw: str
    scale: str
    percent: float | None  # percent of maximum, or None when not derivable

    def describe(self) -> str:
        """A single line for the prompt: original, scale, and rough equivalent."""
        if self.scale == DEFAULT_SCALE or self.percent is None:
            return f"{self.raw} (scale not stated — do not compare against corpus GPAs)"
        scale_name = "percentage" if self.scale == "100" else f"out of {self.scale}"
        line = f"{self.raw} {scale_name} = {self.percent:.0f}% of maximum"
        if self.scale != CORPUS_SCALE:
            line += (
                f"; corpus GPAs are on India's {CORPUS_SCALE}-point scale, so this is"
                f" roughly {self.percent / 10:.1f}/10 — an approximate bridge, not an"
                " official conversion"
            )
        return line


def parse(raw: str | None, scale: str | None = None) -> GradePoint | None:
    """Interpret a GPA string on a named scale.

    An explicit scale in the text itself ("3.6/4", "82%") wins over the argument,
    because the applicant was unambiguous there.
    """
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None

    explicit = _scale_from_text(text)
    chosen = explicit or (scale if scale in SCALES else None)

    match = re.search(r"(\d+(?:\.\d+)?)", text)
    if match is None:
        return GradePoint(raw=text, scale=chosen or DEFAULT_SCALE, percent=None)
    value = float(match.group(1))

    if chosen is None:
        # Refuse to guess. A bare "3.5" is genuinely ambiguous and guessing it as
        # /10 is exactly the bug this module exists to prevent.
        return GradePoint(raw=text, scale=DEFAULT_SCALE, percent=None)

    maximum = SCALES[chosen]
    if value > maximum:
        # Value contradicts the stated scale (e.g. "85" on a 4.0 scale): treat the
        # number as authoritative only if it reads as a percentage.
        if value <= 100:
            return GradePoint(raw=text, scale="100", percent=value)
        return GradePoint(raw=text, scale=chosen, percent=None)

    return GradePoint(raw=text, scale=chosen, percent=(value / maximum) * 100)


def _scale_from_text(text: str) -> str | None:
    """Pull an explicit scale out of the value itself."""
    if "%" in text:
        return "100"
    out_of = re.search(r"(?:/|out of|on)\s*(\d+(?:\.\d+)?)", text, re.IGNORECASE)
    if out_of:
        denominator = out_of.group(1)
        for label, maximum in SCALES.items():
            if abs(float(denominator) - maximum) < 0.01:
                return label
    return None
