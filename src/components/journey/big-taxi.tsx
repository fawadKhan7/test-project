/**
 * The hero cab — a large, hand-built SVG with independently animatable parts.
 *
 * Every moving piece is exposed through a ref map so the journey loop can
 * nest animations: the chassis bobs, the suspension compresses under
 * acceleration, the wheels spin with distance travelled, the headlight cone
 * pulses, and exhaust puffs trail off the back. Yellow and black only.
 *
 * There is a passenger silhouette in the rear window — that's the reader.
 */

export type TaxiParts = {
  chassis: SVGGElement | null;
  bodyGroup: SVGGElement | null;
  wheelFront: SVGGElement | null;
  wheelRear: SVGGElement | null;
  beam: SVGGElement | null;
  puffs: (SVGGElement | null)[];
  passenger: SVGGElement | null;
};

export function BigTaxi({
  className,
  parts,
}: {
  className?: string;
  parts?: React.MutableRefObject<TaxiParts>;
}) {
  const set = <K extends keyof TaxiParts>(key: K) => (el: TaxiParts[K]) => {
    if (parts) parts.current[key] = el;
  };

  return (
    <svg
      viewBox="0 0 460 220"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Headlight cone — drawn behind the body so it reads as cast light. */}
      <g ref={set("beam")} style={{ transformOrigin: "418px 150px" }}>
        <path
          d="M416 138 L460 96 L460 196 L416 162 Z"
          fill="var(--yellow)"
          opacity="0.16"
        />
      </g>

      {/* Exhaust puffs, trailing off the back. */}
      {[0, 1, 2].map((i) => (
        <g
          key={i}
          ref={(el) => {
            if (parts) parts.current.puffs[i] = el;
          }}
          style={{ transformOrigin: `${36 - i * 16}px 168px` }}
        >
          <circle cx={36 - i * 16} cy={168} r={7 - i} fill="var(--cream)" opacity="0.18" />
        </g>
      ))}

      {/* Chassis bobs; suspension scales inside it. */}
      <g ref={set("chassis")}>
        <g ref={set("bodyGroup")} style={{ transformOrigin: "230px 176px" }}>
          {/* Roof sign */}
          <rect
            x="196"
            y="30"
            width="72"
            height="26"
            fill="var(--yellow)"
            stroke="var(--ink)"
            strokeWidth="7"
          />
          <rect x="212" y="40" width="40" height="7" fill="var(--ink)" />

          {/* Main body */}
          <path
            d="M18 168 L18 126 C18 116 24 110 34 108 L104 96 L140 50 C147 40 158 34 170 34 L282 34 C296 34 306 40 312 50 L344 96 L420 108 C432 110 438 116 438 126 L438 168 Z"
            fill="var(--yellow)"
            stroke="var(--ink)"
            strokeWidth="7"
            strokeLinejoin="round"
          />

          {/* Rear window (passenger) + front window */}
          <path d="M168 48 L228 48 L228 92 L134 92 Z" fill="var(--ink)" />
          <path d="M244 48 L280 48 L318 92 L244 92 Z" fill="var(--ink)" />

          {/* The passenger — that's you. */}
          <g ref={set("passenger")} style={{ transformOrigin: "190px 92px" }}>
            <circle cx="190" cy="66" r="13" fill="var(--yellow)" opacity="0.92" />
            <path d="M172 92 C172 78 180 72 190 72 C200 72 208 78 208 92 Z" fill="var(--yellow)" opacity="0.92" />
          </g>

          {/* Checker band */}
          {Array.from({ length: 14 }).map((_, i) => (
            <rect
              key={i}
              x={44 + i * 26}
              y={126}
              width="13"
              height="13"
              fill={i % 2 === 0 ? "var(--ink)" : "transparent"}
            />
          ))}

          {/* Lights + door seam */}
          <rect x="424" y="128" width="14" height="14" fill="var(--cream)" />
          <rect x="18" y="128" width="12" height="14" fill="var(--ink)" />
          <rect x="234" y="96" width="5" height="44" fill="var(--ink)" opacity="0.55" />
        </g>

        {/* Wheels */}
        {[
          { key: "wheelRear" as const, cx: 116 },
          { key: "wheelFront" as const, cx: 344 },
        ].map((w) => (
          <g key={w.key} ref={set(w.key)} style={{ transformOrigin: `${w.cx}px 172px` }}>
            <circle cx={w.cx} cy="172" r="34" fill="var(--ink)" />
            <circle cx={w.cx} cy="172" r="15" fill="var(--yellow)" />
            <circle cx={w.cx} cy="172" r="5" fill="var(--ink)" />
            {/* Spokes make rotation legible */}
            {[0, 45, 90, 135].map((a) => (
              <rect
                key={a}
                x={w.cx - 1.8}
                y={172 - 31}
                width="3.6"
                height="62"
                fill="var(--yellow)"
                opacity="0.45"
                style={{ transform: `rotate(${a}deg)`, transformOrigin: `${w.cx}px 172px` }}
              />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
