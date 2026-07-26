"use client";

import { useEffect, useRef } from "react";
import { createTimeline, stagger, text } from "animejs";
import { DUR, EASE, motionEnabled } from "@/lib/motion";

/**
 * Hero entrance choreography.
 *
 * The headline is character-split with anime's own splitText (the free
 * equivalent of GSAP's paid SplitText plugin) and lifted in with a rotateX
 * stagger; the yellow bar then wipes open from its left edge, the payoff word
 * drops into it, and the supporting copy and booking panel follow.
 *
 * Note: anime's accessible split moves the ORIGINAL markup into a
 * visually-hidden clone. The highlight bar is therefore kept outside the
 * split region — inside it, the bar gets swallowed into the hidden copy and
 * vanishes from the page.
 */
export function HeroMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || !motionEnabled()) return;

    const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel);
    const qa = (sel: string) => Array.from(el.querySelectorAll<HTMLElement>(sel));

    let splitter: { revert: () => unknown } | undefined;
    let tl: ReturnType<typeof createTimeline> | undefined;

    try {
      const title = q("[data-hero-split]");
      const highlight = q("[data-hero-highlight]");
      const punch = q("[data-hero-punch]");
      const items = qa("[data-hero-item]");
      const panel = q("[data-hero-panel]");

      tl = createTimeline({ defaults: { ease: EASE.out } });

      if (title) {
        const split = text.split(title, {
          chars: { class: "char" },
          words: true,
          accessible: true,
        });
        splitter = split;

        tl.add(
          split.chars,
          {
            opacity: [0, 1],
            y: [44, 0],
            rotateX: [-78, 0],
            duration: DUR.hero,
            delay: stagger(17),
          },
          0,
        );
      }

      if (highlight) {
        tl.add(highlight, { scaleX: [0, 1], duration: 760, ease: EASE.soft }, 360);
      }

      if (punch) {
        tl.add(punch, { opacity: [0, 1], y: [30, 0], duration: DUR.base }, 480);
      }

      if (items.length) {
        tl.add(
          items,
          { opacity: [0, 1], y: [26, 0], duration: DUR.base, delay: stagger(80) },
          420,
        );
      }

      if (panel) {
        tl.add(panel, { opacity: [0, 1], y: [40, 0], scale: [0.97, 1], duration: 820 }, 300);
      }
    } catch {
      // Never leave the hero invisible if anime fails for any reason.
      qa("[data-hero-item],[data-hero-panel],[data-hero-punch]").forEach(
        (n) => (n.style.opacity = "1"),
      );
      const hl = q("[data-hero-highlight]");
      if (hl) hl.style.transform = "scaleX(1)";
    }

    return () => {
      tl?.revert();
      // Restore the original text nodes once anime has released the elements.
      splitter?.revert();
    };
  }, []);

  return <div ref={root}>{children}</div>;
}
