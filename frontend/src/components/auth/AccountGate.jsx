import AuthForm from "./AuthForm";
import { useShell } from "../shell/shellContext";

/*
 * What a signed-out visitor sees at /check-profile instead of a redirect.
 *
 * The check needs an account - it is where the free rounds, the reports and
 * the typed answers are kept - so the page says that, in place, and offers the
 * account right there. Before this, the free button on the home page dropped
 * people on a separate login screen with no reason given.
 */
export default function AccountGate({ onAuthed }) {
  const { setUser } = useShell();

  return (
    <div className="tf">
      <div className="page-w gate">
        <div className="gate-copy">
          <h1>Profile check</h1>
          <p className="lede">
            You answer three questions officers ask most, in your own words. We compare
            them with real interviews from applicants like you and show where an officer
            is likely to push back.
          </p>

          <h2 className="gate-h">Why it needs an account</h2>
          <ul className="gate-list">
            <li>
              <strong>Your free rounds are counted on it.</strong> Everyone gets two rounds
              of three questions, free.
            </li>
            <li>
              <strong>Your progress is kept.</strong> Come back another day and you carry
              on from the round you reached, not from question one.
            </li>
            <li>
              <strong>What you type stays private to your account.</strong> You can have
              all of it deleted at any time.
            </li>
          </ul>
          <p className="meta">The account is free. No card, no payment.</p>
        </div>

        <div className="auth-panel gate-panel">
          <AuthForm
            mode="signup"
            redirect="/check-profile"
            idPrefix="gate"
            autoFocus={false}
            title="Create your free account"
            sub="Then you go straight to your first round."
            onAuthed={(user) => {
              setUser(user);
              onAuthed?.(user);
            }}
          />
        </div>
      </div>
    </div>
  );
}
