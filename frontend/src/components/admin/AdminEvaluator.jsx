import { useState, useEffect, useCallback } from "react";
import { Card, StatTile, Loading, ErrorNote, Empty } from "./AdminUI";

/*
 * Evaluator health.
 *
 * When scoring fails for a reason the student cannot act on — the Anthropic
 * account is out of credit, the API key was rejected — they see only
 * "temporarily unavailable". The real cause lands here, because someone has to
 * know, and it should not be every visitor.
 *
 * Counts are since the last server restart; the log lives in memory.
 */

const KINDS = {
  billing: { label: "Out of credit", tone: "text-rose-800 bg-rose-50 border-rose-200" },
  credentials: { label: "Key rejected", tone: "text-amber-800 bg-amber-50 border-amber-200" },
  upstream: { label: "Upstream error", tone: "text-stone-700 bg-stone-50 border-stone-200" },
};

function when(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function AdminEvaluator({ load }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    load()
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((err) => setState({ loading: false, error: err.message, data: null }));
  }, [load]);

  useEffect(refresh, [refresh]);

  if (state.loading && !state.data) return <Loading what="evaluator health" />;
  if (state.error) return <ErrorNote error={state.error} onRetry={refresh} />;

  const { incidents = [], totals = {}, since, action_required: action, spend = {} } = state.data || {};
  const runs = spend.runs || [];

  // Where the money goes. Input and output are priced ~5x apart, so the split
  // is the whole story: a long prompt and a long answer cost very differently.
  const totalIn = runs.reduce((n, r) => n + (r.usage?.input_tokens || 0), 0);
  const totalOut = runs.reduce((n, r) => n + (r.usage?.output_tokens || 0), 0);
  const totalCached = runs.reduce((n, r) => n + (r.usage?.cached_tokens || 0), 0);
  const money = (n) => `$${(n || 0).toFixed(4)}`;

  return (
    <div className="space-y-4">
      {action && (
        <Card className="p-4 border-rose-200 bg-rose-50">
          <p className="text-xs font-medium text-rose-800 uppercase tracking-wide">
            Action required
          </p>
          <p className="text-rose-900 mt-1">{action}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Out of credit" value={totals.billing || 0} hint="hidden from students" />
        <StatTile label="Key rejected" value={totals.credentials || 0} hint="hidden from students" />
        <StatTile label="Other failures" value={totals.upstream || 0} hint="sidecar or network" />
        <StatTile
          label="Counting since"
          value={since ? when(since).split(",")[0] : "—"}
          hint="resets on restart"
        />
      </div>

      <Card className="p-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-stone-900">Cost per evaluation</h3>
          <p className="text-sm text-stone-600">
            {spend.count || 0} evaluations · {money(spend.total_usd)} total
          </p>
        </div>
        {runs.length === 0 ? (
          <Empty>No evaluations since the last restart.</Empty>
        ) : (
          <>
            <p className="text-3xl font-bold text-stone-900 mt-2">
              {money(spend.avg_usd)}
              <span className="text-sm font-normal text-stone-600 ml-2">average</span>
            </p>
            <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
              <div>
                <p className="text-stone-600">Input tokens</p>
                <p className="font-semibold text-stone-900">{totalIn.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-stone-600">Output tokens</p>
                <p className="font-semibold text-stone-900">{totalOut.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-stone-600">Served from cache</p>
                <p className="font-semibold text-stone-900">{totalCached.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {runs.slice(0, 10).map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-stone-600 flex-wrap">
                  <span className="font-semibold text-stone-900">{money(r.usage?.cost_usd)}</span>
                  <span>{when(r.at)}</span>
                  <span>
                    in {(r.usage?.input_tokens || 0).toLocaleString()} · out{" "}
                    {(r.usage?.output_tokens || 0).toLocaleString()}
                  </span>
                  {r.usage?.model && <span className="text-stone-500">{r.usage.model}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-stone-900">Recent failures</h3>
        <button onClick={refresh} className="text-sm font-medium text-indigo-700 underline">
          Refresh
        </button>
      </div>

      {incidents.length === 0 ? (
        <Empty>No failed evaluations since the last restart.</Empty>
      ) : (
        <div className="space-y-2">
          {incidents.map((it, i) => {
            const kind = KINDS[it.kind] || KINDS.upstream;
            return (
              <Card key={i} className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${kind.tone}`}>
                    {kind.label}
                  </span>
                  <span className="text-xs text-stone-600">{when(it.at)}</span>
                  {it.status_code ? (
                    <span className="text-xs text-stone-500">HTTP {it.status_code}</span>
                  ) : null}
                  {it.user_email ? (
                    <span className="text-xs text-stone-500">· {it.user_email}</span>
                  ) : null}
                </div>
                <p className="text-sm text-stone-800 mt-2">{it.detail}</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
