import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCorpusStats } from "../api";
import { questionLabel } from "../data/questionLabels";
import Arrow from "./ui/Arrow";

const pct = (x) => `${Math.round(x * 100)}%`;

// Question types that are about who pays. Used only to decide whether the
// first finding may say "money comes up first" - the heading follows the
// data, so a rebuilt corpus where it no longer holds gets a neutral one.
const MONEY = new Set([
  "sponsor_occupation", "funding_sponsor", "funding_general", "sponsor_income",
  "funding_loan", "scholarship", "business_details", "tuition_cost",
]);

function Bars({ rows }) {
  return (
    <ul className="mbars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="mbar-l">{r.label}</span>
          <span className="mbar-v">{pct(r.value)}</span>
          <span className="mbar-t" aria-hidden="true">
            <span className="mbar-f" style={{ width: `${Math.max(0, Math.min(1, r.value)) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/*
 * Three things the data says, each as one sentence and one small chart.
 *
 * The home page used to carry the whole dashboard - five charts and four
 * tiles - in the middle of the story. It moved to /data; this keeps the
 * findings a nervous applicant can use, in words they read once.
 */
export default function HomeFindings() {
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCorpusStats()
      .then((s) => !cancelled && setStats(s))
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, []);

  if (failed) return null;
  if (!stats) return <p className="meta" role="status">Loading the numbers…</p>;

  const findings = [];

  const asked = (stats.question_types || [])
    .slice()
    .sort((a, b) => b.share_of_interviews - a.share_of_interviews)
    .slice(0, 4);
  if (asked.length) {
    const money = asked.slice(0, 3).every((q) => MONEY.has(q.question_type));
    findings.push({
      key: "asked",
      title: money ? "Money comes up first." : "What officers ask most.",
      text: money
        ? "The most common questions are all about who pays for your degree."
        : "The questions that came up most often across all the interviews.",
      rows: asked.map((q) => ({ label: questionLabel(q.question_type), value: q.share_of_interviews })),
      note: "Share of interviews where it was asked",
    });
  }

  const first = stats.by_attempt?.["1.0"] || stats.by_attempt?.["1"];
  const second = stats.by_attempt?.["2.0"] || stats.by_attempt?.["2"];
  if (first && second) {
    const harder = second.approval_rate < first.approval_rate - 0.05;
    findings.push({
      key: "attempt",
      title: harder ? "A second attempt is harder." : "First and second attempts.",
      text: `${pct(first.approval_rate)} of first-attempt posts report an approval, against ${pct(second.approval_rate)} on a second attempt.`,
      rows: [
        { label: "First attempt", value: first.approval_rate },
        { label: "Second attempt", value: second.approval_rate },
      ],
      note: "Share of posts reporting an approval",
    });
  }

  const masters = stats.by_degree?.Masters;
  const bachelors = stats.by_degree?.Bachelors;
  if (masters && bachelors) {
    const harder = bachelors.approval_rate < masters.approval_rate - 0.05;
    findings.push({
      key: "degree",
      title: harder ? "Bachelor's applicants are refused more often." : "Bachelor's and Master's.",
      text: `${pct(masters.approval_rate)} of Master's posts report an approval, against ${pct(bachelors.approval_rate)} of Bachelor's.`,
      rows: [
        { label: "Master's", value: masters.approval_rate },
        { label: "Bachelor's", value: bachelors.approval_rate },
      ],
      note: "Share of posts reporting an approval",
    });
  }

  if (!findings.length) return null;

  return (
    <>
      <div className="findings">
        {findings.map((f) => (
          <section className="finding" key={f.key}>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
            <Bars rows={f.rows} />
            <p className="finding-note">{f.note}</p>
          </section>
        ))}
      </div>
      <p className="findings-foot">
        These describe students who chose to post about their interview, not official
        approval rates.{" "}
        <Link to="/data" className="more">
          See all the numbers <Arrow />
        </Link>
      </p>
    </>
  );
}
