import { useState, useEffect, useCallback } from "react";

// useAsync runs an async loader and exposes {loading, error, data, reload}.
// The loader is re-run whenever `deps` change; in-flight results are discarded
// if the component unmounts or deps change first.
export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const run = useCallback(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => !cancelled && setState({ loading: false, error: null, data }))
      .catch((err) => !cancelled && setState({ loading: false, error: err.message, data: null }));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);

  return { ...state, reload: run };
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function gradeTone(grade) {
  if (grade === "A") return "emerald";
  if (grade === "B") return "indigo";
  if (grade === "C") return "amber";
  if (grade) return "rose";
  return "stone";
}
