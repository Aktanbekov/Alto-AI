"""Deterministic parser for the template families observed in the corpus.

Family (a): checkvisaslots template — "Visa Profile", "Interview Outcome:",
"Grad Level:", "Exam Type:" ... sections.
Family (b): key-value header + transcript — "Consulate:", "University:",
"Status: Approved ✅", then VO:/Me: dialogue.
Family (c): freeform — dialogue only; whatever key-value lines exist are still
harvested, the rest is left for the LLM extractor.
"""

from __future__ import annotations

import re

from .schema import ExtractedFields, Outcome, QATurn, TestScore

# ---------------------------------------------------------------- key-value --

_KV_RE = re.compile(r"^\s*([A-Za-z][A-Za-z0-9 /()&.#-]{1,35}?)\s*[:\-]\s*(.+?)\s*$")

# label (lowercased, stripped) -> record field
_FIELD_ALIASES: dict[str, str] = {
    # outcome
    "status": "outcome",
    "interview outcome": "outcome",
    "outcome": "outcome",
    "result": "outcome",
    "visa status": "outcome",
    "decision": "outcome",
    # university
    "university": "university",
    "college": "university",
    "school": "university",
    "university name": "university",
    # consulate
    "consulate": "consulate_city",
    "embassy": "consulate_city",
    "interview city": "consulate_city",
    "interview location": "consulate_city",
    "interview country": "consulate_country",
    "country": "consulate_country",
    # dates / attempt
    "interview date": "interview_date",
    "date": "interview_date",
    "date of interview": "interview_date",
    "visa attempt number": "attempt_number",
    "attempt": "attempt_number",
    "attempt number": "attempt_number",
    "attempt no": "attempt_number",
    "no of attempts": "attempt_number",
    # program
    "course": "course",
    "program": "course",
    "degree": "course",
    "course level": "degree_level",
    "level": "degree_level",
    "program level": "degree_level",
    "major": "major",
    "grad major": "major",
    "undergrad major": "major",
    "gpa": "gpa",
    "cgpa": "gpa",
    "grad gpa": "gpa",
    "undergrad gpa": "gpa",
    "percentage": "gpa",
    # work
    "job type": "work_experience",
    "work experience": "work_experience",
    "work exp": "work_experience",
    "experience": "work_experience",
    # funding
    "sponsor": "funding",
    "sponsors": "funding",
    "sponsorship": "funding",
    "funding": "funding",
    "financials": "funding",
    "finances": "funding",
    "scholarship": "scholarship",
    "assistantship": "scholarship",
    # intake
    "f1 visa intake": "intake",
    "intake": "intake",
    "term": "intake",
    "semester": "intake",
    # tips
    "tips": "tips",
    "tip": "tips",
    "advice": "tips",
    "suggestions": "tips",
}

_TEST_LABELS = {
    "gre": "GRE",
    "gmat": "GMAT",
    "toefl": "TOEFL",
    "ielts": "IELTS",
    "duolingo": "Duolingo",
    "dulingo": "Duolingo",
    "det": "Duolingo",
    "sat": "SAT",
    "act": "ACT",
    "pte": "PTE",
}

# ----------------------------------------------------------------- outcome --

_221G_RE = re.compile(r"221\s*-?\s*g|administrative processing", re.IGNORECASE)
_REJECT_RE = re.compile(r"reject|refus|denied|deny|214\s*-?\s*b|not approved", re.IGNORECASE)
_APPROVE_RE = re.compile(r"approv|accept|issued|granted|success", re.IGNORECASE)


def normalize_outcome(value: str) -> Outcome:
    if _221G_RE.search(value):
        # "221g ... visa got issued on July 18" is still 221g at the interview.
        return Outcome.ADMIN_PROCESSING
    if _REJECT_RE.search(value):
        return Outcome.REJECTED
    if _APPROVE_RE.search(value):
        return Outcome.APPROVED
    return Outcome.UNKNOWN


# ---------------------------------------------------------------- dialogue --

_OFFICER_RE = re.compile(r"^\s*(?:VO|VI|CO|OFFICER|CONSULAR OFFICER)\s*[:\-]\s*(.*)$", re.IGNORECASE)
_ME_RE = re.compile(r"^\s*(?:ME|STUDENT|I)\s*[:\-]\s*(.*)$", re.IGNORECASE)
_TIPS_LINE_RE = re.compile(r"^\s*(?:tips?|advice|note|suggestions?)\s*[:\-]\s*", re.IGNORECASE)

# city -> country for the consulates that dominate this corpus
_CITY_COUNTRY = {
    "chennai": "India", "mumbai": "India", "new delhi": "India", "delhi": "India",
    "hyderabad": "India", "kolkata": "India", "calcutta": "India",
    "tashkent": "Uzbekistan", "dhaka": "Bangladesh", "kathmandu": "Nepal",
    "islamabad": "Pakistan", "karachi": "Pakistan", "lahore": "Pakistan",
    "colombo": "Sri Lanka", "lagos": "Nigeria", "abuja": "Nigeria",
    "accra": "Ghana", "hanoi": "Vietnam", "ho chi minh": "Vietnam",
    "ho chi minh city": "Vietnam", "beijing": "China", "shanghai": "China",
    "guangzhou": "China", "seoul": "South Korea", "tokyo": "Japan",
    "riyadh": "Saudi Arabia", "jeddah": "Saudi Arabia", "dubai": "UAE",
    "abu dhabi": "UAE", "almaty": "Kazakhstan", "astana": "Kazakhstan",
    "bishkek": "Kyrgyzstan", "dushanbe": "Tajikistan", "ashgabat": "Turkmenistan",
    "ankara": "Turkey", "istanbul": "Turkey", "lima": "Peru", "bogota": "Colombia",
    "sao paulo": "Brazil", "mexico city": "Mexico", "cairo": "Egypt",
    "amman": "Jordan", "tel aviv": "Israel", "jerusalem": "Israel",
    "kyiv": "Ukraine", "warsaw": "Poland", "frankfurt": "Germany",
    "london": "United Kingdom", "paris": "France", "yerevan": "Armenia",
    "baku": "Azerbaijan", "tbilisi": "Georgia", "ulaanbaatar": "Mongolia",
}

_ATTEMPT_NUM_RE = re.compile(r"\d+")
_ORDINAL_ATTEMPT = {"first": 1, "1st": 1, "second": 2, "2nd": 2, "third": 3, "3rd": 3, "fourth": 4, "4th": 4}


def _parse_attempt(value: str) -> int | None:
    lowered = value.lower()
    for word, num in _ORDINAL_ATTEMPT.items():
        if word in lowered:
            return num
    m = _ATTEMPT_NUM_RE.search(value)
    if m:
        n = int(m.group(0))
        return n if 1 <= n <= 10 else None
    return None


def parse_dialogue(text: str) -> tuple[list[QATurn], str | None]:
    """Split VO:/Me: transcript into turns. Continuation lines attach to the
    current speaker; a Tips:/Advice: line ends the dialogue."""
    turns: list[QATurn] = []
    tips_parts: list[str] = []
    current: str | None = None  # "q" | "a" | "tips" | None
    question, answer = "", ""

    def commit() -> None:
        nonlocal question, answer
        if question or answer:
            turns.append(QATurn(question=question.strip(), answer=answer.strip()))
        question, answer = "", ""

    for line in text.splitlines():
        officer = _OFFICER_RE.match(line)
        me = _ME_RE.match(line)
        if _TIPS_LINE_RE.match(line):
            commit()
            current = "tips"
            tips_parts.append(_TIPS_LINE_RE.sub("", line).strip())
        elif officer:
            if current in ("a", None) or (current == "q" and question):
                commit()
            question = officer.group(1)
            current = "q"
        elif me:
            answer = me.group(1) if not answer else f"{answer}\n{me.group(1)}"
            current = "a"
        elif current == "q" and line.strip():
            question += f"\n{line.strip()}"
        elif current == "a" and line.strip():
            # A template key line ("Tips:" already handled) ends free flow only
            # on blank lines; keep multi-line answers intact.
            answer += f"\n{line.strip()}"
        elif current == "tips" and line.strip():
            tips_parts.append(line.strip())
        elif not line.strip():
            if current == "a":
                commit()
                current = None
            elif current == "tips":
                current = None
    commit()
    tips = "\n".join(tips_parts).strip() or None
    return turns, tips


# ------------------------------------------------------------------- parse --

def parse(text: str) -> ExtractedFields:
    fields = ExtractedFields()
    pending_test_type: str | None = None
    pending_english_type: str | None = None

    for line in text.splitlines():
        m = _KV_RE.match(line)
        if not m:
            continue
        label = re.sub(r"\s+", " ", m.group(1)).strip().lower()
        value = m.group(2).strip()
        if not value:
            continue

        # test-score pairs from the checkvisaslots template
        if label == "exam type":
            pending_test_type = value
            continue
        if label == "exam score" and pending_test_type:
            fields.test_scores.append(TestScore(test=_canon_test(pending_test_type), score=value))
            pending_test_type = None
            continue
        if label == "english test type":
            pending_english_type = value
            continue
        if label == "english test score" and pending_english_type:
            fields.test_scores.append(TestScore(test=_canon_test(pending_english_type), score=value))
            pending_english_type = None
            continue
        # direct "GRE: 324" style lines
        if label in _TEST_LABELS:
            fields.test_scores.append(TestScore(test=_TEST_LABELS[label], score=value))
            continue

        field = _FIELD_ALIASES.get(label)
        if field is None:
            continue
        if field == "outcome":
            outcome = normalize_outcome(value)
            if outcome is not Outcome.UNKNOWN and fields.outcome is Outcome.UNKNOWN:
                fields.outcome = outcome
        elif field == "attempt_number":
            fields.attempt_number = fields.attempt_number or _parse_attempt(value)
        elif field == "tips":
            fields.tips = f"{fields.tips}\n{value}" if fields.tips else value
        elif field == "work_experience":
            fields.work_experience = (
                f"{fields.work_experience}; {value}" if fields.work_experience else value
            )
        elif getattr(fields, field) is None:
            setattr(fields, field, value)

    turns, dialogue_tips = parse_dialogue(text)
    fields.qa_turns = turns
    if dialogue_tips and not fields.tips:
        fields.tips = dialogue_tips

    # Fallback: outcome stated in prose ("I got my visa approved", "Rejected.")
    if fields.outcome is Outcome.UNKNOWN:
        fields.outcome = _outcome_from_prose(text)

    if fields.consulate_city and not fields.consulate_country:
        fields.consulate_country = _CITY_COUNTRY.get(fields.consulate_city.strip().lower())

    return fields


def _canon_test(value: str) -> str:
    return _TEST_LABELS.get(value.strip().lower(), value.strip())


# A line that is nothing but an outcome word (plus emoji/punctuation),
# e.g. "Approved ✅" on its own line with no "Status:" prefix.
_STANDALONE_OUTCOME_RE = re.compile(
    r"^\s*\W{0,3}(approved|accepted|issued|rejected|refused|denied|221\s*-?\s*g)\b[^\w\n]*$",
    re.IGNORECASE | re.MULTILINE,
)

_PROSE_APPROVED_RE = re.compile(
    r"visa (?:is |was |got )?(?:approved|issued|granted)|"
    r"(?:collect|pick up) your passport|passport will be|congratulations.{0,30}approved|"
    r"your visa (?:is|has been) approved",
    re.IGNORECASE,
)
_PROSE_REJECTED_RE = re.compile(
    r"visa (?:is |was |got )?(?:rejected|refused|denied)|"
    r"(?:sorry|unfortunately).{0,60}(?:cannot|can't|unable to) (?:issue|approve)|"
    r"handed?(?: me)? (?:the |a )?(?:white|yellow|blue) (?:slip|paper)|214\s*-?\s*b",
    re.IGNORECASE,
)
_PROSE_221G_RE = re.compile(r"221\s*-?\s*g|administrative processing", re.IGNORECASE)


def _outcome_from_prose(text: str) -> Outcome:
    standalone = _STANDALONE_OUTCOME_RE.search(text)
    if standalone:
        return normalize_outcome(standalone.group(1))
    if _PROSE_221G_RE.search(text):
        return Outcome.ADMIN_PROCESSING
    rejected = _PROSE_REJECTED_RE.search(text)
    approved = _PROSE_APPROVED_RE.search(text)
    if rejected and not approved:
        return Outcome.REJECTED
    if approved and not rejected:
        return Outcome.APPROVED
    return Outcome.UNKNOWN
