import { useNavigate } from "react-router-dom";
import PreviewChip from "../components/shell/PreviewChip";

export default function TakeATestPage() {
  const navigate = useNavigate();

  // The spoken flow above is still a prototype, so the page hands the user off
  // to the evaluator — the same grounded scoring the home page CTA opens. No
  // login detour any more: two practice sets are free to everyone, account or
  // not, so sending a guest to /login would gate what is no longer gated.
  const evaluate = () => navigate("/check-profile");

  return (
    <div className="tf">
    <div className="narrow pt pb">
      <PreviewChip />
      <div className="topbar">
        <span className="tiny">Question 2 of 3</span>
        <span className="timer"><i className="dot" />00:47</span>
      </div>

      <p className="q">Who is sponsoring your education?</p>
      <p className="q-src">
        funding_sponsor · appears in 29.5% of interviews (n=4,474) · median spoken answer 14 seconds
      </p>

      <button className="mic" type="button">
        <span className="ring"><i /></span>
        <span>Recording — tap to finish</span>
        <span className="wave" aria-hidden="true">
          {[0, .12, .24, .36, .48, .6, .72, .1, .3].map((d, i) => (
            <i key={i} style={{ animationDelay: `${d}s` }} />
          ))}
        </span>
      </button>

      <p className="tiny" style={{ marginTop: 16, textAlign: "center" }}>
        Prefer to type? Switch to text — but the real thing is spoken, and speaking
        is the part people freeze on.
      </p>

      <div style={{ marginTop: 40, borderTop: "1px solid var(--rule)", paddingTop: 20 }}>
        <p className="tiny">
          No feedback yet. All three answers are scored together against comparable
          posts, so the report reads your file as a whole rather than one answer at a time.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginTop: 22 }}>
          <button className="btn" type="button" onClick={evaluate}>
            Score my answers <span className="arrow">→</span>
          </button>
          <span className="tiny">Type your profile and answers — scored against the corpus</span>
        </div>
      </div>
    </div>
    </div>
  );
}
