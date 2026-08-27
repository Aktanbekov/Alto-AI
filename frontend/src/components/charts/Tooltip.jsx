/*
 * Follows the cursor and flips to the other side when it would run off the
 * viewport — the same behaviour as visa-llm's moveTip().
 */
export default function Tooltip({ tip }) {
  if (!tip) return null;

  const PAD = 14;
  // Approximate until measured; keeps the flip decision cheap and jitter-free.
  const W = 260;
  const H = 24 + tip.rows.length * 20;

  let left = tip.x + PAD;
  let top = tip.y + PAD;
  if (left + W > window.innerWidth - 8) left = tip.x - W - PAD;
  if (top + H > window.innerHeight - 8) top = tip.y - H - PAD;

  return (
    <div className="vz-tip" style={{ left: Math.max(8, left), top: Math.max(8, top) }}>
      <div className="t-title">{tip.title}</div>
      {tip.rows.map((r, i) => (
        <div className="t-row" key={i}>{r}</div>
      ))}
    </div>
  );
}
