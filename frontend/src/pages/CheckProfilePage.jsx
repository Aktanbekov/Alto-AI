import { useState, useEffect, useRef } from "react";
import { getEvaluateStatus, evaluateProfile, getMe, getQuestionBank } from "../api";
import { track, trackScrollDepth, gpaBandOf } from "../analytics";

/*
 * The profile evaluator, ported from visa-llm's own Evaluate view.
 *
 * It posts to /api/v1/evaluate, which proxies the visa-llm sidecar, so the
 * scoring is the same grounded evaluator — every claim comes from retrieved
 * interviews and precomputed corpus statistics, not model priors.
 */

// Questions come three at a time from the corpus bank, walked in order of how
// often officers ask each type. The applicant does not choose them — the point
// of the test is to face what actually gets asked, not what you have an answer
// for ready.
const PER_ROUND = 3;

// Used when the corpus bank cannot be fetched — an old server without the
// /questions route, a missing data file, a network blip. Four rounds of the
// questions that come up most often, so the test still works end to end
// instead of dead-ending after one round with no way forward.
const FALLBACK_QUESTIONS = [
  "What does your father do?",
  "Who is sponsoring your education?",
  "How are you going to fund your education?",
  "How many universities did you apply to?",
  "Why did you choose this university?",
  "Which course are you going to study?",
  "What is your undergraduate background?",
  "When did you graduate?",
  "What will you do after graduation?",
  "Do you have any relatives in the US?",
  "What is your father's annual income?",
  "Why not study this in your home country?",
];

// One bank entry -> what a round needs: the phrasing officers actually used,
// plus how often the type comes up. Fallback entries carry no share, and the
// UI simply omits that line for them.
function toRound(entry) {
  if (typeof entry === "string") return { question: entry, answer: "" };
  return {
    question: (entry.examples && entry.examples[0]) || entry.question_type,
    question_type: entry.question_type,
    share: entry.share_of_interviews,
    answer: "",
  };
}

// A postgraduate applicant has a prior degree worth asking about; an
// undergraduate does not, so the field is hidden rather than left confusing.
const POSTGRAD = new Set(["Masters", "MBA", "PhD"]);

const SCALES = [
  { value: "", label: "Select your scale…" },
  { value: "4", label: "Out of 4.0 (US and similar)" },
  { value: "4.3", label: "Out of 4.3" },
  { value: "5", label: "Out of 5.0" },
  { value: "10", label: "Out of 10 (India CGPA)" },
  { value: "100", label: "Percentage (out of 100)" },
];

const EMPTY = {
  consulate_city: "", consulate_country: "", university: "", course: "",
  major: "", degree_level: "Bachelor", gpa: "", gpa_scale: "",
  work_experience: "", funding_source: "", attempt_number: "1",
};

export default function CheckProfilePage() {
  const [profile, setProfile] = useState(EMPTY);
  const [pool, setPool] = useState(FALLBACK_QUESTIONS);
  const [answers, setAnswers] = useState(() =>
    FALLBACK_QUESTIONS.slice(0, PER_ROUND).map(toRound)
  );
  const [round, setRound] = useState(0);
  const [status, setStatus] = useState({ checking: true, available: false, detail: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    getEvaluateStatus()
      .then((s) => setStatus({ checking: false, available: !!s.available, detail: s.detail || "" }))
      .catch((err) => setStatus({ checking: false, available: false, detail: err.message }));
  }, []);

  // The bank is a static corpus file, so one fetch covers every round. On
  // failure the fallback pool already in state stands in — the rounds keep
  // working, they are just shorter and carry no asked-in percentages.
  useEffect(() => {
    let cancelled = false;
    getQuestionBank()
      .then((entries) => {
        if (cancelled || !Array.isArray(entries) || !entries.length) return;
        setPool(entries);
        setAnswers(entries.slice(0, PER_ROUND).map(toRound));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Prefill from the signed-in account so people do not retype what we know.
  useEffect(() => {
    getMe()
      .then((u) => {
        if (!u) return;
        setProfile((p) => ({
          ...p,
          university: p.university || u.college || "",
          major: p.major || u.major || "",
        }));
      })
      .catch(() => {});
  }, []);

  // form_start fires on the first edit rather than on mount: arriving on the
  // page is a page_view, and counting it as a form start would flatten the
  // first funnel step to nothing.
  const startedRef = useRef(false);
  const markStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    track("form_start");
    track("test_start", { mode: "text" });
  };

  const set = (k) => (e) => {
    markStarted();
    setProfile((p) => ({ ...p, [k]: e.target.value }));
  };
  const setAnswer = (i) => (e) => {
    markStarted();
    setAnswers((a) => a.map((row, idx) => (idx === i ? { ...row, answer: e.target.value } : row)));
  };

  const roundStartedAt = useRef(Date.now());

  // The report is the thing the product exists to deliver, so how long people
  // stay with it and how far down they get is the quality signal.
  useEffect(() => {
    if (!result) return undefined;
    track("report_view");
    const openedAt = Date.now();
    const stopScroll = trackScrollDepth("report");
    return () => {
      stopScroll();
      track("report_dwell", { seconds: Math.round((Date.now() - openedAt) / 1000) });
    };
  }, [result]);

  const nextStart = (round + 1) * PER_ROUND;
  const hasNextRound = nextStart < pool.length;

  // Next round: same profile, three new questions, empty answers, no report.
  const nextRound = () => {
    setAnswers(pool.slice(nextStart, nextStart + PER_ROUND).map(toRound));
    setRound((r) => r + 1);
    setResult(null);
    setError("");
    roundStartedAt.current = Date.now();
    scrollTo({ top: 0, behavior: "smooth" });
  };

  const showPrior = POSTGRAD.has(profile.degree_level);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    Object.entries(profile).forEach(([field, value]) => {
      if (!String(value || "").trim()) track("form_field_skipped", { field_name: field });
    });

    const planned = answers
      .map((a) => ({ question: a.question.trim(), answer: a.answer.trim() }))
      .filter((a) => a.question && a.answer);

    if (!planned.length) {
      setError("Answer at least one of the questions before scoring.");
      return;
    }
    // A bare number is unusable: 3.5 is strong out of 4 and weak out of 10.
    if (profile.gpa.trim() && !profile.gpa_scale) {
      setError(
        "Pick your grading scale. A GPA on its own is ambiguous — 3.5 out of 4 is strong, " +
        "3.5 out of 10 is not. Choose the scale your institution uses, or clear the GPA field."
      );
      return;
    }

    // One question_answered per answer, with how long and how much they wrote.
    // char_count is a length, not the text — the answer itself never leaves for
    // analytics; it goes to the evaluations table with the report.
    const elapsed = Math.round((Date.now() - roundStartedAt.current) / 1000);
    answers.forEach((a, i) => {
      if (!a.answer.trim()) return;
      track("question_answered", {
        q_id: a.question_type || `round${round}_q${i + 1}`,
        mode: "text",
        answer_seconds: elapsed,
        char_count: a.answer.trim().length,
        rerecord_count: 0,
      });
    });
    track("form_complete", {
      consulate: profile.consulate_city,
      country: profile.consulate_country,
      degree_level: profile.degree_level,
      gpa_band: gpaBandOf(profile.gpa, profile.gpa_scale),
      funding_type: profile.funding_source ? "stated" : "blank",
      attempt_n: Number(profile.attempt_number) || 1,
      round: round + 1,
    });
    track("test_complete", { total_seconds: elapsed });

    setBusy(true);
    try {
      const payload = {
        ...profile,
        major: showPrior ? profile.major.trim() : "",
        attempt_number: Number(profile.attempt_number) || 1,
        planned_answers: planned,
      };
      setResult(await evaluateProfile(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const country = profile.consulate_country.trim().toLowerCase();
  const thinComparables = country && country !== "india";

  return (
    <div className="vz">
      <div className="page-w ev">
        <h1>Check my profile</h1>
        <p className="sub" style={{ marginBottom: 18 }}>
          Your answers are scored against comparable interviews from the corpus.
        </p>

        {status.checking ? (
          <div className="caveat">Checking the evaluator…</div>
        ) : status.available ? (
          <div className="caveat">
            Connected to the evaluator. Your answers are scored against comparable
            interviews from the corpus.
          </div>
        ) : (
          <div className="caveat bad">
            <strong>The evaluator is unavailable.</strong>{" "}
            {status.detail || "The visa-llm service is not reachable."} You can still
            fill this in, but answers cannot be scored right now.
          </div>
        )}

        {/* The corpus is overwhelmingly Indian consulates; anyone else deserves
            to know that before reading the output. */}
        {thinComparables && (
          <div className="caveat">
            <strong>Limited comparables for your country.</strong> Most interviews in this
            dataset are from Indian consulates, and their GPAs are on a 10-point scale.
            Your answers are still evaluated, but the statistics and retrieved examples
            come mainly from Indian applicants — weigh them accordingly.
          </div>
        )}

        {result ? (
          <Evaluation
            ev={result}
            round={round}
            hasNext={hasNextRound}
            onNext={nextRound}
          />
        ) : (
        <form onSubmit={submit}>
          <div className="vz-card">
            <h2>Your profile</h2>
            <p className="sub">
              Use your real details — the tool is built to help you say true things clearly.
              <em> Course</em> is the program you are going to study.
            </p>

            <div className="ev-grid">
              <Field label="Consulate city" value={profile.consulate_city} onChange={set("consulate_city")} />
              <Field label="Country" value={profile.consulate_country} onChange={set("consulate_country")} />
              <Field label="University" value={profile.university} onChange={set("university")} />
              <Field label="Course in the US" value={profile.course} onChange={set("course")} />

              <label className="ev-f">
                <span className="fl">Degree level</span>
                <select value={profile.degree_level} onChange={set("degree_level")}>
                  {["Bachelor", "Masters", "MBA", "PhD"].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>

              {showPrior && (
                <Field
                  label="Undergraduate major"
                  hint="What you already studied"
                  value={profile.major}
                  onChange={set("major")}
                />
              )}

              <Field label="GPA" value={profile.gpa} onChange={set("gpa")} />

              <label className="ev-f">
                <span className="fl">Grading scale</span>
                <select value={profile.gpa_scale} onChange={set("gpa_scale")}>
                  {SCALES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>

              <Field label="Work experience" value={profile.work_experience} onChange={set("work_experience")} />
              <Field label="Funding" value={profile.funding_source} onChange={set("funding_source")} />
              <Field label="Attempt number" value={profile.attempt_number} onChange={set("attempt_number")} />
            </div>
          </div>

          <div className="vz-card">
            <h2>Your answers</h2>
            <p className="sub">
              Round {round + 1} · questions {round * PER_ROUND + 1}–
              {round * PER_ROUND + answers.length} of {pool.length}. These are the
              questions officers ask most often, in that order. Say what you would
              really say.
            </p>

            {answers.map((row, i) => (
              <div className="ev-qa" key={`${round}-${i}`}>
                <p className="ev-q">{row.question}</p>
                {row.share != null && (
                  <p className="ev-q-share">
                    Asked in {(row.share * 100).toFixed(1)}% of interviews
                  </p>
                )}
                <span className="fl">Your answer</span>
                <textarea rows={3} value={row.answer} onChange={setAnswer(i)} />
              </div>
            ))}
          </div>

          {error && <div className="caveat bad">{error}</div>}

          <button className="ev-submit" disabled={busy || !status.available}>
            {busy ? "Retrieving comparable interviews and evaluating…" : "Score these answers"}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, value, onChange }) {
  return (
    <label className="ev-f">
      <span className="fl">{label}</span>
      <input value={value} onChange={onChange} placeholder={hint || ""} />
    </label>
  );
}

const tone = (v) => (v === "strong" ? "ok" : v === "weak" || v === "needs_work" ? "bad" : "");

/*
 * The evaluator cites its sources the way the corpus stores them: opaque
 * interview ids and raw sample counts. Both are bookkeeping — a reader cannot
 * look up "b2448163604f", and "n=4,499" says nothing the percentage beside it
 * does not. Strip them on the way to the page and keep every percentage.
 *
 * This scrubs generated prose, so an unusual phrasing can slip through; the
 * durable fix is to stop the model emitting them in visa-llm's prompts.
 */
const ID = "[0-9a-f]{12}";
// Digits with thousands separators only, so "n=2,339" reads as one number
// rather than "2" followed by a comma.
const NUM = "\\d+(?:,\\d{3})*";
const rx = (body) => new RegExp(body, "g");

function scrub(text) {
  if (typeof text !== "string" || !text) return text;
  let t = text;

  // Sample counts in n= notation, whether or not they share a parenthetical.
  t = t.replace(rx(`\\(\\s*n\\s*=\\s*${NUM}\\s*,\\s+`), "(");
  t = t.replace(rx(`,\\s*n\\s*=\\s*${NUM}\\s*\\)`), ")");
  t = t.replace(rx(`\\s*\\(\\s*n\\s*=\\s*${NUM}\\s*\\)`), "");
  t = t.replace(rx(`\\s*\\bn\\s*=\\s*${NUM},?`), "");

  // The same statistic written as prose. Any percentage that trailed the count
  // is kept; the sentence goes only when it carried none.
  t = t.replace(rx(`\\bAsked in ${NUM} interviews\\s*\\(\\s*approval`), "(Approval");
  t = t.replace(rx(`\\bAsked in ${NUM} interviews\\.\\s*`), "");
  t = t.replace(rx(`\\bof ${NUM} decided\\b`), "of decided posts");
  t = t.replace(rx("\\(Approval([^)]*)\\)\\."), "Approval$1.");

  // Interview ids, counted so the surrounding sentence still parses.
  t = t.replace(rx(`\\bBoth\\s+${ID}\\s+and\\s+${ID}\\b`), "Two comparable interviews");
  t = t.replace(rx(`\\b${ID}(,\\s*${ID})+\\s+and\\s+${ID}\\b`), "three comparable interviews");
  t = t.replace(rx(`\\b${ID}\\s+and\\s+${ID}\\b`), "two comparable interviews");
  t = t.replace(rx(`\\b${ID}\\b`), "one comparable interview");
  // "In record <id>" leaves a stray "record" once the id is a phrase.
  t = t.replace(rx("\\b(?:record|post|interview)s?\\s+(one|two|three) comparable"), "$1 comparable");

  // The tag the model attaches to a cited interview — "(Mumbai, bachelor's,
  // second attempt, approved)". It is filing metadata, not something a reader
  // needs, and it is the densest part of the sentence.
  t = t.replace(rx("(comparable interviews?)\\s*\\([^()]*\\)"), "$1");

  // Internal question-type keys read as code. "why_university" -> "why university".
  t = t.replace(rx("\\b[a-z]{2,}(?:_[a-z]{2,}){1,3}\\b"), (m) => m.replace(/_/g, " "));

  t = t.replace(rx("\\(\\s*\\)"), "");
  t = t.replace(rx("\\s+([,.;:%)])"), "$1");
  t = t.replace(rx("\\s{2,}"), " ");
  return t.trim();
}

const scrubList = (xs) => (xs || []).map(scrub);

function Evaluation({ ev, round, hasNext, onNext }) {
  return (
    <div className="ev-result">
      <p className="sub">Round {round + 1} · your report</p>
      <div className="vz-card">
        <h2>
          Readiness: <span className={tone(ev.readiness)}>{ev.readiness.replace("_", " ")}</span>
        </h2>
        <p>{scrub(ev.summary)}</p>
      </div>

      {ev.answer_feedback?.length > 0 && (
        <div className="vz-card">
          <h2>Your answers</h2>
          {ev.answer_feedback.map((f, i) => (
            <div className="ev-fb" key={i}>
              <div className={`verdict ${tone(f.verdict)}`}>{f.verdict}</div>
              <p className="q">{f.question}</p>
              {f.strengths?.length > 0 && (
                <ul>{scrubList(f.strengths).map((s, j) => <li key={j}>{s}</li>)}</ul>
              )}
              {f.risks?.length > 0 && (
                <ul className="risks">{scrubList(f.risks).map((s, j) => <li key={j}>{s}</li>)}</ul>
              )}
              <p><strong>Suggested:</strong> {scrub(f.suggested_revision)}</p>
            </div>
          ))}
        </div>
      )}

      {ev.likely_questions?.length > 0 && (
        <div className="vz-card">
          <h2>Likely questions for your profile</h2>
          {ev.likely_questions.map((q, i) => (
            <div className="ev-fb" key={i}>
              <div className="verdict">
                {q.question_type.replace(/_/g, " ")} · {q.asked_in_share}
              </div>
              <p className="q">“{scrub(q.example_question)}”</p>
              <p className="sub">{scrub(q.why_likely)}</p>
              <p><strong>Prepare:</strong> {scrub(q.how_to_prepare)}</p>
            </div>
          ))}
        </div>
      )}

      {ev.risk_factors?.length > 0 && (
        <div className="vz-card">
          <h2>Risk factors</h2>
          {ev.risk_factors.map((r, i) => (
            <div className="ev-fb" key={i}>
              <div className={`verdict ${r.severity === "high" ? "bad" : ""}`}>{r.severity}</div>
              <p className="q">{scrub(r.factor)}</p>
              <p className="sub">{scrub(r.evidence)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="caveat">{scrub(ev.caveat)}</div>

      {hasNext ? (
        <button type="button" className="ev-submit" onClick={onNext}>
          Next {PER_ROUND} questions →
        </button>
      ) : (
        <p className="sub">
          That is the last question in this set. Start again from the top whenever
          you want another pass.
        </p>
      )}
    </div>
  );
}
