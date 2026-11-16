import { useState, useEffect, useCallback, useMemo } from "react";
import { Loading, ErrorNote } from "./AdminUI";
import { listPartners, createPartner, updatePartner, recordPartnerPayout, archiveTrackingLink } from "../../api";
import { planName, dateTime, shortDay } from "./adminPlans";

/*
 * Partners: people who share a link and are paid a share of what it sells.
 *
 * A partner link is a tracking link with a name and a commission. Anyone who
 * opens it and sends a checkout request within the window counts for that
 * partner; once the request is marked Bought, the partner's cut is added to
 * what they are owed. The money is paid outside the site - "Mark paid" only
 * records that it was.
 */

const som = (n) => `${(n || 0).toLocaleString("ru-RU")} сом`;
const OUTCOME = { pending: "Waiting", bought: "Bought", declined: "Didn't buy" };

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy this link:", text);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button type="button" className="adm-btn quiet small" onClick={copy} aria-label={`Copy ${text}`}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const EMPTY = { partner_name: "", partner_contact: "", commission_pct: 20, code: "", notes: "" };

function PartnerForm({ initial = EMPTY, editing = false, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit({ ...form, commission_pct: Number(form.commission_pct) || 0 });
      if (!editing) setForm(EMPTY);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const label = { display: "grid", gap: 4, fontSize: 13, color: "var(--ink-soft)" };
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <label style={label}>
          Partner name
          <input className="adm-field" required maxLength={120} value={form.partner_name} onChange={set("partner_name")} placeholder="Азиз" />
        </label>
        <label style={label}>
          How to reach them
          <input className="adm-field" maxLength={120} value={form.partner_contact} onChange={set("partner_contact")} placeholder="@telegram or phone" />
        </label>
        <label style={label}>
          Commission, %
          <input className="adm-field" type="number" min={0} max={100} required value={form.commission_pct} onChange={set("commission_pct")} />
        </label>
        {!editing && (
          <label style={label}>
            Link code <span style={{ color: "var(--ink-muted)" }}>optional</span>
            <input className="adm-field" maxLength={64} value={form.code} onChange={set("code")} placeholder="random if empty" />
          </label>
        )}
      </div>
      <label style={label}>
        Notes
        <input className="adm-field" maxLength={2000} value={form.notes} onChange={set("notes")} placeholder="Card number is in your chat, paid monthly…" />
      </label>
      {error && <p className="adm-note bad" role="alert" style={{ margin: 0 }}>{error}</p>}
      <span style={{ display: "inline-flex", gap: 8 }}>
        <button className="adm-btn small" disabled={busy}>{busy ? "Saving…" : editing ? "Save" : "Create link"}</button>
        {onCancel && <button type="button" className="adm-btn quiet small" onClick={onCancel}>Cancel</button>}
      </span>
    </form>
  );
}

export default function AdminPartners() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState({ tone: "", text: "" });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState("");
  const [busy, setBusy] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(() => {
    setError("");
    listPartners().then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const partners = useMemo(() => data?.partners || [], [data]);
  const byCode = useMemo(() => Object.fromEntries(partners.map((p) => [p.code, p])), [partners]);
  const shown = partners.filter((p) => showArchived || !p.archived);
  const archivedCount = partners.filter((p) => p.archived).length;
  const totals = partners.reduce(
    (t, p) => ({ sales: t.sales + p.sales, revenue: t.revenue + p.revenue, owed: t.owed + p.owed, paid: t.paid + p.paid }),
    { sales: 0, revenue: 0, owed: 0, paid: 0 },
  );

  const create = async (body) => {
    const row = await createPartner(body);
    setAdding(false);
    setNote({ tone: "ok", text: `Link for ${row.partner_name} is ready: ${row.url}` });
    load();
  };

  const save = async (code, body) => {
    await updatePartner(code, body);
    setEditing("");
    load();
  };

  const payout = async (p) => {
    if (!window.confirm(`Mark ${som(p.owed)} as paid to ${p.partner_name}?\n\nSend them the money yourself first. This only records that it was paid.`)) return;
    setBusy(p.code);
    try {
      const r = await recordPartnerPayout(p.code);
      setNote({ tone: "ok", text: `Recorded ${som(r.amount)} paid to ${p.partner_name} for ${r.sales} sale${r.sales === 1 ? "" : "s"}.` });
      load();
    } catch (e) {
      setNote({ tone: "bad", text: e.message });
    } finally {
      setBusy("");
    }
  };

  const archive = async (p) => {
    if (!p.archived && !window.confirm(`Stop counting new sales for ${p.partner_name}?\n\nWhat they already earned stays, and you can still mark it paid.`)) return;
    setBusy(p.code);
    try {
      await archiveTrackingLink(p.code, !p.archived);
      load();
    } catch (e) {
      setNote({ tone: "bad", text: e.message });
    } finally {
      setBusy("");
    }
  };

  if (error && !data) return <ErrorNote error={error} onRetry={load} />;
  if (!data) return <Loading what="partners" />;

  return (
    <div>
      <dl className="adm-strip">
        <div><dt>Partners</dt><dd>{partners.length - archivedCount}</dd></div>
        <div><dt>Sales through partners</dt><dd>{totals.sales}</dd></div>
        <div><dt>Revenue from them</dt><dd>{som(totals.revenue)}</dd></div>
        <div><dt>You owe</dt><dd style={totals.owed ? { color: "var(--bad)" } : undefined}>{som(totals.owed)}</dd></div>
      </dl>

      <p className="adm-note" style={{ marginTop: 0 }}>
        Give each partner their link. Anyone who opens it and sends a request within {data.window_days} days counts for that partner.
        When you mark the request <strong>Bought</strong>, their commission is added to what you owe them. Pay them yourself, then press <strong>Mark paid</strong>.
      </p>

      {note.text && <p className={`adm-note ${note.tone}`} role="status">{note.text}</p>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", margin: "16px 0 12px" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Partners</h2>
        <span style={{ display: "inline-flex", gap: 8 }}>
          {archivedCount > 0 && (
            <button className="adm-btn quiet small" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Hide stopped" : `Show stopped (${archivedCount})`}
            </button>
          )}
          <button className="adm-btn quiet small" onClick={load}>Refresh</button>
          {!adding && <button className="adm-btn small" onClick={() => setAdding(true)}>New partner</button>}
        </span>
      </div>

      {adding && (
        <section className="adm-table-wrap" style={{ padding: "16px 18px", marginBottom: 16 }} aria-label="New partner">
          <PartnerForm onSubmit={create} onCancel={() => setAdding(false)} />
        </section>
      )}

      {shown.length === 0 ? (
        <p className="adm-note">No partners yet. Press <strong>New partner</strong> to make a link for someone to share.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Partner</th><th>Link</th><th>Rate</th><th>Requests</th><th>Sold</th>
                <th>Earned</th><th>Owed</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (editing === p.code ? (
                <tr key={p.code}>
                  <td colSpan={8} style={{ padding: "14px 16px" }}>
                    <PartnerForm
                      editing
                      initial={{ partner_name: p.partner_name, partner_contact: p.partner_contact, commission_pct: p.commission_pct, notes: p.notes }}
                      onSubmit={(body) => save(p.code, body)}
                      onCancel={() => setEditing("")}
                    />
                    <p className="adm-note" style={{ margin: "10px 0 0" }}>A new rate counts for sales marked Bought from now on.</p>
                  </td>
                </tr>
              ) : (
                <tr key={p.code} style={p.archived ? { color: "var(--ink-muted)" } : undefined}>
                  <td>
                    <strong style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{p.partner_name || p.code}</strong>
                    {p.archived && <> <span className="adm-pill">Stopped</span></>}
                    {p.partner_contact && <span className="sub">{p.partner_contact}</span>}
                    {p.notes && <span className="sub">{p.notes}</span>}
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <code style={{ fontSize: 13, wordBreak: "break-all" }}>{p.url}</code>
                      <CopyButton text={p.url} />
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{p.commission_pct}%</td>
                  <td>{p.requests}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{p.sales}<span className="sub">{som(p.revenue)}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{som(p.earned)}{p.paid > 0 && <span className="sub">paid {som(p.paid)}</span>}</td>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 600, color: p.owed ? "var(--bad)" : "var(--ink-muted)" }}>{som(p.owed)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-flex", gap: 6 }}>
                      {p.owed > 0 && (
                        <button className="adm-btn small" disabled={busy === p.code} onClick={() => payout(p)}>Mark paid</button>
                      )}
                      <button className="adm-btn quiet small" onClick={() => setEditing(p.code)}>Edit</button>
                      <button className="adm-btn quiet small" disabled={busy === p.code} onClick={() => archive(p)}>
                        {p.archived ? "Restart" : "Stop"}
                      </button>
                    </span>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ margin: "28px 0 12px", fontSize: 17, fontWeight: 600 }}>Requests through partners</h2>
      {data.sales.length === 0 ? (
        <p className="adm-note">None yet. Requests sent by people who came through a partner link show up here and in Requests.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Sent</th><th>Person</th><th>Partner</th><th>Plan</th><th>Status</th><th>Commission</th></tr>
            </thead>
            <tbody>
              {data.sales.map((s) => {
                const p = byCode[s.ref_code];
                return (
                  <tr key={s.id} style={s.outcome === "declined" ? { color: "var(--ink-muted)" } : undefined}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--ink-soft)" }}>{dateTime(s.created_at)}</td>
                    <td><strong style={{ fontWeight: 600 }}>{s.name}</strong>{s.email && <span className="sub">{s.email}</span>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{p?.partner_name || s.ref_code}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{planName(s.plan)}<span className="sub">{som(s.price)}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {s.outcome === "bought" ? <span className="adm-pill ok">Bought</span> : OUTCOME[s.outcome] || s.outcome}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {s.commission > 0 ? som(s.commission) : <span style={{ color: "var(--ink-muted)" }}>-</span>}
                      {s.commission > 0 && (
                        <span className="sub" style={s.commission_paid_at ? { color: "var(--ok)" } : undefined}>
                          {s.commission_paid_at ? `paid ${shortDay(s.commission_paid_at)}` : "owed"}
                        </span>
                      )}
                    </td>
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
