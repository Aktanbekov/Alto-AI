import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, StatTile, Loading, ErrorNote, Empty } from "./AdminUI";
import {
  listPaymentRequests, updatePaymentRequest,
  getTelegramStatus, getTelegramLink, connectTelegram, sendTelegramTest, disconnectTelegram,
} from "../../api";

/*
 * Payment requests from the checkout, as one sheet.
 *
 * Card payment is not available yet, so a paid plan is sold by hand: someone
 * leaves their details on /checkout and lands here (and in Telegram, once the
 * bot is connected). Each row tracks two separate things: whether anyone has
 * reached out yet, and whether they bought.
 */

const PLAN_NAMES = { quick: "Быстрая", full: "Полная", complete: "Максимум" };
// Rounds a plan adds when marked Bought. Mirrors PaidPlanSets on the server,
// which is what actually grants them; this is only for the confirm prompt.
const PLAN_SETS = { quick: 3, full: 10, complete: 100 };

const OUTCOMES = [
  { id: "pending", label: "Waiting", tone: "border-stone-300 bg-white text-stone-700" },
  { id: "bought", label: "Bought · plan on", tone: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  { id: "declined", label: "Didn't buy", tone: "border-rose-200 bg-rose-50 text-rose-800" },
];
const outcomeTone = (id) => OUTCOMES.find((o) => o.id === id)?.tone || OUTCOMES[0].tone;
const outcomeLabel = (id) => OUTCOMES.find((o) => o.id === id)?.label || id;

const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "todo", label: "Not reached out", test: (r) => !r.contacted },
  { id: "pending", label: "Waiting", test: (r) => r.outcome === "pending" },
  { id: "bought", label: "Bought", test: (r) => r.outcome === "bought" },
  { id: "declined", label: "Didn't buy", test: (r) => r.outcome === "declined" },
];

const pad = (n) => String(n).padStart(2, "0");
function submitted(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function shortDay(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

function daysUntil(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Math.round((d - new Date().setHours(0, 0, 0, 0)) / 86400000);
}

function InterviewCell({ value }) {
  if (!value) return <span className="text-stone-500">Not set</span>;
  const [y, m, d] = value.split("-");
  const days = daysUntil(value);
  const soon = days >= 0 && days <= 7;
  return (
    <span className={soon ? "font-semibold text-rose-700" : "text-stone-900"}>
      {d}.{m}.{y}
      {days >= 0 && (
        <span className="block text-xs font-normal text-stone-500">
          {days === 0 ? "today" : `in ${days} d`}
        </span>
      )}
      {days < 0 && <span className="block text-xs font-normal text-stone-500">passed</span>}
    </span>
  );
}

const digits = (s) => (s || "").replace(/\D/g, "");

function ContactCell({ r }) {
  const href = r.contact === "telegram" ? `https://t.me/${r.telegram}` : `https://wa.me/${digits(r.phone)}`;
  const label = r.contact === "telegram" ? `Telegram @${r.telegram}` : "WhatsApp";
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline">
      {label}
    </a>
  );
}

// Saves on blur, and only when the text actually changed.
function NotesCell({ row, onSave }) {
  const [value, setValue] = useState(row.notes || "");
  useEffect(() => setValue(row.notes || ""), [row.notes]);
  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== (row.notes || "") && onSave({ notes: value })}
      rows={1}
      maxLength={2000}
      placeholder="Add a note"
      aria-label={`Notes for ${row.name}`}
      className="w-48 min-h-[34px] resize-y text-sm border border-transparent hover:border-stone-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 focus:outline-none rounded-md px-2 py-1 bg-transparent focus:bg-white"
    />
  );
}

// ------------------------------------------------------------------ CSV --

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  // A leading = + - @ would run as a formula when the file is opened.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

function downloadCSV(rows) {
  const header = [
    "Submitted", "Name", "Email", "Phone", "Contact via", "Telegram", "Plan", "Price (som)",
    "Interview date", "Reached out", "Reached out on", "Outcome", "Rounds granted", "Notes",
  ];
  const lines = rows.map((r) => [
    submitted(r.created_at), r.name, r.email, r.phone, r.contact, r.telegram ? `@${r.telegram}` : "",
    PLAN_NAMES[r.plan] || r.plan, r.price, r.interview_date || "",
    r.contacted ? "yes" : "no", r.contacted_at ? submitted(r.contacted_at) : "",
    outcomeLabel(r.outcome), r.granted_sets || "", r.notes,
  ].map(csvCell).join(","));
  // The BOM makes Excel read the Cyrillic as UTF-8.
  const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payment-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------- Telegram --

function TelegramPanel() {
  const [status, setStatus] = useState(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState({ tone: "", text: "" });

  const load = useCallback(() => {
    getTelegramStatus().then(setStatus).catch((e) => setNote({ tone: "bad", text: e.message }));
  }, []);
  useEffect(load, [load]);

  const run = async (key, fn, ok) => {
    setBusy(key);
    setNote({ tone: "", text: "" });
    try {
      const res = await fn();
      if (ok) setNote({ tone: "ok", text: ok(res) });
      return res;
    } catch (e) {
      setNote({ tone: "bad", text: e.message });
      return null;
    } finally {
      setBusy("");
    }
  };

  if (!status) return null;

  const btn = "text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50";
  const primary = `${btn} border-indigo-700 bg-indigo-700 text-white hover:bg-indigo-800`;
  const secondary = `${btn} border-stone-300 text-stone-700 hover:bg-stone-50`;

  let body;
  if (!status.token_set) {
    body = (
      <p className="text-sm text-stone-700">
        Off. Set <code className="bg-stone-100 px-1 rounded">TELEGRAM_BOT_TOKEN</code> on the server
        and every new request will be sent to your Telegram.
      </p>
    );
  } else if (status.error) {
    body = <p className="text-sm text-rose-800">The bot token doesn't work: {status.error}</p>;
  } else if (!status.connected) {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-stone-700">
          Bot <b>@{status.bot_username}</b> is ready. Connect the chat it should send requests to.
        </p>
        <ol className="text-sm text-stone-700 space-y-2 list-decimal pl-5">
          <li>
            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-700 hover:underline">
                Open @{status.bot_username} in Telegram and press Start
              </a>
            ) : (
              <button className={secondary} disabled={busy === "link"}
                onClick={() => run("link", getTelegramLink).then((r) => r && setLink(r.url))}>
                Get the connect link
              </button>
            )}
          </li>
          <li>
            <button className={primary} disabled={!link || busy === "connect"}
              onClick={() => run("connect", connectTelegram, (r) => `Connected to ${r.chat_name}.`).then((r) => r && load())}>
              {busy === "connect" ? "Checking…" : "I pressed Start"}
            </button>
          </li>
        </ol>
      </div>
    );
  } else {
    body = (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-stone-700">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 mr-2 align-middle" />
          New requests go to {status.chat_source === "env" ? "the chat in TELEGRAM_CHAT_ID" : <b>{status.chat_name || "your chat"}</b>}
          {" "}via @{status.bot_username}.
        </p>
        <div className="flex gap-2">
          <button className={secondary} disabled={busy === "test"}
            onClick={() => run("test", sendTelegramTest, () => "Test message sent.")}>
            {busy === "test" ? "Sending…" : "Send a test"}
          </button>
          {status.chat_source === "panel" && (
            <button className={secondary} disabled={busy === "off"}
              onClick={() => run("off", disconnectTelegram).then((r) => { if (r) { setLink(""); load(); } })}>
              Disconnect
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-stone-900 mb-2">Telegram notifications</h3>
      {body}
      {note.text && (
        <p className={`text-sm mt-2 ${note.tone === "bad" ? "text-rose-800" : "text-emerald-800"}`} role="status">
          {note.text}
        </p>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------- sheet --

export default function AdminPayments() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [saving, setSaving] = useState("");

  const load = useCallback(() => {
    setError("");
    listPaymentRequests({ limit: 200 })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  // Bought activates the plan on their account; leaving Bought removes it.
  // Both change what a real person can use, so both ask first.
  const changeOutcome = (r, outcome) => {
    const sets = PLAN_SETS[r.plan];
    const plan = PLAN_NAMES[r.plan] || r.plan;
    if (outcome === "bought") {
      if (!r.user_id) {
        setError(`${r.name}'s request isn't linked to an account, so there's nothing to activate the plan on.`);
        return;
      }
      if (!window.confirm(`Confirm payment from ${r.name}?\n\nThis activates «${plan}» on ${r.email || "their account"}: +${sets} practice rounds, right away.`)) return;
    } else if (r.outcome === "bought") {
      if (!window.confirm(`Take the plan back from ${r.name}?\n\nThis removes the ${r.granted_sets || sets} rounds added to ${r.email || "their account"}.`)) return;
    }
    save(r.id, { outcome });
  };

  const save = async (id, changes) => {
    setSaving(id);
    // Show a tick or a note at once; an outcome waits for the server, since
    // Bought can be refused (no account) and must not look done until it is.
    if (!("outcome" in changes)) {
      setData((d) => ({ ...d, items: d.items.map((r) => (r.id === id ? { ...r, ...changes } : r)) }));
    }
    setError("");
    try {
      const row = await updatePaymentRequest(id, changes);
      setData((d) => ({ ...d, items: d.items.map((r) => (r.id === id ? row : r)) }));
    } catch (e) {
      setError(`Not saved: ${e.message}`);
      load();
    } finally {
      setSaving("");
    }
  };

  const items = useMemo(() => data?.items || [], [data]);
  const stats = useMemo(() => ({
    todo: items.filter((r) => !r.contacted).length,
    bought: items.filter((r) => r.outcome === "bought").length,
    revenue: items.filter((r) => r.outcome === "bought").reduce((sum, r) => sum + r.price, 0),
  }), [items]);
  const shown = items.filter(FILTERS.find((f) => f.id === filter).test);

  if (error && !data) return <ErrorNote error={error} onRetry={load} />;
  if (!data) return <Loading what="payment requests" />;

  return (
    <div className="space-y-4">
      <TelegramPanel />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Requests" value={data.total} />
        <StatTile label="Not reached out" value={stats.todo} />
        <StatTile label="Bought" value={stats.bought}
          hint={items.length ? `${Math.round((stats.bought / items.length) * 100)}% of requests` : null} />
        <StatTile label="Revenue" value={`${stats.revenue.toLocaleString("ru-RU")} сом`} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap" role="group" aria-label="Filter requests">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                filter === f.id
                  ? "border-indigo-700 bg-indigo-700 text-white"
                  : "border-stone-300 text-stone-700 hover:bg-stone-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={load} className="text-sm font-medium text-indigo-700 hover:underline">Refresh</button>
          <button
            onClick={() => downloadCSV(items)}
            disabled={!items.length}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Download CSV
          </button>
        </div>
      </div>

      {error && <ErrorNote error={error} />}

      {shown.length === 0 ? (
        <Card>
          <Empty>
            {items.length ? "Nothing matches this filter." : "No requests yet. They appear here when someone submits the checkout form."}
          </Empty>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-stone-50">
              <tr className="text-left text-xs uppercase tracking-wide text-stone-600 border-b border-stone-200">
                {["Submitted", "Name", "Phone", "Contact via", "Plan", "Interview", "Reached out", "Bought?", "Notes"].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-stone-100 last:border-0 align-top ${
                    r.outcome === "bought" ? "bg-emerald-50/40" : r.outcome === "declined" ? "bg-stone-50 text-stone-500" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-stone-600">{submitted(r.created_at)}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-stone-900 whitespace-nowrap">{r.name}</p>
                    {r.email && <p className="text-xs text-stone-600">{r.email}</p>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                    <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="text-stone-900 hover:underline">{r.phone}</a>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><ContactCell r={r} /></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {PLAN_NAMES[r.plan] || r.plan}
                    <span className="block text-xs text-stone-600 tabular-nums">{r.price} сом</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums"><InterviewCell value={r.interview_date} /></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={r.contacted}
                        disabled={saving === r.id}
                        onChange={(e) => save(r.id, { contacted: e.target.checked })}
                        className="w-4 h-4 accent-indigo-700"
                      />
                      <span className={r.contacted ? "text-stone-900" : "text-stone-500"}>
                        {r.contacted ? `Yes${r.contacted_at ? `, ${shortDay(r.contacted_at)}` : ""}` : "No"}
                      </span>
                    </label>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={r.outcome}
                      disabled={saving === r.id}
                      onChange={(e) => changeOutcome(r, e.target.value)}
                      aria-label={`Did ${r.name} buy?`}
                      className={`text-xs font-semibold rounded-full border px-2.5 py-1 ${outcomeTone(r.outcome)}`}
                    >
                      {OUTCOMES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    {r.granted_sets > 0 && (
                      <span className="block mt-1 text-xs text-emerald-800 whitespace-nowrap">
                        +{r.granted_sets} rounds{r.granted_at ? `, ${shortDay(r.granted_at)}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5"><NotesCell row={r} onSave={(c) => save(r.id, c)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
