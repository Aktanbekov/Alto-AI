/*
 * Three models' answers to the same profile, side by side.
 *
 * The comparison this screen exists to support is "is the model we pay for
 * worth it", which is a question about four things at once: what each model
 * concluded, how long it took, what it cost, and whether it worked at all. So
 * the headline row carries all four, and the full reports sit behind tabs -
 * three reports rendered at once is more text than anyone compares.
 *
 * A model that failed keeps its card and its tab. Dropping it would quietly
 * turn a three-way comparison into a two-way one, and "DeepSeek could not
 * answer" is a finding, not an absence of one.
 */

import { useState } from "react";

const LABELS = {
  opus: "Claude Opus 5",
  deepseek: "DeepSeek V4 Pro",
  "o3-mini": "OpenAI o3-mini",
};

// Opus is what production uses; the other two are the candidates being measured
// against it, so its numbers are the baseline the deltas are read from.
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

export default function ModelCompare({ results, renderReport, onBack }) {
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
          Same profile, same retrieved interviews, same instruction &mdash; only the
          model differs.
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
                  <div><dt>Time</dt><dd>{seconds(row.latency_ms)}</dd></div>
                  <div><dt>Cost</dt><dd>{money(row.usage)}</dd></div>
                  <div><dt>Tokens</dt><dd>{tokens(row.usage)}</dd></div>
                  <div><dt>Flags</dt><dd>{row.evaluation?.risk_factors?.length ?? 0}</dd></div>
                  <div><dt>Likely Qs</dt><dd>{row.evaluation?.likely_questions?.length ?? 0}</dd></div>
                </dl>
                <div className="mc-rel">{relativeCost(row, baseline)}</div>
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
