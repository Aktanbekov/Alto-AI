import { useState, useEffect } from "react";
import { useAsync, formatDate } from "./adminUtils";
import { Loading, ErrorNote, Pagination } from "./AdminUI";
import {
  listAdminUsers, getAdminUser, deleteAdminUser, verifyAdminUser,
  grantUserPlan, updatePaymentRequest,
} from "../../api";
import { planName, dateTime, PAID_PLAN_IDS, PLAN_SETS, PLAN_PRICES, confirmOutcome } from "./adminPlans";

/*
 * People: every account, with its plan in the list - the way a billing
 * dashboard shows a customer's subscription next to their name.
 *
 * Opening a person shows their plan history (requests from the checkout and
 * plans given by hand), lets the admin give a plan directly or take one back,
 * and keeps the older account tools: interviews, verify email, delete.
 */

function PlanPill({ plan }) {
  if (!plan) return <span style={{ color: "var(--ink-muted)" }}>Free</span>;
  if (plan.status === "paid") {
    return <span className="adm-pill ok">{planName(plan.plan)} · +{plan.rounds}</span>;
  }
  if (plan.status === "requested") return <span className="adm-pill warn">Asked for {planName(plan.plan)}</span>;
  return <span style={{ color: "var(--ink-muted)" }}>Free</span>;
}

export default function AdminPeople() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const limit = 25;

  const { loading, error, data, reload } = useAsync(
    () => listAdminUsers({ search: query, limit, offset }),
    [query, offset]
  );

  const submitSearch = (e) => {
    e.preventDefault();
    setOffset(0);
    setQuery(search.trim());
  };

  return (
    <div>
      <form onSubmit={submitSearch} role="search" style={{ display: "flex", gap: 8, marginBottom: 16, maxWidth: 560 }}>
        <label htmlFor="people-q" className="sr-only">Search people</label>
        <input
          id="people-q"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, college or major"
          className="adm-field"
          style={{ flex: 1 }}
        />
        <button type="submit" className="adm-btn">Search</button>
      </form>

      {loading && <Loading what="people" />}
      {error && <ErrorNote error={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          {data.users.length === 0 ? (
            <p className="adm-note">{query ? `Nobody matches “${query}”.` : "No accounts yet."}</p>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr><th>Person</th><th>Plan</th><th>College</th><th>Email</th><th>Joined</th><th /></tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong style={{ fontWeight: 600 }}>{u.name || "-"}</strong>
                        <span className="sub">{u.email}</span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}><PlanPill plan={u.plan} /></td>
                      <td style={{ color: "var(--ink-soft)" }}>{u.college || "-"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {u.email_verified ? <span style={{ color: "var(--ink-soft)" }}>Verified</span> : <span className="adm-pill warn">Unverified</span>}
                      </td>
                      <td style={{ whiteSpace: "nowrap", color: "var(--ink-soft)" }}>{formatDate(u.created_at)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="adm-btn quiet small" onClick={() => setSelected(u.id)}>Open</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination total={data.total} limit={data.limit} offset={data.offset} onChange={setOffset} />
        </>
      )}

      {selected && (
        <PersonSheet
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={reload}
          onDeleted={() => { setSelected(null); reload(); }}
        />
      )}
    </div>
  );
}

function PersonSheet({ id, onClose, onChanged, onDeleted }) {
  const { loading, error, data, reload } = useAsync(() => getAdminUser(id), [id]);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState({ tone: "", text: "" });
  const [plan, setPlan] = useState("full");
  const [grantNote, setGrantNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const act = async (key, fn, ok) => {
    setBusy(key);
    setNote({ tone: "", text: "" });
    try {
      await fn();
      if (ok) setNote({ tone: "ok", text: ok });
      reload();
      onChanged();
      return true;
    } catch (e) {
      setNote({ tone: "bad", text: e.message });
      return false;
    } finally {
      setBusy("");
    }
  };

  const give = () => {
    const who = data.user.email;
    if (!window.confirm(`Give «${planName(plan)}» to ${who}?\n\n+${PLAN_SETS[plan]} practice rounds, right away.`)) return;
    act("grant", () => grantUserPlan(id, plan, grantNote), `«${planName(plan)}» is on: +${PLAN_SETS[plan]} rounds.`)
      .then((ok) => ok && setGrantNote(""));
  };

  const setOutcome = (r, outcome) => {
    const check = confirmOutcome(r, outcome);
    if (check.error) { setNote({ tone: "bad", text: check.error }); return; }
    if (!check.ok) return;
    act(r.id, () => updatePaymentRequest(r.id, { outcome }),
      outcome === "bought" ? `«${planName(r.plan)}» is on.` : "Plan taken back.");
  };

  return (
    <div className="adm-scrim" onClick={onClose}>
      <div className="adm-sheet" role="dialog" aria-modal="true" aria-labelledby="person-h" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <h2 id="person-h">{data?.user?.name || data?.user?.email || "Person"}</h2>
          <button className="adm-btn quiet small" onClick={onClose}>Close</button>
        </div>

        {loading && <Loading what="person" />}
        {error && <ErrorNote error={error} onRetry={reload} />}

        {!loading && !error && (
          <>
            <p style={{ margin: "4px 0 0", color: "var(--ink-soft)", fontSize: 14.5 }}>{data.user.email}</p>
            {note.text && <p className={`adm-note ${note.tone}`} style={{ margin: "14px 0 0" }} role="status">{note.text}</p>}

            <h3>Plan</h3>
            <p style={{ margin: "0 0 12px" }}><PlanPill plan={data.user.plan} /></p>

            <div style={{ border: "1px solid var(--rule)", borderRadius: 3, padding: 14, background: "var(--paper-2)" }}>
              <label htmlFor="grant-plan" style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                Give a plan
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select id="grant-plan" className="adm-field" value={plan} onChange={(e) => setPlan(e.target.value)} style={{ flex: "1 1 200px" }}>
                  {PAID_PLAN_IDS.map((p) => (
                    <option key={p} value={p}>{planName(p)} · +{PLAN_SETS[p]} rounds · {PLAN_PRICES[p]} сом</option>
                  ))}
                </select>
                <button className="adm-btn" disabled={busy === "grant"} onClick={give}>
                  {busy === "grant" ? "Giving…" : "Give plan"}
                </button>
              </div>
              <input
                className="adm-field"
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                maxLength={2000}
                placeholder="Note, e.g. paid by bank transfer"
                aria-label="Note for this plan"
                style={{ width: "100%", marginTop: 8 }}
              />
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-muted)" }}>
                For a payment outside the checkout form, a gift or a make-good. It shows in Requests as "Given by admin".
              </p>
            </div>

            <h3>History</h3>
            {data.payment_requests?.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {data.payment_requests.map((r) => (
                  <li key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        {planName(r.plan)} <span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>· {r.price} сом</span>
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink-muted)" }}>
                        {r.contact === "manual" ? "Given by admin" : "Checkout request"} · {dateTime(r.created_at)}
                        {r.notes ? ` · ${r.notes}` : ""}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      {r.outcome === "bought" ? (
                        <>
                          <span className="adm-pill ok">On · +{r.granted_sets}</span>
                          <button className="adm-btn danger small" style={{ display: "flex", marginTop: 6, marginLeft: "auto" }}
                            disabled={busy === r.id} onClick={() => setOutcome(r, "declined")}>
                            Take back
                          </button>
                        </>
                      ) : r.outcome === "pending" ? (
                        <>
                          <span className="adm-pill warn">Waiting</span>
                          <button className="adm-btn small" style={{ display: "flex", marginTop: 6, marginLeft: "auto" }}
                            disabled={busy === r.id} onClick={() => setOutcome(r, "bought")}>
                            Mark bought
                          </button>
                        </>
                      ) : (
                        <span className="adm-pill">Didn't buy</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14.5 }}>No requests or plans yet. This person is on the free rounds.</p>
            )}

            <h3>Account</h3>
            <dl className="adm-kv">
              <div><dt>College</dt><dd>{data.user.college || "-"}</dd></div>
              <div><dt>Major</dt><dd>{data.user.major || "-"}</dd></div>
              <div><dt>Joined</dt><dd>{formatDate(data.user.created_at)}</dd></div>
              <div><dt>Email</dt><dd>{data.user.email_verified ? "Verified" : "Not verified"}</dd></div>
            </dl>

            <h3>Interviews ({data.sessions?.length || 0})</h3>
            {data.sessions?.length ? (
              <dl className="adm-kv">
                {data.sessions.map((s) => (
                  <div key={s.id}>
                    <dt style={{ textTransform: "capitalize" }}>{s.level || "unspecified"} · {formatDate(s.started_at)}</dt>
                    <dd>{s.overall_grade ? `${s.overall_grade} · ` : ""}{s.overall_score ?? "-"}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14.5 }}>No practice interviews recorded.</p>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--rule)" }}>
              {!data.user.email_verified && (
                <button className="adm-btn quiet" disabled={!!busy} onClick={() => act("verify", () => verifyAdminUser(id), "Email marked verified.")}>
                  Mark email verified
                </button>
              )}
              {confirmDelete ? (
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, color: "var(--bad)" }}>Delete {data.user.email} for good?</span>
                  <button className="adm-btn danger" disabled={!!busy}
                    onClick={async () => {
                      setBusy("delete");
                      try { await deleteAdminUser(id); onDeleted(); } catch (e) { setNote({ tone: "bad", text: e.message }); setBusy(""); }
                    }}>
                    {busy === "delete" ? "Deleting…" : "Delete"}
                  </button>
                  <button className="adm-btn quiet" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </span>
              ) : (
                <button className="adm-btn danger" onClick={() => setConfirmDelete(true)}>Delete account</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
