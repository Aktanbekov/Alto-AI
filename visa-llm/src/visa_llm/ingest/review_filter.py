"""Decide which raw messages are interview reviews, and clean boilerplate/PII."""

from __future__ import annotations

import re

MIN_LENGTH = 200

# Officer-dialogue markers at line start: VO:, Vo:, VI:, Vo-, "VO :" etc.
_DIALOGUE_RE = re.compile(r"^\s*(?:VO|VI|CO|OFFICER)\s*[:\-]", re.MULTILINE | re.IGNORECASE)

# Template/section headers seen across the three channels.
_HEADER_RE = re.compile(
    r"^\s*(?:Visa Profile|Interview Outcome|Consulate|Status|University|"
    r"Interview Details|Exam Profile|Education Profile)\s*:?",
    re.MULTILINE | re.IGNORECASE,
)

# Promo/boilerplate blocks appended by aggregator channels.
_BOILERPLATE_RES = [
    re.compile(
        r"For FREE real-time US Visa Appointments.*?(?=\n\n|\Z)", re.DOTALL | re.IGNORECASE
    ),
    re.compile(
        r"When it is your turn, PLEASE SHARE.*?(?=\n\n|\Z)", re.DOTALL | re.IGNORECASE
    ),
    re.compile(r"^\s*https?://\S*checkvisaslots\.com\S*\s*$", re.MULTILINE),
    re.compile(r"^\s*https?://t\.me/\S+\s*$", re.MULTILINE),
    re.compile(r"^\s*@\w+(?:\s*\|\s*@\w+)*\s*$", re.MULTILINE),  # bare handle footer lines
]

_PHONE_RE = re.compile(r"(?<!\d)\+?\d[\d\s\-()]{8,}\d(?!\d)")
_INLINE_HANDLE_RE = re.compile(r"@\w{4,}")


def is_review(text: str) -> bool:
    """A message counts as an interview review if it is long enough and has
    either officer dialogue or the structured template headers."""
    if len(text) < MIN_LENGTH:
        return False
    if _DIALOGUE_RE.search(text):
        return True
    # Template-only posts (profile shared without transcript) still carry
    # outcome signal — require at least two distinct header hits.
    return len(set(m.group(0).strip().lower() for m in _HEADER_RE.finditer(text))) >= 2


def clean(text: str) -> str:
    """Strip promo boilerplate, channel handles, and PII-ish tokens."""
    for pattern in _BOILERPLATE_RES:
        text = pattern.sub("", text)
    text = _PHONE_RE.sub("[phone]", text)
    text = _INLINE_HANDLE_RE.sub("[handle]", text)
    # Collapse the blank-line runs left behind by removals.
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
