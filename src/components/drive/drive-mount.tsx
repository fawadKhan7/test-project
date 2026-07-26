"use client";

/**
 * Chooses between the drive and the readable site, and keeps three.js off the
 * wire for anyone who is never going to see it.
 *
 * The classic scrolling site is server-rendered on every request — it is what
 * crawlers, no-JS visitors and anyone who asked for reduced motion get, and
 * it is the target of every "skip the drive" control. An inline script in the
 * document head decides before first paint whether the drive is on, so there
 * is no flash of the wrong experience.
 */

import dynamic from "next/dynamic";
import { useCallback, useSyncExternalStore } from "react";
import { Car } from "lucide-react";
import {
  canDrive,
  canDriveServerSnapshot,
  getDriveMode,
  getDriveModeServerSnapshot,
  setDriveMode,
  subscribeDriveMode,
  subscribeMotionPreference,
} from "@/lib/drive/drive-mode";
import type { DriveSections } from "./drive-experience";

/**
 * Sits behind the canvas while the 3D chunk downloads. Hidden by CSS unless
 * `drive-3d` is set, so it costs nothing on the readable site.
 */
function Splash() {
  return (
    <div className="drive-splash bg-ink fixed inset-0 z-20 flex-col items-center justify-center gap-4">
      <p className="font-display border-yellow text-yellow border-2 px-4 py-2 text-lg uppercase">
        Yellow Line
      </p>
      <p className="text-cream-dim text-xs font-bold tracking-[0.2em] uppercase">
        Warming the engine…
      </p>
    </div>
  );
}

const DriveExperience = dynamic(
  () => import("./drive-experience").then((m) => m.DriveExperience),
  { ssr: false, loading: () => null },
);

export function DriveMount({
  hero,
  sections,
  classic,
}: {
  hero: React.ReactNode;
  sections: DriveSections;
  classic: React.ReactNode;
}) {
  const driving = useSyncExternalStore(
    subscribeDriveMode,
    getDriveMode,
    getDriveModeServerSnapshot,
  );

  const capable = useSyncExternalStore(
    subscribeMotionPreference,
    canDrive,
    canDriveServerSnapshot,
  );

  const skip = useCallback(() => setDriveMode(false), []);
  const start = useCallback(() => setDriveMode(true), []);

  return (
    <>
      <Splash />

      {driving && (
        <DriveExperience hero={hero} sections={sections} onSkip={skip} />
      )}

      <div className={driving ? "hidden" : "drive-classic"}>{classic}</div>

      {!driving && capable && (
        <button
          type="button"
          onClick={start}
          className="border-ink bg-yellow text-ink hover:bg-yellow-deep focus-visible:ring-cream fixed right-4 bottom-4 z-40 flex min-h-[44px] cursor-pointer items-center gap-2 border-2 px-3.5 text-[0.7rem] font-bold tracking-[0.14em] uppercase shadow-[4px_4px_0_var(--ink)] transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Car className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
          Drive the site
        </button>
      )}
    </>
  );
}
