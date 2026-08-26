"""Environment loading.

Secrets come from a .env file at the project root so they survive new terminals,
rather than living in a single shell session that disappears when the tab closes.

A variable already exported in the shell always wins over .env: an explicit
export is a deliberate override (a different key for one run, CI injection), and
silently replacing it with a file value would be surprising.
"""

from __future__ import annotations

import os
from pathlib import Path

# src/visa_llm/config.py -> project root
PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = PROJECT_ROOT / ".env"

_loaded = False


def load_env(path: Path | None = None) -> bool:
    """Load .env into the environment once. Returns True if a file was read."""
    global _loaded
    if _loaded and path is None:
        return ENV_PATH.exists()

    target = path or ENV_PATH
    if not target.exists():
        _loaded = True
        return False

    try:
        from dotenv import load_dotenv
    except ImportError:  # keep the CLI usable without the optional dependency
        _load_simple(target)
    else:
        load_dotenv(target, override=False)

    _loaded = True
    return True


def _load_simple(path: Path) -> None:
    """Minimal KEY=VALUE fallback when python-dotenv is not installed."""
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.removeprefix("export ").strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def api_key_status() -> tuple[bool, str]:
    """Whether an Anthropic key is available, and where it came from."""
    load_env()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return False, (
            f"ANTHROPIC_API_KEY is not set. Add it to {ENV_PATH.name} at the project "
            "root, or export it in your shell."
        )
    source = ".env file" if ENV_PATH.exists() else "shell environment"
    return True, f"Loaded from {source}."
