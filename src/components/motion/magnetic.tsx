"use client";

import { useEffect, useRef } from "react";
import { createAnimatable, createSpring } from "animejs";
import type { AnimatableObject } from "animejs";
import { finePointer, motionEnabled } from "@/lib/motion";

/**
 * Magnetic hover: the element leans toward the cursor and springs back on exit.
 *
 * Uses anime's createAnimatable, which keeps one live tween per property
 * instead of spawning a new animation on every pointermove. The pull is
 * clamped so the element never leaves its own hit box, which keeps it
 * clickable throughout. Fine pointers only — never on touch.
 */
export function Magnetic({
  children,
  strength = 0.3,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !motionEnabled() || !finePointer()) return;

    let magnet: AnimatableObject;
    try {
      magnet = createAnimatable(el, {
        x: { duration: 420, ease: "out(3)" },
        y: { duration: 420, ease: "out(3)" },
      });
    } catch {
      return;
    }

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      magnet.x((e.clientX - r.left - r.width / 2) * strength);
      magnet.y((e.clientY - r.top - r.height / 2) * strength);
    };

    const onLeave = () => {
      const spring = createSpring({ stiffness: 160, damping: 12 });
      magnet.x(0, 600, spring);
      magnet.y(0, 600, spring);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      magnet.revert();
    };
  }, [strength]);

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: "inline-block", willChange: "transform" }}
    >
      {children}
    </span>
  );
}
