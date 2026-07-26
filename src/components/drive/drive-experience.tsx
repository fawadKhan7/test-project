"use client";

/**
 * The driving experience.
 *
 * There is no modal layer here and no paused state. Every section of the site
 * is a screen standing in the world, rendered as real DOM through
 * CSS3DRenderer, so you drive up to one, read it, and drive away — the cab
 * never stops being drivable and nothing ever has to be dismissed.
 *
 * React owns the section content and the HUD, and nothing else. The renderer,
 * the physics and the input all live outside the component tree and are wired
 * in once on mount, so steering never waits on a re-render.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Keyboard, MapPin, Route } from "lucide-react";
import { BOARD_ATTR, createControls, type TouchButton } from "@/lib/drive/controls";
import { useMediaQuery } from "@/lib/drive/use-media-query";
import { PANEL_IDS } from "@/lib/drive/world-map";
import { cn } from "@/lib/utils";
import { createRunner, type Runner, type Telemetry } from "./scene/runner";
import {
  ArrivalChip,
  ControlLegend,
  DestinationMenu,
  NavMap,
  OffRoadWarning,
  PullAwayPrompt,
  SpeedGauge,
  TouchPad,
} from "./hud";

export type DriveSections = Record<string, React.ReactNode>;

/** `short` is what the nav chip shows, so it doesn't repeat the panel title. */
const META: Record<string, { kicker: string; title: string; short: string }> = {
  top: {
    kicker: "Pick-up · Yellow Line Taxi",
    title: "You're in the driving seat",
    short: "Pick-up",
  },
  book: { kicker: "Booking desk", title: "Book a cab", short: "Booking" },
  services: { kicker: "Depot yard", title: "Services", short: "Services" },
  fleet: { kicker: "Vehicle bay", title: "The fleet", short: "Fleet" },
  fares: { kicker: "Fare office", title: "Fares", short: "Fares" },
  reviews: { kicker: "Passenger wall", title: "Reviews", short: "Reviews" },
  faq: { kicker: "Enquiries", title: "FAQ", short: "FAQ" },
  call: { kicker: "Drop-off point", title: "Drop-off", short: "Drop-off" },
};

const IDLE: Telemetry = {
  mph: 0,
  offRoad: false,
  reversing: false,
  hint: "BOOK left · SERVICES right",
  hintDistance: null,
  turn: "straight",
  atBoard: null,
  arrived: false,
};

/** Chrome around each in-world screen. */
function BoardFrame({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const meta = META[id];
  return (
    <div className="drive-board">
      <header className="drive-board-head">
        <p>{meta?.kicker}</p>
        <h2>{meta?.title}</h2>
      </header>
      <div className="drive-board-body">{children}</div>
    </div>
  );
}

export function DriveExperience({
  hero,
  sections,
  onSkip,
}: {
  hero: React.ReactNode;
  sections: DriveSections;
  onSkip: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const runnerRef = useRef<Runner | null>(null);
  const controlsRef = useRef<ReturnType<typeof createControls> | null>(null);

  const [telemetry, setTelemetry] = useState<Telemetry>(IDLE);
  const [hasDriven, setHasDriven] = useState(false);
  const [waypoint, setWaypoint] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [visited, setVisited] = useState<Set<string>>(() => new Set());

  const isTouch = useMediaQuery("(pointer: coarse)");

  /**
   * One detached element per screen, created once. The runner hands each to a
   * CSS3DObject, which re-parents it into the 3D layer; React keeps rendering
   * into it through a portal, so the content stays live and interactive.
   */
  const [hosts] = useState(() => {
    const map = new Map<string, HTMLElement>();
    for (const id of PANEL_IDS) {
      const el = document.createElement("div");
      el.setAttribute(BOARD_ATTR, id);
      map.set(id, el);
    }
    return map;
  });

  // Stable, so the runner below is built exactly once rather than on every
  // state change. The setters React hands back never change identity.
  const handleVisit = useCallback((id: string) => {
    setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const handleFirstDrive = useCallback(() => setHasDriven(true), []);

  /** Escape is the universal way out of anything you have focused. */
  const handleEscape = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) active.blur();
    setMenuOpen(false);
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const minimap = minimapRef.current;
    if (!container || !canvas || !minimap) return;

    const controls = createControls(handleFirstDrive, handleEscape);
    controlsRef.current = controls;

    const cores = navigator.hardwareConcurrency ?? 4;
    const lowPower =
      cores <= 4 || window.matchMedia("(pointer: coarse)").matches;

    let runner: Runner;
    try {
      runner = createRunner({
        canvas,
        minimap,
        container,
        controls,
        hosts,
        lowPower,
        onTelemetry: setTelemetry,
        onVisit: handleVisit,
        onContextLost: onSkip,
      });
    } catch {
      // Context creation failed outright. Hand the visitor the readable site,
      // on the next tick so we aren't re-rendering the tree that mounts us.
      controls.dispose();
      controlsRef.current = null;
      queueMicrotask(onSkip);
      return;
    }

    runnerRef.current = runner;

    return () => {
      runner.dispose();
      controls.dispose();
      runnerRef.current = null;
      controlsRef.current = null;
    };
  }, [handleVisit, handleFirstDrive, handleEscape, hosts, onSkip]);

  const handleTouch = useCallback((button: TouchButton, active: boolean) => {
    controlsRef.current?.setTouch(button, active);
  }, []);

  const handleReset = useCallback(() => {
    runnerRef.current?.resetToRoad();
  }, []);

  const handleWaypoint = useCallback((id: string | null) => {
    setWaypoint((prev) => {
      const next = prev === id ? null : id;
      runnerRef.current?.setWaypoint(next);
      return next;
    });
  }, []);

  const boardContent: DriveSections = {
    ...sections,
    top: (
      <div className="flex flex-col gap-6">
        <section
          aria-label="How to drive"
          className="border-yellow bg-ink-soft border-2 p-4"
        >
          <p className="text-yellow flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.2em] uppercase">
            <Keyboard className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
            {isTouch ? "Use the on-screen pedals" : "Use your keyboard"}
          </p>

          <ul className="mt-3 grid grid-cols-2 gap-2">
            {[
              ["W or ↑", "Accelerate"],
              ["S or ↓", "Brake, then reverse"],
              ["A / D or ← / →", "Steer"],
              ["Space", "Handbrake"],
            ].map(([k, label]) => (
              <li key={k} className="flex items-center gap-2.5">
                <span className="tabular border-ink-line bg-ink text-yellow shrink-0 border px-2 py-1 text-xs font-bold">
                  {k}
                </span>
                <span className="text-cream-dim text-sm">{label}</span>
              </li>
            ))}
          </ul>

          {/* Names the two cues the road itself provides, in the order a
              driver meets them. Everything else about the layout is meant to
              be self-explanatory; these two are worth one sentence each
              because they are the difference between exploring and guessing. */}
          <ul className="text-cream-dim mt-4 flex flex-col gap-2.5 text-sm">
            <li className="flex items-start gap-2">
              <Route
                className="text-yellow mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
                strokeWidth={2.5}
              />
              <span>
                Follow the chevrons painted down the road — they always point
                at your next stop, and they swing through the junction you
                need to take.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin
                className="text-yellow mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
                strokeWidth={2.5}
              />
              <span>
                Each column of light is a section of this site. Pull into the
                bay under one and it opens in front of you; drive off and it
                clears itself away.
              </span>
            </li>
          </ul>
        </section>

        {hero}
      </div>
    ),
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="drive-stage fixed inset-0 z-30 overflow-hidden focus:outline-none"
    >
      {/*
        Pointer-transparent: driving is keyboard-only, so every click and
        every scroll belongs to the section screens sitting behind the canvas.
      */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none relative z-[1] block h-full w-full"
        aria-hidden="true"
      />

      {PANEL_IDS.map((id) => {
        const host = hosts.get(id);
        const content = boardContent[id];
        if (!host || !content) return null;
        return createPortal(<BoardFrame id={id}>{content}</BoardFrame>, host, id);
      })}

      {/* ------------------------------------------------------------ HUD */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/*
          The driving instruments. They fade out on arrival: the section screen
          is behind this exact part of the frame, and a speedometer reading zero
          over a wall of text is pure obstruction. Faded rather than unmounted,
          so they are already back in place by the time the cab is moving again.
        */}
        <div
          className={cn(
            "transition-opacity duration-300",
            telemetry.arrived ? "opacity-0" : "opacity-100",
          )}
          aria-hidden={telemetry.arrived}
        >
          {/* Route map rides at the top of the frame, racing-game style, so it
              never sits between the driver and the road. */}
          <div className="absolute top-3 left-1/2 hidden -translate-x-1/2 sm:block">
            <NavMap
              canvasRef={minimapRef}
              hint={telemetry.hint}
              distance={telemetry.hintDistance}
              turn={telemetry.turn}
              atBoard={telemetry.atBoard ? META[telemetry.atBoard]?.short : null}
              arrived={telemetry.arrived}
            />
          </div>

          {!isTouch && (
            <div className="absolute top-14 left-3 sm:top-16 sm:left-4">
              <ControlLegend dimmed={hasDriven} />
            </div>
          )}
        </div>

        <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
          <p className="font-display border-yellow bg-ink/85 text-yellow border-2 px-2.5 py-1 text-sm uppercase backdrop-blur-sm">
            Yellow Line
          </p>
        </div>

        <div className="pointer-events-auto absolute top-3 right-3 flex flex-col items-end gap-2 sm:top-4 sm:right-4">
          <button
            type="button"
            onClick={onSkip}
            className="border-cream-dim bg-ink/85 text-cream hover:border-yellow hover:text-yellow focus-visible:ring-yellow flex min-h-[40px] cursor-pointer items-center border-2 px-3 text-[0.65rem] font-bold tracking-[0.14em] uppercase backdrop-blur-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
          >
            Skip the drive
          </button>
          <DestinationMenu
            open={menuOpen}
            onToggle={() => setMenuOpen((v) => !v)}
            waypoint={waypoint}
            visited={visited}
            onSelect={handleWaypoint}
          />
        </div>

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 sm:bottom-5">
          {!hasDriven && <PullAwayPrompt touch={isTouch} />}
          {telemetry.offRoad && (
            <div className="pointer-events-auto">
              <OffRoadWarning onReset={handleReset} />
            </div>
          )}
          {telemetry.arrived && telemetry.atBoard ? (
            <ArrivalChip label={META[telemetry.atBoard]?.short ?? "Stop"} />
          ) : (
            <SpeedGauge mph={telemetry.mph} reversing={telemetry.reversing} />
          )}
        </div>

        {isTouch && <TouchPad onPress={handleTouch} />}
      </div>
    </div>
  );
}
