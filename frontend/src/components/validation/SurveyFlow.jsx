import { useState, useEffect, useRef } from "react";
import { submitSurvey } from "../../api";
import { track } from "../../analytics";
import { useLang, useCopy, plural, serverMessage } from "../../i18n";

/*
 * The seven-question unlock survey.
 *
 * One question per step, because it is answered mostly on a phone between other
 * things, and a seven-question wall is where people close the tab. The progress
 * bar exists for the same reason: the reward was promised as "2 minutes" and the
 * screen has to keep showing that the claim was true.
 *
 * Every question is optional. The survey is a favour, and a required field
 * turns a favour into a toll.
 */

const MAX_TEXT = 1000;

const STEPS = [
  {
    key: "interview_timing",
    kind: "single",
    question: "When is your F-1 visa interview?",
    options: [
      "Within 2 weeks", "Within 1 month", "Within 2-3 months",
      "More than 3 months away", "Not scheduled yet", "Already completed",
    ],
  },
  {
    key: "prep_methods",
    kind: "multi",
    question: "How are you currently preparing?",
    hint: "Choose as many as apply.",
    options: [
      "YouTube", "Social media or online groups", "Practicing with friends or family",
      "Professional consultant", "AI tools", "Reviewing sample questions",
      "Not preparing yet", "Other",
    ],
  },
  {
    key: "biggest_difficulty",
    kind: "single",
    question: "What is your biggest preparation difficulty?",
    options: [
      "Knowing what to say", "Making my answers concise", "Sounding confident",
      "Understanding officer expectations", "English communication",
      "Identifying risky answers", "Finding realistic practice", "Other",
    ],
  },
  {
    key: "most_useful",
    kind: "single",
    question: "Which Altovisas feedback was most useful?",
    // Stored as keys so the wording can change without orphaning answers.
    options: [
      { value: "answer_analysis", label: "Answer analysis" },
      { value: "suggested_answer", label: "Suggested answer" },
      { value: "risk_detection", label: "Risk detection" },
      { value: "score", label: "Score" },
      { value: "none", label: "None of these" },
    ],
  },
  {
    key: "inaccurate_text",
    kind: "text",
    question: "What felt inaccurate, confusing, or missing?",
    hint: "Optional.",
  },
  {
    key: "price_point",
    kind: "single",
    question: "How much would you consider paying for unlimited practice?",
    options: ["$5", "$10", "$20", "More than $20", "I would not pay yet"],
  },
  {
    key: "blocker_text",
    kind: "text",
    question: "What would prevent you from paying today?",
    hint: "Optional.",
  },
];

const DRAFT_KEY = "alto.survey.draft";

const EMPTY = {
  interview_timing: "", prep_methods: [], biggest_difficulty: "",
  most_useful: "", inaccurate_text: "", price_point: "", blocker_text: "",
};

// A refresh two questions from the end should not cost someone the survey - and
// with it the unlock. sessionStorage, like the round resume: one sitting's work,
// not something a shared browser hands to the next person.
function readDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    if (!saved || typeof saved !== "object") return null;
    return {
      step: Number(saved.step) || 0,
      answers: { ...EMPTY, ...(saved.answers || {}) },
    };
  } catch {
    return null;
  }
}

function writeDraft(value) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(value));
  } catch { /* progress is a convenience, not a requirement */ }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch { /* nothing to do */ }
}

const optionValue = (o) => (typeof o === "string" ? o : o.value);

/*
 * Russian wording for the survey. Only what the reader sees: every answer is
 * still stored under its English value above, so one question's answers stay
 * in one bucket whichever language they were given in.
 */
const RU = {
  questions: {
    interview_timing: "Когда ваше собеседование на визу F-1?",
    prep_methods: "Как вы сейчас готовитесь?",
    biggest_difficulty: "Что даётся сложнее всего при подготовке?",
    most_useful: "Какая часть разбора Altovisas была полезнее всего?",
    inaccurate_text: "Что показалось неточным, непонятным или чего не хватило?",
    price_point: "Сколько вы готовы заплатить за безлимитную практику?",
    blocker_text: "Что мешает вам заплатить сегодня?",
  },
  hints: {
    prep_methods: "Выберите всё, что подходит.",
    inaccurate_text: "Необязательно.",
    blocker_text: "Необязательно.",
  },
  options: {
    "Within 2 weeks": "В ближайшие 2 недели",
    "Within 1 month": "В течение месяца",
    "Within 2-3 months": "Через 2-3 месяца",
    "More than 3 months away": "Больше чем через 3 месяца",
    "Not scheduled yet": "Ещё не назначено",
    "Already completed": "Уже прошло",
    "Social media or online groups": "Соцсети или онлайн-группы",
    "Practicing with friends or family": "Тренируюсь с друзьями или семьёй",
    "Professional consultant": "Профессиональный консультант",
    "AI tools": "ИИ-инструменты",
    "Reviewing sample questions": "Разбираю примеры вопросов",
    "Not preparing yet": "Пока не готовлюсь",
    Other: "Другое",
    "Knowing what to say": "Понять, что говорить",
    "Making my answers concise": "Отвечать коротко",
    "Sounding confident": "Звучать уверенно",
    "Understanding officer expectations": "Понять, чего ждёт офицер",
    "English communication": "Говорить по-английски",
    "Identifying risky answers": "Распознавать рискованные ответы",
    "Finding realistic practice": "Найти реалистичную практику",
    answer_analysis: "Разбор ответов",
    suggested_answer: "Советы по ответу",
    risk_detection: "Поиск рисков",
    score: "Оценка",
    none: "Ничего из этого",
    "More than $20": "Больше $20",
    "I would not pay yet": "Пока не готов(а) платить",
  },
};

const optionLabel = (o, lang) => {
  const value = optionValue(o);
  if (lang === "ru" && RU.options[value]) return RU.options[value];
  return typeof o === "string" ? o : o.label;
};

const COPY = {
  ru: {
    failed: "Не удалось сохранить ответы. Попробуйте ещё раз.",
    unlocked: (n) => `Открыто ещё ${n} ${plural("ru", n, ["раунд", "раунда", "раундов"])}`,
    unlockedSub: (q) => `Это ещё ${q} ${plural("ru", q, ["вопрос", "вопроса", "вопросов"])} из реальных собеседований. Спасибо за ответы!`,
    next: "Начать следующий раунд",
    of: (i, n) => `Вопрос ${i} из ${n}`,
    close: "Закрыть",
    back: "Назад",
    saving: "Сохраняем…",
    finish: "Завершить и открыть раунды",
    cont: "Продолжить",
  },
};

export default function SurveyFlow({ onUnlocked, onContinue, onCancel }) {
  const draft = useRef(readDraft());
  const [step, setStep] = useState(() => draft.current?.step || 0);
  const [answers, setAnswers] = useState(() => draft.current?.answers || EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(null);
  const { lang } = useLang();
  const c = useCopy(COPY);

  useEffect(() => { track("validation_survey_started", { resumed: !!draft.current }); }, []);
  useEffect(() => { writeDraft({ step, answers }); }, [step, answers]);

  // Leaving part-way through is the outcome worth knowing about - it is the
  // difference between a survey nobody wants and one that is simply too long.
  //
  // Registered once, reading the step through a ref: with `step` in the
  // dependency list the cleanup would fire on every Continue and report an
  // abandonment for each question they actually answered.
  const finished = useRef(false);
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const onLeave = () => {
      if (finished.current) return;
      finished.current = true; // once per survey, however they left
      track("validation_survey_abandoned", {
        step: stepRef.current + 1,
        of: STEPS.length,
      });
    };
    addEventListener("pagehide", onLeave);
    return () => {
      removeEventListener("pagehide", onLeave);
      onLeave();
    };
  }, []);

  const current = STEPS[step];
  const value = answers[current.key];

  const set = (v) => setAnswers((a) => ({ ...a, [current.key]: v }));

  // Reads the list through the updater rather than the render's copy: two taps
  // landing in one batch would otherwise both start from the same array and the
  // second would drop the first's choice.
  const toggleMulti = (option) =>
    setAnswers((a) => {
      const chosen = a[current.key] || [];
      return {
        ...a,
        [current.key]: chosen.includes(option)
          ? chosen.filter((x) => x !== option)
          : [...chosen, option],
      };
    });

  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await submitSurvey(answers);
      finished.current = true;
      clearDraft();
      track("validation_survey_completed", {
        price_point: answers.price_point,
        most_useful: answers.most_useful,
        timing: answers.interview_timing,
      });
      setUnlocked(result.unlocked_sets ?? 3);
      onUnlocked?.(result.access);
    } catch (err) {
      setError(serverMessage(lang, err.message) || c.failed);
    } finally {
      setBusy(false);
    }
  };

  if (unlocked !== null) {
    return (
      <div className="ev-result">
        <div className="vz-card vsv-done" role="status">
          <h2>{c.unlocked(unlocked)}</h2>
          <p className="sub">{c.unlockedSub(unlocked * 3)}</p>
          <button type="button" className="ev-submit" onClick={() => onContinue?.()}>
            {c.next}
          </button>
        </div>
      </div>
    );
  }

  const last = step === STEPS.length - 1;

  return (
    <div className="ev-result">
      <div className="vz-card vsv">
        <div className="vsv-head">
          <span className="tiny">{c.of(step + 1, STEPS.length)}</span>
          <button type="button" className="vfb-skip" onClick={onCancel} disabled={busy}>
            {c.close}
          </button>
        </div>
        <div
          className="vsv-bar"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
        >
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <h2 className="vfb-q">
          {(lang === "ru" && RU.questions[current.key]) || current.question}
        </h2>
        {current.hint && (
          <p className="sub">{(lang === "ru" && RU.hints[current.key]) || current.hint}</p>
        )}

        {current.kind === "text" ? (
          <label className="vfb-text">
            <textarea
              rows={4}
              value={value}
              maxLength={MAX_TEXT}
              onChange={(e) => set(e.target.value)}
            />
            <span className="vfb-count">{value.length} / {MAX_TEXT}</span>
          </label>
        ) : (
          <div
            className="vfb-options col"
            role={current.kind === "multi" ? "group" : "radiogroup"}
          >
            {current.options.map((o) => {
              const v = optionValue(o);
              const on = current.kind === "multi" ? value.includes(v) : value === v;
              return (
                <button
                  key={v}
                  type="button"
                  role={current.kind === "multi" ? "checkbox" : "radio"}
                  aria-checked={on}
                  className={`vfb-option${on ? " on" : ""}`}
                  onClick={() => (current.kind === "multi" ? toggleMulti(v) : set(v))}
                >
                  {optionLabel(o, lang)}
                </button>
              );
            })}
          </div>
        )}

        {error && <p className="vfb-err">{error}</p>}

        <div className="vsv-nav">
          <button
            type="button"
            className="vfb-skip"
            disabled={step === 0 || busy}
            onClick={() => setStep((n) => n - 1)}
          >
            {c.back}
          </button>
          <button
            type="button"
            className="ev-submit vsv-next"
            disabled={busy}
            onClick={() => (last ? finish() : setStep((n) => n + 1))}
          >
            {busy ? c.saving : last ? c.finish : c.cont}
          </button>
        </div>
      </div>
    </div>
  );
}
