import pytest

from visa_llm.analytics.taxonomy import PROCEDURAL, classify, is_question_type

CASES = [
    # funding cluster
    ("Who is sponsoring your education?", "funding_sponsor"),
    ("How are you funding your studies?", "funding_general"),
    ("Any loan?", "funding_loan"),
    ("What is your father's annual income?", "sponsor_income"),
    ("What is his salary", "sponsor_income"),
    ("What does your father do?", "sponsor_occupation"),
    ("what do they do", "sponsor_occupation"),
    ("Which kind of business?", "business_details"),
    ("Did you get any scholarship?", "scholarship"),
    ("What is the total cost of your program?", "tuition_cost"),
    # university / program
    ("Why this university?", "why_university"),
    ("Why did you choose University of Tampa?", "why_university"),
    ("Why masters now?", "why_course"),
    ("Why computer engineering?", "why_course"),
    ("Why USA and not India?", "why_usa"),
    ("How many universities did you apply to?", "universities_applied"),
    ("Any admits from these?", "universities_applied"),
    ("Which university are you going to?", "which_university"),
    ("Which course are you pursuing?", "which_course"),
    ("How will this course help you?", "course_value"),
    ("What is your study plan?", "course_value"),
    # academics / work
    ("When did you graduate?", "graduation_year"),
    ("What is your CGPA?", "academics_scores"),
    ("What did you study in your undergrad?", "undergrad_background"),
    ("What have you been doing since graduation?", "gap_year"),
    ("Are you currently working?", "work_experience"),
    ("any experience", "work_experience"),
    # intent / family / history
    ("What are your plans after graduation?", "post_grad_plans"),
    ("Will you come back to India?", "return_intent"),
    ("Do you have any relatives in the US?", "relatives_in_us"),
    ("Have you been refused a visa before?", "prior_visa_history"),
    ("Are you refused previously", "prior_visa_history"),
    ("Tell me about yourself", "open_ended"),
    # procedural
    ("Good morning", "greeting"),
    ("Very good morning sir", "greeting"),
    ("Please pass me your I-20 and passport", "document_request"),
    ("Hold your I20 against the glass", "document_request"),
    ("Place your left four fingers on the scanner", "biometrics"),
    ("Your visa is approved, collect your passport in 7 days", "verdict_approved"),
    ("I am sorry, I cannot approve your visa today", "verdict_rejected"),
    ("We are putting you on administrative processing (221g)", "verdict_221g"),
    ("scrolling and typing something", "non_verbal"),
    ("American lady with brown hair and specs", "non_verbal"),
]


@pytest.mark.parametrize("text,expected", CASES)
def test_classify(text, expected):
    assert classify(text) == expected


def test_procedural_excluded_from_question_types():
    assert not is_question_type("greeting")
    assert not is_question_type("verdict_approved")
    assert not is_question_type("other")
    assert is_question_type("why_university")


def test_procedural_set_matches_labels():
    for label in PROCEDURAL:
        assert not is_question_type(label)


def test_empty_turn_is_other():
    assert classify("") == "other"
    assert classify("   ") == "other"
