"""Running the same grounded evaluation against more than one model.

The point of this module is comparison, so the one thing it must guarantee is
that every model gets *identical* input: the same retrieved interviews, the same
corpus statistics, the same task instruction. Only the model changes. Anything
that varied the prompt per provider would make the outputs incomparable and the
whole exercise pointless.

`build_messages()` in evaluate.py produces Anthropic's shape - a list of system
blocks plus a user turn. The OpenAI-compatible providers here flatten those
system blocks into one system message and send the same user text unchanged.

DeepSeek is reached through the OpenAI SDK: its API is OpenAI-compatible, so the
only differences are the base URL and the key.

Prompt caching, per vendor. All three cache the same prefix - the system
message, which is identical for every student - and nothing after it:
- Anthropic: an explicit breakpoint on the last system block (evaluate.py).
- OpenAI GPT-5.6+: an explicit breakpoint at the end of the system message,
  with implicit mode switched off. The implicit default puts its breakpoint at
  the end of the user turn, which writes the whole per-student prompt at the
  write rate on every call and never reads it back.
- DeepSeek: automatic prefix caching on their side; nothing to mark.
"""

from __future__ import annotations

import json
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
    # OpenAI list pricing for GPT-5.6 Terra.
    "gpt-5.6-terra": (2.0, 12.0),
    # DeepSeek does not publish v4-pro pricing in the SDK, and guessing a rate
    # would put an invented number next to two real ones in the comparison
    # table. Left out deliberately: unknown prices report as null, not as zero.
}


class ProviderError(RuntimeError):
    """A provider failed in a way worth showing an operator verbatim."""


@dataclass(frozen=True)
class Provider:
    key: str        # stable id used on the wire: "opus", "terra", "deepseek"
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

    Cache reads bill at 0.1x input and 5-minute (or OpenAI 30-minute) writes at
    1.25x, for every priced model. Anthropic's 1-hour writes bill at 2x and are
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


# ------------------------------------------------------- OpenAI-compatible

def _flatten_system(system_blocks: list[dict]) -> str:
    """Anthropic's system blocks as one system message, content unchanged."""
    return "\n\n".join(b.get("text", "") for b in system_blocks if b.get("text"))


def _system_message(system_blocks: list[dict], explicit_cache: bool) -> dict:
    """The flattened system message, optionally marked as the end of the cache.

    The text is the same either way; only the breakpoint marker differs. It is
    a content part rather than a plain string because that is the only place
    the marker can go.
    """
    text = _flatten_system(system_blocks)
    if not explicit_cache:
        return {"role": "system", "content": text}
    return {
        "role": "system",
        "content": [
            {"type": "text", "text": text, "prompt_cache_breakpoint": {"mode": "explicit"}}
        ],
    }


def _openai_client(p: Provider, base_url: str | None):
    from openai import OpenAI

    from ..config import load_env

    load_env()
    key = os.environ.get(p.env_key)
    if not key:
        raise ProviderError(f"{p.env_key} is not set.")
    return OpenAI(api_key=key, base_url=base_url) if base_url else OpenAI(api_key=key)


def _run_openai_compatible(
    p: Provider,
    system_blocks: list[dict],
    messages: list[dict],
    max_tokens: int,
    base_url: str | None = None,
    explicit_cache: bool = False,
) -> tuple[Evaluation, dict]:
    """One evaluation through an OpenAI-shaped API (OpenAI itself, or DeepSeek).

    Two attempts, because strict schema support is not uniform. Terra honours
    a json_schema response_format; whether deepseek-v4-pro does is unverified -
    the account had no balance to test against - so a rejection falls back to
    plain JSON mode with the schema pasted into the prompt, and pydantic
    validates the result either way. The fallback is what makes this work on a
    model whose capabilities we cannot confirm ahead of time.

    `explicit_cache` is for OpenAI GPT-5.6 and later only: other models, and
    DeepSeek, do not accept `prompt_cache_options`.
    """
    client = _openai_client(p, base_url)
    chat = [_system_message(system_blocks, explicit_cache), *messages]
    cache = {"prompt_cache_options": {"mode": "explicit"}} if explicit_cache else {}
    # Reasoning models reject `max_tokens` and take `max_completion_tokens`;
    # they also reject `temperature`. Sending the reasoning-model spelling to a
    # chat model is the error that *is* recoverable, so try it first and retry
    # on the other spelling.
    for cap in ("max_completion_tokens", "max_tokens"):
        try:
            completion = client.beta.chat.completions.parse(
                model=p.model,
                messages=chat,
                response_format=Evaluation,
                **{cap: max_tokens},
                **cache,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is None:
                raise ProviderError(
                    "No structured output returned "
                    f"(finish_reason={completion.choices[0].finish_reason})."
                )
            return parsed, _openai_meta(completion, p.model)
        except ProviderError:
            raise
        except Exception as exc:  # noqa: BLE001 - classified below
            message = str(exc)
            if cap == "max_completion_tokens" and _is_param_error(message):
                continue
            if _is_schema_unsupported(message):
                return _run_json_mode(client, p, chat, max_tokens, cache)
            raise ProviderError(message) from exc
    raise ProviderError("could not settle on a token-limit parameter")


def _is_param_error(message: str) -> bool:
    m = message.lower()
    return "max_completion_tokens" in m or "max_tokens" in m or "unsupported_parameter" in m


def _is_schema_unsupported(message: str) -> bool:
    m = message.lower()
    return "response_format" in m or "json_schema" in m or "not supported" in m


def _run_json_mode(client, p: Provider, chat: list[dict], max_tokens: int, cache: dict):
    """Fallback: ask for JSON, hand over the schema, validate it ourselves.

    The schema goes on the end of the user turn, after the cached prefix, so
    the fallback still reads the same cache entry.
    """
    schema = json.dumps(Evaluation.model_json_schema(), indent=None)
    steered = list(chat)
    steered[-1] = {
        "role": "user",
        "content": (
            f"{chat[-1]['content']}\n\n"
            "Reply with a single JSON object and nothing else - no prose, no "
            "code fence. It must validate against this JSON Schema:\n"
            f"{schema}"
        ),
    }
    completion = client.chat.completions.create(
        model=p.model,
        messages=steered,
        response_format={"type": "json_object"},
        max_tokens=max_tokens,
        **cache,
    )
    raw = completion.choices[0].message.content or ""
    try:
        evaluation = Evaluation.model_validate_json(_strip_fence(raw))
    except Exception as exc:  # noqa: BLE001
        raise ProviderError(f"returned JSON that does not match the schema: {exc}") from exc
    return evaluation, _openai_meta(completion, p.model)


def _strip_fence(raw: str) -> str:
    """Some models wrap JSON in a fence despite being told not to."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0]
    return text.strip()


def _openai_meta(completion, fallback_model: str) -> dict:
    usage = getattr(completion, "usage", None)
    details = getattr(usage, "prompt_tokens_details", None)
    cached = getattr(details, "cached_tokens", 0) or 0
    written = getattr(details, "cache_write_tokens", 0) or 0
    # DeepSeek reports its automatic cache in its own top-level field.
    cached = cached or getattr(usage, "prompt_cache_hit_tokens", 0) or 0
    total_in = getattr(usage, "prompt_tokens", 0) or 0
    return {
        "model": getattr(completion, "model", None) or fallback_model,
        # prompt_tokens already includes cache reads and writes, so subtract
        # them to match Anthropic's split, where input_tokens is neither.
        "input_tokens": max(total_in - cached - written, 0),
        "output_tokens": getattr(usage, "completion_tokens", 0) or 0,
        "cache_read_input_tokens": cached,
        "cache_creation_input_tokens": written,
    }


def _run_openai(p, system_blocks, messages, max_tokens):
    return _run_openai_compatible(
        p, system_blocks, messages, max_tokens, explicit_cache=True
    )


def _run_deepseek(p, system_blocks, messages, max_tokens):
    return _run_openai_compatible(
        p, system_blocks, messages, max_tokens, base_url=DEEPSEEK_BASE_URL
    )


DEEPSEEK_BASE_URL = "https://api.deepseek.com"

# The three independent providers used for every profile check.
PROVIDERS: dict[str, Provider] = {
    p.key: p
    for p in (
        Provider("opus", "Claude Opus 5", "claude-opus-5", "ANTHROPIC_API_KEY", _run_anthropic),
        Provider("terra", "GPT-5.6 Terra", "gpt-5.6-terra", "OPENAI_API_KEY", _run_openai),
        Provider("deepseek", "DeepSeek V4 Pro", "deepseek-v4-pro", "DEEPSEEK_API_KEY", _run_deepseek),
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
