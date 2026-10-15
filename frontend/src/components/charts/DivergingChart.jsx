import { useTooltip } from "./useTooltip";
import Tooltip from "./Tooltip";
import { questionLabel } from "../../data/questionLabels";

// The longest bar takes this share of the row, so its value label still fits
// between the bar's end and the edge of the plot on a phone.
const REACH = 40;

/*
 * Percentage-point difference from the corpus-wide approval share when a
 * question type appears. Claret left of the centre rule, blue right of it.
 *
 * The causation runs the other way round - officers probe because a case
 * already looks doubtful - which is why the page prints a warning above this.
 */
export default function DivergingChart({ rows }) {
  const { tip, bind } = useTooltip();

  if (!rows?.length) return <p className="sub">No question types met the sample threshold.</p>;

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.delta_vs_base))) || 1;

  return (
    <div>
      <div className="vzdv-head" aria-hidden="true">
        <span>Lower approval</span>
        <span>Higher approval</span>
      </div>
      <div className="vzdv">
        {rows.map((r) => {
          const pp = r.delta_vs_base * 100;
          const width = (Math.abs(r.delta_vs_base) / maxAbs) * REACH;
          const neg = r.delta_vs_base < 0;
          const label = questionLabel(r.question_type);
          // Just past the bar's own end, on the side it grows towards.
          const at = `calc(50% + ${width}% + 6px)`;
          return (
            <div className={`vzrow ${neg ? "neg" : "pos"}`} key={r.question_type}>
              <span className="dl">{label}</span>
              <span
                className="db"
                style={{ width: `${width}%` }}
                {...bind(label, [
                  `${pp >= 0 ? "+" : ""}${pp.toFixed(1)} points vs the whole corpus`,
                  `Asked in ${r.asked_in?.toLocaleString() ?? "?"} interviews`,
                  r.approval_rate_when_asked != null
                    ? `Approval share when asked: ${(r.approval_rate_when_asked * 100).toFixed(1)}%`
                    : "",
                ])}
              />
              <span className="dn" style={neg ? { right: at } : { left: at }}>
                {`${pp > 0 ? "+" : "−"}${Math.abs(pp).toFixed(1)}`}
              </span>
            </div>
          );
        })}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}
