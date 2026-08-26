from visa_llm.extract.schema import Outcome
from visa_llm.extract.template_parser import normalize_outcome, parse
from visa_llm.ingest.review_filter import clean, is_review
from visa_llm.ingest.dedup import content_key

CHECKVISASLOTS_SAMPLE = """\
Visa Profile
College: University of Tampa, Florida
Interview Outcome: Approved
Visa Attempt Number: 1
Interview Date: 2023-06-13
Interview Time: 08:30
Interview City: Chennai
Interview Country: India

Exam Profile
Exam Type: GRE
Exam Score: 324
English Test Type: Dulingo
English Test Score: 135

Education Profile
Grad Level: Bachelors (3 Years)
Grad Major: Biotechnology
Grad GPA: 7.1
Grad Institute: Reva University
Grad Country: India

Job Profile
Job Type: Procurement Specialist
Job Years: 2.8

Interview Details
VO: Which University are you applying for?
Me: I have applied to University of Tampa, sir.

VO: How many universities did you apply?
Me: I've applied to 3 universities which are UT, Saint Leo university and Webster university.

VO: You can collect your passport in 7 days.
Me: Thank you officer.

For FREE real-time US Visa Appointments availability, sign up for https://checkvisaslots.com
"""

KV_TRANSCRIPT_SAMPLE = """\
First attempt

Biometrics: July 10
Consulate: Tashkent
Slot time : 10:30

Status: 221g (administrative processing) my visa got issued on July 18
Program: Global MBA program with STEM track
Major: Business administration
University: George Washington School of Business
Scholarship: $120.000
Duration: 2 years

VO: Morning
Me: Morning
VO: why GW?
Me: explained consicely
VO: who is going to cover your expenses?
Me: my workplace is going to sponsor my education.

Tips: Don't lie!!! They are professional psychologists.

@f1expuz | @f1expuzgroup
"""

STANDALONE_OUTCOME_SAMPLE = """\
F-1 visa appointment
June 23
Chennai consulate
Approved ✅
University of Cincinnati -MSIT

Me: Good morning sir
Vo: Very good morning, pass your I20 and passport.
Me: passed the documents.
Vo: So tell about your degree
Me: Completed my bachelor's in IT.
"""


def test_checkvisaslots_template():
    fields = parse(CHECKVISASLOTS_SAMPLE)
    assert fields.outcome is Outcome.APPROVED
    assert fields.attempt_number == 1
    assert fields.university == "University of Tampa, Florida"
    assert fields.consulate_city == "Chennai"
    assert fields.consulate_country == "India"
    assert fields.major == "Biotechnology"
    assert fields.gpa == "7.1"
    tests = {t.test: t.score for t in fields.test_scores}
    assert tests == {"GRE": "324", "Duolingo": "135"}
    assert len(fields.qa_turns) == 3
    assert fields.qa_turns[0].question.startswith("Which University")
    assert "Tampa" in fields.qa_turns[0].answer


def test_kv_transcript_format():
    fields = parse(KV_TRANSCRIPT_SAMPLE)
    assert fields.outcome is Outcome.ADMIN_PROCESSING
    assert fields.consulate_city == "Tashkent"
    assert fields.consulate_country == "Uzbekistan"
    assert fields.university == "George Washington School of Business"
    assert fields.scholarship == "$120.000"
    assert fields.attempt_number is None  # "First attempt" is prose, not a KV line
    assert len(fields.qa_turns) == 3
    assert fields.tips and "Don't lie" in fields.tips


def test_standalone_outcome_line():
    fields = parse(STANDALONE_OUTCOME_SAMPLE)
    assert fields.outcome is Outcome.APPROVED
    assert len(fields.qa_turns) >= 2


def test_outcome_normalization():
    assert normalize_outcome("Approved ✅✅") is Outcome.APPROVED
    assert normalize_outcome("- accepted") is Outcome.APPROVED
    assert normalize_outcome("Rejected ❌") is Outcome.REJECTED
    assert normalize_outcome("refused under 214(b)") is Outcome.REJECTED
    assert normalize_outcome("221g white slip") is Outcome.ADMIN_PROCESSING
    assert normalize_outcome("pending") is Outcome.UNKNOWN


def test_filter_and_clean():
    assert is_review(CHECKVISASLOTS_SAMPLE)
    assert not is_review("anyone got slots for mumbai?")
    cleaned = clean(CHECKVISASLOTS_SAMPLE)
    assert "checkvisaslots.com" not in cleaned
    assert "PLEASE SHARE" not in cleaned


def test_dedup_ignores_footers():
    a = KV_TRANSCRIPT_SAMPLE
    b = KV_TRANSCRIPT_SAMPLE.replace("@f1expuz | @f1expuzgroup", "https://t.me/other")
    assert content_key(a) == content_key(b)
