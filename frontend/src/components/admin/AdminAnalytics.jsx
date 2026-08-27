import { useState, useEffect, useCallback } from "react";
import { Card, StatTile, Loading, ErrorNote, Empty } from "./AdminUI";
import {
  getFunnel, getReportQuality, getCoverageGaps, getFeedbackInbox, getCorpusGrowth,
} from "../../api";

/*
 * Product analytics — the five screens from the build spec.
 *
 * Every screen shares one filter bar. The `src` filter is the important one:
 * people who know the author personally inflate every number, so friends and
 * strangers have to be separable everywhere.
 */

const SCREENS = [
  { id: "funnel", label: "Funnel" },
  { id: "quality", label: "Report quality" },
  { id: "coverage", label: "Coverage gaps" },
  { id: "feedback", label: "Feedback" },
  { id: "corpus", label: "Corpus growth" },
];

const pct = (n) => `${((n || 0) * 100).toFixed(1)}%`;
const num = (n) => (n || 0).toLocaleString();

// -------------------------------------------------------------- filters --

function Filters({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const field = "border border-stone-300 rounded-lg px-2 py-1 text-sm bg-white";
  return (
    <Card className="p-3">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs text-stone-600">
          Source
          <input
            className={`${field} block mt-1`}
            placeholder="all"
            value={value.src || ""}
            onChange={set("src")}
          />
        </label>
        <label className="text-xs text-stone-600">
          From
          <input type="date" className={`${field} block mt-1`} value={value.from || ""} onChange={set("from")} />
        </label>
        <label className="text-xs text-stone-600">
          To
          <input type="date" className={`${field} block mt-1`} value={value.to || ""} onChange={set("to")} />
        </label>
        <label className="text-xs text-stone-600">
          Consulate
          <input className={`${field} block mt-1`} placeholder="all" value={value.consulate || ""} onChange={set("consulate")} />
        </label>
        <label className="text-xs text-stone-600">
          Degree
          <select className={`${field} block mt-1`} value={value.degree_level || ""} onChange={set("degree_level")}>
            <option value="">all</option>
            {["Bachelor", "Masters", "MBA", "PhD"].map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="text-xs text-stone-600">
          Device
          <select className={`${field} block mt-1`} value={value.device || ""} onChange={set("device")}>
            <option value="">all</option>
            <option value="mobile">mobile</option>
            <option value="desktop">desktop</option>
          </select>
        </label>
        <button
          onClick={() => onChange({})}
          className="text-sm text-indigo-700 underline pb-1"
        >
          Reset
        </button>
      </div>
      <p className="text-xs text-stone-500 mt-2">
        Defaults to the last 30 days. Tag links with <code>?src=friends</code> to keep
        people who know you out of the stranger numbers.
      </p>
    </Card>
  );
}

// A one-line note for events the product cannot fire yet, so an un-built
// feature never reads as a dead metric.
function NotWired({ map, keys }) {
  const rows = (keys || []).filter((k) => map && map[k]);
  if (!rows.length) return null;
  return (
    <Card className="p-3 bg-stone-50">
      <p className="text-xs font-medium text-stone-600 uppercase tracking-wide">Not yet instrumented</p>
      <ul className="mt-2 space-y-1">
        {rows.map((k) => (
          <li key={k} className="text-sm text-stone-700">
            <code className="text-stone-900">{k}</code> — {map[k]}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// A hook every screen shares: load on mount and whenever the filters change.
function useScreen(loader, filters) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const key = JSON.stringify(filters);
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    loader(filters)
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((err) => setState({ loading: false, error: err.message, data: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(load, [load]);
  return [state, load];
}

// ---------------------------------------------------------------- funnel --

function FunnelScreen({ filters }) {
  const [{ loading, error, data }, retry] = useScreen(getFunnel, filters);
  if (loading && !data) return <Loading what="funnel" />;
  if (error) return <ErrorNote error={error} onRetry={retry} />;

  const steps = data?.steps || [];
  const top = steps[0]?.visitors || 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Visitors" value={num(top)} hint="distinct, in range" />
        <StatTile
          label="Mobile completion"
          value={pct(data?.mobile_completion?.rate)}
          hint={`${num(data?.mobile_completion?.completed)} of ${num(data?.mobile_completion?.visitors)}`}
        />
        <StatTile
          label="Desktop completion"
          value={pct(data?.desktop_completion?.rate)}
          hint={`${num(data?.desktop_completion?.completed)} of ${num(data?.desktop_completion?.visitors)}`}
        />
        <StatTile
          label="D1 / D7 return"
          value={`${pct(data?.return_rate?.d1)} / ${pct(data?.return_rate?.d7)}`}
          hint={`cohort ${num(data?.return_rate?.cohort)}`}
        />
      </div>

      <Card className="p-4">
        <h3 className="font-semibold text-stone-900 mb-3">Funnel</h3>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={s.name}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-stone-900">{s.name}</span>
                <span className="text-stone-600">
                  {num(s.visitors)}
                  {i > 0 && (
                    <>
                      {" · "}
                      <span className="text-stone-900 font-medium">{pct(s.from_prev)}</span>
                      {" from previous · "}
                      {pct(s.from_top)} from top
                    </>
                  )}
                </span>
              </div>
              <div className="h-2 bg-stone-100 rounded mt-1 overflow-hidden">
                <div
                  className="h-full bg-indigo-500"
                  style={{ width: top ? `${(s.visitors / top) * 100}%` : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Breakdown title="By source" data={data?.by_src} />
        <Breakdown title="By device" data={data?.by_device} />
      </div>

      <NotWired map={data?.not_yet_instrumented} keys={["outcome_submitted", "form_abandon", "form_step_complete"]} />
    </div>
  );
}

function Breakdown({ title, data }) {
  const rows = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  return (
    <Card className="p-4">
      <h3 className="font-semibold text-stone-900 mb-2">{title}</h3>
      {rows.length === 0 ? (
        <Empty>No events yet.</Empty>
      ) : (
        <ul className="space-y-1">
          {rows.map(([k, v]) => (
            <li key={k} className="flex justify-between text-sm">
              <span className="text-stone-700">{k}</span>
              <span className="font-medium text-stone-900">{num(v)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// -------------------------------------------------------------- quality ---

function QualityScreen({ filters }) {
  const [{ loading, error, data }, retry] = useScreen(getReportQuality, filters);
  if (loading && !data) return <Loading what="report quality" />;
  if (error) return <ErrorNote error={error} onRetry={retry} />;

  const cost = data?.cost_usd || {};
  const perReport = data?.reports ? (cost.sum || 0) / data.reports : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Reports" value={num(data?.reports)} hint="generated in range" />
        <StatTile
          label="Cost per report"
          value={`$${perReport.toFixed(4)}`}
          hint={`$${(cost.sum || 0).toFixed(2)} total`}
        />
        <StatTile
          label="Median latency"
          value={`${((data?.latency_ms?.median || 0) / 1000).toFixed(1)}s`}
          hint={`p90 ${((data?.latency_ms?.p90 || 0) / 1000).toFixed(1)}s`}
        />
        <StatTile
          label="Median dwell"
          value={`${Math.round(data?.dwell_seconds?.median || 0)}s`}
          hint="time on the report"
        />
      </div>

      <Card className="p-4 border-indigo-200 bg-indigo-50">
        <p className="text-xs font-medium text-indigo-800 uppercase tracking-wide">
          Demand signal
        </p>
        <p className="text-3xl font-bold text-indigo-900 mt-1">
          {pct(data?.locked_click_per_view)}
        </p>
        <p className="text-sm text-indigo-900 mt-1">
          locked-flag clicks per report view — {num(data?.locked_flag_clicks)} of{" "}
          {num(data?.report_views)} views. Someone asking &ldquo;how do I fix this&rdquo;
          without being prompted.
        </p>
        <p className="text-sm text-indigo-800 mt-2">
          Forward rate: {pct(data?.share_per_view)} ({num(data?.share_clicks)} shares)
        </p>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Breakdown title="Flag frequency" data={data?.flag_frequency} />
        <Breakdown title="Readiness distribution" data={data?.readiness} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Breakdown title="Scroll depth" data={data?.scroll_depth} />
        <Card className="p-4">
          <h3 className="font-semibold text-stone-900 mb-2">Tokens per report</h3>
          <ul className="space-y-1 text-sm">
            <li className="flex justify-between">
              <span className="text-stone-700">Median input</span>
              <span className="font-medium">{num(Math.round(data?.input_tokens?.median || 0))}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-stone-700">Median output</span>
              <span className="font-medium">{num(Math.round(data?.output_tokens?.median || 0))}</span>
            </li>
          </ul>
          <p className="text-xs text-stone-500 mt-2">
            Output bills about five times input, so the split says whether the prompt or
            the answer is the cost.
          </p>
        </Card>
      </div>

      <NotWired
        map={data?.not_yet_instrumented}
        keys={["locked_flag_click", "flag_expand", "paywall_cta_click", "share_click"]}
      />
    </div>
  );
}

// ------------------------------------------------------------- coverage ---

function CoverageScreen({ filters }) {
  const [{ loading, error, data }, retry] = useScreen(getCoverageGaps, filters);
  if (loading && !data) return <Loading what="coverage" />;
  if (error) return <ErrorNote error={error} onRetry={retry} />;

  const table = (title, rows) => (
    <Card className="p-4">
      <h3 className="font-semibold text-stone-900 mb-2">{title}</h3>
      {!rows?.length ? (
        <Empty>No requests yet.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-600">
                <th className="py-1">Requested</th>
                <th className="py-1 text-right">Users</th>
                <th className="py-1 text-right">Corpus records</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-stone-100">
                  <td className="py-1 text-stone-900">{r.name}</td>
                  <td className="py-1 text-right font-medium">{num(r.requests)}</td>
                  <td className={`py-1 text-right ${r.covered ? "text-stone-700" : "text-rose-700 font-semibold"}`}>
                    {r.covered ? num(r.corpus_n) : "none"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card className="p-3 bg-stone-50">
        <p className="text-sm text-stone-700">
          Sorted by least corpus data first — the top rows are what to collect next.
          A consulate with users and no records produces a report built only from
          national and overall statistics.
        </p>
      </Card>
      {table("Consulates", data?.cities)}
      {table("Countries", data?.countries)}
    </div>
  );
}

// ------------------------------------------------------------- feedback ---

function FeedbackScreen({ filters }) {
  const [{ loading, error, data }, retry] = useScreen(getFeedbackInbox, filters);
  if (loading && !data) return <Loading what="feedback" />;
  if (error) return <ErrorNote error={error} onRetry={retry} />;

  const items = data?.items || [];
  return (
    <div className="space-y-3">
      {!items.length && (
        <Card className="p-4 bg-stone-50">
          <p className="text-sm text-stone-700">
            No feedback yet — {data?.note || "the widget is not built"}. The inbox reads
            <code className="mx-1">feedback_answer</code> events as soon as one exists.
          </p>
        </Card>
      )}
      {items.map((it) => (
        <Card key={it.id} className="p-4">
          <div className="flex items-center gap-2 text-xs text-stone-600 flex-wrap">
            <span className={it.props?.helpful ? "text-emerald-700" : "text-rose-700"}>
              {it.props?.helpful ? "helpful" : "not helpful"}
            </span>
            <span>{new Date(it.timestamp).toLocaleString()}</span>
            {it.src && <span>· {it.src}</span>}
            {it.is_mobile && <span>· mobile</span>}
          </div>
          {it.props?.open_text && (
            <p className="text-sm text-stone-900 mt-2">{it.props.open_text}</p>
          )}
        </Card>
      ))}
    </div>
  );
}

// --------------------------------------------------------------- corpus ---

function CorpusScreen() {
  const [{ loading, error, data }, retry] = useScreen(getCorpusGrowth, {});
  if (loading && !data) return <Loading what="corpus" />;
  if (error) return <ErrorNote error={error} onRetry={retry} />;

  const years = Object.entries(data?.by_year || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const cities = Object.entries(data?.by_city || {}).sort((a, b) => b[1].n_decided - a[1].n_decided);

  return (
    <div className="space-y-4">
      <Card className="p-3 bg-amber-50 border-amber-200">
        <p className="text-sm text-amber-900">{data?.limitation}</p>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-stone-900 mb-2">Outcome mix by year</h3>
        <div className="space-y-2">
          {years.map(([year, row]) => (
            <div key={year}>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-stone-900">{year}</span>
                <span className="text-stone-600">
                  {num(row.n_decided)} decided · {pct(row.approval_rate)} approved
                </span>
              </div>
              <div className="h-2 bg-rose-200 rounded mt-1 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: pct(row.approval_rate) }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-stone-900 mb-2">Records by consulate</h3>
        <ul className="space-y-1">
          {cities.map(([city, row]) => (
            <li key={city} className="flex justify-between text-sm">
              <span className="text-stone-700">{city}</span>
              <span className="font-medium text-stone-900">
                {num(row.n_decided)} · {pct(row.approval_rate)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------- shell --

export default function AdminAnalytics() {
  const [screen, setScreen] = useState("funnel");
  const [filters, setFilters] = useState({});

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {SCREENS.map((s) => (
          <button
            key={s.id}
            onClick={() => setScreen(s.id)}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              screen === s.id
                ? "bg-stone-900 text-white"
                : "text-stone-700 hover:bg-stone-100"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {screen !== "corpus" && <Filters value={filters} onChange={setFilters} />}

      {screen === "funnel" && <FunnelScreen filters={filters} />}
      {screen === "quality" && <QualityScreen filters={filters} />}
      {screen === "coverage" && <CoverageScreen filters={filters} />}
      {screen === "feedback" && <FeedbackScreen filters={filters} />}
      {screen === "corpus" && <CorpusScreen />}
    </div>
  );
}
