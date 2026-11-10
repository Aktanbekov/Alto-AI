import { useState, useEffect } from "react";
import { sendDetailFeedback } from "../../api";
import { track } from "../../analytics";
import { useLang, useCopy, serverMessage } from "../../i18n";

// The options are stored as stable keys, not as the labels - the wording can be
// rewritten (or translated) without orphaning every answer collected under the
// old phrasing.
const OPTIONS = ["answer_analysis", "suggested_answer", "risk_detection", "score", "none"];

const COPY = {
  ru: {
    options: {
      answer_analysis: "Разбор ответов",
      suggested_answer: "Советы по ответу",
      risk_detection: "Поиск рисков",
      score: "Оценка",
      none: "Ничего из этого",
    },
    failed: "Не удалось сохранить. Попробуйте ещё раз.",
    thanks: "Спасибо за отзыв.",
    question: "Что было полезнее всего?",
    missing: "Что показалось неточным, непонятным или чего не хватило?",
    saving: "Сохраняем…",
    submit: "Отправить отзыв",
    skip: "Пропустить",
  },
};

const MAX_TEXT = 1000;

/*
 * The card under the second report: which part landed, and what did not.
 *
 * Both questions are optional and the whole card is skippable. What it asks is
 * the same pair the unlock survey asks later, deliberately - someone who stops
 * here has still told us the two things worth knowing.
 */
export default function FeedbackCard({ setIndex, onDone }) {
  const [mostUseful, setMostUseful] = useState("");
  const [text, setText] = useState("");
  const [state, setState] = useState("asking"); // asking | saving | done
  const [error, setError] = useState("");
  const { lang } = useLang();
  const c = useCopy(COPY);

  useEffect(() => { track("second_feedback_shown", { set_index: setIndex }); }, [setIndex]);

  const send = async (body, event) => {
    setState("saving");
    setError("");
    try {
      await sendDetailFeedback({ set_index: setIndex, ...body });
      track(event, { set_index: setIndex, most_useful: body.most_useful || "" });
      setState("done");
      // The access screen follows either way - submitted or skipped.
      onDone?.();
    } catch (err) {
      setError(serverMessage(lang, err.message) || c.failed);
      setState("asking");
    }
  };

  if (state === "done") {
    return (
      <div className="vz-card vfb" role="status">
        <p className="vfb-thanks">{c.thanks}</p>
      </div>
    );
  }

  const busy = state === "saving";
  const over = text.length > MAX_TEXT;

  return (
    <div className="vz-card vfb">
      <h2 className="vfb-q" id="most-useful-label">{c.question}</h2>
      <div className="vfb-options" role="radiogroup" aria-labelledby="most-useful-label">
        {OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mostUseful === value}
            className={`vfb-option${mostUseful === value ? " on" : ""}`}
            disabled={busy}
            onClick={() => setMostUseful(value)}
          >
            {c.options[value]}
          </button>
        ))}
      </div>

      <label className="vfb-text">
        <span className="fl">{c.missing}</span>
        <textarea
          rows={3}
          value={text}
          maxLength={MAX_TEXT}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
        />
        <span className={`vfb-count${over ? " over" : ""}`}>
          {text.length} / {MAX_TEXT}
        </span>
      </label>

      {error && <p className="vfb-err">{error}</p>}

      <div className="vfb-actions">
        <button
          type="button"
          className="ev-submit vfb-primary"
          disabled={busy}
          onClick={() =>
            send(
              { most_useful: mostUseful, open_text: text.trim() },
              "second_feedback_submitted",
            )
          }
        >
          {busy ? c.saving : c.submit}
        </button>
        <button
          type="button"
          className="vfb-skip"
          disabled={busy}
          onClick={() => send({ skipped: true }, "second_feedback_skipped")}
        >
          {c.skip}
        </button>
      </div>
    </div>
  );
}
