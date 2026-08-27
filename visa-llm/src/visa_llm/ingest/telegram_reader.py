"""Read Telegram Desktop JSON exports into plain-text message rows."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator


@dataclass
class RawMessage:
    channel: str
    message_id: int
    date: str  # ISO 8601, e.g. "2023-06-13T08:30:00"
    text: str


def flatten_text(text: str | list) -> str:
    """Telegram exports `text` as either a string or a list of strings and
    entity dicts ({"type": ..., "text": ...}). Flatten to plain text."""
    if isinstance(text, str):
        return text
    parts = []
    for item in text:
        if isinstance(item, str):
            parts.append(item)
        elif isinstance(item, dict):
            parts.append(item.get("text", ""))
    return "".join(parts)


def read_export(path: Path) -> Iterator[RawMessage]:
    """Yield real (non-service) messages from one export file."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    channel = data.get("name", path.stem)
    for msg in data.get("messages", []):
        if msg.get("type") != "message":
            continue
        text = flatten_text(msg.get("text", ""))
        if not text.strip():
            continue
        yield RawMessage(
            channel=channel,
            message_id=msg["id"],
            date=msg.get("date", ""),
            text=text,
        )


def read_exports(raw_dir: Path) -> Iterator[RawMessage]:
    for path in sorted(raw_dir.glob("*.json")):
        yield from read_export(path)
