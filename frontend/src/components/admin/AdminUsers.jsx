import { useState } from "react";
import { useAsync, formatDate, gradeTone } from "./adminUtils";
import {
  Card, Loading, ErrorNote, Empty, Badge, Pagination,
} from "./AdminUI";

export default function AdminUsers({ list, get, remove, verify }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const limit = 25;

  const { loading, error, data, reload } = useAsync(
    () => list({ search: query, limit, offset }),
    [query, offset]
  );

  const submitSearch = (e) => {
    e.preventDefault();
    setOffset(0);
    setQuery(search.trim());
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submitSearch} className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email, name, college, or major"
          className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 placeholder:text-stone-500 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-indigo-700 text-white text-sm font-medium hover:bg-indigo-800 transition-colors"
        >
          Search
        </button>
      </form>

      {loading && <Loading what="users" />}
      {error && <ErrorNote error={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          {data.users.length === 0 ? (
            <Empty>{query ? `No users match “${query}”.` : "No users yet."}</Empty>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr className="text-left text-stone-700">
                      <th className="px-4 py-2.5 font-semibold">Name</th>
                      <th className="px-4 py-2.5 font-semibold">Email</th>
                      <th className="px-4 py-2.5 font-semibold">College</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 font-semibold">Joined</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {data.users.map((u) => (
                      <tr key={u.id} className="hover:bg-stone-50">
                        <td className="px-4 py-2.5 text-stone-900 font-medium">{u.name || "—"}</td>
                        <td className="px-4 py-2.5 text-stone-700">{u.email}</td>
                        <td className="px-4 py-2.5 text-stone-700">{u.college || "—"}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone={u.email_verified ? "emerald" : "amber"}>
                            {u.email_verified ? "Verified" : "Unverified"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-stone-600">{formatDate(u.created_at)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => setSelected(u.id)}
                            className="text-indigo-700 hover:text-indigo-900 font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Pagination total={data.total} limit={data.limit} offset={data.offset} onChange={setOffset} />
        </>
      )}

      {selected && (
        <UserDrawer
          id={selected}
          get={get}
          remove={remove}
          verify={verify}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); reload(); }}
        />
      )}
    </div>
  );
}

function UserDrawer({ id, get, remove, verify, onClose, onChanged }) {
  const { loading, error, data, reload } = useAsync(() => get(id), [id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const act = async (fn) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setActionError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white h-full overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-stone-900">User details</h2>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-900 text-sm">
            Close
          </button>
        </div>

        {loading && <Loading what="user" />}
        {error && <ErrorNote error={error} onRetry={reload} />}

        {!loading && !error && (
          <div className="space-y-5">
            <dl className="space-y-2 text-sm">
              <Row label="Name" value={data.user.name} />
              <Row label="Email" value={data.user.email} />
              <Row label="College" value={data.user.college} />
              <Row label="Major" value={data.user.major} />
              <Row label="Joined" value={formatDate(data.user.created_at)} />
              <div className="flex justify-between gap-4">
                <dt className="text-stone-600">Status</dt>
                <dd>
                  <Badge tone={data.user.email_verified ? "emerald" : "amber"}>
                    {data.user.email_verified ? "Verified" : "Unverified"}
                  </Badge>
                </dd>
              </div>
            </dl>

            <div>
              <h3 className="font-semibold text-stone-900 mb-2 text-sm">
                Interviews ({data.sessions?.length || 0})
              </h3>
              {data.sessions?.length ? (
                <ul className="space-y-2">
                  {data.sessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 border border-stone-200 rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-stone-900 capitalize">{s.level || "unspecified"}</p>
                        <p className="text-xs text-stone-600">{formatDate(s.started_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.overall_grade && <Badge tone={gradeTone(s.overall_grade)}>{s.overall_grade}</Badge>}
                        <span className="text-sm font-semibold text-stone-900 tabular-nums">
                          {s.overall_score ?? "—"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No interviews recorded for this user.</Empty>
              )}
            </div>

            {actionError && <ErrorNote error={actionError} />}

            <div className="flex flex-col gap-2 pt-2 border-t border-stone-200">
              {!data.user.email_verified && (
                <button
                  disabled={busy}
                  onClick={() => act(() => verify(id))}
                  className="w-full px-4 py-2 rounded-lg bg-indigo-700 text-white text-sm font-medium hover:bg-indigo-800 disabled:opacity-50 transition-colors"
                >
                  Mark email verified
                </button>
              )}

              {confirmDelete ? (
                <div className="border border-rose-200 bg-rose-50 rounded-lg p-3">
                  <p className="text-sm text-rose-800 mb-2">
                    Permanently delete {data.user.email}? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => act(() => remove(id))}
                      className="px-3 py-1.5 rounded-lg bg-rose-700 text-white text-sm font-medium hover:bg-rose-800 disabled:opacity-50 transition-colors"
                    >
                      {busy ? "Deleting…" : "Delete permanently"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full px-4 py-2 rounded-lg border border-rose-300 text-rose-700 text-sm font-medium hover:bg-rose-50 transition-colors"
                >
                  Delete user
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone-600">{label}</dt>
      <dd className="text-stone-900 text-right break-all">{value || "—"}</dd>
    </div>
  );
}
