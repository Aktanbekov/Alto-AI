import { useAsync } from "./adminUtils";
import { Card, StatTile, Loading, ErrorNote, BarList, Empty } from "./AdminUI";

export default function AdminDashboard({ load }) {
  const { loading, error, data, reload } = useAsync(load, []);

  if (loading) return <Loading what="stats" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const s = data;
  const avg = s.average_score != null ? Math.round(s.average_score) : null;
  const verifiedPct = s.total_users ? Math.round((s.verified_users / s.total_users) * 100) : 0;
  const completionPct = s.total_sessions
    ? Math.round((s.finished_sessions / s.total_sessions) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total users" value={s.total_users} hint={`${s.users_last_7_days} in last 7 days`} />
        <StatTile label="Verified" value={`${verifiedPct}%`} hint={`${s.verified_users} of ${s.total_users}`} />
        <StatTile label="Interviews" value={s.total_sessions} hint={`${s.sessions_last_7_days} in last 7 days`} />
        <StatTile
          label="Avg score"
          value={avg != null ? avg : "—"}
          hint={avg != null ? `${completionPct}% completed` : "No graded sessions yet"}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="font-semibold text-stone-900 mb-3">Signups (last 30 days)</h2>
          <BarList
            items={(s.signups_by_day || []).map((d) => ({ label: d.day, count: d.count }))}
            emptyText="No signups in the last 30 days"
          />
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold text-stone-900 mb-3">Interviews by level</h2>
          <BarList items={s.sessions_by_level} emptyText="No interviews recorded yet" />
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold text-stone-900 mb-3">Top colleges</h2>
          <BarList items={s.top_colleges} emptyText="No colleges recorded yet" />
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold text-stone-900 mb-3">Top majors</h2>
          <BarList items={s.top_majors} emptyText="No majors recorded yet" />
        </Card>
      </section>

      <Card className="p-4">
        <h2 className="font-semibold text-stone-900 mb-3">Grade distribution</h2>
        {s.grade_distribution?.length ? (
          <BarList items={s.grade_distribution} />
        ) : (
          <Empty>
            No graded interviews yet. Grades appear here once users complete
            interviews with deep analysis enabled.
          </Empty>
        )}
      </Card>
    </div>
  );
}
