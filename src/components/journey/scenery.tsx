/**
 * Parallax scenery for the ride. Three depths, all pure SVG in the two brand
 * colours: distant skyline, near buildings, and the road surface.
 *
 * All geometry is deterministic (no Math.random) so the server and client
 * render identical markup and hydration stays clean.
 */

/** Simple deterministic pseudo-random so skylines look varied but stable. */
function rnd(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function Skyline({ seed = 1, count = 26, opacity = 1 }: {
  seed?: number;
  count?: number;
  opacity?: number;
}) {
  const buildings = Array.from({ length: count }).map((_, i) => {
    const w = 60 + Math.round(rnd(seed + i) * 90);
    const h = 90 + Math.round(rnd(seed + i * 3.7) * 260);
    return { w, h, i };
  });

  let x = 0;
  const shapes = buildings.map((b) => {
    const item = { ...b, x };
    x += b.w + 18;
    return item;
  });
  const totalWidth = x;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} 420`}
      width={totalWidth}
      height="420"
      preserveAspectRatio="xMinYMax meet"
      className="block h-full w-auto"
      style={{ opacity }}
      aria-hidden="true"
      focusable="false"
    >
      {shapes.map((b) => (
        <g key={b.i}>
          <rect x={b.x} y={420 - b.h} width={b.w} height={b.h} fill="var(--ink-soft)" />
          <rect
            x={b.x}
            y={420 - b.h}
            width={b.w}
            height="3"
            fill="var(--ink-line)"
          />
          {/* Lit windows */}
          {Array.from({ length: Math.floor(b.h / 34) }).map((_, r) =>
            Array.from({ length: Math.max(1, Math.floor(b.w / 30)) }).map((_, c) => {
              const lit = rnd(b.i * 7.3 + r * 2.1 + c * 5.9) > 0.55;
              if (!lit) return null;
              return (
                <rect
                  key={`${r}-${c}`}
                  x={b.x + 10 + c * 30}
                  y={420 - b.h + 16 + r * 34}
                  width="12"
                  height="16"
                  fill="var(--yellow)"
                  opacity={0.16 + rnd(b.i + r + c) * 0.5}
                />
              );
            }),
          )}
        </g>
      ))}
    </svg>
  );
}

/** The road surface: kerb, centre dashes, and a hard top edge. */
export function Road({ width }: { width: number }) {
  const dashes = Math.ceil(width / 180) + 4;
  return (
    <svg
      viewBox={`0 0 ${width} 160`}
      width={width}
      height="160"
      preserveAspectRatio="none"
      className="block"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="0" width={width} height="160" fill="var(--ink-soft)" />
      <rect x="0" y="0" width={width} height="5" fill="var(--yellow)" />
      {Array.from({ length: dashes }).map((_, i) => (
        <rect
          key={i}
          x={i * 180}
          y="76"
          width="104"
          height="9"
          fill="var(--yellow)"
          opacity="0.75"
        />
      ))}
    </svg>
  );
}
