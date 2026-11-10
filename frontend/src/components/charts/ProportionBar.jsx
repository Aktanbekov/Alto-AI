import { useTooltip } from "./useTooltip";
import Tooltip from "./Tooltip";
import { useLang, useCopy, formatNumber } from "../../i18n";

const COPY = {
  ru: {
    interviews: (n) => `Собеседований: ${n}`,
    ofCorpus: (p) => `${p}% всех данных`,
  },
};

// Outcome mix as one stacked bar, in visa_llm's palette.
export default function ProportionBar({ segments }) {
  const { tip, bind } = useTooltip();
  const { lang } = useLang();
  const c = useCopy(COPY);
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  return (
    <div>
      <div
        className="vzprop"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}
      >
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            {...bind(s.label, [
              c.interviews(formatNumber(lang, s.value)),
              c.ofCorpus(((s.value / total) * 100).toFixed(1)),
            ])}
          />
        ))}
      </div>
      <div className="legend">
        {segments.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label} - {formatNumber(lang, s.value)} ({((s.value / total) * 100).toFixed(1)}%)
          </span>
        ))}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}
