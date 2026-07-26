"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Reads a media query without a mount-time setState, and keeps up if the
 * answer changes (rotating a tablet, plugging in a mouse, toggling reduced
 * motion in the OS). Renders as `false` on the server.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
