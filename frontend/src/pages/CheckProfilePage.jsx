import { useState, useEffect, useRef } from "react";
import {
  getEvaluateStatus, evaluateProfile, getQuestionBank, getAccess,
  getAdminMe, compareModels, getCorpusStats,
} from "../api";
import { useCurrentUser } from "../components/ProtectedRoute";
import { TEST_PROFILE, testAnswerFor } from "../data/testProfile";
import { askAs, askAsRu } from "../data/questionPhrasing";
import ModelCompare from "../components/admin/ModelCompare";
import { track, trackScrollDepth, gpaBandOf } from "../analytics";
import FeedbackRating from "../components/validation/FeedbackRating";
import FeedbackCard from "../components/validation/FeedbackCard";
import AccessScreen from "../components/validation/AccessScreen";
import SurveyFlow from "../components/validation/SurveyFlow";
import { questionLabel } from "../data/questionLabels";
import { SMALL_N } from "../components/charts/useChartWidth";
import Arrow from "../components/ui/Arrow";
import { useLang, useCopy, plural, formatNumber, serverMessage } from "../i18n";

/*
 * The profile evaluator, ported from visa-llm's own Evaluate view.
 *
 * It posts to /api/v1/evaluate, which scores the grounded prompt with
 * Anthropic through the visa-llm sidecar, using the retrieved interviews and
 * precomputed corpus statistics.
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

/*
 * Every word this page shows, in both languages. The values sent to the
 * server (degree, scale, attempt) never change with the language - only what
 * the reader sees beside them.
 */
const COPY = {
  en: {
    scales: [
      { value: "", label: "Choose a scale" },
      { value: "4", label: "Out of 4.0 (US and similar)" },
      { value: "4.3", label: "Out of 4.3" },
      { value: "5", label: "Out of 5.0" },
      { value: "10", label: "Out of 10 (India CGPA)" },
      { value: "100", label: "Percentage (out of 100)" },
    ],
    attempts: [
      { value: "1", label: "First attempt" },
      { value: "2", label: "Second attempt" },
      { value: "3", label: "Third attempt" },
      { value: "4", label: "Fourth or later" },
    ],
    degrees: { Bachelor: "Bachelor's", Masters: "Master's", MBA: "MBA", PhD: "PhD" },
    gpaScale:
      "Choose what your grades are out of. A number on its own is ambiguous - 3.5 out of 4 " +
      "is strong, 3.5 out of 10 is not. Or clear the grades box.",
    offline: "We couldn't reach Altovisas. Check your connection and try again - your answers are still here.",
    failed: "Something went wrong while checking your answers. Try again in a moment.",
    coverCity: (n, name) => <><strong>{n} interviews</strong> from {name} in the data.</>,
    coverNoCity: (city) => <>No interviews from {city} in the data yet. </>,
    coverCountry: (n, name) => <><strong>{n} interviews</strong> from {name} overall.</>,
    coverThin: " That is a thin comparison - read the numbers in your report with that in mind.",
    coverNone: (name) =>
      `Few or no interviews from ${name} in the data yet. Your answers are still ` +
      "checked, but the comparisons lean on other consulates, mostly in India.",
    compareEmpty: "Fill in at least one answer before comparing models.",
    answerOne: "Answer at least one of the three questions, then check again.",
    nextThree: "Next three questions",
    changeAnswer: "Change an answer and check again",
    lastRound:
      "That was the last round of questions. Start again from the top whenever you want another pass.",
    adminIntro: "Admin view: every model's report on the same answers. Students see one.",
    noReport: "The report didn’t come back.",
    noReportStill: "Your answers are still here -",
    goBack: "go back and check again",
    stepStudy: "Your study",
    stepInterview: "Your interview",
    stepQuestion: (i, n) => `Question ${i} of ${n}`,
    admin: "Admin",
    fill: "Fill with test data",
    scoring: "Scoring…",
    scoreFree: "Score without a round",
    adminNote: "Fill drops in a sample applicant. Score runs this round with Claude Opus — no practice round spent, nothing stored.",
    stepOf: (i, n) => `Step ${i} of ${n}`,
    roundN: (n) => `Round ${n} · `,
    progress: "Progress",
    studyTitle: "First, your study",
    studySub: "This is how we find interviews like yours. Skip anything you don’t know.",
    degreeQ: "What degree are you applying for?",
    university: "University",
    universityHint: "e.g. Arizona State University",
    course: "What you will study",
    courseHint: "e.g. MS in Computer Science",
    major: "What you studied before",
    majorHint: "e.g. B.Tech in Mechanical Engineering",
    gpa: "Your grades",
    gpaHint: "e.g. 8.2",
    outOf: "Out of",
    interviewTitle: "Your interview and funding",
    interviewSub: "The consulate decides which officers’ questions we compare you with.",
    consulate: "Which consulate is your interview at?",
    consulateHint: "e.g. Chennai",
    funding: "Who is paying for your degree?",
    fundingHint: "e.g. My father's business savings and an education loan",
    more: "Add more detail",
    optional: "(optional)",
    work: "Work experience",
    workHint: "e.g. 2 years as a data analyst, or none",
    firstAttempt: "Is this your first attempt?",
    country: "Consulate country",
    countryAuto: (c) => `We'll use ${c} unless you change it`,
    countryHint: "e.g. India",
    askedIn: (p) => `Asked in ${p}% of the interviews in the data`,
    answerTip: "Write what you would really say at the window. Two or three sentences is plenty. You can leave a question blank.",
    check: "Check my answers",
    nextQ: "Next question",
    cont: "Continue",
    back: "Back",
    edit: "Edit your details",
    statusChecking: "Checking that scoring is up…",
    statusDown: "Scoring is down right now. Your answers stay in this browser until it's back.",
    statusUnlimited: "Your admin account has unlimited practice rounds.",
    statusLeft: (n) => `A new round uses one of your free rounds. You have ${n} left.`,
    statusSaved: "Your answers are saved in this browser as you type.",
    title: "Profile check",
    lede: "A few details about you, then three questions officers ask most. We show where an officer would push back.",
    downTitle: "Scoring is down right now.",
    downBody: "You can still fill this in; your answers stay in this browser, and you can check them when it’s back.",
    adminDetail: "Admin detail:",
  },
  ru: {
    scales: [
      { value: "", label: "Выберите шкалу" },
      { value: "4", label: "Из 4.0 (США и похожие)" },
      { value: "4.3", label: "Из 4.3" },
      { value: "5", label: "Из 5 (пятибалльная)" },
      { value: "10", label: "Из 10 (CGPA, Индия)" },
      { value: "100", label: "Проценты (из 100)" },
    ],
    attempts: [
      { value: "1", label: "Первая попытка" },
      { value: "2", label: "Вторая попытка" },
      { value: "3", label: "Третья попытка" },
      { value: "4", label: "Четвёртая или позже" },
    ],
    degrees: { Bachelor: "Бакалавриат", Masters: "Магистратура", MBA: "MBA", PhD: "PhD" },
    gpaScale:
      "Выберите, из скольки баллов ваша оценка. Одно число ничего не говорит: 3.5 из 4 — " +
      "это высокая оценка, а 3.5 из 10 — нет. Или очистите поле с оценками.",
    offline: "Не удалось связаться с Altovisas. Проверьте подключение и попробуйте ещё раз — ваши ответы никуда не делись.",
    failed: "При проверке ответов что-то пошло не так. Попробуйте ещё раз через минуту.",
    coverCity: (n, name, count) => (
      <>{name}: в данных <strong>{n} {plural("ru", count, ["собеседование", "собеседования", "собеседований"])}</strong>.</>
    ),
    coverNoCity: (city) => <>{city}: собеседований в данных пока нет. </>,
    coverCountry: (n, name, count) => (
      <>{name} в целом: <strong>{n} {plural("ru", count, ["собеседование", "собеседования", "собеседований"])}</strong>.</>
    ),
    coverThin: " Сравнивать особо не с чем — учитывайте это, читая цифры в отчёте.",
    coverNone: (name) =>
      `${name}: собеседований в данных пока мало или нет совсем. Ваши ответы всё равно ` +
      "проверят, но сравнение будет опираться на другие консульства, в основном в Индии.",
    compareEmpty: "Заполните хотя бы один ответ, прежде чем сравнивать модели.",
    answerOne: "Ответьте хотя бы на один из трёх вопросов и проверьте снова.",
    nextThree: "Следующие три вопроса",
    changeAnswer: "Изменить ответ и проверить снова",
    lastRound:
      "Это был последний раунд вопросов. Начните сначала, когда захотите пройти ещё раз.",
    adminIntro: "Вид администратора: отчёты всех моделей по одним и тем же ответам. Студенты видят один.",
    noReport: "Отчёт не пришёл.",
    noReportStill: "Ваши ответы на месте —",
    goBack: "вернитесь и проверьте снова",
    stepStudy: "Ваша учёба",
    stepInterview: "Ваше собеседование",
    stepQuestion: (i, n) => `Вопрос ${i} из ${n}`,
    admin: "Админ",
    fill: "Заполнить тестовыми данными",
    scoring: "Проверяем…",
    scoreFree: "Проверить без траты раунда",
    adminNote: "«Заполнить» подставляет пример заявителя. «Проверить» прогоняет этот раунд через Claude Opus — раунд не тратится, ничего не сохраняется.",
    stepOf: (i, n) => `Шаг ${i} из ${n}`,
    roundN: (n) => `Раунд ${n} · `,
    progress: "Прогресс",
    studyTitle: "Сначала — о вашей учёбе",
    studySub: "По этим данным мы находим собеседования, похожие на ваше. Пропустите то, чего не знаете.",
    degreeQ: "На какую ступень вы поступаете?",
    university: "Университет",
    universityHint: "например, Arizona State University",
    course: "Что вы будете изучать",
    courseHint: "например, MS in Computer Science",
    major: "Что вы изучали раньше",
    majorHint: "например, бакалавриат по машиностроению",
    gpa: "Ваши оценки",
    gpaHint: "например, 4.6",
    outOf: "Из скольки",
    interviewTitle: "Собеседование и оплата учёбы",
    interviewSub: "От консульства зависит, с вопросами каких офицеров мы вас сравниваем.",
    consulate: "В каком консульстве ваше собеседование?",
    consulateHint: "например, Tashkent",
    funding: "Кто оплачивает вашу учёбу?",
    fundingHint: "например, сбережения отца от бизнеса и кредит на обучение",
    more: "Добавить подробности",
    optional: "(необязательно)",
    work: "Опыт работы",
    workHint: "например, 2 года аналитиком данных, или нет",
    firstAttempt: "Это ваша первая попытка?",
    country: "Страна консульства",
    countryAuto: (c) => `Укажем ${c}, если вы не измените`,
    countryHint: "например, Uzbekistan",
    askedIn: (p) => `Этот вопрос задавали в ${p}% собеседований из наших данных`,
    answerTip: "Отвечайте по-английски — собеседование проходит на английском. Напишите то, что вы действительно скажете у окошка: двух-трёх предложений достаточно. Вопрос можно пропустить.",
    check: "Проверить ответы",
    nextQ: "Следующий вопрос",
    cont: "Продолжить",
    back: "Назад",
    edit: "Изменить данные",
    statusChecking: "Проверяем, доступен ли сервис…",
    statusDown: "Проверка сейчас не работает. Ваши ответы сохранятся в этом браузере, пока она не заработает.",
    statusUnlimited: "У вашего админ-аккаунта неограниченное число раундов.",
    statusLeft: (n) => `Новый раунд расходует один из бесплатных раундов. Осталось: ${n}.`,
    statusSaved: "Ответы сохраняются в этом браузере по мере ввода.",
    title: "Проверка профиля",
    lede: "Немного о вас, а затем три вопроса, которые офицеры задают чаще всего. Мы покажем, где офицер может засомневаться.",
    downTitle: "Проверка сейчас не работает.",
    downBody: "Форму всё равно можно заполнить: ответы сохранятся в этом браузере, и вы проверите их, когда сервис заработает.",
    adminDetail: "Для администратора:",
  },
};

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

// The values the server stores; their labels are in COPY.degrees.
const DEGREES = ["Bachelor", "Masters", "MBA", "PhD"];

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

// What a failed request should say. The server's own messages are already
// written for students (in English; serverMessage translates the known ones);
// a dropped connection only has the browser's.
function plainError(err, lang, c) {
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(err?.message || "")) {
    return c.offline;
  }
  if (lang === "ru" && (err?.status === 502 || err?.status === 503)) {
    return serverMessage(lang, "Scoring is temporarily unavailable");
  }
  return serverMessage(lang, err?.message) || c.failed;
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
  const { lang } = useLang();
  const c = useCopy(COPY);
  if (!coverage) return null;
  const n = formatNumber(lang, coverage.n_decided);
  if (coverage.kind === "city") {
    return (
      <p className="pc-cover" role="status">
        {c.coverCity(n, coverage.name, coverage.n_decided)}
        {coverage.n_decided < SMALL_N && c.coverThin}
      </p>
    );
  }
  if (coverage.kind === "country") {
    return (
      <p className="pc-cover" role="status">
        {coverage.city ? c.coverNoCity(coverage.city) : null}
        {c.coverCountry(n, coverage.name, coverage.n_decided)}
        {coverage.n_decided < SMALL_N && c.coverThin}
      </p>
    );
  }
  return <p className="pc-cover" role="status">{c.coverNone(coverage.name)}</p>;
}

export default function CheckProfilePage() {
  // The route is behind ProtectedRoute, so the account is known at mount.
  const user = useCurrentUser();
  const { lang } = useLang();
  const c = useCopy(COPY);
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
  // Set while an admin scoring run is in flight, then holds its rows.
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

  // What the report quotes back: the planned answers plus each question's
  // Russian reading. Kept apart from the payload so the server never sees it.
  const withReadings = (planned) => planned.map((p) => {
    const row = answers.find((a) => askAs(a, profile.degree_level).trim() === p.question);
    return { ...p, question_ru: row ? askAsRu(row, profile.degree_level) : "" };
  });

  /*
   * Admin only: score this round without spending a practice round.
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
      setError(c.compareEmpty);
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
      setSubmitted(withReadings(planned));
      setComparison(res.results || []);
      scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(plainError(err, lang, c));
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
      setError(c.answerOne);
      setStep(PROFILE_STEPS);
      return;
    }
    // A bare number is unusable: 3.5 is strong out of 4 and weak out of 10.
    if (profile.gpa.trim() && !profile.gpa_scale) {
      setStepError(c.gpaScale);
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
    setSubmitted(withReadings(planned));
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
      setError(plainError(err, lang, c));
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
          {c.nextThree} <Arrow />
        </button>
        <button type="button" className="pc-quiet" onClick={editRound}>
          {c.changeAnswer}
        </button>
      </div>
    );
  } else {
    nextAction = (
      <p className="sub">{c.lastRound}</p>
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
        intro={c.adminIntro}
        renderReport={(ev) => <>{reportFor(ev)}<div className="pc-after no-print">{afterReport}</div></>}
      />
    ) : result[0]?.evaluation ? (
      <>
        {reportFor(result[0].evaluation)}
        <div className="pc-after no-print">{afterReport}</div>
      </>
    ) : (
      <div className="caveat bad" role="alert">
        <strong>{c.noReport}</strong> {c.noReportStill}{" "}
        <button type="button" className="pc-inline" onClick={editRound}>{c.goBack}</button>.
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
    const stepName = step === 0 ? c.stepStudy
      : step === 1 ? c.stepInterview
        : c.stepQuestion(qIndex + 1, answers.length);
    const extraOpen = Boolean(
      profile.work_experience || profile.consulate_country || profile.attempt_number !== "1"
    );

    const goNext = (e) => {
      e.preventDefault();
      if (step === 0 && profile.gpa.trim() && !profile.gpa_scale) {
        setStepError(c.gpaScale);
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
            <span className="ev-devbar-tag">{c.admin}</span>
            <button type="button" className="ev-devfill" onClick={fillWithTestData}>
              {c.fill}
            </button>
            <button
              type="button"
              className="ev-devfill"
              onClick={runComparison}
              disabled={comparing}
            >
              {comparing ? c.scoring : c.scoreFree}
            </button>
            <span className="ev-devbar-note">{c.adminNote}</span>
          </div>
        )}

        <div className="pc-progress">
          <p className="pc-step-of">
            <span>{c.stepOf(step + 1, totalSteps)}</span>
            <span aria-hidden="true"> · </span>
            <span>{round > 0 ? c.roundN(round + 1) : ""}{stepName}</span>
          </p>
          <div
            className="pc-track" role="progressbar" aria-label={c.progress}
            aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step + 1}
          >
            <span style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
          </div>
        </div>

        <div className="pc-panel">
          {step === 0 && (
            <>
              <h2 id="pc-step-h" tabIndex={-1}>{c.studyTitle}</h2>
              <p className="sub">{c.studySub}</p>

              <fieldset className="pc-choice">
                <legend className="fl">{c.degreeQ}</legend>
                <div className="pc-seg">
                  {DEGREES.map((d) => (
                    <label key={d} className={profile.degree_level === d ? "on" : ""}>
                      <input
                        type="radio" name="degree_level" value={d}
                        checked={profile.degree_level === d}
                        onChange={set("degree_level")}
                      />
                      {c.degrees[d]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="pc-fields">
                <Field id="university" label={c.university} hint={c.universityHint}
                  value={profile.university} onChange={set("university")} autoComplete="organization" />
                <Field id="course" label={c.course} hint={c.courseHint}
                  value={profile.course} onChange={set("course")} />
                {showPrior && (
                  <Field id="major" label={c.major} hint={c.majorHint}
                    value={profile.major} onChange={set("major")} />
                )}
                <div className="pc-pair">
                  <Field id="gpa" label={c.gpa} hint={c.gpaHint} inputMode="decimal"
                    value={profile.gpa} onChange={set("gpa")} />
                  <Select id="gpa_scale" label={c.outOf} value={profile.gpa_scale}
                    onChange={set("gpa_scale")} options={c.scales} />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 id="pc-step-h" tabIndex={-1}>{c.interviewTitle}</h2>
              <p className="sub">{c.interviewSub}</p>

              <div className="pc-fields">
                <div>
                  <Field id="consulate_city" label={c.consulate}
                    hint={c.consulateHint} list="pc-cities"
                    value={profile.consulate_city} onChange={set("consulate_city")} />
                  <CoverageNote coverage={coverage} />
                </div>
                <Field id="funding_source" label={c.funding}
                  hint={c.fundingHint}
                  value={profile.funding_source} onChange={set("funding_source")} />
              </div>
              <datalist id="pc-cities">
                {cities.map((c) => <option key={c} value={c} />)}
              </datalist>

              <details className="pc-more" open={extraOpen}>
                <summary>{c.more} <span>{c.optional}</span></summary>
                <div className="pc-fields">
                  <Field id="work_experience" label={c.work}
                    hint={c.workHint}
                    value={profile.work_experience} onChange={set("work_experience")} />
                  <Select id="attempt_number" label={c.firstAttempt}
                    value={profile.attempt_number} onChange={set("attempt_number")} options={c.attempts} />
                  <Field id="consulate_country" label={c.country}
                    hint={countryFor(profile.consulate_city)
                      ? c.countryAuto(countryFor(profile.consulate_city))
                      : c.countryHint}
                    value={profile.consulate_country} onChange={set("consulate_country")}
                    autoComplete="country-name" />
                </div>
              </details>
            </>
          )}

          {row && (
            <>
              <label className="pc-q" htmlFor={`pc-a${qIndex}`} lang="en">
                {askAs(row, profile.degree_level)}
              </label>
              {/* The officer asks in English, so the English question is the
                  one to answer; the Russian line is only a reading aid. */}
              {lang === "ru" && askAsRu(row, profile.degree_level) && (
                <p className="pc-q-tr">{askAsRu(row, profile.degree_level)}</p>
              )}
              {row.share != null && (
                <p className="ev-q-share">{c.askedIn(Math.round(row.share * 100))}</p>
              )}
              <textarea
                id={`pc-a${qIndex}`}
                className="pc-answer-box"
                rows={5}
                value={row.answer}
                onChange={setAnswer(qIndex)}
                aria-describedby={`pc-a${qIndex}-tip`}
              />
              <p className="fh" id={`pc-a${qIndex}-tip`}>{c.answerTip}</p>
            </>
          )}
        </div>

        {(stepError || error) && (
          <div className="caveat bad" role="alert">{stepError || error}</div>
        )}

        <div className="pc-nav">
          <button className="ev-submit" disabled={last && !status.available}>
            {last ? c.check : row ? c.nextQ : c.cont}
            {!last && <Arrow />}
          </button>
          {step > 0 && (
            <button type="button" className="pc-quiet" onClick={goBack}>{c.back}</button>
          )}
          {step >= PROFILE_STEPS && (
            <button type="button" className="pc-quiet pc-edit" onClick={() => setStep(0)}>
              {c.edit}
            </button>
          )}
        </div>

        {last && (
          <p className="sub pc-status" aria-live="polite">
            {status.checking
              ? c.statusChecking
              : !status.available
                ? c.statusDown
                : access?.unlimited
                  ? c.statusUnlimited
                  : roundsLeft != null
                  ? c.statusLeft(roundsLeft)
                  : c.statusSaved}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="vz">
      <div className="page-w ev">
        <h1>{c.title}</h1>
        <p className="lede-vz">{c.lede}</p>

        {!status.checking && !status.available && (
          <div className="caveat bad" role="alert">
            <strong>{c.downTitle}</strong> {c.downBody}
            {isAdmin && status.detail && <span className="pc-admin"> {c.adminDetail} {status.detail}</span>}
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
const SCORING_COPY = {
  en: {
    title: "Checking your answers",
    body: (where, n) => (
      <>
        Comparing them with interviews from {where || "applicants like you"}
        {n ? ` - ${n} in the data` : ""}, and with the questions officers ask there. It
        takes a little while; keep this tab open.
      </>
    ),
  },
  ru: {
    title: "Проверяем ваши ответы",
    body: (where, n) => (
      <>
        {where
          ? `Сравниваем их с собеседованиями (${where}${n ? `: ${n} в данных` : ""}) `
          : "Сравниваем их с собеседованиями заявителей, похожих на вас, "}
        и с вопросами, которые там задают офицеры. Это займёт немного времени — не
        закрывайте вкладку.
      </>
    ),
  },
};

function Scoring({ planned, profile, coverage }) {
  const { lang } = useLang();
  const c = useCopy(SCORING_COPY);
  const where = profile.consulate_city.trim() || profile.consulate_country.trim();
  return (
    <section className="pc-scoring" aria-live="polite" aria-busy="true">
      <svg className="pc-rosette" viewBox="0 0 400 240" aria-hidden="true">
        <use href="#guil" />
      </svg>
      <h2>{c.title}</h2>
      <p className="sub">
        {c.body(where, coverage?.n_decided ? formatNumber(lang, coverage.n_decided) : "")}
      </p>
      <ol className="pc-readback">
        {planned.map((a) => (
          <li key={a.question}>
            <span className="q" lang="en">{a.question}</span>
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

// What a stripped interview id becomes, in the report's language.
const ID_PHRASES = {
  en: {
    both: "Two comparable interviews", three: "three comparable interviews",
    two: "two comparable interviews", one: "one comparable interview",
  },
  ru: {
    both: "Два похожих собеседования", three: "три похожих собеседования",
    two: "два похожих собеседования", one: "одно похожее собеседование",
  },
};

function scrub(text, lang = "en") {
  if (typeof text !== "string" || !text) return text;
  let t = text;
  const ids = ID_PHRASES[lang] || ID_PHRASES.en;

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
  t = t.replace(rx(`\\bBoth\\s+${ID}\\s+and\\s+${ID}\\b`), ids.both);
  t = t.replace(rx(`\\b${ID}(,\\s*${ID})+\\s+(?:and|и)\\s+${ID}\\b`), ids.three);
  t = t.replace(rx(`\\b${ID}\\s+(?:and|и)\\s+${ID}\\b`), ids.two);
  t = t.replace(rx(`\\b${ID}\\b`), ids.one);
  // "In record <id>" leaves a stray "record" once the id is a phrase.
  t = t.replace(rx("\\b(?:record|post|interview)s?\\s+(one|two|three) comparable"), "$1 comparable");

  // The tag the model attaches to a cited interview - "(Mumbai, bachelor's,
  // second attempt, approved)". It is filing metadata, not something a reader
  // needs, and it is the densest part of the sentence.
  t = t.replace(rx("(comparable interviews?)\\s*\\([^()]*\\)"), "$1");
  t = t.replace(/(похож\p{L}* собеседовани\p{L}*)\s*\([^()]*\)/gu, "$1");

  // Internal question-type keys read as code. "why_university" -> "why university".
  t = t.replace(rx("\\b[a-z]{2,}(?:_[a-z]{2,}){1,3}\\b"), (m) => m.replace(/_/g, " "));

  // The corpus's source platform. The site names the data as public student
  // write-ups; the model sometimes names the platform instead.
  if (lang === "ru") {
    t = t.replace(/(?<!\p{L})(в|из|на)\s+Telegram(?:[-\s](?:канал|групп|чат)\p{L}*)?/giu,
      (_, prep) => (prep.toLowerCase() === "из" ? "из открытых публикаций" : "в открытых публикациях"));
    t = t.replace(/Telegram(?:[-\s](?:канал|групп|чат)\p{L}*)?/giu, "открытые публикации");
  }
  t = t.replace(/\bposted (?:to|on|in) Telegram\b/gi, "posted publicly online");
  t = t.replace(/\bTelegram (channels?|groups?|chats?|posts?|reviews?)\b/gi, "online $1");
  t = t.replace(/\bfrom Telegram\b/gi, "from public posts");
  t = t.replace(/\bTelegram\b/gi, "online");

  t = t.replace(rx("\\(\\s*\\)"), "");
  t = t.replace(rx("\\s+([,.;:%)])"), "$1");
  t = t.replace(rx("\\s{2,}"), " ");
  return t.trim();
}

const TONES = {
  readiness: { strong: "ok", moderate: "", needs_work: "bad" },
  verdict: { strong: "ok", adequate: "", weak: "bad" },
};

const REPORT_COPY = {
  en: {
    readiness: { strong: "Holding up", moderate: "Partly ready", needs_work: "Needs work" },
    verdict: { strong: "Holds up", adequate: "Could be stronger", weak: "Weak" },
    severity: { high: "High risk", medium: "Medium risk", low: "Low risk" },
    head: (n) => `Profile check · round ${n}`,
    checked: "Answers checked",
    rework: "Answers to rework",
    from: (where) => `Interviews from ${where}`,
    refused: "Of those, reported a refusal",
    answersTitle: "Your answers, one by one",
    said: "You said",
    mayHear: "An officer may hear",
    works: "What works",
    fix: "How to fix it",
    likelyTitle: "What an officer is likely to ask you next",
    askedIn: (share) => ` · asked in ${share} of comparable interviews`,
    prepare: "To prepare:",
    risksTitle: "Risks in your profile",
    rehearseTitle: "Rehearse these",
    rehearseSub: "Say each answer out loud, in your own words, then try the follow-up. Don’t memorise a script: officers hear one immediately.",
    thenReady: "Then be ready for:",
    print: "Print or save as PDF",
    howToRead: "How to read this.",
    howToReadTail: "The interviews behind it were posted by applicants themselves, so the numbers describe who chose to post, not official approval rates.",
  },
  ru: {
    readiness: { strong: "В целом готовы", moderate: "Частично готовы", needs_work: "Нужна доработка" },
    verdict: { strong: "Убедительно", adequate: "Можно сильнее", weak: "Слабо" },
    severity: { high: "Высокий риск", medium: "Средний риск", low: "Низкий риск" },
    head: (n) => `Проверка профиля · раунд ${n}`,
    checked: "Проверено ответов",
    rework: "Ответов на доработку",
    from: (where) => `Собеседований: ${where}`,
    refused: "Из них с отказом",
    answersTitle: "Ваши ответы по порядку",
    said: "Вы сказали",
    mayHear: "Что может услышать офицер",
    works: "Что работает",
    fix: "Как исправить",
    likelyTitle: "О чём офицер, скорее всего, спросит дальше",
    askedIn: (share) => ` · задавали в ${share} похожих собеседований`,
    prepare: "Как подготовиться:",
    risksTitle: "Риски в вашем профиле",
    rehearseTitle: "Отрепетируйте",
    rehearseSub: "Проговорите каждый ответ вслух своими словами, затем ответьте на уточняющий вопрос. Не заучивайте текст: офицеры сразу это слышат.",
    thenReady: "Затем будьте готовы к вопросу:",
    print: "Распечатать или сохранить в PDF",
    howToRead: "Как это читать.",
    howToReadTail: "Собеседования, на которых основан отчёт, опубликовали сами заявители, поэтому цифры описывают тех, кто решил написать, а не официальную долю одобрений.",
  },
};

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
  const { lang } = useLang();
  const c = useCopy(REPORT_COPY);
  const clean = (t) => scrub(t, lang);
  const scrubList = (xs) => (xs || []).map(clean);
  const feedback = ev.answer_feedback || [];
  const likely = ev.likely_questions || [];
  const risks = ev.risk_factors || [];
  const readiness = {
    word: c.readiness[ev.readiness] || (ev.readiness || "").replace("_", " "),
    tone: TONES.readiness[ev.readiness] || "",
  };
  // The Russian reading of a question the student answered, matched back
  // through the round's own phrasing. Empty when there is none to offer.
  const translate = (question) => {
    if (lang !== "ru") return "";
    const hit = submitted.find((s) => s.question.trim().toLowerCase() === (question || "").trim().toLowerCase());
    return hit?.question_ru || "";
  };
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
            <span>{c.head(round + 1)}</span>
            <span>{[profile.consulate_city, profile.degree_level].filter(Boolean).join(" · ")}</span>
          </div>
          <h2 id="pc-report-title" className={`pc-verdict ${readiness.tone}`}>{readiness.word}</h2>
          <p className="pc-summary">{clean(ev.summary)}</p>
          <dl className="pc-doc-meta">
            <div><dt>{c.checked}</dt><dd>{feedback.length}</dd></div>
            <div><dt>{c.rework}</dt><dd>{rework}</dd></div>
            {where && (
              <div>
                <dt>{c.from(where)}</dt>
                <dd>{formatNumber(lang, coverage.n_decided)}</dd>
              </div>
            )}
            {where && coverage.rejected != null && coverage.n_decided > 0 && (
              <div>
                <dt>{c.refused}</dt>
                <dd>{((coverage.rejected / coverage.n_decided) * 100).toFixed(1)}%</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      {feedback.length > 0 && (
        <section className="pc-sec">
          <h3>{c.answersTitle}</h3>
          {feedback.map((f, i) => {
            const verdict = {
              word: c.verdict[f.verdict] || f.verdict,
              tone: TONES.verdict[f.verdict] || "",
            };
            const said = ownAnswer(submitted, f, i);
            const questionRu = translate(f.question);
            return (
              <div className="pc-answer" key={i}>
                <div className="pc-answer-head">
                  <div>
                    <h4 lang="en">{f.question}</h4>
                    {questionRu && <p className="pc-q-tr">{questionRu}</p>}
                  </div>
                  <span className={`pc-pill ${verdict.tone}`}>{verdict.word}</span>
                </div>
                {said && (
                  <blockquote className="pc-said">
                    <span className="pc-k">{c.said}</span>
                    {said}
                  </blockquote>
                )}
                {f.risks?.length > 0 && (
                  <div className="pc-row">
                    <span className="pc-k">{c.mayHear}</span>
                    <ul>{scrubList(f.risks).map((s, j) => <li key={j}>{s}</li>)}</ul>
                  </div>
                )}
                {f.strengths?.length > 0 && (
                  <div className="pc-row">
                    <span className="pc-k">{c.works}</span>
                    <ul>{scrubList(f.strengths).map((s, j) => <li key={j}>{s}</li>)}</ul>
                  </div>
                )}
                {f.suggested_revision && (
                  <div className="pc-fix">
                    <span className="pc-k">{c.fix}</span>
                    <p>{clean(f.suggested_revision)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {likely.length > 0 && (
        <section className="pc-sec">
          <h3>{c.likelyTitle}</h3>
          {likely.map((q, i) => (
            <div className="pc-likely" key={i}>
              <p className="pc-quote" lang="en">&ldquo;{clean(q.example_question)}&rdquo;</p>
              <p className="pc-likely-meta">
                {questionLabel(q.question_type, lang)}
                {q.asked_in_share ? c.askedIn(q.asked_in_share) : ""}
              </p>
              <p>{clean(q.why_likely)}</p>
              <p><strong>{c.prepare}</strong> {clean(q.how_to_prepare)}</p>
            </div>
          ))}
        </section>
      )}

      {risks.length > 0 && (
        <section className="pc-sec">
          <h3>{c.risksTitle}</h3>
          {risks.map((r, i) => (
            <div className="pc-risk" key={i}>
              <div className="pc-answer-head">
                <h4>{clean(r.factor)}</h4>
                <span className={`pc-pill ${r.severity === "high" ? "bad" : ""}`}>
                  {c.severity[r.severity] || r.severity}
                </span>
              </div>
              <p>{clean(r.evidence)}</p>
            </div>
          ))}
        </section>
      )}

      {(likely.length > 0 || feedback.some((f) => f.suggested_revision)) && (
        <section className="pc-sec pc-rehearse">
          <h3>{c.rehearseTitle}</h3>
          <p className="sub">{c.rehearseSub}</p>
          <ol>
            {feedback.filter((f) => f.verdict !== "strong" && f.suggested_revision).map((f, i) => (
              <li key={`fix-${i}`}>
                <strong lang="en">{f.question}</strong> {clean(f.suggested_revision)}
              </li>
            ))}
            {likely.map((q, i) => (
              <li key={`next-${i}`}>
                <strong>{c.thenReady}</strong> <span lang="en">&ldquo;{clean(q.example_question)}&rdquo;</span>
              </li>
            ))}
          </ol>
          <button type="button" className="pc-quiet no-print" onClick={print}>
            {c.print}
          </button>
        </section>
      )}

      <p className="pc-note">
        <strong>{c.howToRead}</strong> {clean(ev.caveat)} {c.howToReadTail}
      </p>
    </article>
  );
}
