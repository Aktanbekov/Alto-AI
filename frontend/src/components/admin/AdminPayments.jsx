import { useState, useEffect, useCallback, useMemo } from "react";
import { Loading, ErrorNote } from "./AdminUI";
import {
  listPaymentRequests, updatePaymentRequest,
  getTelegramStatus, getTelegramLink, connectTelegram, sendTelegramTest, disconnectTelegram,
} from "../../api";
import { planName, dateTime, shortDay, interviewLabel, contactLink, confirmOutcome } from "./adminPlans";

/*
 * Requests: every request from the checkout as one sheet.
 *
 * Card payment is not available yet, so a paid plan is sold by hand. Each row
 * tracks two separate things - has anyone reached out, and did they buy -
 * and marking it Bought turns the plan on for that account. Plans given by
 * hand from a person's profile show here too, as "Given by admin".
 */

const OUTCOMES = [
  { id: "pending", label: "Waiting" },
  { id: "bought", label: "Bought" },
  { id: "declined", label: "Didn't buy" },
];
const outcomeLabel = (id) => OUTCOMES.find((o) => o.id === id)?.label || id;

const FILTERS = [
  { id: "open", label: "Open", test: (r) => r.outcome === "pending" },
  { id: "todo", label: "Not reached out", test: (r) => !r.contacted && r.outcome === "pending" },
  { id: "bought", label: "Bought", test: (r) => r.outcome === "bought" },
  { id: "declined", label: "Didn't buy", test: (r) => r.outcome === "declined" },
  { id: "all", label: "All", test: () => true },
];

const som = (n) => `${(n || 0).toLocaleString("ru-RU")} сом`;

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
      aria-label={`Note for ${row.name}`}
      className="adm-field"
      style={{ width: 200, minHeight: 32, resize: "vertical", fontSize: 13.5, padding: "5px 8px" }}
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
    "Interview date", "Reached out", "Reached out on", "Outcome", "Rounds granted", "Partner",
    "Commission (som)", "Commission paid", "Notes",
  ];
  const lines = rows.map((r) => [
    dateTime(r.created_at), r.name, r.email, r.phone, r.contact, r.telegram ? `@${r.telegram}` : "",
    planName(r.plan), r.price, r.interview_date || "",
    r.contacted ? "yes" : "no", r.contacted_at ? dateTime(r.contacted_at) : "",
    outcomeLabel(r.outcome), r.granted_sets || "", r.ref_code || "",
    r.commission || "", r.commission_paid_at ? dateTime(r.commission_paid_at) : "", r.notes,
  ].map(csvCell).join(","));
  // The BOM makes Excel read the Cyrillic as UTF-8.
  const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `requests-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------- Telegram --

export function TelegramPanel() {
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

  if (!status) return note.text ? <p className="adm-note bad">{note.text}</p> : <Loading what="Telegram status" />;

  let state;
  let body;
  if (!status.token_set) {
    state = <span className="adm-pill">Off</span>;
    body = (
      <p style={{ margin: 0 }}>
        Add <code>TELEGRAM_BOT_TOKEN</code> to the server's environment (in Vercel, then redeploy), and every new
        request will be sent to your Telegram.
      </p>
    );
  } else if (status.error) {
    state = <span className="adm-pill bad">Token not working</span>;
    body = <p style={{ margin: 0 }}>Telegram rejected the bot token: {status.error}</p>;
  } else if (!status.connected) {
    state = <span className="adm-pill warn">Not connected</span>;
    body = (
      <>
        <p style={{ margin: "0 0 12px" }}>Bot <strong>@{status.bot_username}</strong> is ready. Tell it which chat to send requests to:</p>
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 10 }}>
          <li>
            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="adm-link" style={{ fontWeight: 600 }}>
                Open @{status.bot_username} in Telegram and press Start
              </a>
            ) : (
              <button className="adm-btn quiet small" disabled={busy === "link"}
                onClick={() => run("link", getTelegramLink).then((r) => r && setLink(r.url))}>
                Get the connect link
              </button>
            )}
          </li>
          <li>
            <button className="adm-btn small" disabled={!link || busy === "connect"}
              onClick={() => run("connect", connectTelegram, (r) => `Connected to ${r.chat_name}.`).then((r) => r && load())}>
              {busy === "connect" ? "Checking…" : "I pressed Start"}
            </button>
          </li>
        </ol>
      </>
    );
  } else {
    state = <span className="adm-pill ok">On</span>;
    body = (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0 }}>
          New requests go to {status.chat_source === "env" ? "the chat in TELEGRAM_CHAT_ID" : <strong>{status.chat_name || "your chat"}</strong>}
          {" "}through @{status.bot_username}.
        </p>
        <span style={{ display: "inline-flex", gap: 8 }}>
          <button className="adm-btn quiet small" disabled={busy === "test"}
            onClick={() => run("test", sendTelegramTest, () => "Test message sent. Check Telegram.")}>
            {busy === "test" ? "Sending…" : "Send a test"}
          </button>
          {status.chat_source === "panel" && (
            <button className="adm-btn danger small" disabled={busy === "off"}
              onClick={() => run("off", disconnectTelegram).then((r) => { if (r) { setLink(""); load(); } })}>
              Disconnect
            </button>
          )}
        </span>
      </div>
    );
  }

  return (
    <section className="adm-table-wrap" style={{ padding: "16px 18px", maxWidth: 720 }} aria-labelledby="tg-h">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h2 id="tg-h" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Telegram notifications</h2>
        {state}
      </div>
      <div style={{ fontSize: 14.5, color: "var(--ink-soft)" }}>{body}</div>
      {note.text && <p className={`adm-note ${note.tone}`} style={{ margin: "12px 0 0" }} role="status">{note.text}</p>}
    </section>
  );
}

// ----------------------------------------------------------------- sheet --

export default function AdminPayments({ onChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("open");
  const [saving, setSaving] = useState("");

  const load = useCallback(() => {
    setError("");
    listPaymentRequests({ limit: 200 })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const save = async (r, changes) => {
    if ("outcome" in changes) {
      const check = confirmOutcome(r, changes.outcome);
      if (check.error) { setError(check.error); return; }
      if (!check.ok) return;
    } else {
      // A tick or a note shows at once; an outcome waits for the server,
      // since Bought can be refused and must not look done until it is.
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === r.id ? { ...x, ...changes } : x)) }));
    }
    setSaving(r.id);
    setError("");
    try {
      const row = await updatePaymentRequest(r.id, changes);
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === r.id ? row : x)) }));
      onChange?.();
    } catch (e) {
      setError(`Not saved: ${e.message}`);
      load();
    } finally {
      setSaving("");
    }
  };

  const items = useMemo(() => data?.items || [], [data]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, items.filter(f.test).length])), [items]);
  const bought = items.filter((r) => r.outcome === "bought");
  const revenue = bought.reduce((s, r) => s + r.price, 0);
  const shown = items.filter(FILTERS.find((f) => f.id === filter).test);

  if (error && !data) return <ErrorNote error={error} onRetry={load} />;
  if (!data) return <Loading what="requests" />;

  return (
    <div>
      <dl className="adm-strip">
        <div><dt>Requests</dt><dd>{data.total}</dd></div>
        <div><dt>Not reached out</dt><dd>{counts.todo}</dd></div>
        <div><dt>Bought</dt><dd>{bought.length}<small>{items.length ? `${Math.round((bought.length / items.length) * 100)}%` : ""}</small></dd></div>
        <div><dt>Revenue</dt><dd>{som(revenue)}</dd></div>
      </dl>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div className="adm-tabs" role="tablist" aria-label="Filter requests" style={{ margin: 0, borderBottom: 0 }}>
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <span style={{ display: "inline-flex", gap: 8 }}>
          <button className="adm-btn quiet small" onClick={load}>Refresh</button>
          <button className="adm-btn quiet small" onClick={() => downloadCSV(items)} disabled={!items.length}>
            Download CSV
          </button>
        </span>
      </div>

      {error && <p className="adm-note bad" role="alert">{error}</p>}

      {shown.length === 0 ? (
        <p className="adm-note">
          {items.length ? "Nothing here right now." : "No requests yet. They appear here when someone sends the form on the checkout page."}
        </p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Sent</th><th>Person</th><th>Contact</th><th>Plan</th><th>Interview</th>
                <th>Reached out</th><th>Bought?</th><th>Note</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const link = contactLink(r);
                const i = interviewLabel(r.interview_date);
                const manual = r.contact === "manual";
                return (
                  <tr key={r.id} style={r.outcome === "declined" ? { color: "var(--ink-muted)" } : undefined}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--ink-soft)" }}>{dateTime(r.created_at)}</td>
                    <td>
                      <strong style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.name}</strong>
                      {r.email && <span className="sub">{r.email}</span>}
                      {r.ref_code && (
                        <span className="sub">
                          <a href="#partners" className="adm-link">via partner {r.ref_code}</a>
                          {r.commission > 0 && ` · ${som(r.commission)}${r.commission_paid_at ? " paid" : " owed"}`}
                        </span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {manual ? <span className="adm-pill">Given by admin</span> : (
                        <>
                          {link ? <a href={link.href} target="_blank" rel="noopener noreferrer" className="adm-link">{link.label}</a> : "-"}
                          <span className="sub"><a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="adm-link">{r.phone}</a></span>
                        </>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{planName(r.plan)}<span className="sub">{som(r.price)}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {manual ? "-" : i.urgent ? <span className="adm-pill bad">{i.when}</span> : i.text}
                      {!manual && <span className="sub">{i.urgent ? i.text : i.when || ""}</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={r.contacted}
                          disabled={saving === r.id}
                          onChange={(e) => save(r, { contacted: e.target.checked })}
                          style={{ width: 16, height: 16, accentColor: "var(--ink)" }}
                        />
                        {r.contacted ? `Yes${r.contacted_at ? `, ${shortDay(r.contacted_at)}` : ""}` : <span style={{ color: "var(--ink-muted)" }}>No</span>}
                      </label>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <select
                        value={r.outcome}
                        disabled={saving === r.id}
                        onChange={(e) => save(r, { outcome: e.target.value })}
                        aria-label={`Did ${r.name} buy?`}
                        className="adm-field"
                        style={{
                          minHeight: 30, padding: "3px 8px", fontSize: 13.5, fontWeight: 600,
                          ...(r.outcome === "bought" ? { color: "var(--ok)", borderColor: "rgba(47,107,79,.45)", background: "rgba(47,107,79,.06)" } : {}),
                        }}
                      >
                        {OUTCOMES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                      {r.granted_sets > 0 && (
                        <span className="sub" style={{ color: "var(--ok)" }}>
                          Plan on · +{r.granted_sets} rounds{r.granted_at ? `, ${shortDay(r.granted_at)}` : ""}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "6px 12px" }}><NotesCell row={r} onSave={(c) => save(r, c)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
