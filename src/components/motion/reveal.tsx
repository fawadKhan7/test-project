"use client";

import { useEffect, useRef } from "react";
import { animate, stagger, onScroll } from "animejs";
import { DUR, EASE, motionEnabled } from "@/lib/motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Elements to stagger. Defaults to any [data-reveal] inside. */
  select?: string;
  /** Per-item stagger step in ms. */
  step?: number;
  /** Travel distance in px. */
  y?: number;
};

/**
 * Scroll-triggered staggered entrance.
 *
 * Renders as a plain div with the className you pass, so it can *be* the
 * section container rather than adding a wrapper that would break grid layout.
 */
export function Reveal({
  children,
  className,
  select = "[data-reveal]",
  step = 70,
  y = 28,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !motionEnabled()) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>(select));
    if (targets.length === 0) return;

    try {
      const animation = animate(targets, {
        opacity: [0, 1],
        y: [y, 0],
        duration: DUR.base,
        delay: stagger(step),
        ease: EASE.out,
        autoplay: onScroll({
          target: root,
          enter: { target: "top", container: "88%" },
          repeat: false,
        }),
      });
      return () => {
        animation.revert();
      };
    } catch {
      // If anime ever fails, make sure nothing stays invisible.
      targets.forEach((t) => (t.style.opacity = "1"));
    }
  }, [select, step, y]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
