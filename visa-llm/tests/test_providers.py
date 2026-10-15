"""The multi-model layer: routing, pricing, and keeping `model` out of the profile.

No API key and no network — these cover the parts that decide *which* vendor a
run goes to and *what* it is reported to have cost, which are the two things
that would be quietly wrong rather than loudly broken.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from visa_llm.evaluator import providers
from visa_llm.evaluator.providers import (
    DEFAULT_PROVIDER,
    PROVIDERS,
    ProviderError,
    cost_of,
    resolve,
)
from visa_llm.evaluator.schema import Evaluation


def test_the_three_comparison_models_are_registered():
    assert set(PROVIDERS) == {"opus", "terra", "deepseek"}


def test_the_default_is_the_production_model():
    # A caller that names nothing must land on the model students actually get,
    # never on whichever provider happens to be first in the registry.
    assert resolve(None).key == DEFAULT_PROVIDER
    assert resolve(None).model == "claude-opus-5"


@pytest.mark.parametrize(
    "spelling", ["opus", "OPUS", " opus ", "claude-opus-5"]
)
def test_a_provider_resolves_from_either_spelling(spelling):
    # The API sends the short key; `visa-llm evaluate --model claude-opus-5`
    # has passed a wire id since before providers existed. Both must work.
    assert resolve(spelling).key == "opus"


def test_an_unknown_model_is_refused_rather_than_defaulted():
    # Silently falling back would bill a vendor the caller did not ask for and
    # label the result with a model that never ran.
    with pytest.raises(ProviderError):
        resolve("gpt-9-ultra")


def test_a_priced_model_reports_a_real_cost():
    cost = cost_of(
        {"model": "claude-opus-5", "input_tokens": 1_000_000, "output_tokens": 0}
    )
    assert cost == pytest.approx(5.0)


def test_terra_uses_its_published_api_price():
    cost = cost_of(
        {"model": "gpt-5.6-terra", "input_tokens": 1_000_000, "output_tokens": 1_000_000}
    )
    assert cost == pytest.approx(14.0)


def test_cached_input_bills_at_a_tenth():
    cost = cost_of(
        {
            "model": "claude-opus-5",
            "input_tokens": 0,
            "cache_read_input_tokens": 1_000_000,
            "output_tokens": 0,
        }
    )
    assert cost == pytest.approx(0.5)


def test_an_unpriced_model_reports_unknown_not_free():
    # The whole point: $0.0000 beside two real figures reads as "free", which is
    # the one reading that would change which model someone picks.
    assert cost_of({"model": "deepseek-v4-pro", "input_tokens": 5000}) is None


def test_model_is_a_routing_field_not_part_of_the_profile():
    from visa_llm.web.serve import ProfileRequest

    req = ProfileRequest(
        model="terra",
        planned_answers=[{"question": "Who funds you?", "answer": "My father."}],
    )
    profile = req.to_profile()
    # StudentProfile has no `model`; leaving it in the dump raises TypeError.
    assert not hasattr(profile, "model")
    assert len(profile.planned_answers) == 1


def test_one_hour_cache_writes_bill_at_double_and_five_minute_at_a_quarter_more():
    cost = cost_of(
        {
            "model": "claude-opus-5",
            "input_tokens": 0,
            "cache_creation_input_tokens": 2_000_000,
            "cache_creation_1h_input_tokens": 1_000_000,
            "output_tokens": 0,
        }
    )
    # 1M at 1.25x of $5 plus 1M at 2x of $5.
    assert cost == pytest.approx(6.25 + 10.0)


# ------------------------------------------------- what reaches the vendor

SYSTEM_BLOCKS = [
    {"type": "text", "text": "rules"},
    {"type": "text", "text": "stats", "cache_control": {"type": "ephemeral", "ttl": "1h"}},
]
MESSAGES = [{"role": "user", "content": "this student"}]


def _evaluation() -> Evaluation:
    return Evaluation(
        readiness="moderate",
        summary="s",
        answer_feedback=[],
        likely_questions=[],
        risk_factors=[],
        comparable_interviews=[],
        caveat="c",
    )


def _fake_client(usage):
    """An OpenAI-shaped client that records the request instead of sending it."""
    sent: dict = {}

    def parse(**kwargs):
        sent.update(kwargs)
        return SimpleNamespace(
            model=kwargs["model"],
            usage=usage,
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(parsed=_evaluation()), finish_reason="stop"
                )
            ],
        )

    client = SimpleNamespace(
        beta=SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(parse=parse)))
    )
    return client, sent


def test_terra_marks_the_end_of_the_system_message_and_disables_implicit_caching(
    monkeypatch,
):
    usage = SimpleNamespace(
        prompt_tokens=3000,
        completion_tokens=400,
        prompt_tokens_details=SimpleNamespace(cached_tokens=0, cache_write_tokens=2000),
    )
    client, sent = _fake_client(usage)
    monkeypatch.setattr(providers, "_openai_client", lambda p, base_url: client)

    _, meta = providers._run_openai(PROVIDERS["terra"], SYSTEM_BLOCKS, MESSAGES, 100)

    # Implicit mode would put the breakpoint at the end of the per-student user
    # turn and pay the write rate on all of it, every call.
    assert sent["prompt_cache_options"] == {"mode": "explicit"}
    system = sent["messages"][0]
    assert system["role"] == "system"
    assert system["content"] == [
        {
            "type": "text",
            "text": "rules\n\nstats",
            "prompt_cache_breakpoint": {"mode": "explicit"},
        }
    ]
    # The user turn carries no marker: it is never cached.
    assert sent["messages"][1] == MESSAGES[0]
    assert meta["cache_creation_input_tokens"] == 2000
    assert meta["input_tokens"] == 1000


def test_deepseek_gets_the_same_text_without_openai_cache_controls(monkeypatch):
    usage = SimpleNamespace(
        prompt_tokens=3000,
        completion_tokens=400,
        prompt_tokens_details=None,
        prompt_cache_hit_tokens=2048,
        prompt_cache_miss_tokens=952,
    )
    client, sent = _fake_client(usage)
    monkeypatch.setattr(providers, "_openai_client", lambda p, base_url: client)

    _, meta = providers._run_deepseek(PROVIDERS["deepseek"], SYSTEM_BLOCKS, MESSAGES, 100)

    assert "prompt_cache_options" not in sent
    assert sent["messages"][0] == {"role": "system", "content": "rules\n\nstats"}
    # DeepSeek's own hit counter is what proves its automatic cache worked.
    assert meta["cache_read_input_tokens"] == 2048
    assert meta["input_tokens"] == 952
