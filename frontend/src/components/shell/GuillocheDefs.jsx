// The guilloche rosette behind the hero panel — the same engine-turned pattern
// used on banknotes and visa foils. Defined once and referenced with <use>.
export default function GuillocheDefs() {
  const rings = [0, 18, 36, 54, 72, 90, 108, 126, 144, 162];
  const inner = [
    { rx: 120, ry: 120, rot: 0 },
    { rx: 96, ry: 120, rot: 30 },
    { rx: 96, ry: 120, rot: 60 },
    { rx: 96, ry: 120, rot: 90 },
  ];
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <g id="guil">
          <g fill="none" stroke="#7C6BA8" strokeWidth=".6">
            {rings.map((deg) => (
              <ellipse key={deg} cx="200" cy="120" rx="190" ry="52"
                transform={deg ? `rotate(${deg} 200 120)` : undefined} />
            ))}
          </g>
          <g fill="none" stroke="#5F8FA8" strokeWidth=".5" opacity=".8">
            {inner.map((e) => (
              <ellipse key={e.rot} cx="200" cy="120" rx={e.rx} ry={e.ry}
                transform={e.rot ? `rotate(${e.rot} 200 120)` : undefined} />
            ))}
          </g>
        </g>
      </defs>
    </svg>
  );
}
