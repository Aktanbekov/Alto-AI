// Small shared building blocks for the admin tabs, kept in the same
// indigo/stone palette as the rest of the site.

export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-stone-200 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

export function StatTile({ label, value, hint }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-stone-600 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-stone-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-stone-600 mt-1">{hint}</p>}
    </Card>
  );
}

export function Loading({ what = "data" }) {
  return <p className="text-stone-600 py-8 text-center">Loading {what}…</p>;
}

export function ErrorNote({ error, onRetry }) {
  return (
    <Card className="p-4 border-rose-200 bg-rose-50">
      <p className="text-rose-800 text-sm">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-sm font-medium text-rose-800 underline"
        >
          Try again
        </button>
      )}
    </Card>
  );
}

export function Empty({ children }) {
  return <p className="text-stone-600 py-8 text-center text-sm">{children}</p>;
}

export function Badge({ tone = "stone", children }) {
  const tones = {
    stone: "bg-stone-100 text-stone-700",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
    indigo: "bg-indigo-100 text-indigo-800",
  };
  return (
    <span className={`${tones[tone]} px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap`}>
      {children}
    </span>
  );
}

// A horizontal bar list — used for signups per day, top colleges, grades.
export function BarList({ items, emptyText = "No data yet" }) {
  if (!items?.length) return <Empty>{emptyText}</Empty>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3">
          <span className="text-sm text-stone-700 w-40 shrink-0 truncate" title={item.label}>
            {item.label}
          </span>
          <span className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
            <span
              className="block h-full bg-indigo-600 rounded-full"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </span>
          <span className="text-sm font-semibold text-stone-900 w-10 text-right tabular-nums">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Pagination({ total, limit, offset, onChange }) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <p className="text-sm text-stone-600">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex gap-2">
        <button
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
          className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-700 disabled:opacity-40 hover:bg-stone-50 transition-colors"
        >
          Previous
        </button>
        <button
          disabled={page >= pages}
          onClick={() => onChange(offset + limit)}
          className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-700 disabled:opacity-40 hover:bg-stone-50 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
