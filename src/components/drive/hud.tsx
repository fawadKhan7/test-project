"use client";

/**
 * Heads-up display for the drive.
 *
 * Everything here floats over the canvas and is pointer-transparent unless it
 * is actually a control, so a stray click never steals the road. Styling
 * follows the same brutalist blocks as the rest of the site: 2–3px borders,
 * hard offset shadows, uppercase display type, tabular mono for numbers.
 */

import { useRef } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  CornerUpLeft,
  CornerUpRight,
  MapPin,
  Navigation,
  RotateCcw,
  TriangleAlert,
  Undo2,
} from "lucide-react";

/* -------------------------------------------------------------- nav map */
import type { TouchButton } from "@/lib/drive/controls";
import type { TurnCue } from "./scene/runner";
import { DESTINATIONS } from "@/lib/drive/world-map";
import { cn } from "@/lib/utils";

const panel =
  "border-ink bg-ink/85 border-2 backdrop-blur-sm shadow-[4px_4px_0_var(--ink)]";

/* ------------------------------------------------------------------ speed */

export function SpeedGauge({
  mph,
  reversing,
}: {
  mph: number;
  reversing: boolean;
}) {
  const value = Math.round(mph);
  return (
    <div
      className={cn(panel, "border-yellow flex items-end gap-2 px-3 py-2")}
      aria-live="off"
    >
      <span className="tabular text-yellow text-3xl leading-none font-bold">
        {value.toString().padStart(2, "0")}
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-cream-dim text-[0.6rem] font-bold tracking-[0.16em] uppercase">
          mph
        </span>
        <span className="text-yellow font-display text-xs uppercase">
          {reversing ? "R" : value < 1 ? "N" : "D"}
        </span>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------- nav hint */

/* -------------------------------------------------------- pull-away prompt */

/** Shown until the visitor touches a control for the first time. */
export function PullAwayPrompt({ touch }: { touch: boolean }) {
  return (
    <p
      className="drive-pulse border-yellow bg-yellow text-ink border-2 px-3 py-1.5 text-[0.7rem] font-bold tracking-[0.14em] uppercase"
      role="status"
    >
      {touch ? "Press and hold ▲ to pull away" : "Press W to pull away"}
    </p>
  );
}

/* -------------------------------------------------------- control legend */

const LEGEND: Array<{ keys: string; label: string }> = [
  { keys: "W / ↑", label: "Accelerate" },
  { keys: "S / ↓", label: "Brake · Reverse" },
  { keys: "A / D", label: "Steer" },
  { keys: "Space", label: "Handbrake" },
];

export function ControlLegend({ dimmed }: { dimmed: boolean }) {
  return (
    <div
      className={cn(
        panel,
        "border-ink-line px-3 py-2 transition-opacity duration-500",
        dimmed ? "opacity-40" : "opacity-100",
      )}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {LEGEND.map(({ keys, label }) => (
          <div key={keys} className="contents">
            <dt className="tabular border-ink-line bg-ink-soft text-yellow border px-1.5 text-[0.65rem] font-bold">
              {keys}
            </dt>
            <dd className="text-cream-dim text-[0.65rem] tracking-wide uppercase">
              {label}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------- arrival */

/**
 * Replaces the driving instruments while parked at a stop.
 *
 * Everything the HUD shows while moving — speed, gear, the map, the next
 * manoeuvre — is answering a question nobody has when the car is stationary
 * and there is a wall of text to read. So the instruments step aside and this
 * takes their place: where you are, and the one thing you can do next.
 */
export function ArrivalChip({ label }: { label: string }) {
  return (
    <div
      className={cn(panel, "border-yellow flex items-center gap-3 px-3.5 py-2")}
      role="status"
      aria-live="polite"
    >
      <MapPin className="text-yellow h-4 w-4 shrink-0" aria-hidden="true" strokeWidth={2.5} />
      <span className="font-display text-yellow text-sm uppercase">{label}</span>
      <span className="bg-ink-line h-4 w-px" aria-hidden="true" />
      <span className="text-cream-dim text-[0.62rem] font-bold tracking-[0.16em] uppercase">
        Drive on when you&rsquo;re ready
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ off-road */

export function OffRoadWarning({ onReset }: { onReset: () => void }) {
  return (
    <div
      className={cn(
        panel,
        "border-yellow bg-yellow/95 flex items-center gap-3 px-3 py-2",
      )}
      role="status"
    >
      <TriangleAlert
        className="text-ink h-5 w-5 shrink-0"
        aria-hidden="true"
        strokeWidth={2.5}
      />
      <p className="font-display text-ink text-xs uppercase">Off the road</p>
      <button
        type="button"
        onClick={onReset}
        className="border-ink bg-ink text-yellow hover:bg-ink-soft focus-visible:ring-ink flex min-h-[36px] cursor-pointer items-center gap-1.5 border-2 px-2.5 text-[0.65rem] font-bold tracking-[0.12em] uppercase transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.5} />
        Back to road
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- minimap */

/**
 * Compact route map, parked at the top of the frame the way a racing game
 * does it — glanceable without eating into the road you are looking at.
 */
const TURN_ICON: Record<TurnCue, typeof ArrowUp> = {
  left: CornerUpLeft,
  right: CornerUpRight,
  straight: ArrowUp,
  around: Undo2,
};

const TURN_LABEL: Record<TurnCue, string> = {
  left: "Turn left",
  right: "Turn right",
  straight: "Continue straight ahead",
  around: "Turn around",
};

export function NavMap({
  canvasRef,
  hint,
  distance,
  turn,
  atBoard,
  arrived,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  hint: string;
  distance: number | null;
  turn: TurnCue;
  atBoard: string | null;
  arrived: boolean;
}) {
  const TurnIcon = TURN_ICON[turn];
  /** Turns are called out from 60m, the way a satnav does the final prompt. */
  const imminent = !atBoard && distance !== null && distance < 60 && turn !== "straight";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={cn(panel, "border-ink-line p-1.5")}>
        <canvas
          ref={canvasRef}
          className="h-[104px] w-[208px] bg-black/60"
          aria-hidden="true"
        />
      </div>

      {/* The manoeuvre is an arrow first and words second: the shape is
          readable in peripheral vision while the driver is watching the road,
          which a line of uppercase text is not. */}
      <div
        className={cn(
          panel,
          "flex items-center gap-2.5 px-3 py-1.5 transition-colors duration-200",
          atBoard || imminent ? "border-yellow" : "border-ink-line",
          imminent && "bg-yellow/95",
        )}
        role="status"
        aria-live="polite"
      >
        {!atBoard && (
          <TurnIcon
            className={cn("h-5 w-5 shrink-0", imminent ? "text-ink" : "text-yellow")}
            strokeWidth={2.75}
            aria-hidden="true"
          />
        )}
        <span className="sr-only">{atBoard ? "Parked at" : TURN_LABEL[turn]}</span>

        <span
          className={cn(
            "text-[0.58rem] font-bold tracking-[0.18em] uppercase",
            imminent ? "text-ink/70" : "text-cream-dim",
          )}
          aria-hidden="true"
        >
          {atBoard ? "Parked at" : "Next"}
        </span>

        <span
          className={cn(
            "font-display text-xs uppercase",
            imminent ? "text-ink" : "text-cream",
          )}
        >
          {atBoard ? (
            <span className="flex items-center gap-2">
              <span className="text-yellow">{atBoard}</span>
              {/* The way out, stated where the visitor is already looking.
                  Nothing has to be dismissed — driving is the dismissal. */}
              {arrived && (
                <span className="text-cream-dim border-ink-line border-l pl-2 text-[0.58rem] font-bold tracking-[0.14em]">
                  Drive on to continue
                </span>
              )}
            </span>
          ) : (
            <>
              {hint}
              {distance !== null && distance < 400 && (
                <span
                  className={cn("tabular ml-2", imminent ? "text-ink" : "text-yellow")}
                >
                  {Math.round(distance)} m
                </span>
              )}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ destination menu */

/**
 * The satnav list. Picking a stop doesn't teleport you — it sets a
 * destination and the hint line starts giving turn-by-turn to it, so
 * navigation stays inside the driving. Collapsed by default to keep the
 * windscreen clear.
 */
export function DestinationMenu({
  open,
  onToggle,
  waypoint,
  visited,
  onSelect,
}: {
  open: boolean;
  onToggle: () => void;
  waypoint: string | null;
  visited: Set<string>;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex min-h-[40px] cursor-pointer items-center gap-2 border-2 px-3 text-[0.65rem] font-bold tracking-[0.14em] uppercase backdrop-blur-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none",
          open
            ? "border-yellow bg-yellow text-ink"
            : "border-cream-dim bg-ink/85 text-cream hover:border-yellow hover:text-yellow focus-visible:ring-yellow",
        )}
      >
        <Navigation className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
        Destinations
        <ChevronDown
          className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div className={cn(panel, "border-ink-line w-[190px] p-2")}>
          <ul className="flex flex-col gap-0.5">
            {DESTINATIONS.map((d) => {
              const active = waypoint === d.id;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(d.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-[34px] w-full cursor-pointer items-center justify-between gap-1.5 px-1.5 text-left text-[0.68rem] tracking-wide uppercase transition-colors duration-150 focus-visible:outline-none",
                      active
                        ? "bg-yellow text-ink font-bold"
                        : "text-cream-dim hover:bg-ink-line hover:text-cream focus-visible:bg-ink-line focus-visible:text-cream",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {/* Not colour alone: visited stops carry a tick too. */}
                      <Check
                        className={cn(
                          "h-3 w-3 shrink-0",
                          visited.has(d.id) ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden="true"
                        strokeWidth={3}
                      />
                      {d.label}
                      {visited.has(d.id) && <span className="sr-only">(visited)</span>}
                    </span>
                    <span className="tabular text-[0.6rem] opacity-70">
                      {d.approach === "left" ? "←" : d.approach === "right" ? "→" : "↑"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {waypoint && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-cream-dim hover:text-yellow focus-visible:text-yellow mt-1.5 min-h-[32px] w-full cursor-pointer text-[0.6rem] font-bold tracking-[0.14em] uppercase underline underline-offset-2 transition-colors duration-150 focus-visible:outline-none"
            >
              Clear destination
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ touch pad */

function TouchKey({
  label,
  button,
  onPress,
  children,
  className,
}: {
  label: string;
  button: TouchButton;
  onPress: (b: TouchButton, active: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const held = useRef(false);

  const set = (active: boolean) => {
    if (held.current === active) return;
    held.current = active;
    onPress(button, active);
  };

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onPointerLeave={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "border-yellow bg-ink/85 text-yellow active:bg-yellow active:text-ink flex h-[60px] w-[60px] touch-none items-center justify-center border-2 backdrop-blur-sm transition-colors duration-100 select-none",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TouchPad({
  onPress,
}: {
  onPress: (b: TouchButton, active: boolean) => void;
}) {
  const icon = "h-6 w-6";
  return (
    <>
      <div className="pointer-events-auto absolute bottom-6 left-4 flex gap-2">
        <TouchKey label="Steer left" button="left" onPress={onPress}>
          <ArrowLeft className={icon} strokeWidth={2.5} aria-hidden="true" />
        </TouchKey>
        <TouchKey label="Steer right" button="right" onPress={onPress}>
          <ArrowRight className={icon} strokeWidth={2.5} aria-hidden="true" />
        </TouchKey>
      </div>
      <div className="pointer-events-auto absolute right-4 bottom-6 flex flex-col gap-2">
        <TouchKey label="Accelerate" button="forward" onPress={onPress}>
          <ArrowUp className={icon} strokeWidth={2.5} aria-hidden="true" />
        </TouchKey>
        <TouchKey label="Brake and reverse" button="back" onPress={onPress}>
          <ArrowDown className={icon} strokeWidth={2.5} aria-hidden="true" />
        </TouchKey>
      </div>
    </>
  );
}
