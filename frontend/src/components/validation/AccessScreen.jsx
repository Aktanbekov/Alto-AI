import { useEffect } from "react";
import { track } from "../../analytics";
import WaitlistCard from "./WaitlistCard";

/*
 * Where someone lands once their free sets are spent.
 *
 * Two ways forward, and the survey is not a purchase: it buys three more sets
 * with two minutes of answers, and the copy says so plainly rather than dressing
 * it as a subscription. Once the survey is behind them the primary slot becomes
 * a receipt and the waitlist is all that is left — the screen never offers a
 * second unlock it cannot grant.
 */
export default function AccessScreen({ access, onStartSurvey, onWaitlistJoined }) {
  const done = access.survey_completed;

  useEffect(() => {
    track("access_screen_viewed", {
      sets_used: access.sets_used,
      survey_completed: done,
    });
  }, [access.sets_used, done]);

  return (
    <div className="ev-result">
      <div className="vz-card vac">
        <h2>Continue practicing with Alto Visas</h2>
        <p className="sub">
          {done
            ? "You have used all of your interview sets."
            : "You’ve completed your 2 free interview sets. Choose how you’d like to continue."}
        </p>

        {done ? (
          <p className="vac-receipt" role="status">
            ✓ Survey completed — thank you. Those three extra sets have been used.
          </p>
        ) : (
          <div className="vac-primary">
            <button type="button" className="ev-submit" onClick={onStartSurvey}>
              Unlock 3 more interview sets
            </button>
            <p className="vac-support">
              Complete a short 2-minute survey to unlock 9 additional visa questions.
            </p>
          </div>
        )}
      </div>

      <WaitlistCard access={access} onJoined={onWaitlistJoined} />
    </div>
  );
}
