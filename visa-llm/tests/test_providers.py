"""The multi-model layer: routing, pricing, and keeping `model` out of the profile.

No API key and no network — these cover the parts that decide *which* vendor a
run goes to and *what* it is reported to have cost, which are the two things
that would be quietly wrong rather than loudly broken.
"""

from __future__ import annotations

import pytest

from visa_llm.evaluator.providers import (
    DEFAULT_PROVIDER,
    PROVIDERS,
    ProviderError,
    cost_of,
    resolve,
)


def test_the_three_comparison_models_are_registered():
    assert set(PROVIDERS) == {"opus", "deepseek", "o3-mini"}


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
        model="o3-mini",
        planned_answers=[{"question": "Who funds you?", "answer": "My father."}],
    )
    profile = req.to_profile()
    # StudentProfile has no `model`; leaving it in the dump raises TypeError.
    assert not hasattr(profile, "model")
    assert len(profile.planned_answers) == 1
