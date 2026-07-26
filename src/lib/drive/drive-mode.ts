/**
 * Whether the visitor is driving, held outside React.
 *
 * The `drive-3d` class on <html> is the single source of truth: an inline
 * script sets it before first paint (so the page never flashes the wrong
 * experience) and the CSS keys off it. React reads that same class through
 * `useSyncExternalStore` rather than mirroring it in state, which keeps the
 * server and client renders in agreement and avoids a setState-on-mount.
 */

const CLASS = "drive-3d";
const STORAGE_KEY = "yl-drive";

const listeners = new Set<() => void>();

export function subscribeDriveMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDriveMode(): boolean {
  return document.documentElement.classList.contains(CLASS);
}

/** The server has no DOM, so it always renders the readable site. */
export function getDriveModeServerSnapshot(): boolean {
  return false;
}

export function setDriveMode(on: boolean): void {
  document.documentElement.classList.toggle(CLASS, on);
  try {
    if (on) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, "off");
  } catch {
    // Private browsing — the choice simply won't survive a reload.
  }
  for (const l of listeners) l();
}

/* ------------------------------------------------------------- capability */

let webglSupport: boolean | null = null;

function testWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (c.getContext("webgl2") || c.getContext("webgl")),
    );
  } catch {
    return false;
  }
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** True when offering the drive would actually work and be welcome. */
export function canDrive(): boolean {
  if (webglSupport === null) webglSupport = testWebGL();
  return webglSupport && !window.matchMedia(REDUCED_MOTION).matches;
}

export function subscribeMotionPreference(listener: () => void): () => void {
  const mql = window.matchMedia(REDUCED_MOTION);
  mql.addEventListener("change", listener);
  return () => mql.removeEventListener("change", listener);
}

export function canDriveServerSnapshot(): boolean {
  return false;
}
