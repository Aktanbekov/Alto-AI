import { useState, useEffect } from "react";
import { sendQuickFeedback } from "../../api";
import { track } from "../../analytics";

/*
 * The prompt under the first report: one question, five buttons, and a way out.
 *
 * It sits below the feedback, never in front of it. Someone who has just read
 * where their interview breaks is owed that reading whether or not they feel
 * like rating it, so every path here — answer, skip, or a failed save — leaves
 * the report exactly where it was.
 */
export default function FeedbackRating({ setIndex, onDone }) {
  const [state, setState] = useState("asking"); // asking | saving | done
  const [error, setError] = useState("");

  useEffect(() => { track("first_feedback_shown", { set_index: setIndex }); }, [setIndex]);

  const send = async (body, event) => {
    setState("saving");
    setError("");
    try {
      await sendQuickFeedback({ set_index: setIndex, ...body });
      track(event, { set_index: setIndex, ...(body.rating ? { rating: body.rating } : {}) });
      setState("done");
      onDone?.();
    } catch (err) {
      // Recoverable: they keep the buttons and can try again or move on.
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

  return (
    <div className="vz-card vfb">
      <h2 className="vfb-q" id="rating-label">How useful was this feedback?</h2>

      <div className="vfb-scale" role="group" aria-labelledby="rating-label">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="vfb-num"
            disabled={busy}
            onClick={() => send({ rating: n }, "first_feedback_submitted")}
            aria-label={`${n} out of 5${n === 1 ? ", not useful" : ""}${n === 5 ? ", very useful" : ""}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="vfb-ends" aria-hidden="true">
        <span>Not useful</span>
        <span>Very useful</span>
      </div>

      {error && <p className="vfb-err">{error}</p>}

      <button
        type="button"
        className="vfb-skip"
        disabled={busy}
        onClick={() => send({ skipped: true }, "first_feedback_skipped")}
      >
        Skip
      </button>
    </div>
  );
}
