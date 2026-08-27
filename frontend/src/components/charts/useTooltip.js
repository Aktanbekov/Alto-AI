import { useState, useCallback } from "react";

/*
 * Hover state for the chart tooltips, ported from visa-llm's charts.js.
 * The rendering half lives in Tooltip.jsx so this file stays hook-only.
 */
export function useTooltip() {
  const [tip, setTip] = useState(null);

  const show = useCallback((e, title, rows) => {
    setTip({ title, rows: rows.filter(Boolean), x: e.clientX, y: e.clientY });
  }, []);

  const move = useCallback((e) => {
    setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  }, []);

  const hide = useCallback(() => setTip(null), []);

  // Spread onto any mark that should carry a tooltip.
  const bind = useCallback(
    (title, rows) => ({
      onMouseEnter: (e) => show(e, title, rows),
      onMouseMove: move,
      onMouseLeave: hide,
    }),
    [show, move, hide]
  );

  return { tip, bind };
}
