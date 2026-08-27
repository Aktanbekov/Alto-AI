import { useEffect, useState } from "react";
import { getCorpusStats } from "../api";
import ProportionBar from "./charts/ProportionBar";
import BarChart from "./charts/BarChart";
import DivergingChart from "./charts/DivergingChart";
import { SMALL_N } from "./charts/useChartWidth";

// Question types below this many appearances are dropped rather than faded:
// with a handful of observations the percentage-point delta is meaningless.
const MIN_ASKED = 150;

// Sorted by decided volume so the largest, most trustworthy groups lead.
function toRows(obj, limit = 12) {
  return Object.entries(obj || {})
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.n_decided - a.n_decided)
    .slice(0, limit);
}

export default function CorpusDashboard() {
  const [state, setState] = useState({ loading: true, error: null, stats: null });

  useEffect(() => {
    let cancelled = false;
    getCorpusStats()
      .then((stats) => !cancelled && setState({ loading: false, error: null, stats }))
      .catch((err) => !cancelled && setState({ loading: false, error: err.message, stats: null }));
    return () => { cancelled = true; };
  }, []);

  if (state.loading) return <p className="sub">Loading the corpus…</p>;
  if (state.error) {
    return (
      <div className="caveat bad">
        <strong>Statistics unavailable.</strong> {state.error}
      </div>
    );
  }

  const s = state.stats;
  const counts = s.meta.outcome_counts || {};
  const years = (s.meta.year_range || []).join("–");
  const withTranscript = s.meta.n_with_transcript ?? 14589;

  const tiles = [
    { k: "Interviews", n: s.meta.n_records.toLocaleString(), sub: "deduplicated posts" },
    {
      k: "With an outcome",
      n: s.overall.n_decided.toLocaleString(),
      sub: `${Math.round((s.overall.n_decided / s.meta.n_records) * 100)}% of corpus`,
    },
    {
      k: "Approved share",
      n: `${(s.overall.approval_rate * 100).toFixed(1)}%`,
      sub: "among posters, not the true rate",
    },
    { k: "Full transcripts", n: withTranscript.toLocaleString(), sub: "readable question by question" },
    { k: "Years covered", n: years, sub: "earliest to latest post" },
  ];

  const attempts = toRows(s.by_attempt).map((r) => ({
    ...r,
    label: `Attempt ${String(r.label).replace(".0", "")}`,
  }));

  const questionTypes = (s.question_types || [])
    .filter((q) => q.asked_in >= MIN_ASKED)
    .sort((a, b) => a.delta_vs_base - b.delta_vs_base);

  return (
    <>
      <div className="caveat">
        <strong>Read this first.</strong> These are self-selected, self-reported posts. The
        approval share describes <em>who chose to post</em>, not the true consular
        approval rate. Nothing here predicts an individual outcome.
      </div>

      <div className="tiles">
        {tiles.map((t) => (
          <div className="tile" key={t.k}>
            <div className="k">{t.k}</div>
            <div className="v">{t.n}</div>
            <div className="n">{t.sub}</div>
          </div>
        ))}
      </div>

      <div className="vz-card">
        <h2>Outcome mix</h2>
        <p className="sub">Every record in the corpus, including those with no stated decision.</p>
        <ProportionBar
          segments={[
            { label: "Approved", value: counts.approved || 0, color: "#2a78d6" },
            { label: "Rejected", value: counts.rejected || 0, color: "#d03b3b" },
            {
              label: "221(g) processing",
              value: counts.administrative_processing_221g || 0,
              color: "#898781",
            },
            { label: "Not stated", value: counts.unknown || 0, color: "#dedcd6" },
          ]}
        />
      </div>

      <div className="vz-grid-two">
        <div className="vz-card">
          <h2>By degree level</h2>
          <p className="sub">Bachelor&rsquo;s applicants post markedly worse outcomes than Masters.</p>
          <BarChart rows={toRows(s.by_degree)} />
        </div>
        <div className="vz-card">
          <h2>By visa attempt</h2>
          <p className="sub">
            A second attempt posts a much lower approval share. Faded bars are small
            samples (under {SMALL_N} decided) — read them as noise, not signal.
          </p>
          <BarChart rows={attempts} />
        </div>
      </div>

      <div className="vz-card">
        <h2>Which questions track with which outcomes</h2>
        <p className="sub">
          Percentage-point difference from the corpus-wide approval share when a
          question type appears in an interview.
        </p>
        <div className="caveat bad">
          <strong>The causation runs backwards.</strong> A question does not cause a refusal.
          Officers probe prior refusals <em>because</em> a case already looks
          doubtful, and reach loan paperwork <em>because</em> the interview is going
          well. You cannot control what you are asked — so treat this as a map of
          where officers dig, not a list of topics to dodge.
        </div>
        <DivergingChart rows={questionTypes} />
      </div>
    </>
  );
}
