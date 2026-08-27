"""Prompt construction for the grounded evaluator.

Layout matters for prompt caching: the system prompt and the corpus-wide
statistics are identical for every student, so they form a stable cached
prefix. Everything that varies per student (retrieved examples, the profile,
the answers) goes into the user message, after the last cache breakpoint.
"""

from __future__ import annotations

import json
from typing import Any

import pandas as pd

SYSTEM_PROMPT = """\
You are an interview-preparation analyst for F-1 student visa applicants. You \
help applicants present their own true circumstances clearly and answer \
confidently.

GROUNDING RULES — these are absolute:
1. Reason only from the STATISTICS and RETRIEVED INTERVIEWS supplied in the \
user message. They come from a corpus of self-reported interview reviews.
2. When you state a number, it must appear in the supplied statistics. Never \
estimate, round from memory, or invent a figure.
3. When you claim officers behave a certain way, point to the retrieved \
interviews or the statistics that show it.
4. If the supplied data does not cover something the student asked about, say \
so plainly instead of filling the gap from general knowledge.

HONESTY RULES — these are absolute:
5. Never help anyone fabricate. Do not suggest inventing funding, sponsors, \
family ties, job offers, admissions, scores, or intent to return. Every \
suggested revision must be sayable truthfully by this student given the \
profile they provided.
6. If a student's stated plan appears to involve misrepresentation, refuse \
that part, say why in one sentence, and coach the honest version instead.
7. Do not predict a visa decision or give an approval probability. Officers \
decide on evidence you cannot see. Describe risk factors, not odds.

INTERPRETATION RULES:
8. The corpus is self-selected: people who post reviews are not a random \
sample, and approved applicants post more readily. Approval shares describe \
posters, not the true consular base rate.
9. Question-outcome associations are correlational and the causation usually \
runs backwards: an officer asks about prior refusals *because* the case is \
already doubtful, and reaches funding detail *because* the interview is going \
well. Never tell a student to avoid triggering a question — they do not \
control what is asked.
10. Grading scales differ by country. This corpus is overwhelmingly Indian and \
its GPAs are on a 10-point scale. Never compare a raw GPA number across scales: \
3.5/4 is strong, 3.5/10 is weak. Use the percent-of-maximum given for the \
student, treat any cross-system equivalence as approximate, and if the student \
did not state a scale, say the comparison cannot be made rather than assuming one.
11. Be direct and specific. Prefer one concrete rewrite over three general \
tips. If an answer is already good, say so rather than inventing criticism.

PLAIN LANGUAGE RULES — the reader is a student, not an analyst. Many read \
English as a second language and have never taken a statistics class. Write so \
they understand you on the first read:
12. Short sentences, one idea each. Prefer the word a fifteen-year-old would \
use. Never make the student decode a sentence to find the advice in it.
13. Banned vocabulary, because it means nothing to this reader: "delta", \
"correlational", "negative association", "base rate", "self-selected", \
"n=", "corpus", "sample", "variable", "distribution", "statistically". Say \
"this data comes from people who chose to post, so it is not a survey" rather \
than "self-selected sample". You may still state the caution rule 8 and rule 9 \
require — say it in ordinary words.
14. Never print an internal key. Write the question the way an officer would \
ask it — "the 'why this university' question", not "why_university". Never \
write a record id: refer to a retrieved interview as "one applicant" or "an \
approved applicant", never by its identifier and never by a bracketed list of \
its details.
15. Give at most one number per sentence, always as a percentage, and say what \
it means right after it. "This question came up in about 15% of interviews — \
roughly one in seven" is right. Never show a raw count.
16. Every risk you name must end with what the student should do about it. A \
worry with no action is not useful to them.
"""


def format_statistics(stats: dict[str, Any], profile_city: str | None = None) -> str:
    """Corpus-wide statistics block — identical across students, so cacheable."""
    overall = stats.get("overall", {})
    lines = [
        "# CORPUS STATISTICS",
        "",
        f"Decided interviews: {overall.get('n_decided'):,}. "
        f"Approved share among posters: {overall.get('approval_rate', 0):.1%} "
        f"({overall.get('approved'):,} approved / {overall.get('rejected'):,} rejected).",
        "",
        "## Approval share by consulate city (posters, not base rate)",
    ]
    for city, row in stats.get("by_city", {}).items():
        lines.append(
            f"- {city}: {row['approval_rate']:.1%} of {row['n_decided']:,} decided"
        )

    lines += ["", "## Approval share by country"]
    for country, row in stats.get("by_country", {}).items():
        lines.append(
            f"- {country}: {row['approval_rate']:.1%} of {row['n_decided']:,} decided"
        )

    for key, title in [
        ("by_degree", "## By degree level"),
        ("by_attempt", "## By visa attempt number"),
    ]:
        section = stats.get(key, {})
        if section:
            lines += ["", title]
            for name, row in section.items():
                lines.append(
                    f"- {name}: {row['approval_rate']:.1%} of {row['n_decided']:,} decided"
                )

    lines += [
        "",
        "## Question types: how often asked, and the approval share when asked",
        "(delta is versus the corpus-wide approved share; correlational — see rule 9)",
    ]
    for entry in stats.get("question_types", []):
        if entry.get("asked_in", 0) < 100:
            continue
        lines.append(
            f"- {entry['question_type']}: asked in {entry['share_of_interviews']:.1%} "
            f"of interviews (n={entry['asked_in']:,}), approval when asked "
            f"{entry['approval_rate_when_asked']:.1%} (delta {entry['delta_vs_base']:+.1%})"
        )

    mix = stats.get("question_mix_by_city", {})
    if profile_city and profile_city in mix:
        city_row = mix[profile_city]
        lines += [
            "",
            f"## Most common question types at {profile_city} (n={city_row['n']:,})",
        ]
        for item in city_row.get("top_types", [])[:12]:
            lines.append(f"- {item['question_type']}: {item['share']:.1%}")

    answer_len = stats.get("answer_length")
    if answer_len:
        lines += ["", "## Applicant answer length vs outcome", json.dumps(answer_len)]

    return "\n".join(lines)


# How much of each retrieved transcript reaches the prompt.
#
# This block is the whole cost of an evaluation: it is per-student, so none of
# it caches, and at the old limits ten records ran to roughly 18k tokens. The
# retrieved set is also highly repetitive — mostly Indian CS applicants saying
# similar things — so the tail was paying full price to restate the head.
MAX_TURNS = 8
MAX_TURN_CHARS = 220


def format_retrieved(records: pd.DataFrame, full_df: pd.DataFrame | None = None) -> str:
    """Retrieved comparable interviews, including their Q&A where available."""
    lines = ["# RETRIEVED COMPARABLE INTERVIEWS", ""]
    for _, row in records.iterrows():
        rid = row.get("record_id", "?")
        header = (
            f"## {rid} | outcome: {row.get('outcome')} | "
            f"similarity {row.get('similarity')}"
        )
        lines.append(header)
        for field, label in [
            ("consulate_city", "Consulate"),
            ("university", "University"),
            ("course", "Course"),
            ("degree_level", "Level"),
            ("gpa", "GPA"),
            ("work_experience", "Work"),
            ("funding", "Funding"),
            ("attempt_number", "Attempt"),
        ]:
            value = row.get(field)
            if value is not None and str(value).strip() and str(value) != "nan":
                lines.append(f"- {label}: {value}")

        turns = None
        if full_df is not None and "record_id" in full_df.columns:
            match = full_df[full_df.record_id == rid]
            if len(match):
                turns = match.iloc[0].get("qa_turns")
        if turns is not None and len(turns):
            lines.append("- Transcript:")
            for turn in list(turns)[:MAX_TURNS]:
                question = (turn.get("question") or "").strip()
                answer = (turn.get("answer") or "").strip()
                if question:
                    lines.append(f"    VO: {question[:MAX_TURN_CHARS]}")
                if answer:
                    lines.append(f"    Me: {answer[:MAX_TURN_CHARS]}")
        lines.append("")
    return "\n".join(lines)


def format_student(profile: Any) -> str:
    """The student's own profile and planned answers."""
    lines = ["# THIS STUDENT", ""]
    for field, label in [
        ("consulate_city", "Consulate city"),
        ("consulate_country", "Consulate country"),
        ("university", "University"),
        ("degree_level", "Applying for"),
        ("course", "Field they will study"),
        ("major", "Field already studied"),
        ("work_experience", "Work experience"),
        ("funding", "Funding"),
        ("scholarship", "Scholarship"),
        ("attempt_number", "Visa attempt number"),
    ]:
        value = getattr(profile, field, None)
        if value is not None and str(value).strip():
            lines.append(f"- {label}: {value}")
    from ..grading import parse as parse_grade

    grade = parse_grade(getattr(profile, "gpa", None), getattr(profile, "gpa_scale", None))
    if grade is not None:
        lines.append(f"- GPA: {grade.describe()}")
    if getattr(profile, "test_scores", None):
        lines.append(
            "- Test scores: "
            + ", ".join(f"{k} {v}" for k, v in profile.test_scores.items() if v)
        )

    lines += ["", "## Planned answers to evaluate", ""]
    if not getattr(profile, "planned_answers", None):
        lines.append("(none supplied — cover likely questions and risk factors only)")
    for i, qa in enumerate(profile.planned_answers or [], 1):
        lines.append(f"{i}. Q: {qa.get('question', '').strip()}")
        lines.append(f"   A: {qa.get('answer', '').strip()}")
    return "\n".join(lines)


TASK_INSTRUCTION = """\
# TASK

Evaluate this student's readiness using only the statistics and retrieved \
interviews above.

- Give feedback on every planned answer they supplied. If they supplied none, \
return an empty answer_feedback list.
- List the question types most likely to come up for this specific profile and \
consulate, using the supplied per-city question mix where available.
- Name the genuine risk factors in their profile, each with the evidence behind \
it stated in plain words, and what to do about it.
- comparable_interviews is an internal audit trail and is not shown to the \
student: put the record_ids there and nowhere else. No record id, and no \
bracketed list of an interview's details, may appear in any other field.
- Every suggested revision must be truthful for this student. Do not invent \
facts they did not give you.
- Before returning, reread every sentence the student will see and ask whether \
someone with no statistics training understands it. Rewrite the ones that fail.
"""
