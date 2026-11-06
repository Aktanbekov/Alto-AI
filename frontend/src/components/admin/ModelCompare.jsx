/*
 * The configured models' answers to the same profile, side by side.
 *
 * Scoring now runs on Anthropic only, so this shows a single model; it still
 * renders any number the server returns. The headline row carries what the
 * model concluded, how long it took, what it cost, and whether it worked, and
 * the full reports sit behind tabs.
 *
 * A model that failed keeps its card and its tab: "the model could not
 * answer" is a finding, not an absence of one.
 */

import { useState } from "react";

const LABELS = {
  opus: "Claude Opus 5",
  report: "AI report",
};

// Opus is the established baseline, so admin cost deltas are read against it.
const BASELINE = "opus";

const labelOf = (key) => LABELS[key] || key;

const seconds = (ms) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);

// An unpriced model shows a dash, never $0.00 - see cost_known on the server.
// A zero that means "we have no rate for this" reads as "free", which is the
// one reading that would change a decision.
function money(usage) {
  if (!usage || !usage.cost_known) return "—";
  return `$${Number(usage.cost_usd || 0).toFixed(4)}`;
}

const tokens = (usage) =>
  usage ? `${usage.input_tokens || 0} in / ${usage.output_tokens || 0} out` : "—";

// How much cheaper or dearer than the baseline, when both are priced.
function relativeCost(row, baseline) {
  if (row.model === BASELINE) return "baseline";
  const a = row.usage, b = baseline?.usage;
  if (!a?.cost_known || !b?.cost_known || !b.cost_usd) return "";
  const ratio = a.cost_usd / b.cost_usd;
  if (ratio < 1) return `${(1 / ratio).toFixed(1)}× cheaper`;
  return `${ratio.toFixed(1)}× dearer`;
}

const readinessTone = (v) =>
  v === "strong" ? "ok" : v === "weak" || v === "needs_work" ? "bad" : "";

export default function ModelCompare({
  results,
  renderReport,
  onBack,
  showMetrics = true,
  intro = "Same profile, same retrieved interviews, same instruction — only the model differs.",
}) {
  const rows = results || [];
  // Open on the first model that actually produced something, so a failed
  // baseline does not land the reader on an empty tab.
  const [active, setActive] = useState(
    () => (rows.find((r) => r.evaluation) || rows[0] || {}).model || ""
  );
  const baseline = rows.find((r) => r.model === BASELINE);
  const shown = rows.find((r) => r.model === active);

  return (
    <div className="ev-result">
      <div className="mc-head">
        <p className="sub" style={{ margin: 0 }}>
          {intro}
        </p>
        {onBack && (
          <button type="button" className="ev-devfill" onClick={onBack}>
            Back to the form
          </button>
        )}
      </div>

      <div className="mc-cards">
        {rows.map((row) => (
          <div
            key={row.model}
            className={`mc-card${row.error ? " bad" : ""}${row.model === active ? " on" : ""}`}
          >
            <div className="mc-name">{labelOf(row.model)}</div>
            {row.error ? (
              <>
                <div className="mc-verdict bad">failed</div>
                {/* Verbatim, because an admin is the one person who can act on
                    the real message. */}
                <p className="mc-err">{row.error}</p>
                <dl className="mc-stats">
                  <div><dt>Time</dt><dd>{seconds(row.latency_ms)}</dd></div>
                </dl>
              </>
            ) : (
              <>
                <div className={`mc-verdict ${readinessTone(row.evaluation?.readiness)}`}>
                  {(row.evaluation?.readiness || "—").replace(/_/g, " ")}
                </div>
                <dl className="mc-stats">
                  {showMetrics && <div><dt>Time</dt><dd>{seconds(row.latency_ms)}</dd></div>}
                  {showMetrics && <div><dt>Cost</dt><dd>{money(row.usage)}</dd></div>}
                  {showMetrics && <div><dt>Tokens</dt><dd>{tokens(row.usage)}</dd></div>}
                  <div><dt>Flags</dt><dd>{row.evaluation?.risk_factors?.length ?? 0}</dd></div>
                  <div><dt>Likely Qs</dt><dd>{row.evaluation?.likely_questions?.length ?? 0}</dd></div>
                </dl>
                {showMetrics && <div className="mc-rel">{relativeCost(row, baseline)}</div>}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mc-tabs">
        {rows.map((row) => (
          <button
            key={row.model}
            type="button"
            className={`mc-tab${row.model === active ? " on" : ""}`}
            onClick={() => setActive(row.model)}
          >
            {labelOf(row.model)}
            {row.error && <span className="mc-dot" title="this model failed" />}
          </button>
        ))}
      </div>

      {shown?.evaluation ? (
        renderReport(shown.evaluation)
      ) : (
        <div className="caveat bad">
          <strong>{labelOf(active)} produced no report.</strong>{" "}
          {shown?.error || "No further detail was returned."}
        </div>
      )}
    </div>
  );
}
