import { useEffect } from "react";
import { track } from "../../analytics";
import WaitlistCard from "./WaitlistCard";

/*
 * Where someone lands once their free sets are spent.
 *
 * Two ways forward, and the survey is not a purchase: it buys three more sets
 * with two minutes of answers, and the copy says so plainly rather than dressing
 * it as a subscription. Once the survey is behind them the primary slot becomes
 * a receipt and the waitlist is all that is left - the screen never offers a
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
        <h2>You&rsquo;ve used your free rounds</h2>
        <p className="sub">
          {done
            ? "That includes the three extra rounds from the survey."
            : "Everyone gets two free rounds of three questions. There are two ways to keep going."}
        </p>

        {done ? (
          <p className="vac-receipt" role="status">
            Survey done - thank you. Your three extra rounds have been used.
          </p>
        ) : (
          <div className="vac-primary">
            <button type="button" className="ev-submit" onClick={onStartSurvey}>
              Answer a 2-minute survey for 3 more rounds
            </button>
            <p className="vac-support">
              Seven short questions about how you are preparing. No payment, nothing to sign up for.
            </p>
          </div>
        )}
      </div>

      <WaitlistCard access={access} onJoined={onWaitlistJoined} />
    </div>
  );
}
