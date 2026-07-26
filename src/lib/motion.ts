/**
 * Shared motion tokens. Every animation on the site pulls its duration and
 * easing from here so the whole page moves with one rhythm.
 */

export const DUR = {
  micro: 260,
  base: 620,
  hero: 900,
} as const;

export const EASE = {
  /** Entrances — fast out of the gate, long settle. */
  out: "outExpo",
  /** Softer alternative for larger surfaces. */
  soft: "outQuint",
  /** Slight overshoot, used sparingly on accents. */
  back: "outBack",
} as const;

/**
 * Motion is opt-in: a blocking script in <head> adds `.anim` to <html> only
 * when the user has NOT asked for reduced motion. Every animation checks this,
 * so reduced-motion users (and anyone without JS) get the finished layout with
 * nothing hidden and nothing moving.
 */
export function motionEnabled() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("anim")
  );
}

/** Magnetic/hover affordances are pointer-only; touch users never get them. */
export function finePointer() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches
  );
}
