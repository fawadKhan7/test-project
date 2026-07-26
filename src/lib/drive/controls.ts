/**
 * Keyboard and touch input for the cab.
 *
 * Kept out of React state on purpose: key state is read once per animation
 * frame by the physics step, so routing it through re-renders would cost a
 * render per keypress and add a frame of latency to the steering.
 *
 * Because the section screens are real DOM standing in the world, focus can
 * legitimately be inside page content while you are still sitting in the cab.
 * The rules below keep both usable: the letter keys always drive, the arrow
 * keys hand over to whatever you are reading, and Escape always gets you back
 * out to the road.
 */

export type ControlState = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
};

export type TouchButton = keyof ControlState;

/** Letter keys drive no matter what you are looking at. */
const LETTER_MAP: Record<string, TouchButton> = {
  KeyW: "forward",
  KeyS: "back",
  KeyA: "left",
  KeyD: "right",
};

/** Arrow keys and Space defer to focused page content. */
const SHARED_MAP: Record<string, TouchButton> = {
  ArrowUp: "forward",
  ArrowDown: "back",
  ArrowLeft: "left",
  ArrowRight: "right",
  Space: "handbrake",
};

/** Marks a subtree as readable page content rather than cab controls. */
export const BOARD_ATTR = "data-drive-board";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/** True when focus sits inside one of the section screens. */
function isInBoard(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest(`[${BOARD_ATTR}]`) !== null;
}

export type Controls = {
  keys: ControlState;
  touch: ControlState;
  /** True once the visitor has actually driven — retires the pull-away prompt. */
  hasDriven: boolean;
  setTouch(button: TouchButton, active: boolean): void;
  releaseAll(): void;
  dispose(): void;
};

export function createControls(
  onFirstDrive?: () => void,
  onEscape?: () => void,
): Controls {
  const keys: ControlState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    handbrake: false,
  };
  const touch: ControlState = { ...keys };

  const controls: Controls = {
    keys,
    touch,
    hasDriven: false,
    setTouch(button, active) {
      touch[button] = active;
      if (active) markDriven();
    },
    releaseAll() {
      for (const k of Object.keys(keys) as TouchButton[]) {
        keys[k] = false;
        touch[k] = false;
      }
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onBlur);
    },
  };

  function markDriven() {
    if (controls.hasDriven) return;
    controls.hasDriven = true;
    onFirstDrive?.();
  }

  /** Which action a key maps to right now, given where focus is. */
  function resolve(e: KeyboardEvent): { action: TouchButton; swallow: boolean } | null {
    const typing = isTypingTarget(e.target);

    const letter = LETTER_MAP[e.code];
    if (letter) return typing ? null : { action: letter, swallow: false };

    const shared = SHARED_MAP[e.code];
    if (!shared) return null;
    // Reading or typing: the arrows scroll the screen you are looking at and
    // Space presses the button you have focused.
    if (typing || isInBoard(e.target)) return null;
    return { action: shared, swallow: true };
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      // Always an exit: drop focus back to the road so the arrow keys drive
      // again, whatever the visitor had wandered into.
      controls.releaseAll();
      onEscape?.();
      return;
    }

    const hit = resolve(e);
    if (!hit) return;
    if (hit.swallow) e.preventDefault();
    if (e.repeat) return;
    keys[hit.action] = true;
    markDriven();
  }

  function onKeyUp(e: KeyboardEvent) {
    // Release on the raw mapping: if focus moved mid-press we still need to
    // let go of the pedal, otherwise the throttle sticks on.
    const action = LETTER_MAP[e.code] ?? SHARED_MAP[e.code];
    if (!action) return;
    if (SHARED_MAP[e.code] && !isTypingTarget(e.target) && !isInBoard(e.target)) {
      e.preventDefault();
    }
    keys[action] = false;
  }

  // Alt-tabbing away with the throttle down should not leave it stuck on.
  function onBlur() {
    controls.releaseAll();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onBlur);

  return controls;
}

/** Collapses key and touch state into the values the physics step wants. */
export function readInput(c: Controls) {
  const on = (k: TouchButton) => c.keys[k] || c.touch[k];
  return {
    throttle: on("forward") ? 1 : 0,
    brake: on("back") ? 1 : 0,
    steer: (on("right") ? 1 : 0) - (on("left") ? 1 : 0),
    handbrake: on("handbrake"),
  };
}
