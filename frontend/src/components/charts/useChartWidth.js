import { useEffect, useRef, useState } from "react";

// Charts are SVG sized in absolute units, so they need a measured width.
// ResizeObserver beats a debounced window listener: it also fires when the
// sidebar collapses or a parent grid reflows without the window changing.
export function useChartWidth(fallback = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof ResizeObserver === "undefined") {
      setWidth(node.clientWidth || fallback);
      return;
    }
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setWidth(w);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [fallback]);

  return [ref, width];
}

export const pct = (v) => `${(v * 100).toFixed(1)}%`;

// Below this many decided records a slice is noise, not signal. The prototype
// fades those bars rather than hiding them, so the gap stays visible.
export const SMALL_N = 150;
