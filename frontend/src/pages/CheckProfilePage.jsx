import { useState, useEffect, useRef } from "react";
import {
  getEvaluateStatus, evaluateProfile, getQuestionBank, getAccess,
  getAdminMe, compareModels, getCorpusStats,
} from "../api";
import { useCurrentUser } from "../components/ProtectedRoute";
import { TEST_PROFILE, testAnswerFor } from "../data/testProfile";
import { askAs } from "../data/questionPhrasing";
import ModelCompare from "../components/admin/ModelCompare";
import { track, trackScrollDepth, gpaBandOf } from "../analytics";
import FeedbackRating from "../components/validation/FeedbackRating";
import FeedbackCard from "../components/validation/FeedbackCard";
import AccessScreen from "../components/validation/AccessScreen";
import SurveyFlow from "../components/validation/SurveyFlow";
import { questionLabel } from "../data/questionLabels";
import { SMALL_N } from "../components/charts/useChartWidth";
import Arrow from "../components/ui/Arrow";

/*
 * The profile evaluator, ported from visa-llm's own Evaluate view.
 *
 * It posts to /api/v1/evaluate, which fans the same grounded prompt out to
 * three providers through the visa-llm sidecar. Every report receives the same
 * retrieved interviews and precomputed corpus statistics; a student is sent
 * one of them, an admin all three.
 */

// Questions come three at a time from the corpus bank, walked in order of how
// often officers ask each type. The applicant does not choose them - the point
// of the test is to face what actually gets asked, not what you have an answer
// for ready.
const PER_ROUND = 3;

// A backend can roll out a little after its Vercel frontend. The old endpoint
// returned one evaluation directly; the new endpoint returns model-result rows.
// Normalize both shapes so a mixed-version deploy still shows the report.
const evaluationRows = (response) => {
  if (Array.isArray(response?.results)) return response.results;
  if (response && typeof response === "object") {
    return [{ model: "report", evaluation: response }];
  }
  return [];
};

// Used when the corpus bank cannot be fetched - an old server without the
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
 * at the top of the bank - so a round taken straight off the top asks the same
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
// their topic. When only one topic is left, order stands - a late repeat beats
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
  { value: "", label: "Choose a scale" },
  { value: "4", label: "Out of 4.0 (US and similar)" },
  { value: "4.3", label: "Out of 4.3" },
  { value: "5", label: "Out of 5.0" },
  { value: "10", label: "Out of 10 (India CGPA)" },
  { value: "100", label: "Percentage (out of 100)" },
];

const ATTEMPTS = [
  { value: "1", label: "First attempt" },
  { value: "2", label: "Second attempt" },
  { value: "3", label: "Third attempt" },
  { value: "4", label: "Fourth or later" },
];

// Consulate city -> country, so nobody is asked for both. Matched on the
// lower-cased city; anything not listed can still be typed under "Add more
// detail". Only cities with a US embassy or consulate that issues student visas.
const CITY_COUNTRY = {
  "new delhi": "India", delhi: "India", mumbai: "India", hyderabad: "India",
  chennai: "India", kolkata: "India",
  tashkent: "Uzbekistan", almaty: "Kazakhstan", astana: "Kazakhstan",
  bishkek: "Kyrgyzstan", dushanbe: "Tajikistan", ashgabat: "Turkmenistan",
  "abu dhabi": "UAE", dubai: "UAE", dhaka: "Bangladesh", kathmandu: "Nepal",
  colombo: "Sri Lanka", islamabad: "Pakistan", karachi: "Pakistan", lahore: "Pakistan",
  lagos: "Nigeria", abuja: "Nigeria", accra: "Ghana", nairobi: "Kenya",
  cairo: "Egypt", istanbul: "Turkey", ankara: "Turkey", riyadh: "Saudi Arabia",
  jeddah: "Saudi Arabia", dhahran: "Saudi Arabia", hanoi: "Vietnam",
  "ho chi minh city": "Vietnam", manila: "Philippines", jakarta: "Indonesia",
  surabaya: "Indonesia", beijing: "China", shanghai: "China", guangzhou: "China",
  shenyang: "China", seoul: "South Korea", tokyo: "Japan", taipei: "Taiwan",
  "kuala lumpur": "Malaysia", bangkok: "Thailand", "mexico city": "Mexico",
  "sao paulo": "Brazil", "são paulo": "Brazil", bogota: "Colombia", "bogotá": "Colombia",
};
const countryFor = (city) => CITY_COUNTRY[city.trim().toLowerCase()] || "";

const DEGREES = [
  { value: "Bachelor", label: "Bachelor's" },
  { value: "Masters", label: "Master's" },
  { value: "MBA", label: "MBA" },
  { value: "PhD", label: "PhD" },
];

// The two short profile steps that come before the questions.
const PROFILE_STEPS = 2;
const profileStarted = (p) =>
  Boolean(p && (p.university || p.course || p.consulate_city || p.funding_source));

const EMPTY = {
  consulate_city: "", consulate_country: "", university: "", course: "",
  major: "", degree_level: "Bachelor", gpa: "", gpa_scale: "",
  work_experience: "", funding_source: "", attempt_number: "1",
};

/*
 * A reload, or the survey that unlocks more rounds, should hand the person
 * back the round they were on with the profile and answers they already typed
 * still filled in, not question one of a blank form.
 *
 * Answers are kept by question type, so they come back on whichever round the
 * question lands on once the real bank has loaded. The scoring error message
 * tells people their answers are saved; this is what makes that true on their
 * side of the connection too.
 *
 * sessionStorage, not localStorage: this is one sitting's progress, and a
 * shared browser should not hand the next person someone's profile. For the
 * same reason it is stamped with the account it belongs to and ignored for any
 * other, and signing out wipes it (utils/tokenStorage.js).
 */
const RESUME_KEY = "alto.check_profile.resume";

function readResume(owner) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RESUME_KEY) || "null");
    if (!saved || typeof saved !== "object" || !owner || saved.owner !== owner) return null;
    const round = Number(saved.round);
    if (!Number.isInteger(round) || round < 0) return null;
    const drafts = saved.drafts && typeof saved.drafts === "object" ? saved.drafts : {};
    return { round, profile: { ...EMPTY, ...(saved.profile || {}) }, drafts };
  } catch {
    // Private browsing, a disabled store, a half-written value - none of it is
    // worth failing the page over. Start fresh.
    return null;
  }
}

function saveResume(owner, state) {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ owner, ...state }));
  } catch {
    // Progress is a convenience; losing it is not an error worth showing.
  }
}

const FALLBACK_POOL = spreadTopics(FALLBACK_QUESTIONS, PER_ROUND);

const draftKey = (row) => row.question_type || row.question;

const GPA_SCALE_MESSAGE =
  "Choose what your grades are out of. A number on its own is ambiguous - 3.5 out of 4 " +
  "is strong, 3.5 out of 10 is not. Or clear the grades box.";

// What a failed request should say. The server's own messages are already
// written for students; a dropped connection only has the browser's.
function plainError(err) {
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(err?.message || "")) {
    return "We couldn't reach Altovisas. Check your connection and try again - your answers are still here.";
  }
  return err?.message || "Something went wrong while checking your answers. Try again in a moment.";
}

/*
 * How much of the corpus stands behind a comparison for this consulate.
 * Matched on the city first, then the country; null until the statistics load
 * or while neither field says anything.
 */
function coverageFor(stats, city, country) {
  if (!stats) return null;
  const find = (table, name) => {
    const key = name.trim().toLowerCase();
    if (!key) return null;
    const hit = Object.entries(table || {}).find(([k]) => k.toLowerCase() === key);
    return hit ? { name: hit[0], ...hit[1] } : null;
  };
  const byCity = find(stats.by_city, city);
  if (byCity) return { kind: "city", ...byCity };
  const byCountry = find(stats.by_country, country);
  if (byCountry) return { kind: "country", city: city.trim(), ...byCountry };
  if (city.trim() || country.trim()) return { kind: "none", name: city.trim() || country.trim() };
  return null;
}

function CoverageNote({ coverage }) {
  if (!coverage) return null;
  const n = coverage.n_decided?.toLocaleString();
  if (coverage.kind === "city") {
    return (
      <p className="pc-cover" role="status">
        <strong>{n} interviews</strong> from {coverage.name} in the data.
        {coverage.n_decided < SMALL_N && " That is a thin comparison - read the numbers in your report with that in mind."}
      </p>
    );
  }
  if (coverage.kind === "country") {
    return (
      <p className="pc-cover" role="status">
        {coverage.city ? <>No interviews from {coverage.city} in the data yet. </> : null}
        <strong>{n} interviews</strong> from {coverage.name} overall.
        {coverage.n_decided < SMALL_N && " That is a thin comparison - read the numbers in your report with that in mind."}
      </p>
    );
  }
  return (
    <p className="pc-cover" role="status">
      Few or no interviews from {coverage.name} in the data yet. Your answers are still
      checked, but the comparisons lean on other consulates, mostly in India.
    </p>
  );
}

export default function CheckProfilePage() {
  // The route is behind ProtectedRoute, so the account is known at mount.
  const user = useCurrentUser();
  const owner = (user?.email || "").toLowerCase();
  // Read once per mount, before the state below is seeded from it.
  const resume = useRef(readResume(owner));
  const drafts = useRef(resume.current?.drafts || {});
  const withDrafts = (rows) =>
    rows.map((row) => ({ ...row, answer: row.answer || drafts.current[draftKey(row)] || "" }));

  const [profile, setProfile] = useState(() => resume.current?.profile || EMPTY);
  const [pool, setPool] = useState(FALLBACK_POOL);
  const [answers, setAnswers] = useState(() =>
    withDrafts(roundQuestions(FALLBACK_POOL, resume.current?.round || 0))
  );
  const [round, setRound] = useState(() => resume.current?.round || 0);
  const [status, setStatus] = useState({ checking: true, available: false, detail: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  // What was sent for the report on screen, so the report can quote it back.
  const [submitted, setSubmitted] = useState([]);
  const [stats, setStats] = useState(null);

  /*
   * How many rounds are left, which short prompt is due, and whether the survey
   * and waitlist are behind them - all from the server, never inferred here.
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
   * for deciding whether to ask - but the card has a thank-you to show, and
   * rendering straight off the server state swapped it away in the same frame
   * it appeared. So the page holds on to the prompt it is showing until the
   * next round, and lets the card run its own course.
   */
  const [activePrompt, setActivePrompt] = useState("");
  const [promptDone, setPromptDone] = useState(false);

  // Admins get a button that fills the form with a sample applicant, because
  // testing a scoring change means retyping eleven fields and three answers
  // otherwise. Everyone else never learns it exists.
  const [isAdmin, setIsAdmin] = useState(false);
  // Set while a three-model run is in flight, then holds its rows.
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);

  /*
   * Which step of the form is on screen: two short profile steps, then one
   * question per step. Someone resuming a sitting with a profile already
   * filled in starts at the first question, not at the top of the form.
   */
  const [step, setStep] = useState(() =>
    profileStarted(resume.current?.profile) ? PROFILE_STEPS : 0
  );
  const [stepError, setStepError] = useState("");
  const stepMoved = useRef(false);
  useEffect(() => {
    // Not on first render: arriving on the page should not jump the focus.
    if (!stepMoved.current) { stepMoved.current = true; return; }
    const answer = document.getElementById(`pc-a${step - PROFILE_STEPS}`);
    (answer || document.getElementById("pc-step-h"))?.focus({ preventScroll: true });
    const top = document.querySelector(".pc-flow")?.getBoundingClientRect().top ?? 0;
    if (top < 0) scrollTo({ top: Math.max(0, scrollY + top - 16), behavior: "smooth" });
  }, [step]);

  useEffect(() => {
    getEvaluateStatus()
      .then((s) => {
        setStatus({ checking: false, available: !!s.available, detail: s.detail || "" });
        if (s.access) setAccess(s.access);
      })
      .catch((err) => setStatus({ checking: false, available: false, detail: err.message }));
  }, []);

  // The corpus statistics, for the coverage line under the consulate fields
  // and in the report. The page works without them; the line just stays away.
  useEffect(() => {
    let cancelled = false;
    getCorpusStats().then((s) => !cancelled && setStats(s)).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // The bank is a static corpus file, so one fetch covers every round. On
  // failure the fallback pool already in state stands in - the rounds keep
  // working, they are just shorter and carry no asked-in percentages.
  useEffect(() => {
    let cancelled = false;
    getQuestionBank()
      .then((entries) => {
        if (cancelled || !Array.isArray(entries) || !entries.length) return;
        const spread = spreadTopics(entries, PER_ROUND);
        setPool(spread);
        // A resumed round is only meaningful against the real bank, and the
        // fallback pool is shorter - so the round is settled here, once the
        // real one has arrived, and clamped if it points past the end.
        const start = (resume.current?.round || 0) * PER_ROUND;
        const from = start < spread.length ? start : 0;
        setRound(from / PER_ROUND);
        setAnswers(withDrafts(spread.slice(from, from + PER_ROUND).map(toRound)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Keep the sitting's progress current, so a gate at any point - this round
  // or the next - comes back to where the person actually was.
  useEffect(() => {
    answers.forEach((row) => {
      const key = draftKey(row);
      if (row.answer) drafts.current[key] = row.answer;
      else delete drafts.current[key];
    });
    saveResume(owner, { round, profile, drafts: drafts.current });
  }, [owner, round, profile, answers]);

  /*
   * Start where the server says they left off.
   *
   * The round counter is local and starts at zero, but someone coming back
   * tomorrow - or after unlocking - has rounds behind them that this page knows
   * nothing about. Without this they are handed questions they have already
   * answered, and the rounds they paid a survey for go on the same three.
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
    setAnswers(withDrafts(roundQuestions(pool, start)));
  }, [access, pool, result]);

  // getAdminMe answers {is_admin:false} rather than throwing for everyone else,
  // so this is safe to call on every visit.
  useEffect(() => {
    let cancelled = false;
    getAdminMe()
      .then((res) => { if (!cancelled) setIsAdmin(!!res?.is_admin); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Prefill from the signed-in account so people do not retype what we know.
  useEffect(() => {
    if (!user) return;
    setProfile((p) => ({
      ...p,
      university: p.university || user.college || "",
      major: p.major || user.major || "",
    }));
  }, [user]);

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

  /*
   * Admin only: fill the whole form with a sample applicant.
   *
   * Answers are looked up by the corpus question_type rather than by position,
   * so this still produces sensible text on round four - the three questions on
   * screen change every round. Unknown types get the generic answer instead of
   * being left blank, which would fail the "answer at least one" check in a
   * confusing way.
   *
   * markStarted() is called deliberately. The fill is not a real form start,
   * but submitting afterwards fires form_complete regardless, and a funnel with
   * more completions than starts is harder to read than one extra test row.
   *
   * It fills only - it does not submit. Scoring costs a round and a model call,
   * and that stays an explicit click.
   */
  const fillWithTestData = () => {
    markStarted();
    setProfile({ ...EMPTY, ...TEST_PROFILE });
    setAnswers((a) => a.map((row) => ({ ...row, answer: testAnswerFor(row.question_type) })));
    setError("");
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
  // No gate here any more. Whether they have a round left is the server's call
  // and it is made on submit; asking again at this point would only add a round
  // trip and a second place for the two answers to disagree.
  const nextRound = async () => {
    setActivePrompt("");
    setPromptDone(false);
    setAnswers(withDrafts(pool.slice(nextStart, nextStart + PER_ROUND).map(toRound)));
    setRound((r) => r + 1);
    setResult(null);
    setSubmitted([]);
    setError("");
    setStep(PROFILE_STEPS);
    roundStartedAt.current = Date.now();
    scrollTo({ top: 0, behavior: "smooth" });
  };

  // Back to the same three questions with what they wrote, to change an answer
  // and check it again. Re-checking a round already used is free server-side.
  const editRound = () => {
    setActivePrompt("");
    setPromptDone(false);
    setResult(null);
    setError("");
    setStep(PROFILE_STEPS);
    scrollTo({ top: 0, behavior: "smooth" });
  };

  const showPrior = POSTGRAD.has(profile.degree_level);
  const country = profile.consulate_country.trim() || countryFor(profile.consulate_city);

  const plannedAnswers = () => answers
    .map((a) => ({ question: askAs(a, profile.degree_level).trim(), answer: a.answer.trim() }))
    .filter((a) => a.question && a.answer);

  /*
   * Admin only: score this round with all three models at once.
   *
   * Separate from submit() rather than a flag on it, because almost none of
   * what submit does applies here - no analytics funnel (this is not someone
   * taking the test), no round accounting (the server spends none), no resume
   * state. What it shares is the payload, built the same way so the comparison
   * measures the request students actually send.
   */
  const runComparison = async () => {
    const planned = plannedAnswers();
    if (!planned.length) {
      setError("Fill in at least one answer before comparing models.");
      return;
    }
    setError("");
    setComparing(true);
    try {
      const res = await compareModels({
        ...profile,
        consulate_country: country,
        major: showPrior ? profile.major.trim() : "",
        attempt_number: Number(profile.attempt_number) || 1,
        planned_answers: planned,
      });
      setSubmitted(planned);
      setComparison(res.results || []);
      scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(plainError(err));
    } finally {
      setComparing(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    Object.entries(profile).forEach(([field, value]) => {
      if (!String(value || "").trim()) track("form_field_skipped", { field_name: field });
    });

    const planned = plannedAnswers();

    if (!planned.length) {
      setError("Answer at least one of the three questions, then check again.");
      setStep(PROFILE_STEPS);
      return;
    }
    // A bare number is unusable: 3.5 is strong out of 4 and weak out of 10.
    if (profile.gpa.trim() && !profile.gpa_scale) {
      setStepError(GPA_SCALE_MESSAGE);
      setStep(0);
      return;
    }

    // One question_answered per answer, with how long and how much they wrote.
    // char_count is a length, not the text - the answer itself never leaves for
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
      country,
      degree_level: profile.degree_level,
      gpa_band: gpaBandOf(profile.gpa, profile.gpa_scale),
      funding_type: profile.funding_source ? "stated" : "blank",
      attempt_n: Number(profile.attempt_number) || 1,
      round: round + 1,
    });
    track("test_complete", { total_seconds: elapsed });

    setBusy(true);
    setSubmitted(planned);
    scrollTo({ top: 0, behavior: "smooth" });
    try {
      const payload = {
        ...profile,
        consulate_country: country,
        major: showPrior ? profile.major.trim() : "",
        attempt_number: Number(profile.attempt_number) || 1,
        planned_answers: planned,
        // Which round this is, so re-scoring one after a refresh does not
        // spend another allowance.
        set_index: round,
      };
      const response = await evaluateProfile(payload);
      setResult(evaluationRows(response));
      // The report is on screen; what comes underneath it depends on a count
      // only the server keeps, so ask before rendering the next step.
      refreshAccess();
    } catch (err) {
      if (err.code === "sets_exhausted") {
        // Not an error to apologise for - it is the access screen's cue.
        refreshAccess();
        return;
      }
      setError(plainError(err));
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

  const coverage = coverageFor(stats, profile.consulate_city, country);
  const cities = [...new Set([
    ...Object.keys(stats?.by_city || {}),
    ...Object.keys(CITY_COUNTRY).map((c) => c.replace(/\b\w/g, (ch) => ch.toUpperCase())),
  ])].sort();

  // Out of rounds, by the server's count. Until the first access call lands we
  // assume they have rounds - the form is the right thing to show while we do
  // not know, and the submit itself is still enforced server-side.
  const outOfSets = !!access && !access.unlimited && access.sets_remaining <= 0;
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
   * they are out of rounds. Then the access screen if the allowance is spent,
   * and otherwise the button for the next three questions.
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
      <div className="pc-next">
        <button type="button" className="ev-submit" onClick={nextRound}>
          Next three questions <Arrow />
        </button>
        <button type="button" className="pc-quiet" onClick={editRound}>
          Change an answer and check again
        </button>
      </div>
    );
  } else {
    nextAction = (
      <p className="sub">
        That was the last round of questions. Start again from the top whenever you
        want another pass.
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

  const roundsLeft = access && !access.unlimited && Number.isFinite(access.sets_remaining) ? access.sets_remaining : null;
  const reportFor = (ev) => (
    <Evaluation
      ev={ev}
      round={round}
      submitted={submitted}
      profile={profile}
      coverage={coverage}
    />
  );

  let body;
  if (showSurvey) {
    body = (
      <SurveyFlow
        onUnlocked={(next) => { if (next) setAccess(next); else refreshAccess(); }}
        onContinue={() => { setShowSurvey(false); setResult(null); nextRound(); }}
        onCancel={() => setShowSurvey(false)}
      />
    );
  } else if (comparison) {
    body = (
      <ModelCompare
        results={comparison}
        renderReport={reportFor}
        onBack={() => setComparison(null)}
      />
    );
  } else if (busy) {
    body = <Scoring planned={submitted} profile={profile} coverage={coverage} />;
  } else if (result) {
    // Admins get every model side by side; everyone else is sent one report.
    body = result.length > 1 ? (
      <ModelCompare
        results={result}
        showMetrics={false}
        intro="Admin view: every model's report on the same answers. Students see one."
        renderReport={(ev) => <>{reportFor(ev)}<div className="pc-after no-print">{afterReport}</div></>}
      />
    ) : result[0]?.evaluation ? (
      <>
        {reportFor(result[0].evaluation)}
        <div className="pc-after no-print">{afterReport}</div>
      </>
    ) : (
      <div className="caveat bad" role="alert">
        <strong>The report didn&rsquo;t come back.</strong> Your answers are still here -{" "}
        <button type="button" className="pc-inline" onClick={editRound}>go back and check again</button>.
      </div>
    );
  } else if (outOfSets) {
    body = (
      <AccessScreen
        access={access}
        onStartSurvey={() => setShowSurvey(true)}
        onWaitlistJoined={refreshAccess}
      />
    );
  } else {
    const totalSteps = PROFILE_STEPS + answers.length;
    const qIndex = step - PROFILE_STEPS;
    const row = qIndex >= 0 ? answers[qIndex] : null;
    const last = step >= totalSteps - 1;
    const stepName = step === 0 ? "Your study"
      : step === 1 ? "Your interview"
        : `Question ${qIndex + 1} of ${answers.length}`;
    const extraOpen = Boolean(
      profile.work_experience || profile.consulate_country || profile.attempt_number !== "1"
    );

    const goNext = (e) => {
      e.preventDefault();
      if (step === 0 && profile.gpa.trim() && !profile.gpa_scale) {
        setStepError(GPA_SCALE_MESSAGE);
        return;
      }
      setStepError("");
      setError("");
      setStep((n) => Math.min(n + 1, totalSteps - 1));
    };
    const goBack = () => {
      setStepError("");
      setError("");
      setStep((n) => Math.max(0, n - 1));
    };

    body = (
      <form className="pc-flow" onSubmit={last ? submit : goNext} noValidate>
        {/* type="button" matters: inside a form, a bare button submits. */}
        {isAdmin && (
          <div className="ev-devbar">
            <span className="ev-devbar-tag">Admin</span>
            <button type="button" className="ev-devfill" onClick={fillWithTestData}>
              Fill with test data
            </button>
            <button
              type="button"
              className="ev-devfill"
              onClick={runComparison}
              disabled={comparing}
            >
              {comparing ? "Scoring with all three…" : "Compare 3 models"}
            </button>
            <span className="ev-devbar-note">
              Fill drops in a sample applicant. Compare scores this round with
              Claude Opus, GPT-5.6 Terra and DeepSeek V4 Pro at once &mdash; three model calls, no
              practice round spent, nothing stored.
            </span>
          </div>
        )}

        <div className="pc-progress">
          <p className="pc-step-of">
            <span>Step {step + 1} of {totalSteps}</span>
            <span aria-hidden="true"> · </span>
            <span>{round > 0 ? `Round ${round + 1} · ` : ""}{stepName}</span>
          </p>
          <div
            className="pc-track" role="progressbar" aria-label="Progress"
            aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step + 1}
          >
            <span style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
          </div>
        </div>

        <div className="pc-panel">
          {step === 0 && (
            <>
              <h2 id="pc-step-h" tabIndex={-1}>First, your study</h2>
              <p className="sub">
                This is how we find interviews like yours. Skip anything you don&rsquo;t know.
              </p>

              <fieldset className="pc-choice">
                <legend className="fl">What degree are you applying for?</legend>
                <div className="pc-seg">
                  {DEGREES.map((d) => (
                    <label key={d.value} className={profile.degree_level === d.value ? "on" : ""}>
                      <input
                        type="radio" name="degree_level" value={d.value}
                        checked={profile.degree_level === d.value}
                        onChange={set("degree_level")}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="pc-fields">
                <Field id="university" label="University" hint="e.g. Arizona State University"
                  value={profile.university} onChange={set("university")} autoComplete="organization" />
                <Field id="course" label="What you will study" hint="e.g. MS in Computer Science"
                  value={profile.course} onChange={set("course")} />
                {showPrior && (
                  <Field id="major" label="What you studied before" hint="e.g. B.Tech in Mechanical Engineering"
                    value={profile.major} onChange={set("major")} />
                )}
                <div className="pc-pair">
                  <Field id="gpa" label="Your grades" hint="e.g. 8.2" inputMode="decimal"
                    value={profile.gpa} onChange={set("gpa")} />
                  <Select id="gpa_scale" label="Out of" value={profile.gpa_scale}
                    onChange={set("gpa_scale")} options={SCALES} />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 id="pc-step-h" tabIndex={-1}>Your interview and funding</h2>
              <p className="sub">
                The consulate decides which officers&rsquo; questions we compare you with.
              </p>

              <div className="pc-fields">
                <div>
                  <Field id="consulate_city" label="Which consulate is your interview at?"
                    hint="e.g. Chennai" list="pc-cities"
                    value={profile.consulate_city} onChange={set("consulate_city")} />
                  <CoverageNote coverage={coverage} />
                </div>
                <Field id="funding_source" label="Who is paying for your degree?"
                  hint="e.g. My father's business savings and an education loan"
                  value={profile.funding_source} onChange={set("funding_source")} />
              </div>
              <datalist id="pc-cities">
                {cities.map((c) => <option key={c} value={c} />)}
              </datalist>

              <details className="pc-more" open={extraOpen}>
                <summary>Add more detail <span>(optional)</span></summary>
                <div className="pc-fields">
                  <Field id="work_experience" label="Work experience"
                    hint="e.g. 2 years as a data analyst, or none"
                    value={profile.work_experience} onChange={set("work_experience")} />
                  <Select id="attempt_number" label="Is this your first attempt?"
                    value={profile.attempt_number} onChange={set("attempt_number")} options={ATTEMPTS} />
                  <Field id="consulate_country" label="Consulate country"
                    hint={countryFor(profile.consulate_city)
                      ? `We'll use ${countryFor(profile.consulate_city)} unless you change it`
                      : "e.g. India"}
                    value={profile.consulate_country} onChange={set("consulate_country")}
                    autoComplete="country-name" />
                </div>
              </details>
            </>
          )}

          {row && (
            <>
              <label className="pc-q" htmlFor={`pc-a${qIndex}`}>
                {askAs(row, profile.degree_level)}
              </label>
              {row.share != null && (
                <p className="ev-q-share">
                  Asked in {Math.round(row.share * 100)}% of the interviews in the data
                </p>
              )}
              <textarea
                id={`pc-a${qIndex}`}
                className="pc-answer-box"
                rows={5}
                value={row.answer}
                onChange={setAnswer(qIndex)}
                aria-describedby={`pc-a${qIndex}-tip`}
              />
              <p className="fh" id={`pc-a${qIndex}-tip`}>
                Write what you would really say at the window. Two or three sentences is plenty.
                You can leave a question blank.
              </p>
            </>
          )}
        </div>

        {(stepError || error) && (
          <div className="caveat bad" role="alert">{stepError || error}</div>
        )}

        <div className="pc-nav">
          <button className="ev-submit" disabled={last && !status.available}>
            {last ? "Check my answers" : row ? "Next question" : "Continue"}
            {!last && <Arrow />}
          </button>
          {step > 0 && (
            <button type="button" className="pc-quiet" onClick={goBack}>Back</button>
          )}
          {step >= PROFILE_STEPS && (
            <button type="button" className="pc-quiet pc-edit" onClick={() => setStep(0)}>
              Edit your details
            </button>
          )}
        </div>

        {last && (
          <p className="sub pc-status" aria-live="polite">
            {status.checking
              ? "Checking that scoring is up…"
              : !status.available
                ? "Scoring is down right now. Your answers stay in this browser until it's back."
                : access?.unlimited
                  ? "Your admin account has unlimited practice rounds."
                  : roundsLeft != null
                  ? `A new round uses one of your free rounds. You have ${roundsLeft} left.`
                  : "Your answers are saved in this browser as you type."}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="vz">
      <div className="page-w ev">
        <h1>Profile check</h1>
        <p className="lede-vz">
          A few details about you, then three questions officers ask most. We show where
          an officer would push back.
        </p>

        {!status.checking && !status.available && (
          <div className="caveat bad" role="alert">
            <strong>Scoring is down right now.</strong> You can still fill this in; your
            answers stay in this browser, and you can check them when it&rsquo;s back.
            {isAdmin && status.detail && <span className="pc-admin"> Admin detail: {status.detail}</span>}
          </div>
        )}

        {body}
      </div>
    </div>
  );
}

function Field({ id, label, hint, value, onChange, list, ...rest }) {
  const hintId = hint ? `pc-${id}-hint` : undefined;
  return (
    <div className="ev-f">
      <label className="fl" htmlFor={`pc-${id}`}>{label}</label>
      <input id={`pc-${id}`} value={value} onChange={onChange} aria-describedby={hintId} list={list} {...rest} />
      {hint && <span className="fh" id={hintId}>{hint}</span>}
    </div>
  );
}

function Select({ id, label, value, onChange, options }) {
  return (
    <div className="ev-f">
      <label className="fl" htmlFor={`pc-${id}`}>{label}</label>
      <select id={`pc-${id}`} value={value} onChange={onChange}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/*
 * While the answers are being checked. The form is replaced rather than left
 * on screen with a busy button at its foot, so there is one thing to look at:
 * what is being compared, and the answers being compared, read back.
 */
function Scoring({ planned, profile, coverage }) {
  const where = profile.consulate_city.trim() || profile.consulate_country.trim();
  return (
    <section className="pc-scoring" aria-live="polite" aria-busy="true">
      <svg className="pc-rosette" viewBox="0 0 400 240" aria-hidden="true">
        <use href="#guil" />
      </svg>
      <h2>Checking your answers</h2>
      <p className="sub">
        Comparing them with interviews from {where || "applicants like you"}
        {coverage?.n_decided ? ` - ${coverage.n_decided.toLocaleString()} in the data` : ""}, and
        with the questions officers ask there. It takes a little while; keep this tab open.
      </p>
      <ol className="pc-readback">
        {planned.map((a) => (
          <li key={a.question}>
            <span className="q">{a.question}</span>
            <span className="a">{a.answer}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/*
 * The evaluator cites its sources the way the corpus stores them: opaque
 * interview ids and raw sample counts. Both are bookkeeping - a reader cannot
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

  // The tag the model attaches to a cited interview - "(Mumbai, bachelor's,
  // second attempt, approved)". It is filing metadata, not something a reader
  // needs, and it is the densest part of the sentence.
  t = t.replace(rx("(comparable interviews?)\\s*\\([^()]*\\)"), "$1");

  // Internal question-type keys read as code. "why_university" -> "why university".
  t = t.replace(rx("\\b[a-z]{2,}(?:_[a-z]{2,}){1,3}\\b"), (m) => m.replace(/_/g, " "));

  // The corpus's source platform. The site names the data as public student
  // write-ups; the model sometimes names the platform instead.
  t = t.replace(/\bposted (?:to|on|in) Telegram\b/gi, "posted publicly online");
  t = t.replace(/\bTelegram (channels?|groups?|chats?|posts?|reviews?)\b/gi, "online $1");
  t = t.replace(/\bfrom Telegram\b/gi, "from public posts");
  t = t.replace(/\bTelegram\b/gi, "online");

  t = t.replace(rx("\\(\\s*\\)"), "");
  t = t.replace(rx("\\s+([,.;:%)])"), "$1");
  t = t.replace(rx("\\s{2,}"), " ");
  return t.trim();
}

const scrubList = (xs) => (xs || []).map(scrub);

const READINESS = {
  strong: { word: "Holding up", tone: "ok" },
  moderate: { word: "Partly ready", tone: "" },
  needs_work: { word: "Needs work", tone: "bad" },
};
const VERDICT = {
  strong: { word: "Holds up", tone: "ok" },
  adequate: { word: "Could be stronger", tone: "" },
  weak: { word: "Weak", tone: "bad" },
};
const SEVERITY = { high: "High risk", medium: "Medium risk", low: "Low risk" };

// The model echoes each question back; match it to what was sent so the report
// can quote the applicant's own words. Position is the fallback.
function ownAnswer(submitted, fb, i) {
  const hit = submitted.find((s) => s.question.trim().toLowerCase() === (fb.question || "").trim().toLowerCase());
  return (hit || submitted[i] || {}).answer || "";
}

/*
 * The report, laid out as the document the home page's sample card promises:
 * a header with the verdict and what it stands on, then each answer quoted
 * back with what an officer may hear and how to fix it, then what is likely to
 * come next. It prints cleanly, because people rehearse from paper.
 */
function Evaluation({ ev, round, submitted, profile, coverage }) {
  const feedback = ev.answer_feedback || [];
  const likely = ev.likely_questions || [];
  const risks = ev.risk_factors || [];
  const readiness = READINESS[ev.readiness] || { word: (ev.readiness || "").replace("_", " "), tone: "" };
  const rework = feedback.filter((f) => f.verdict !== "strong").length;
  const where = coverage?.kind === "city" || coverage?.kind === "country" ? coverage.name : "";

  const print = () => {
    track("report_print", { round: round + 1 });
    window.print();
  };

  return (
    <article className="pc-report" aria-labelledby="pc-report-title">
      <header className="pc-doc">
        <svg className="foil-g" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <use href="#guil" />
        </svg>
        <div className="pc-doc-in">
          <div className="pc-doc-head">
            <span>Profile check · round {round + 1}</span>
            <span>{[profile.consulate_city, profile.degree_level].filter(Boolean).join(" · ")}</span>
          </div>
          <h2 id="pc-report-title" className={`pc-verdict ${readiness.tone}`}>{readiness.word}</h2>
          <p className="pc-summary">{scrub(ev.summary)}</p>
          <dl className="pc-doc-meta">
            <div><dt>Answers checked</dt><dd>{feedback.length}</dd></div>
            <div><dt>Answers to rework</dt><dd>{rework}</dd></div>
            {where && (
              <div>
                <dt>Interviews from {where}</dt>
                <dd>{coverage.n_decided.toLocaleString()}</dd>
              </div>
            )}
            {where && coverage.rejected != null && coverage.n_decided > 0 && (
              <div>
                <dt>Of those, reported a refusal</dt>
                <dd>{((coverage.rejected / coverage.n_decided) * 100).toFixed(1)}%</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      {feedback.length > 0 && (
        <section className="pc-sec">
          <h3>Your answers, one by one</h3>
          {feedback.map((f, i) => {
            const verdict = VERDICT[f.verdict] || { word: f.verdict, tone: "" };
            const said = ownAnswer(submitted, f, i);
            return (
              <div className="pc-answer" key={i}>
                <div className="pc-answer-head">
                  <h4>{f.question}</h4>
                  <span className={`pc-pill ${verdict.tone}`}>{verdict.word}</span>
                </div>
                {said && (
                  <blockquote className="pc-said">
                    <span className="pc-k">You said</span>
                    {said}
                  </blockquote>
                )}
                {f.risks?.length > 0 && (
                  <div className="pc-row">
                    <span className="pc-k">An officer may hear</span>
                    <ul>{scrubList(f.risks).map((s, j) => <li key={j}>{s}</li>)}</ul>
                  </div>
                )}
                {f.strengths?.length > 0 && (
                  <div className="pc-row">
                    <span className="pc-k">What works</span>
                    <ul>{scrubList(f.strengths).map((s, j) => <li key={j}>{s}</li>)}</ul>
                  </div>
                )}
                {f.suggested_revision && (
                  <div className="pc-fix">
                    <span className="pc-k">How to fix it</span>
                    <p>{scrub(f.suggested_revision)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {likely.length > 0 && (
        <section className="pc-sec">
          <h3>What an officer is likely to ask you next</h3>
          {likely.map((q, i) => (
            <div className="pc-likely" key={i}>
              <p className="pc-quote">&ldquo;{scrub(q.example_question)}&rdquo;</p>
              <p className="pc-likely-meta">
                {questionLabel(q.question_type)}
                {q.asked_in_share ? ` · asked in ${q.asked_in_share} of comparable interviews` : ""}
              </p>
              <p>{scrub(q.why_likely)}</p>
              <p><strong>To prepare:</strong> {scrub(q.how_to_prepare)}</p>
            </div>
          ))}
        </section>
      )}

      {risks.length > 0 && (
        <section className="pc-sec">
          <h3>Risks in your profile</h3>
          {risks.map((r, i) => (
            <div className="pc-risk" key={i}>
              <div className="pc-answer-head">
                <h4>{scrub(r.factor)}</h4>
                <span className={`pc-pill ${r.severity === "high" ? "bad" : ""}`}>
                  {SEVERITY[r.severity] || r.severity}
                </span>
              </div>
              <p>{scrub(r.evidence)}</p>
            </div>
          ))}
        </section>
      )}

      {(likely.length > 0 || feedback.some((f) => f.suggested_revision)) && (
        <section className="pc-sec pc-rehearse">
          <h3>Rehearse these</h3>
          <p className="sub">
            Say each answer out loud, in your own words, then try the follow-up. Don&rsquo;t
            memorise a script: officers hear one immediately.
          </p>
          <ol>
            {feedback.filter((f) => f.verdict !== "strong" && f.suggested_revision).map((f, i) => (
              <li key={`fix-${i}`}>
                <strong>{f.question}</strong> {scrub(f.suggested_revision)}
              </li>
            ))}
            {likely.map((q, i) => (
              <li key={`next-${i}`}>
                <strong>Then be ready for:</strong> &ldquo;{scrub(q.example_question)}&rdquo;
              </li>
            ))}
          </ol>
          <button type="button" className="pc-quiet no-print" onClick={print}>
            Print or save as PDF
          </button>
        </section>
      )}

      <p className="pc-note">
        <strong>How to read this.</strong> {scrub(ev.caveat)} The interviews behind it were
        posted by applicants themselves, so the numbers describe who chose to post, not
        official approval rates.
      </p>
    </article>
  );
}
