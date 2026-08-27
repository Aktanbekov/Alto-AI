import { useTooltip } from "./useTooltip";
import Tooltip from "./Tooltip";

/*
 * Percentage-point difference from the corpus-wide approval share when a
 * question type appears. Red left of the centre rule, blue right of it.
 *
 * The causation runs the other way round — officers probe because a case
 * already looks doubtful — which is why the page prints a warning above this.
 */
export default function DivergingChart({ rows }) {
  const { tip, bind } = useTooltip();

  if (!rows?.length) return <p className="sub">No question types met the sample threshold.</p>;

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.delta_vs_base))) || 1;

  return (
    <div>
      <div className="vzdv-head">
        <span>lower approval</span>
        <span>higher approval</span>
      </div>
      <div className="vzdv">
        {rows.map((r) => {
          const pp = r.delta_vs_base * 100;
          const width = (Math.abs(r.delta_vs_base) / maxAbs) * 50;
          const neg = r.delta_vs_base < 0;
          const label = r.question_type.replace(/_/g, " ");
          return (
            <div className={`vzrow ${neg ? "neg" : "pos"}`} key={r.question_type}>
              <span className="dl">{label}</span>
              <span
                className="db"
                style={{ width: `${width}%` }}
                {...bind(label, [
                  `${pp >= 0 ? "+" : ""}${pp.toFixed(1)} pp vs corpus base`,
                  `Asked in ${r.asked_in?.toLocaleString() ?? "?"} interviews`,
                  r.approval_rate_when_asked != null
                    ? `Approval when asked: ${(r.approval_rate_when_asked * 100).toFixed(1)}%`
                    : "",
                ])}
              />
              <span className="dn">{`${pp > 0 ? "+" : "−"}${Math.abs(pp).toFixed(1)}`}</span>
            </div>
          );
        })}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}
