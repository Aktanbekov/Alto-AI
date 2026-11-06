"""The model layer for grounded evaluations.

Student answers are scored by Anthropic only. The registry below holds a single
provider, and resolve() refuses any key it does not contain, so no request can
route a student's answers to another vendor.

`build_messages()` in evaluate.py produces Anthropic's shape - a list of system
blocks plus a user turn. Prompt caching is an explicit breakpoint on the last
system block (evaluate.py), which is identical for every student.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Callable

from .schema import Evaluation

# Per-million-token (input, output) rates, used to price a run.
PRICES: dict[str, tuple[float, float]] = {
    "claude-opus-5": (5.0, 25.0),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-sonnet-5": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}


class ProviderError(RuntimeError):
    """A provider failed in a way worth showing an operator verbatim."""


@dataclass(frozen=True)
class Provider:
    key: str        # stable id used on the wire: "opus"
    label: str      # what the admin UI shows
    model: str      # the model id sent to the vendor
    env_key: str    # environment variable holding the credential
    run: Callable[["Provider", list[dict], list[dict], int], tuple[Evaluation, dict]]

    def configured(self) -> bool:
        # Load .env here rather than trusting the caller: the health endpoint,
        # the CLI and the test suite all reach this by different routes, and a
        # provider reported as unconfigured because nobody called load_env()
        # looks exactly like a missing key.
        from ..config import load_env

        load_env()
        return bool(os.environ.get(self.env_key))


def price_of(model: str) -> tuple[float, float] | None:
    for prefix, rate in PRICES.items():
        if model.startswith(prefix):
            return rate
    return None


def cost_of(meta: dict[str, Any]) -> float | None:
    """Dollar cost of one run, or None when the model's rate is unknown.

    Cache reads bill at 0.1x input and 5-minute writes at 1.25x, for every
    priced model. Anthropic's 1-hour writes bill at 2x and are
    reported separately as `cache_creation_1h_input_tokens`, a subset of
    `cache_creation_input_tokens`.
    """
    rate = price_of(str(meta.get("model", "")))
    if rate is None:
        return None
    rate_in, rate_out = rate
    fresh = meta.get("input_tokens", 0) or 0
    cached = meta.get("cache_read_input_tokens", 0) or 0
    written = meta.get("cache_creation_input_tokens", 0) or 0
    written_1h = min(meta.get("cache_creation_1h_input_tokens", 0) or 0, written)
    out = meta.get("output_tokens", 0) or 0
    return (
        fresh * rate_in
        + cached * rate_in * 0.1
        + (written - written_1h) * rate_in * 1.25
        + written_1h * rate_in * 2.0
        + out * rate_out
    ) / 1_000_000


# ---------------------------------------------------------------- Anthropic

def _run_anthropic(
    p: Provider, system_blocks: list[dict], messages: list[dict], max_tokens: int
) -> tuple[Evaluation, dict]:
    """The original path, unchanged in behaviour - see evaluate.evaluate()."""
    import anthropic

    client = anthropic.Anthropic()
    message = client.beta.messages.parse(
        model=p.model,
        max_tokens=max_tokens,
        system=system_blocks,
        messages=messages,
        output_format=Evaluation,
        output_config={"effort": "medium"},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
    if message.stop_reason == "refusal":
        raise ProviderError(
            "The model declined this request "
            f"({getattr(message.stop_details, 'category', 'unspecified')})."
        )
    evaluation = message.parsed_output
    if evaluation is None:
        raise ProviderError(
            f"No structured output returned (stop_reason={message.stop_reason})."
        )
    usage = message.usage
    breakdown = getattr(usage, "cache_creation", None)
    return evaluation, {
        "model": message.model,
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", 0) or 0,
        "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", 0) or 0,
        # 1h writes cost more than 5m ones; cost_of() needs the split.
        "cache_creation_1h_input_tokens": getattr(breakdown, "ephemeral_1h_input_tokens", 0) or 0,
    }


# The providers a profile check may use. Anthropic only: student answers are
# not sent to any other vendor, and an unknown key is refused by resolve().
PROVIDERS: dict[str, Provider] = {
    p.key: p
    for p in (
        Provider("opus", "Claude Opus 5", "claude-opus-5", "ANTHROPIC_API_KEY", _run_anthropic),
    )
}

# What /api/evaluate uses when the caller names no model: the production path.
DEFAULT_PROVIDER = "opus"


def resolve(key: str | None) -> Provider:
    """A provider from either its short key ("opus") or its wire model id.

    Both spellings are accepted because two callers use different ones: the API
    sends the short key, and `visa-llm evaluate --model claude-opus-5` has
    passed a wire id since before this module existed.
    """
    wanted = (key or DEFAULT_PROVIDER).strip().lower()
    if wanted in PROVIDERS:
        return PROVIDERS[wanted]
    for provider in PROVIDERS.values():
        if provider.model.lower() == wanted:
            return provider
    raise ProviderError(f"unknown model {key!r}")
