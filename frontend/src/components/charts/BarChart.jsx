import { SMALL_N } from "./useChartWidth";
import { useTooltip } from "./useTooltip";
import Tooltip from "./Tooltip";

/*
 * Horizontal approval-rate bars. Rows with fewer than SMALL_N decided records
 * render faded and are flagged in the tooltip: visa_llm's rule is to show a
 * thin sample as visibly thin rather than drop it, so the reader can tell
 * "low" apart from "barely measured".
 */
export default function BarChart({ rows }) {
  const { tip, bind } = useTooltip();

  if (!rows?.length) return <p className="sub">No data for this breakdown.</p>;

  return (
    <div>
      {rows.map((r) => {
        const value = r.approval_rate ?? r.value ?? 0;
        const small = (r.n_decided ?? Infinity) < SMALL_N;
        return (
          <div className="vzbar" key={r.label}>
            <span className="lab">{r.label}{small ? " *" : ""}</span>
            <span
              className="track"
              {...bind(r.label, [
                `Approval share: ${(value * 100).toFixed(1)}%`,
                `${r.n_decided?.toLocaleString() ?? "?"} decided interviews`,
                small ? "Small sample — read with caution" : "",
              ])}
            >
              <span
                className={`fill${small ? " lite" : ""}`}
                style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
              />
            </span>
            <span className="val">{(value * 100).toFixed(1)}</span>
          </div>
        );
      })}
      <Tooltip tip={tip} />
    </div>
  );
}
