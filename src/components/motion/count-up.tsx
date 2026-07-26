"use client";

import { useEffect, useRef } from "react";
import { animate, onScroll } from "animejs";
import { EASE, motionEnabled } from "@/lib/motion";

/**
 * Rolls a fare up from zero when it scrolls into frame.
 *
 * The real value is server-rendered, so without JS (or with reduced motion)
 * the correct price is simply there. Values use tabular figures, so the digits
 * never change width and the count can't reflow the table around it.
 */
export function CountUp({
  value,
  prefix = "",
  decimals = 2,
  className,
}: {
  value: number;
  prefix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !motionEnabled()) return;

    const state = { v: 0 };

    try {
      const animation = animate(state, {
        v: value,
        duration: 1500,
        ease: EASE.out,
        onUpdate: () => {
          node.textContent = prefix + state.v.toFixed(decimals);
        },
        autoplay: onScroll({
          target: node,
          enter: { target: "top", container: "92%" },
          repeat: false,
        }),
      });

      return () => {
        animation.revert();
        node.textContent = prefix + value.toFixed(decimals);
      };
    } catch {
      node.textContent = prefix + value.toFixed(decimals);
    }
  }, [value, prefix, decimals]);

  return (
    <span ref={ref} className={className}>
      {prefix + value.toFixed(decimals)}
    </span>
  );
}
