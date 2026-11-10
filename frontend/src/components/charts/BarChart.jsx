import { SMALL_N } from "./useChartWidth";
import { useTooltip } from "./useTooltip";
import Tooltip from "./Tooltip";
import { useLang, useCopy, formatNumber } from "../../i18n";

const COPY = {
  ru: {
    empty: "Для этого разреза нет данных.",
    share: (v) => `Доля одобрений: ${v}%`,
    decided: (n) => `Собеседований с итогом: ${n}`,
    small: "Маленькая группа, выводы делайте осторожно",
    // No unit in Russian: the word does not fit the count column, so the
    // chart's caption says what the number is instead.
    posts: () => "",
  },
};

/*
 * Horizontal approval-rate bars. Rows with fewer than SMALL_N decided records
 * render faded and are flagged in the tooltip: visa_llm's rule is to show a
 * thin sample as visibly thin rather than drop it, so the reader can tell
 * "low" apart from "barely measured".
 */
// showCount puts each group's size beside its share, for breakdowns where how
// much evidence a row stands on is the point (the consulate chart).
export default function BarChart({ rows, showCount = false }) {
  const { tip, bind } = useTooltip();
  const { lang } = useLang();
  const c = useCopy(COPY);

  if (!rows?.length) return <p className="sub">{c.empty}</p>;

  return (
    <div>
      {rows.map((r) => {
        const value = r.approval_rate ?? r.value ?? 0;
        const small = (r.n_decided ?? Infinity) < SMALL_N;
        return (
          <div className={`vzbar${showCount ? " counted" : ""}`} key={r.label}>
            <span className="lab">{r.label}{small ? " *" : ""}</span>
            <span
              className="track"
              {...bind(r.label, [
                c.share((value * 100).toFixed(1)),
                c.decided(r.n_decided != null ? formatNumber(lang, r.n_decided) : "?"),
                small ? c.small : "",
              ])}
            >
              <span
                className={`fill${small ? " lite" : ""}`}
                style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
              />
            </span>
            <span className="val">
              {(value * 100).toFixed(1)}%
              {showCount && r.n_decided != null && (
                <span className="cnt">
                  {formatNumber(lang, r.n_decided)}
                  {c.posts(r.n_decided) && ` ${c.posts(r.n_decided)}`}
                </span>
              )}
            </span>
          </div>
        );
      })}
      <Tooltip tip={tip} />
    </div>
  );
}
