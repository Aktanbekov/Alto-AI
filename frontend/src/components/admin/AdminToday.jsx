import { useState, useEffect, useCallback, useMemo } from "react";
import { listPaymentRequests, updatePaymentRequest, getAdminStats, getTelegramStatus } from "../../api";
import { Loading, ErrorNote } from "./AdminUI";
import { planName, dateTime, interviewLabel, daysUntil, contactLink, confirmOutcome } from "./adminPlans";

/*
 * Today: the founder's to-do list. Two queues, in the order they matter -
 * people nobody has written to yet (closest interview first, because that
 * person runs out of time first), then people who were contacted and have not
 * decided. Each row carries the one action that moves it along.
 */

const som = (n) => `${(n || 0).toLocaleString("ru-RU")} сом`;

function byUrgency(a, b) {
  const da = daysUntil(a.interview_date);
  const db = daysUntil(b.interview_date);
  const ka = da == null || da < 0 ? Infinity : da;
  const kb = db == null || db < 0 ? Infinity : db;
  if (ka !== kb) return ka - kb;
  return new Date(a.created_at) - new Date(b.created_at); // longest waiting first
}

function Who({ r }) {
  return (
    <td>
      <strong style={{ fontWeight: 600 }}>{r.name}</strong>
      <span className="sub">{r.phone}{r.email ? ` · ${r.email}` : ""}</span>
    </td>
  );
}

function When({ r }) {
  const i = interviewLabel(r.interview_date);
  return (
    <td style={{ whiteSpace: "nowrap" }}>
      {i.urgent ? <span className="adm-pill bad">{i.when}</span> : <span>{i.text}</span>}
      <span className="sub">{i.urgent ? i.text : i.when || ""}</span>
    </td>
  );
}

export default function AdminToday({ go, onChange }) {
  const [items, setItems] = useState(null);
  const [stats, setStats] = useState(null);
  const [telegram, setTelegram] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    setError("");
    listPaymentRequests({ limit: 200 })
      .then((d) => setItems((d.items || []).filter((r) => r.contact !== "manual")))
      .catch((e) => setError(e.message));
    getAdminStats().then(setStats).catch(() => {});
    getTelegramStatus().then(setTelegram).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const save = async (r, changes) => {
    if ("outcome" in changes) {
      const check = confirmOutcome(r, changes.outcome);
      if (check.error) { setError(check.error); return; }
      if (!check.ok) return;
    }
    setBusy(r.id);
    setError("");
    try {
      const row = await updatePaymentRequest(r.id, changes);
      setItems((list) => list.map((x) => (x.id === r.id ? row : x)));
      onChange?.();
    } catch (e) {
      setError(`Not saved: ${e.message}`);
    } finally {
      setBusy("");
    }
  };

  const month = useMemo(() => {
    if (!items) return null;
    const now = new Date();
    const inMonth = (v) => { const d = new Date(v); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); };
    const bought = items.filter((r) => r.outcome === "bought" && inMonth(r.granted_at || r.created_at));
    return {
      requests: items.filter((r) => inMonth(r.created_at)).length,
      bought: bought.length,
      revenue: bought.reduce((s, r) => s + r.price, 0),
    };
  }, [items]);

  if (error && !items) return <ErrorNote error={error} onRetry={load} />;
  if (!items) return <Loading what="today" />;

  const toContact = items.filter((r) => !r.contacted && r.outcome === "pending").sort(byUrgency);
  const deciding = items.filter((r) => r.contacted && r.outcome === "pending").sort(byUrgency);
  const monthName = new Date().toLocaleDateString("en-GB", { month: "long" });

  return (
    <div>
      {telegram && !telegram.connected && (
        <p className="adm-note">
          New requests are not reaching Telegram yet.{" "}
          <a href="#settings/telegram" className="adm-link">Set up notifications</a>
        </p>
      )}

      <dl className="adm-strip">
        <div><dt>Waiting for you</dt><dd>{toContact.length}</dd></div>
        <div><dt>Deciding</dt><dd>{deciding.length}</dd></div>
        <div><dt>Bought in {monthName}</dt><dd>{month.bought}<small>of {month.requests} requests</small></dd></div>
        <div><dt>Revenue in {monthName}</dt><dd>{som(month.revenue)}</dd></div>
        {stats && <div><dt>New accounts, 7 days</dt><dd>{stats.users_last_7_days}</dd></div>}
      </dl>

      {error && <p className="adm-note bad" role="alert">{error}</p>}

      <section aria-labelledby="today-contact" style={{ marginBottom: 28 }}>
        <div className="adm-head" style={{ marginBottom: 10 }}>
          <div>
            <h2 id="today-contact" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Reach out</h2>
            <p>Nobody has written to them yet. Closest interview first.</p>
          </div>
        </div>
        {toContact.length === 0 ? (
          <p className="adm-note">Nobody is waiting. New requests from the checkout appear here{telegram?.connected ? " and in Telegram" : ""}.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Person</th><th>Plan</th><th>Interview</th><th>Sent</th><th>Contact</th><th /></tr></thead>
              <tbody>
                {toContact.map((r) => {
                  const link = contactLink(r);
                  return (
                    <tr key={r.id}>
                      <Who r={r} />
                      <td style={{ whiteSpace: "nowrap" }}>{planName(r.plan)}<span className="sub">{som(r.price)}</span></td>
                      <When r={r} />
                      <td style={{ whiteSpace: "nowrap", color: "var(--ink-soft)" }}>{dateTime(r.created_at)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {link ? <a className="adm-btn quiet small" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a> : "-"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="adm-btn small" disabled={busy === r.id} onClick={() => save(r, { contacted: true })}>
                          Mark reached out
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="today-deciding">
        <div className="adm-head" style={{ marginBottom: 10 }}>
          <div>
            <h2 id="today-deciding" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Waiting on their answer</h2>
            <p>You reached out. Once they pay, press Bought and the plan turns on.</p>
          </div>
        </div>
        {deciding.length === 0 ? (
          <p className="adm-note">No open conversations.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Person</th><th>Plan</th><th>Interview</th><th>Reached out</th><th>Note</th><th /></tr></thead>
              <tbody>
                {deciding.map((r) => (
                  <tr key={r.id}>
                    <Who r={r} />
                    <td style={{ whiteSpace: "nowrap" }}>{planName(r.plan)}<span className="sub">{som(r.price)}</span></td>
                    <When r={r} />
                    <td style={{ whiteSpace: "nowrap", color: "var(--ink-soft)" }}>{dateTime(r.contacted_at)}</td>
                    <td style={{ maxWidth: 220, color: "var(--ink-soft)" }}>{r.notes || "-"}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <button className="adm-btn small" disabled={busy === r.id} onClick={() => save(r, { outcome: "bought" })}>
                          Bought
                        </button>
                        <button className="adm-btn quiet small" disabled={busy === r.id} onClick={() => save(r, { outcome: "declined" })}>
                          Didn't buy
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ marginTop: 14, fontSize: 14 }}>
          <a href="#requests" className="adm-link" onClick={(e) => { e.preventDefault(); go("requests"); }}>
            See every request
          </a>
        </p>
      </section>
    </div>
  );
}
