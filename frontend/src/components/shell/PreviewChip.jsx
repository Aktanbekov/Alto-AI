// These screens are ported from the design prototype and are not wired to a
// backend yet. The chip says so on the page rather than letting the UI imply
// working functionality.
export default function PreviewChip({ children = "Preview · not wired up yet" }) {
  return (
    <span
      className="tiny"
      style={{
        display: "inline-block", border: "1px solid var(--rule)",
        background: "var(--paper-2)", padding: "5px 10px", borderRadius: 2,
        letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 22,
      }}
    >
      {children}
    </span>
  );
}
