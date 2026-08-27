"""Precompute the statistics that ground the evaluator's prompt.

Everything here is descriptive: these are self-selected, self-reported reviews,
so rates describe *who posts*, not the true consular base rate. The report and
the evaluator prompt both state that explicitly.
"""

from __future__ import annotations

import re
from typing import Any

import pandas as pd

from .taxonomy import OTHER, PROCEDURAL, classify

# Below this many records, a breakdown cell is noise — suppress it.
MIN_CELL = 25
DECIDED = ("approved", "rejected")


# Raw city values carry prefixes ("VI Mumbai", "OFC Delhi"), date stamps
# ("July 19th Delhi"), emoji, asterisks and misspellings, so match the value
# against known consulates rather than trying to clean it into shape.
_CITY_ALIASES: list[tuple[str, str]] = [
    (r"new\s*delhi|newdelhi|\bdelhi\b|\bndl\b", "New Delhi"),
    (r"mumbai|bombay|\bbom\b", "Mumbai"),
    (r"hyderabad|hyderbad|hydrabad|hyderabd|\bhyd\b", "Hyderabad"),
    (r"chennai|madras|\bmaa\b", "Chennai"),
    (r"kolkata|kolkota|kolakata|calcutta|\bccu\b", "Kolkata"),
    (r"tashkent|toshkent", "Tashkent"),
    (r"dhaka|dacca", "Dhaka"),
    (r"kathmandu|katmandu", "Kathmandu"),
    (r"islamabad", "Islamabad"),
    (r"karachi", "Karachi"),
    (r"lahore", "Lahore"),
    (r"colombo", "Colombo"),
    (r"abu\s*dhabi", "Abu Dhabi"),
    (r"dubai", "Dubai"),
    (r"riyadh", "Riyadh"),
    (r"jeddah", "Jeddah"),
    (r"lagos", "Lagos"),
    (r"abuja", "Abuja"),
    (r"accra", "Accra"),
    (r"nairobi", "Nairobi"),
    (r"addis\s*ababa", "Addis Ababa"),
    (r"hanoi", "Hanoi"),
    (r"ho\s*chi\s*minh|saigon|\bhcmc\b", "Ho Chi Minh"),
    (r"beijing|peking", "Beijing"),
    (r"shanghai", "Shanghai"),
    (r"guangzhou", "Guangzhou"),
    (r"shenyang", "Shenyang"),
    (r"seoul", "Seoul"),
    (r"tokyo", "Tokyo"),
    (r"kuala\s*lumpur", "Kuala Lumpur"),
    (r"manila", "Manila"),
    (r"jakarta", "Jakarta"),
    (r"bangkok", "Bangkok"),
    (r"almaty", "Almaty"),
    (r"astana|nur[- ]?sultan", "Astana"),
    (r"bishkek", "Bishkek"),
    (r"dushanbe", "Dushanbe"),
    (r"ashgabat", "Ashgabat"),
    (r"baku", "Baku"),
    (r"yerevan", "Yerevan"),
    (r"tbilisi", "Tbilisi"),
    (r"ankara", "Ankara"),
    (r"istanbul", "Istanbul"),
    (r"cairo", "Cairo"),
    (r"amman", "Amman"),
    (r"tel\s*aviv", "Tel Aviv"),
    (r"jerusalem", "Jerusalem"),
    (r"\bkyiv\b|\bkiev\b", "Kyiv"),
    (r"warsaw", "Warsaw"),
    (r"frankfurt", "Frankfurt"),
    (r"london", "London"),
    (r"paris", "Paris"),
    (r"madrid", "Madrid"),
    (r"rome", "Rome"),
    (r"mexico\s*city", "Mexico City"),
    (r"bogota", "Bogota"),
    (r"\blima\b", "Lima"),
    (r"sao\s*paulo", "Sao Paulo"),
    (r"rio\s*de\s*janeiro", "Rio de Janeiro"),
    (r"buenos\s*aires", "Buenos Aires"),
    (r"santiago", "Santiago"),
    (r"ulaanbaatar|ulan\s*bator", "Ulaanbaatar"),
    (r"freetown", "Freetown"),
    (r"kampala", "Kampala"),
    (r"dar\s*es\s*salaam", "Dar es Salaam"),
    (r"casablanca", "Casablanca"),
    (r"tunis", "Tunis"),
    (r"algiers", "Algiers"),
    (r"doha", "Doha"),
    (r"kuwait", "Kuwait City"),
    (r"muscat", "Muscat"),
    (r"manama", "Manama"),
    (r"yaounde", "Yaounde"),
    (r"johannesburg", "Johannesburg"),
    (r"cape\s*town", "Cape Town"),
    (r"toronto", "Toronto"),
    (r"vancouver", "Vancouver"),
    (r"ottawa", "Ottawa"),
]

_CITY_PATTERNS = [(re.compile(p, re.IGNORECASE), name) for p, name in _CITY_ALIASES]


def _norm_city(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    for pattern, name in _CITY_PATTERNS:
        if pattern.search(value):
            return name
    return None  # unrecognized -> excluded rather than guessed


# Country is the messiest field in the corpus: case varies, Indian cities and
# states get typed into it, and some posters put their *destination* (USA)
# rather than where they interviewed. An F1 interview never happens inside the
# USA, so those values are dropped rather than reported as a bogus cohort.
_COUNTRY_ALIASES = [
    (r"uzbek|tashkent", "Uzbekistan"),
    (r"\bnepal", "Nepal"),
    (r"bangladesh|dhaka", "Bangladesh"),
    (r"pakistan|islamabad|karachi", "Pakistan"),
    (r"sri\s*lanka|colombo", "Sri Lanka"),
    (r"\buae\b|emirat|dubai|abu\s*dhabi", "UAE"),
    (r"canada|toronto|vancouver|ottawa", "Canada"),
    (r"mexico", "Mexico"),
    (r"colombia|bogota", "Colombia"),
    (r"nigeria|lagos|abuja", "Nigeria"),
    (r"ghana|accra", "Ghana"),
    (r"kenya|nairobi", "Kenya"),
    (r"turkey|turkiye|ankara|istanbul", "Turkey"),
    (r"vietnam|hanoi", "Vietnam"),
    (r"philippin|manila", "Philippines"),
    (r"indonesia|jakarta", "Indonesia"),
    (r"\bchina\b|beijing|shanghai", "China"),
    (r"saudi|riyadh|jeddah", "Saudi Arabia"),
    (r"\bqatar\b|doha", "Qatar"),
    (r"kuwait", "Kuwait"),
    (r"\boman\b|muscat", "Oman"),
    (r"bahrain", "Bahrain"),
    (r"egypt|cairo", "Egypt"),
    (r"jordan|amman", "Jordan"),
    (r"kazakh|almaty|astana", "Kazakhstan"),
    (r"kyrgyz|bishkek", "Kyrgyzstan"),
    (r"tajik|dushanbe", "Tajikistan"),
    (r"azerbaijan|baku", "Azerbaijan"),
    (r"georgia|tbilisi", "Georgia"),
    (r"armenia|yerevan", "Armenia"),
    (r"russia|moscow", "Russia"),
    (r"ukraine|kyiv|kiev", "Ukraine"),
    (r"germany|frankfurt|berlin", "Germany"),
    (r"south\s*africa|johannesburg|cape\s*town", "South Africa"),
    # India last: its alias list is broad (cities/states), so more specific
    # countries above must get first refusal.
    (
        r"\bindia\b|\bind\b|\bindian\b|bharat|hyderabad|telangana|mumbai|"
        r"delhi|chennai|kolkata|calcutta|bengaluru|bangalore|andhra|maharashtra|"
        r"karnataka|punjab|gujarat|kerala|tamil\s*nadu|rajasthan|odisha|bihar|"
        r"pune|ahmedabad|surat|nagpur|kanpur|lucknow|madhya\s*pradesh|"
        r"uttar\s*pradesh|west\s*bengal|haryana|jharkhand|assam|goa\b",
        "India",
    ),
]

_COUNTRY_PATTERNS = [(re.compile(p, re.IGNORECASE), name) for p, name in _COUNTRY_ALIASES]

# Destination-not-consulate values: an F1 applicant never interviews in the US.
_NOT_A_CONSULATE_COUNTRY = re.compile(
    r"^\W*(?:usa?|u\.s\.a?\.?|united\s*states(?:\s*of\s*america)?|america\w*)\W*$",
    re.IGNORECASE,
)


def _norm_country(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if _NOT_A_CONSULATE_COUNTRY.match(text):
        return None
    for pattern, name in _COUNTRY_PATTERNS:
        if pattern.search(text):
            return name
    return None  # unrecognized -> excluded rather than guessed


def _norm_degree(row: pd.Series) -> str | None:
    """Degree level from the explicit field, else inferred from the course text."""
    blob = " ".join(
        str(row.get(c) or "") for c in ("degree_level", "course", "major", "university")
    ).lower()
    if re.search(r"\bph\.?d\b|doctora|doctoral", blob):
        return "PhD"
    if re.search(r"\bmba\b", blob):
        return "MBA"
    if re.search(r"\bm\.?s\b|master|\bmsc\b|\bm\.?tech\b|\bma\b\.?|grad(?:uate)? level|\bmis\b", blob):
        return "Masters"
    if re.search(r"bachelor|under\s?grad|\bbs\b|\bba\b|\bbba\b|\bb\.?tech\b|freshman|undergraduate", blob):
        return "Bachelors"
    return None


def _approval_rate(frame: pd.DataFrame) -> dict[str, Any] | None:
    """Approved share among *decided* interviews (excludes 221g/unknown)."""
    decided = frame[frame.outcome.isin(DECIDED)]
    if len(decided) < MIN_CELL:
        return None
    approved = int((decided.outcome == "approved").sum())
    return {
        "n_decided": int(len(decided)),
        "approved": approved,
        "rejected": int(len(decided)) - approved,
        "approval_rate": round(approved / len(decided), 3),
    }


def _by(frame: pd.DataFrame, column: str, top: int = 20) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for value, group in frame.groupby(column):
        stats = _approval_rate(group)
        if stats:
            out[str(value)] = stats
    return dict(sorted(out.items(), key=lambda kv: -kv[1]["n_decided"])[:top])


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    """Add the derived columns the stats and retrieval layers both use."""
    df = df.copy()
    df["city"] = df.consulate_city.map(_norm_city)
    df["country"] = df.consulate_country.map(_norm_country)
    df["degree"] = df.apply(_norm_degree, axis=1)
    df["year"] = pd.to_datetime(df.source.map(lambda s: s["date"]), errors="coerce").dt.year
    df["q_types"] = df.qa_turns.map(
        lambda turns: sorted(
            {
                label
                for label in (classify(t["question"]) for t in turns)
                if label not in PROCEDURAL and label != OTHER
            }
        )
    )
    df["n_turns"] = df.qa_turns.map(len)
    df["answer_chars"] = df.qa_turns.map(
        lambda turns: sum(len(t["answer"]) for t in turns) or 0
    )
    return df


def compute(df: pd.DataFrame) -> dict[str, Any]:
    """Build the stats blob injected into the evaluator prompt."""
    prepared = prepare(df)
    decided = prepared[prepared.outcome.isin(DECIDED)]

    stats: dict[str, Any] = {
        "meta": {
            "n_records": int(len(prepared)),
            "n_decided": int(len(decided)),
            "outcome_counts": {k: int(v) for k, v in prepared.outcome.value_counts().items()},
            "year_range": [
                int(prepared.year.min()) if prepared.year.notna().any() else None,
                int(prepared.year.max()) if prepared.year.notna().any() else None,
            ],
            "caveat": (
                "Self-selected, self-reported Telegram reviews. Approval shares "
                "describe who chooses to post, not the true consular base rate. "
                "Associations are correlational, not causal."
            ),
            "min_cell_size": MIN_CELL,
        },
        "overall": _approval_rate(prepared),
        "by_city": _by(prepared, "city"),
        "by_country": _by(prepared, "country"),
        "by_degree": _by(prepared, "degree"),
        "by_attempt": _by(prepared[prepared.attempt_number.notna()], "attempt_number", top=6),
        "by_year": _by(prepared[prepared.year.notna()], "year", top=10),
    }

    # ---- question-type frequency and outcome association --------------------
    q_rows: list[dict[str, Any]] = []
    for label in sorted({q for types in prepared.q_types for q in types}):
        has = decided[decided.q_types.map(lambda types: label in types)]
        if len(has) < MIN_CELL:
            continue
        rate = _approval_rate(has)
        q_rows.append(
            {
                "question_type": label,
                "asked_in": int(len(has)),
                "share_of_interviews": round(len(has) / len(decided), 3),
                "approval_rate_when_asked": rate["approval_rate"] if rate else None,
            }
        )
    base = stats["overall"]["approval_rate"] if stats["overall"] else None
    for row in q_rows:
        if base and row["approval_rate_when_asked"] is not None:
            row["delta_vs_base"] = round(row["approval_rate_when_asked"] - base, 3)
    stats["question_types"] = sorted(q_rows, key=lambda r: -r["asked_in"])

    # ---- per-city question mix (what to prepare for, by post) --------------
    city_q: dict[str, Any] = {}
    for city, group in decided.groupby("city"):
        if len(group) < 100:
            continue
        counts: dict[str, int] = {}
        for types in group.q_types:
            for label in types:
                counts[label] = counts.get(label, 0) + 1
        top = sorted(counts.items(), key=lambda kv: -kv[1])[:12]
        city_q[str(city)] = {
            "n": int(len(group)),
            "top_question_types": [
                {"question_type": k, "share": round(v / len(group), 3)} for k, v in top
            ],
        }
    stats["question_mix_by_city"] = dict(
        sorted(city_q.items(), key=lambda kv: -kv[1]["n"])[:15]
    )

    # ---- answer-length signal ---------------------------------------------
    length = decided[decided.answer_chars > 0]
    if len(length) >= MIN_CELL:
        stats["answer_length"] = {
            "median_total_answer_chars_approved": int(
                length[length.outcome == "approved"].answer_chars.median()
            ),
            "median_total_answer_chars_rejected": int(
                length[length.outcome == "rejected"].answer_chars.median()
            ),
            "median_turns_approved": float(
                length[length.outcome == "approved"].n_turns.median()
            ),
            "median_turns_rejected": float(
                length[length.outcome == "rejected"].n_turns.median()
            ),
            "note": (
                "Transcript length reflects how much the poster wrote down, not "
                "only how much they said at the window. Treat as weak signal."
            ),
        }
    return stats
