import { useState } from "react";
import { useAsync, formatDate, gradeTone } from "./adminUtils";
import {
  Card, Loading, ErrorNote, Empty, Badge, Pagination,
} from "./AdminUI";

export default function AdminInterviews({ list, get }) {
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
          placeholder="Search by user email"
          className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 placeholder:text-stone-500 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-indigo-700 text-white text-sm font-medium hover:bg-indigo-800 transition-colors"
        >
          Search
        </button>
      </form>

      {loading && <Loading what="interviews" />}
      {error && <ErrorNote error={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          {data.sessions.length === 0 ? (
            <Empty>
              {query
                ? `No interviews match “${query}”.`
                : "No interviews recorded yet. Sessions appear here once users complete an interview."}
            </Empty>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr className="text-left text-stone-700">
                      <th className="px-4 py-2.5 font-semibold">User</th>
                      <th className="px-4 py-2.5 font-semibold">Level</th>
                      <th className="px-4 py-2.5 font-semibold">Answers</th>
                      <th className="px-4 py-2.5 font-semibold">Grade</th>
                      <th className="px-4 py-2.5 font-semibold">Score</th>
                      <th className="px-4 py-2.5 font-semibold">Started</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {data.sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-stone-50">
                        <td className="px-4 py-2.5 text-stone-900">{s.user_email || "anonymous"}</td>
                        <td className="px-4 py-2.5 text-stone-700 capitalize">{s.level || "—"}</td>
                        <td className="px-4 py-2.5 text-stone-700 tabular-nums">
                          {s.answer_count}/{s.question_count}
                        </td>
                        <td className="px-4 py-2.5">
                          {s.overall_grade ? (
                            <Badge tone={gradeTone(s.overall_grade)}>{s.overall_grade}</Badge>
                          ) : (
                            <span className="text-stone-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-stone-900 tabular-nums">
                          {s.overall_score ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-stone-600">{formatDate(s.started_at)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => setSelected(s.id)}
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
        <SessionDrawer id={selected} get={get} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function SessionDrawer({ id, get, onClose }) {
  const { loading, error, data, reload } = useAsync(() => get(id), [id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white h-full overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-stone-900">Interview transcript</h2>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-900 text-sm">
            Close
          </button>
        </div>

        {loading && <Loading what="transcript" />}
        {error && <ErrorNote error={error} onRetry={reload} />}

        {!loading && !error && (
          <div className="space-y-5">
            <Card className="p-4 bg-stone-50">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="User" value={data.session.user_email || "anonymous"} />
                <Field label="Level" value={data.session.level || "—"} />
                <Field label="Started" value={formatDate(data.session.started_at)} />
                <Field label="Status" value={data.session.status} />
                <Field label="Score" value={data.session.overall_score ?? "—"} />
                <Field label="Grade" value={data.session.overall_grade || "—"} />
              </div>
              {data.session.verdict && (
                <p className="text-sm text-stone-700 mt-3 pt-3 border-t border-stone-200">
                  <span className="text-stone-600">Verdict: </span>
                  {data.session.verdict}
                </p>
              )}
            </Card>

            {data.answers?.length ? (
              <ol className="space-y-3">
                {data.answers.map((a, i) => (
                  <li key={a.id} className="border border-stone-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-semibold text-stone-900 text-sm">
                        {i + 1}. {a.question_text || a.question_id}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.classification && <Badge>{a.classification}</Badge>}
                        {a.total_score != null && (
                          <span className="text-sm font-semibold text-stone-900 tabular-nums">
                            {a.total_score}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-stone-700 whitespace-pre-wrap">{a.answer_text}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>No answers recorded for this session.</Empty>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-stone-600 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-stone-900 capitalize">{value}</p>
    </div>
  );
}
