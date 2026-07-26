"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BigTaxi, type TaxiParts } from "@/components/journey/big-taxi";
import { Skyline, Road } from "@/components/journey/scenery";
import { motionEnabled } from "@/lib/motion";

export type Panel = { id: string; label: string; node: React.ReactNode };

type JourneyMode = "plain" | "vertical" | "horizontal";

const WHEEL_CIRCUMFERENCE = 2 * Math.PI * 34;
const DESKTOP_MQ = "(min-width: 1024px)";

function applyTaxiMotion(
  parts: TaxiParts,
  velocity: number,
  distance: number,
  bobPhase: number,
  passengerLag: number,
) {
  const speed = Math.min(1, Math.abs(velocity) * 60);
  const nextBobPhase = bobPhase + 0.06 + speed * 0.14;
  const bob = Math.sin(nextBobPhase) * (1.6 + speed * 3.2);

  const deg = (distance / WHEEL_CIRCUMFERENCE) * 360;
  if (parts.wheelFront) parts.wheelFront.style.transform = `rotate(${deg}deg)`;
  if (parts.wheelRear) parts.wheelRear.style.transform = `rotate(${deg}deg)`;
  if (parts.chassis) parts.chassis.style.transform = `translate(0px, ${bob}px)`;

  if (parts.bodyGroup) {
    const squat = 1 - Math.min(0.05, Math.abs(velocity) * 2.2);
    const lean = Math.max(-3.5, Math.min(3.5, velocity * 260));
    parts.bodyGroup.style.transform = `scaleY(${squat}) rotate(${-lean}deg)`;
  }

  const nextPassengerLag = passengerLag + (bob * 0.6 - passengerLag) * 0.12;
  if (parts.passenger) {
    parts.passenger.style.transform = `translate(0px, ${-nextPassengerLag}px)`;
  }

  if (parts.beam) {
    parts.beam.style.opacity = String(0.45 + speed * 0.55);
    parts.beam.style.transform = `scaleX(${1 + speed * 0.22})`;
  }

  parts.puffs.forEach((puff, i) => {
    if (!puff) return;
    const phase = (nextBobPhase * 0.5 + i * 0.9) % 3;
    puff.style.opacity = String(speed > 0.06 ? Math.max(0, 1 - phase / 3) * speed : 0);
    puff.style.transform = `translate(${-phase * 26}px, ${-phase * 12}px) scale(${1 + phase * 0.7})`;
  });

  return { bobPhase: nextBobPhase, passengerLag: nextPassengerLag };
}

function viewportHeight() {
  return window.visualViewport?.height ?? window.innerHeight;
}

function syncViewport(sticky: HTMLDivElement | null) {
  if (!sticky) return;
  sticky.style.height = `${viewportHeight()}px`;
}

function scrollProgress(wrap: HTMLElement, travel: number) {
  const top = wrap.getBoundingClientRect().top;
  return Math.min(1, Math.max(0, -top / travel));
}

function JourneyNav({
  panels,
  active,
  onSelect,
  className,
}: {
  panels: Panel[];
  active: number;
  onSelect: (i: number) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Journey progress" className={className}>
      <ul className="border-ink bg-yellow flex max-w-full items-center gap-1 overflow-x-auto border-2 px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {panels.map((p, i) => (
          <li key={p.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={i === active ? "true" : undefined}
              className={`font-display cursor-pointer min-h-[36px] touch-manipulation px-2.5 py-1.5 text-xs tracking-wider uppercase transition-colors duration-200 lg:min-h-0 lg:px-2.5 lg:py-1 lg:text-[0.68rem] ${
                i === active ? "bg-ink text-yellow" : "text-ink hover:bg-ink/10"
              }`}
            >
              {p.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TaxiChrome({
  roadRef,
  parts,
  roadHeight = "h-[72px]",
  taxiBottom = "bottom-[22px]",
  taxiWidth = "w-[min(46vw,200px)]",
  nav,
}: {
  roadRef: React.RefObject<HTMLDivElement | null>;
  parts: React.MutableRefObject<TaxiParts>;
  roadHeight?: string;
  taxiBottom?: string;
  taxiWidth?: string;
  nav: React.ReactNode;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className={`border-ink pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden border-t-4 ${roadHeight}`}
      >
        <div ref={roadRef} className="will-change-transform">
          <Road width={2400} />
        </div>
      </div>

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-[3vw] ${taxiBottom} ${taxiWidth}`}
      >
        <BigTaxi className="w-full" parts={parts} />
      </div>

      {nav}
    </>
  );
}

export function Journey({ panels }: { panels: Panel[] }) {
  const [mode, setMode] = useState<JourneyMode>("plain");
  const [active, setActive] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);
  const roadRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);
  const fitRefs = useRef<(HTMLDivElement | null)[]>([]);
  const snappingRef = useRef(false);
  const activeRef = useRef(0);

  const parts = useRef<TaxiParts>({
    chassis: null,
    bodyGroup: null,
    wheelFront: null,
    wheelRear: null,
    beam: null,
    puffs: [],
    passenger: null,
  });

  useEffect(() => {
    const decide = () => {
      if (!motionEnabled()) {
        setMode("plain");
        return;
      }
      const wide = window.matchMedia(DESKTOP_MQ).matches;
      setMode(wide ? "horizontal" : "vertical");
    };
    const id = window.setTimeout(decide, 0);
    const mq = window.matchMedia(DESKTOP_MQ);
    mq.addEventListener("change", decide);
    window.addEventListener("resize", decide);
    return () => {
      window.clearTimeout(id);
      mq.removeEventListener("change", decide);
      window.removeEventListener("resize", decide);
    };
  }, []);

  const horizontal = mode === "horizontal";
  const guided = mode === "horizontal" || mode === "vertical";

  const sizeWrapper = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !horizontal) return;
    syncViewport(stickyRef.current);
    const vw = window.innerWidth;
    const travel = panels.length * vw - vw;
    wrap.style.height = `${travel + viewportHeight()}px`;
  }, [horizontal, panels.length]);

  const fitPanels = useCallback(() => {
    if (!horizontal || window.innerWidth < 1024) return;

    fitRefs.current.forEach((inner) => {
      if (!inner) return;
      const holder = inner.parentElement;
      if (!holder) return;

      inner.style.transform = "scale(1)";

      const availableH = holder.clientHeight;
      const availableW = holder.clientWidth;
      const neededH = inner.scrollHeight;
      const neededW = inner.scrollWidth;

      if (availableH <= 0 || availableW <= 0) return;

      const scale = Math.min(1, availableH / neededH, availableW / neededW);
      if (scale < 0.98) {
        inner.style.transform = `scale(${Math.max(0.58, scale)})`;
      }
    });
  }, [horizontal]);

  useEffect(() => {
    if (!horizontal) return;
    const recalc = () => {
      sizeWrapper();
      fitPanels();
    };
    const id = window.setTimeout(recalc, 0);
    const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts;
    fontsReady?.ready.then(recalc).catch(() => {});
    window.addEventListener("resize", recalc);
    window.visualViewport?.addEventListener("resize", recalc);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", recalc);
      window.visualViewport?.removeEventListener("resize", recalc);
    };
  }, [horizontal, sizeWrapper, fitPanels]);

  const goToHorizontal = useCallback((i: number, behavior: ScrollBehavior = "smooth") => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    window.scrollTo({ top: wrap.offsetTop + i * window.innerWidth, behavior });
  }, []);

  const goToVertical = useCallback((i: number) => {
    panelRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const goTo = useCallback(
    (i: number, behavior: ScrollBehavior = "smooth") => {
      if (mode === "horizontal") goToHorizontal(i, behavior);
      else if (mode === "vertical") goToVertical(i);
    },
    [mode, goToHorizontal, goToVertical],
  );

  useEffect(() => {
    if (!horizontal) return;

    let timer = 0;

    const snap = () => {
      if (snappingRef.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const vw = window.innerWidth;
        const travel = panels.length * vw - vw;
        if (travel <= 0) return;

        const raw = scrollProgress(wrap, travel);
        const nearest = Math.round(raw * (panels.length - 1));
        const target = wrap.offsetTop + nearest * vw;

        if (Math.abs(window.scrollY - target) > 4) {
          snappingRef.current = true;
          window.scrollTo({ top: target, behavior: "smooth" });
          window.setTimeout(() => {
            snappingRef.current = false;
          }, 450);
        }
      }, 140);
    };

    window.addEventListener("scroll", snap, { passive: true });
    return () => {
      window.removeEventListener("scroll", snap);
      window.clearTimeout(timer);
    };
  }, [horizontal, panels.length]);

  useEffect(() => {
    if (!horizontal) return;

    let frame = 0;
    let running = true;
    let prevP = 0;
    let velocity = 0;
    let distance = 0;
    let bobPhase = 0;
    let passengerLag = 0;

    const tick = () => {
      if (!running) return;
      const wrap = wrapRef.current;
      const vw = window.innerWidth;
      const travel = panels.length * vw - vw;

      if (wrap && travel > 0) {
        const raw = scrollProgress(wrap, travel);

        const dp = raw - prevP;
        velocity += (dp - velocity) * 0.2;
        prevP = raw;

        const px = raw * travel;
        distance = px;

        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${-px}px, 0, 0)`;
        }
        if (farRef.current) {
          farRef.current.style.transform = `translate3d(${-px * 0.12}px, 0, 0)`;
        }
        if (nearRef.current) {
          nearRef.current.style.transform = `translate3d(${-px * 0.38}px, 0, 0)`;
        }
        if (roadRef.current) {
          roadRef.current.style.transform = `translate3d(${-((px * 1.15) % 180)}px, 0, 0)`;
        }

        const motion = applyTaxiMotion(
          parts.current,
          velocity,
          distance,
          bobPhase,
          passengerLag,
        );
        bobPhase = motion.bobPhase;
        passengerLag = motion.passengerLag;

        const nearest = Math.round(raw * (panels.length - 1));
        if (nearest !== activeRef.current) {
          activeRef.current = nearest;
          setActive(nearest);
        }
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
    };
  }, [horizontal, panels.length]);

  // Mobile: ordinary vertical scroll with pinned cab.
  useEffect(() => {
    if (mode !== "vertical") return;

    let frame = 0;
    let running = true;
    let prevY = window.scrollY;
    let velocity = 0;
    let distance = 0;
    let bobPhase = 0;
    let passengerLag = 0;

    const tick = () => {
      if (!running) return;
      const y = window.scrollY;
      const dy = y - prevY;
      velocity += (dy - velocity) * 0.2;
      prevY = y;
      distance += Math.abs(dy);

      if (roadRef.current) {
        roadRef.current.style.transform = `translate3d(${-((distance * 1.15) % 180)}px, 0, 0)`;
      }

      const motion = applyTaxiMotion(
        parts.current,
        velocity * 0.004,
        distance,
        bobPhase,
        passengerLag,
      );
      bobPhase = motion.bobPhase;
      passengerLag = motion.passengerLag;

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "vertical") return;

    const ratios = new Map<number, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const i = Number((entry.target as HTMLElement).dataset.panelIndex);
          if (Number.isNaN(i)) return;
          ratios.set(i, entry.intersectionRatio);
        });

        let best = activeRef.current;
        let bestRatio = -1;
        ratios.forEach((ratio, i) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = i;
          }
        });

        if (best !== activeRef.current) {
          activeRef.current = best;
          setActive(best);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.55, 0.75, 1] },
    );

    panelRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [mode, panels.length]);

  const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!guided) return;
    const panel = (e.target as HTMLElement).closest("[data-panel-index]");
    if (!panel) return;
    const i = Number(panel.getAttribute("data-panel-index"));
    if (!Number.isNaN(i) && i !== activeRef.current) goTo(i);
  };

  useEffect(() => {
    if (!guided) return;
    const ids = panels.map((p) => p.id);

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const link = (e.target as HTMLElement | null)?.closest?.("a[href^='#']");
      if (!link) return;
      const id = link.getAttribute("href")?.slice(1);
      if (!id) return;
      const i = ids.indexOf(id);
      if (i === -1) return;
      e.preventDefault();
      goTo(i);
      window.history.replaceState(null, "", `#${id}`);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [guided, panels, goTo]);

  if (mode === "plain") {
    return (
      <div className="flex flex-col">
        {panels.map((p) => (
          <section key={p.id} id={p.id} className="px-4 py-10 lg:px-10 lg:py-16">
            {p.node}
          </section>
        ))}
      </div>
    );
  }

  if (mode === "vertical") {
    return (
      <div className="relative touch-pan-y" onFocus={handleFocus}>
        {panels.map((p, i) => (
          <section
            key={p.id}
            id={p.id}
            data-panel-index={i}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            className="scroll-mt-4 px-4 py-10 pb-28 lg:px-10 lg:py-16"
          >
            {p.node}
          </section>
        ))}

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
          <TaxiChrome
            roadRef={roadRef}
            parts={parts}
            nav={
              <JourneyNav
                panels={panels}
                active={active}
                onSelect={goToVertical}
                className="pointer-events-auto absolute bottom-2 left-1/2 z-20 max-w-[calc(100vw-0.5rem)] -translate-x-1/2"
              />
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div ref={stickyRef} className="sticky top-0 h-dvh overflow-hidden" onFocus={handleFocus}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[112px] left-0 h-[38vh] opacity-30"
        >
          <div ref={farRef} className="flex h-full will-change-transform">
            <Skyline seed={3} count={30} opacity={0.55} />
            <Skyline seed={11} count={30} opacity={0.55} />
          </div>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[112px] left-0 h-[26vh] opacity-70"
        >
          <div ref={nearRef} className="flex h-full will-change-transform">
            <Skyline seed={23} count={26} />
            <Skyline seed={41} count={26} />
          </div>
        </div>

        <div
          ref={trackRef}
          className="absolute inset-0 flex will-change-transform"
          style={{ width: `${panels.length * 100}vw` }}
        >
          {panels.map((p, i) => (
            <div
              key={p.id}
              data-panel-index={i}
              ref={(el) => {
                panelRefs.current[i] = el;
              }}
              className="flex h-full w-screen shrink-0 overflow-hidden"
            >
              <div className="flex h-full w-full items-center justify-center overflow-hidden px-10 pb-36 pt-8">
                <div
                  ref={(el) => {
                    fitRefs.current[i] = el;
                  }}
                  className="w-full max-w-6xl origin-center"
                >
                  {p.node}
                </div>
              </div>
            </div>
          ))}
        </div>

        <TaxiChrome
          roadRef={roadRef}
          parts={parts}
          roadHeight="h-[112px]"
          taxiBottom="bottom-[36px]"
          taxiWidth="w-[clamp(200px,20vw,360px)]"
          nav={
            <JourneyNav
              panels={panels}
              active={active}
              onSelect={(i) => goToHorizontal(i)}
              className="absolute bottom-4 left-1/2 z-20 max-w-[calc(100vw-0.5rem)] -translate-x-1/2"
            />
          }
        />
      </div>
    </div>
  );
}
