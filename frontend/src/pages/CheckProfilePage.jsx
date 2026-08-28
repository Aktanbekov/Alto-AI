import { useState, useEffect, useRef } from "react";
import { getEvaluateStatus, evaluateProfile, getMe, getQuestionBank, getAccess } from "../api";
import { track, trackScrollDepth, gpaBandOf } from "../analytics";
import FeedbackRating from "../components/validation/FeedbackRating";
import FeedbackCard from "../components/validation/FeedbackCard";
import AccessScreen from "../components/validation/AccessScreen";
import SurveyFlow from "../components/validation/SurveyFlow";

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
// instead of dead-ending after one round with no way forward. Typed like bank
// entries so the same topic spreading applies to them.
const FALLBACK_QUESTIONS = [
  ["sponsor_occupation", "What does your father do?"],
  ["funding_sponsor", "Who is sponsoring your education?"],
  ["funding_general", "How are you going to fund your education?"],
  ["universities_applied", "How many universities did you apply to?"],
  ["why_university", "Why did you choose this university?"],
  ["which_course", "Which course are you going to study?"],
  ["undergrad_background", "What is your undergraduate background?"],
  ["graduation_year", "When did you graduate?"],
  ["post_grad_plans", "What will you do after graduation?"],
  ["relatives_in_us", "Do you have any relatives in the US?"],
  ["sponsor_income", "What is your father's annual income?"],
  ["why_usa", "Why not study this in your home country?"],
].map(([question_type, q]) => ({ question_type, examples: [q] }));

/*
 * The corpus splits questions finer than an applicant hears them. "Who is
 * sponsoring you?" and "How are you going to fund the education?" are two
 * types by frequency and one question by ear, and they sit next to each other
 * at the top of the bank — so a round taken straight off the top asks the same
 * thing twice and wastes a third of the test.
 *
 * Grouping the types into topics lets a round hold three topics rather than
 * three rows of a frequency table. A type missing here is its own topic, so a
 * rebuilt corpus that adds types still spreads sensibly.
 */
const TOPIC = {
  sponsor_occupation: "funding", funding_sponsor: "funding",
  funding_general: "funding", funding_loan: "funding",
  sponsor_income: "funding", tuition_cost: "funding",
  scholarship: "funding", business_details: "funding",

  family_details: "family", relatives_in_us: "family", ties_to_home: "family",

  undergrad_background: "academics", graduation_year: "academics",
  academics_scores: "academics", gap_year: "academics",

  work_experience: "work", job_relevance: "work",

  which_university: "university", why_university: "university",
  university_knowledge: "university", universities_applied: "university",
  accommodation: "university",

  which_course: "course", why_course: "course", program_details: "course",
  course_value: "course", professors_research: "course", intake_travel: "course",

  post_grad_plans: "plans", return_intent: "plans", job_prospects_home: "plans",

  why_usa: "intent", why_choice_other: "intent",
  purpose_of_travel: "intent", confirm_plan: "intent",

  prior_visa_history: "history",
  open_ended: "open",
};

const topicOf = (entry) => {
  const type = typeof entry === "string" ? entry : entry.question_type;
  return TOPIC[type] || type || "";
};

// Reorder the bank so each round of `size` covers `size` different topics,
// otherwise keeping the frequency order the bank arrives in: at every slot,
// take the most-asked question whose topic this round has not used yet. The
// skipped ones are not dropped, they fall to the next round that has room for
// their topic. When only one topic is left, order stands — a late repeat beats
// losing the question.
function spreadTopics(entries, size) {
  const remaining = [...entries];
  const ordered = [];
  while (remaining.length) {
    const used = new Set();
    for (let slot = 0; slot < size && remaining.length; slot++) {
      let i = remaining.findIndex((e) => !used.has(topicOf(e)));
      if (i < 0) i = 0;
      const [picked] = remaining.splice(i, 1);
      used.add(topicOf(picked));
      ordered.push(picked);
    }
  }
  return ordered;
}

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

// The three questions a round shows, clamped to what the pool can serve: a
// resumed round can outrun the short fallback pool, and three empty rows would
// be worse than starting over.
function roundQuestions(pool, round) {
  const start = round * PER_ROUND;
  const from = start < pool.length ? start : 0;
  return pool.slice(from, from + PER_ROUND).map(toRound);
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

/*
 * The gate falls in the middle of the flow. A guest finishes their free round,
 * asks for the next three questions, and is sent to sign up — so coming back
 * has to hand them the round they asked for, with the eleven profile fields
 * they already typed still filled in. Without this the round-trip drops them
 * on question one of a blank form, which reads as the sign-up having eaten
 * their work.
 *
 * sessionStorage, not localStorage: this is one sitting's progress, and a
 * shared browser should not hand the next person someone's profile.
 */
const RESUME_KEY = "alto.check_profile.resume";

function readResume() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RESUME_KEY) || "null");
    if (!saved || typeof saved !== "object") return null;
    const round = Number(saved.round);
    if (!Number.isInteger(round) || round < 0) return null;
    return { round, profile: { ...EMPTY, ...(saved.profile || {}) } };
  } catch {
    // Private browsing, a disabled store, a half-written value — none of it is
    // worth failing the page over. Start fresh.
    return null;
  }
}

function saveResume(state) {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify(state));
  } catch {
    // Progress is a convenience; losing it is not an error worth showing.
  }
}

const FALLBACK_POOL = spreadTopics(FALLBACK_QUESTIONS, PER_ROUND);

export default function CheckProfilePage() {
  // Read once per mount, before the state below is seeded from it.
  const resume = useRef(readResume());
  const [profile, setProfile] = useState(() => resume.current?.profile || EMPTY);
  const [pool, setPool] = useState(FALLBACK_POOL);
  const [answers, setAnswers] = useState(() =>
    roundQuestions(FALLBACK_POOL, resume.current?.round || 0)
  );
  const [round, setRound] = useState(() => resume.current?.round || 0);
  const [status, setStatus] = useState({ checking: true, available: false, detail: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  /*
   * How many sets are left, which short prompt is due, and whether the survey
   * and waitlist are behind them — all from the server, never inferred here.
   *
   * The page could guess most of it from `round`, and would be wrong the moment
   * someone opens a second tab, signs in, or comes back tomorrow. "Have I
   * already been asked this" and "have I already unlocked" are exactly the
   * questions a client-side guess gets wrong in the user's favour once and in
   * their disfavour forever after.
   */
  const [access, setAccess] = useState(null);
  const [showSurvey, setShowSurvey] = useState(false);

  /*
   * The prompt currently on screen, latched.
   *
   * The server stops naming a prompt the moment it is answered, which is right
   * for deciding whether to ask — but the card has a thank-you to show, and
   * rendering straight off the server state swapped it away in the same frame
   * it appeared. So the page holds on to the prompt it is showing until the
   * next round, and lets the card run its own course.
   */
  const [activePrompt, setActivePrompt] = useState("");
  const [promptDone, setPromptDone] = useState(false);

  useEffect(() => {
    getEvaluateStatus()
      .then((s) => {
        setStatus({ checking: false, available: !!s.available, detail: s.detail || "" });
        if (s.access) setAccess(s.access);
      })
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
        const spread = spreadTopics(entries, PER_ROUND);
        setPool(spread);
        // A resumed round is only meaningful against the real bank, and the
        // fallback pool is shorter — so the round is settled here, once the
        // real one has arrived, and clamped if it points past the end.
        const start = (resume.current?.round || 0) * PER_ROUND;
        const from = start < spread.length ? start : 0;
        setRound(from / PER_ROUND);
        setAnswers(spread.slice(from, from + PER_ROUND).map(toRound));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Keep the sitting's progress current, so a gate at any point — this round
  // or the next — comes back to where the person actually was.
  useEffect(() => { saveResume({ round, profile }); }, [round, profile]);

  /*
   * Start where the server says they left off.
   *
   * The round counter is local and starts at zero, but someone coming back
   * tomorrow — or after unlocking — has sets behind them that this page knows
   * nothing about. Without this they are handed questions they have already
   * answered, and the sets they paid a survey for go on the same three.
   *
   * Only for a fresh arrival: a resumed sitting already carries its own round,
   * and a round in progress must not be yanked out from under a report.
   */
  const aligned = useRef(false);
  useEffect(() => {
    if (aligned.current || !access || result) return;
    aligned.current = true;
    // Whichever is further along. The resumed sitting knows where they were
    // mid-round; the server knows what they have actually scored, including
    // from another tab or a session this page never saw. Taking the larger of
    // the two is what stops a reload handing back questions already answered.
    const start = Math.max(resume.current?.round || 0, access.sets_used || 0);
    if (start <= 0 || start * PER_ROUND >= pool.length) return;
    setRound(start);
    setAnswers(roundQuestions(pool, start));
  }, [access, pool, result]);

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
  //
  // No gate here any more. Whether they have a set left is the server's call and
  // it is made on submit; asking again at this point would only add a round trip
  // and a second place for the two answers to disagree.
  const nextRound = async () => {
    setActivePrompt("");
    setPromptDone(false);
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
        // Which set this is, so re-scoring one after a refresh does not spend
        // another allowance.
        set_index: round,
      };
      setResult(await evaluateProfile(payload));
      // The report is on screen; what comes underneath it depends on a count
      // only the server keeps, so ask before rendering the next step.
      refreshAccess();
    } catch (err) {
      if (err.code === "sets_exhausted") {
        // Not an error to apologise for — it is the access screen's cue.
        refreshAccess();
        return;
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const refreshAccess = () => {
    getAccess().then(setAccess).catch(() => {});
  };

  const promptAnswered = () => {
    setPromptDone(true);
    refreshAccess();
  };

  const country = profile.consulate_country.trim().toLowerCase();
  const thinComparables = country && country !== "india";

  // Out of sets, by the server's count. Until the first access call lands we
  // assume they have sets — the form is the right thing to show while we do not
  // know, and the submit itself is still enforced server-side.
  const outOfSets = !!access && access.sets_remaining <= 0;
  const prompt = access?.next_prompt || "";

  // Latch it once per round, so answering does not unmount the card mid-thanks.
  useEffect(() => {
    if (prompt && !activePrompt) setActivePrompt(prompt);
  }, [prompt, activePrompt]);

  /*
   * What follows the report, in order of what is owed to whom.
   *
   * The short prompt comes first when one is due: it is asked once, and asking
   * it after the access screen would mean asking someone who has just been told
   * they are out of sets. Then the access screen if the allowance is spent, and
   * otherwise the button for the next three questions.
   */
  let nextAction;
  if (outOfSets) {
    nextAction = (
      <AccessScreen
        access={access}
        onStartSurvey={() => setShowSurvey(true)}
        onWaitlistJoined={refreshAccess}
      />
    );
  } else if (hasNextRound) {
    nextAction = (
      <button type="button" className="ev-submit" onClick={nextRound}>
        Next {PER_ROUND} questions →
      </button>
    );
  } else {
    nextAction = (
      <p className="sub">
        That is the last question in this set. Start again from the top whenever
        you want another pass.
      </p>
    );
  }

  let afterReport;
  if (activePrompt === "rating" || activePrompt === "detail") {
    const Card = activePrompt === "rating" ? FeedbackRating : FeedbackCard;
    afterReport = (
      <>
        <Card setIndex={round} onDone={promptAnswered} />
        {/* Once they have answered or skipped, the way on appears beneath the
            card rather than in place of it, so the thank-you is readable. */}
        {promptDone && nextAction}
      </>
    );
  } else {
    afterReport = nextAction;
  }

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

        {showSurvey ? (
          <SurveyFlow
            onUnlocked={(next) => { if (next) setAccess(next); else refreshAccess(); }}
            onContinue={() => { setShowSurvey(false); setResult(null); nextRound(); }}
            onCancel={() => setShowSurvey(false)}
          />
        ) : result ? (
          <Evaluation ev={result} round={round} footer={afterReport} />
        ) : outOfSets ? (
          <AccessScreen
            access={access}
            onStartSurvey={() => setShowSurvey(true)}
            onWaitlistJoined={refreshAccess}
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
              questions officers ask most often, most-asked first, with each round
              spread across different topics. Say what you would really say.
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

function Evaluation({ ev, round, footer }) {
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

      {/* Whatever comes next — a feedback prompt, the access screen, or the
          button for the next three questions. The report above is rendered and
          complete before any of it, which is the one rule this flow has. */}
      {footer}
    </div>
  );
}
