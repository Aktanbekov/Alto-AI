import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, StatTile, Loading, ErrorNote, Empty, Badge } from "./AdminUI";
import {
  listTrackingLinks, createTrackingLink, updateTrackingLink,
  archiveTrackingLink, deleteTrackingLink,
} from "../../api";

/*
 * Tracking links.
 *
 * Make a link for a channel, post it, and see what that channel actually sent.
 * The link is the site's own URL with a ?src= tag on it - there is no redirect
 * in the middle, so a link keeps working even if this panel is down, and the
 * tag sticks to the visitor for later visits.
 *
 * The table shows the funnel per source rather than clicks alone: a thousand
 * visitors who never start the form are worth less than fifty who finish it,
 * and clicks alone cannot tell those apart.
 */

const num = (n) => (n || 0).toLocaleString();
const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "-");

const field =
  "border border-stone-300 rounded-lg px-2.5 py-1.5 text-sm bg-white w-full " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400";

// Mirrors NormalizeLinkCode in the repository, so the field shows what the
// server will store instead of rejecting it a moment later.
function normalizeCode(raw) {
  return (raw || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
}

function shortDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return "-";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ------------------------------------------------------------------ copy --

function CopyButton({ text, className = "" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access is denied outside a secure context. Falling back to a
      // selection keeps the link reachable rather than failing silently.
      window.prompt("Copy this link:", text);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={`text-xs font-medium px-2 py-1 rounded-md border transition-colors ${
        copied
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-stone-300 text-stone-700 hover:bg-stone-50"
      } ${className}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ------------------------------------------------------------ create form --

function NewLinkForm({ baseUrl, onCreated }) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [destination, setDestination] = useState("/");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const clean = normalizeCode(code);
  const preview = `${baseUrl || "https://altovisas.com"}${destination || "/"}?src=${clean || "your-code"}`;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!clean) {
      setError("Give the link a code, like reddit or youtube-oct.");
      return;
    }
    setSaving(true);
    try {
      await createTrackingLink({ code: clean, label, destination, notes });
      setCode(""); setLabel(""); setDestination("/"); setNotes("");
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-stone-900">New link</h3>
      <p className="text-sm text-stone-600 mt-1">
        One link per place you post. Keep the code short and lowercase - it shows up
        in the URL people see.
      </p>

      <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-stone-600">
          Code
          <input
            className={`${field} mt-1 font-mono`}
            placeholder="reddit"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {code && clean !== code.trim() && (
            <span className="block mt-1 text-stone-500">
              Will be saved as <code className="text-stone-800">{clean || "-"}</code>
            </span>
          )}
        </label>

        <label className="text-xs text-stone-600">
          Label
          <input
            className={`${field} mt-1`}
            placeholder="Reddit - r/f1visa post"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>

        <label className="text-xs text-stone-600">
          Landing page
          <input
            className={`${field} mt-1 font-mono`}
            placeholder="/"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <span className="block mt-1 text-stone-500">
            A path on this site, like <code className="text-stone-800">/</code> or{" "}
            <code className="text-stone-800">/check</code>.
          </span>
        </label>

        <label className="text-xs text-stone-600">
          Notes
          <input
            className={`${field} mt-1`}
            placeholder="Posted 30 Aug, comment thread"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="md:col-span-2">
          <p className="text-xs text-stone-600 mb-1">Link</p>
          <code className="block text-sm bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 break-all text-stone-800">
            {preview}
          </code>
        </div>

        {error && <p className="md:col-span-2 text-sm text-rose-700">{error}</p>}

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Creating…" : "Create link"}
          </button>
        </div>
      </form>
    </Card>
  );
}

// -------------------------------------------------------------- edit row --

function EditRow({ link, onDone, onCancel }) {
  const [label, setLabel] = useState(link.label || "");
  const [destination, setDestination] = useState(link.destination || "/");
  const [notes, setNotes] = useState(link.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await updateTrackingLink(link.code, { label, destination, notes });
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <tr className="bg-indigo-50/40">
      <td colSpan={9} className="px-3 py-3">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-xs text-stone-600">
            Label
            <input className={`${field} mt-1`} value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="text-xs text-stone-600">
            Landing page
            <input className={`${field} mt-1 font-mono`} value={destination} onChange={(e) => setDestination(e.target.value)} />
          </label>
          <label className="text-xs text-stone-600">
            Notes
            <input className={`${field} mt-1`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        {error && <p className="text-sm text-rose-700 mt-2">{error}</p>}
        <p className="text-xs text-stone-500 mt-2">
          The code <code className="text-stone-800">{link.code}</code> cannot change - it is
          already recorded on every visit this link brought in.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-stone-700 rounded-lg border border-stone-300">
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------- table --

function LinkRow({ link, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return <EditRow link={link} onDone={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} />;
  }

  const cell = "px-3 py-2.5 text-sm text-stone-800 tabular-nums text-right whitespace-nowrap";

  return (
    <tr className="border-t border-stone-200 align-top">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-sm font-semibold text-stone-900">{link.code}</code>
          {!link.tracked && <Badge tone="amber">untracked</Badge>}
          {link.archived && <Badge tone="stone">archived</Badge>}
        </div>
        {link.label && <p className="text-xs text-stone-600 mt-0.5">{link.label}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <code className="text-xs text-stone-500 break-all">{link.url}</code>
          <CopyButton text={link.url} />
        </div>
        {link.notes && <p className="text-xs text-stone-500 mt-1">{link.notes}</p>}
      </td>
      <td className={cell}>{num(link.visitors)}</td>
      <td className={cell}>{num(link.page_views)}</td>
      <td className={cell}>{num(link.form_starts)}</td>
      <td className={cell}>{num(link.form_completes)}</td>
      <td className={cell}>
        {num(link.reports)}
        <span className="block text-xs text-stone-500 font-normal">
          {pct(link.reports, link.visitors)} of visitors
        </span>
      </td>
      <td className={cell}>{num(link.signups)}</td>
      <td className={`${cell} text-stone-600 text-xs`}>
        {shortDate(link.first_seen)}
        <span className="block">{shortDate(link.last_seen)}</span>
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        {link.tracked ? (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-indigo-700 hover:underline"
            >
              Edit
            </button>
            <button
              disabled={busy}
              onClick={() => act(() => archiveTrackingLink(link.code, !link.archived))}
              className="text-xs text-stone-600 hover:underline disabled:opacity-50"
            >
              {link.archived ? "Restore" : "Archive"}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm(
                  `Delete the link "${link.code}"?\n\n` +
                  "Its visits are kept - the source just loses its name and shows as untracked."
                )) act(() => deleteTrackingLink(link.code));
              }}
              className="text-xs text-rose-700 hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ) : (
          <span className="text-xs text-stone-500">seen in traffic</span>
        )}
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------- screen --

export default function AdminLinks() {
  const [range, setRange] = useState({ from: "", to: "" });
  const [showArchived, setShowArchived] = useState(false);
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const key = `${range.from}|${range.to}|${showArchived}`;
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    listTrackingLinks({ ...range, archived: showArchived })
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((err) => setState({ loading: false, error: err.message, data: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(load, [load]);

  const { loading, error, data } = state;
  const links = useMemo(() => data?.links || [], [data]);
  const untagged = data?.untagged;

  const totals = useMemo(() => links.reduce(
    (acc, l) => ({
      visitors: acc.visitors + (l.visitors || 0),
      reports: acc.reports + (l.reports || 0),
      signups: acc.signups + (l.signups || 0),
    }),
    { visitors: 0, reports: 0, signups: 0 },
  ), [links]);

  if (loading && !data) return <Loading what="links" />;
  if (error) return <ErrorNote error={error} onRetry={load} />;

  const head = "px-3 py-2 text-xs font-medium text-stone-600 uppercase tracking-wide text-right whitespace-nowrap";

  return (
    <div className="space-y-4">
      <NewLinkForm baseUrl={data?.base_url} onCreated={load} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Tagged visitors" value={num(totals.visitors)} hint="arrived on a link" />
        <StatTile label="Tagged reports" value={num(totals.reports)} hint="generated a report" />
        <StatTile label="Tagged signups" value={num(totals.signups)} hint="created an account" />
        <StatTile
          label="Untagged"
          value={num(untagged?.visitors)}
          hint="direct, search, or a stripped tag"
        />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs text-stone-600">
            From
            <input
              type="date"
              className={`${field} mt-1`}
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </label>
          <label className="text-xs text-stone-600">
            To
            <input
              type="date"
              className={`${field} mt-1`}
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </label>
          <label className="text-xs text-stone-600 flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <button
            onClick={() => { setRange({ from: "", to: "" }); setShowArchived(false); }}
            className="text-sm text-indigo-700 underline pb-2"
          >
            Reset
          </button>
        </div>
        <p className="text-xs text-stone-500 mt-2">
          Shows all time unless you set a range. Every number except page views counts
          people, not visits - one person reloading the report five times is one person.
        </p>
      </Card>

      {data?.stats_error && (
        <ErrorNote error={`Numbers could not be loaded: ${data.stats_error}`} onRetry={load} />
      )}

      <Card className="overflow-x-auto">
        {links.length === 0 ? (
          <Empty>No links yet. Create one above and post it somewhere.</Empty>
        ) : (
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="bg-stone-50">
                <th className="px-3 py-2 text-xs font-medium text-stone-600 uppercase tracking-wide text-left">
                  Link
                </th>
                <th className={head}>Visitors</th>
                <th className={head}>Views</th>
                <th className={head}>Form started</th>
                <th className={head}>Form done</th>
                <th className={head}>Reports</th>
                <th className={head}>Signups</th>
                <th className={head}>First / last</th>
                <th className={head}></th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <LinkRow key={l.code} link={l} onChanged={load} />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-4 bg-stone-50">
        <p className="text-xs font-medium text-stone-600 uppercase tracking-wide">How this works</p>
        <ul className="mt-2 space-y-1.5 text-sm text-stone-700">
          <li>
            The link points straight at the site with a <code>?src=</code> tag. No redirect,
            so nothing extra can break between the post and the page.
          </li>
          <li>
            The tag is stored in the visitor's browser on their first visit and attached to
            everything they do after - including a report they generate a week later.
          </li>
          <li>
            <code>?utm_source=</code> and <code>?ref=</code> are read too, so a link that
            comes back rewritten by another tool still counts.
          </li>
          <li>
            An <Badge tone="amber">untracked</Badge> row is a tag seen in real traffic with no
            link saved for it. Create one with the same code to name it.
          </li>
          <li>
            A visitor who clears their browser storage, or arrives in a private window, comes
            back as untagged. Treat these as a solid floor, not an exact count.
          </li>
        </ul>
      </Card>
    </div>
  );
}
