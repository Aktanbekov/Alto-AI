import { useState, useEffect } from "react";
import { sendDetailFeedback } from "../../api";
import { track } from "../../analytics";

// The options are stored as stable keys, not as the labels — the wording can be
// rewritten without orphaning every answer collected under the old phrasing.
const OPTIONS = [
  { value: "answer_analysis", label: "Answer analysis" },
  { value: "suggested_answer", label: "Suggested answer" },
  { value: "risk_detection", label: "Risk detection" },
  { value: "score", label: "Score" },
  { value: "none", label: "None of these" },
];

const MAX_TEXT = 1000;

/*
 * The card under the second report: which part landed, and what did not.
 *
 * Both questions are optional and the whole card is skippable. What it asks is
 * the same pair the unlock survey asks later, deliberately — someone who stops
 * here has still told us the two things worth knowing.
 */
export default function FeedbackCard({ setIndex, onDone }) {
  const [mostUseful, setMostUseful] = useState("");
  const [text, setText] = useState("");
  const [state, setState] = useState("asking"); // asking | saving | done
  const [error, setError] = useState("");

  useEffect(() => { track("second_feedback_shown", { set_index: setIndex }); }, [setIndex]);

  const send = async (body, event) => {
    setState("saving");
    setError("");
    try {
      await sendDetailFeedback({ set_index: setIndex, ...body });
      track(event, { set_index: setIndex, most_useful: body.most_useful || "" });
      setState("done");
      // The access screen follows either way — submitted or skipped.
      onDone?.();
    } catch (err) {
      setError(err.message || "Could not save that. Try again.");
      setState("asking");
    }
  };

  if (state === "done") {
    return (
      <div className="vz-card vfb" role="status">
        <p className="vfb-thanks">Thank you for your feedback.</p>
      </div>
    );
  }

  const busy = state === "saving";
  const over = text.length > MAX_TEXT;

  return (
    <div className="vz-card vfb">
      <h2 className="vfb-q" id="most-useful-label">What was the most useful part?</h2>
      <div className="vfb-options" role="radiogroup" aria-labelledby="most-useful-label">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={mostUseful === o.value}
            className={`vfb-option${mostUseful === o.value ? " on" : ""}`}
            disabled={busy}
            onClick={() => setMostUseful(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <label className="vfb-text">
        <span className="fl">What felt inaccurate, confusing, or missing?</span>
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
          {busy ? "Saving…" : "Submit feedback"}
        </button>
        <button
          type="button"
          className="vfb-skip"
          disabled={busy}
          onClick={() => send({ skipped: true }, "second_feedback_skipped")}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
