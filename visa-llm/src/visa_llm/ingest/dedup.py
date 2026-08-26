"""Near-exact deduplication of reviews cross-posted between channels."""

from __future__ import annotations

import hashlib
import re

_STRIP_RE = re.compile(r"https?://\S+|@\w+|\[handle\]|\[phone\]")
_WS_RE = re.compile(r"\W+")


def content_key(text: str) -> str:
    """Hash of the text with links/handles/whitespace/punctuation removed,
    so reposts that differ only in footers or formatting collide."""
    normalized = _WS_RE.sub("", _STRIP_RE.sub("", text.lower()))
    return hashlib.sha256(normalized.encode()).hexdigest()


class Deduplicator:
    def __init__(self) -> None:
        self._seen: set[str] = set()

    def is_new(self, text: str) -> bool:
        key = content_key(text)
        if key in self._seen:
            return False
        self._seen.add(key)
        return True
