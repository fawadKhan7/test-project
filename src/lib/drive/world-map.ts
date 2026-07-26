/**
 * The city map behind the first-person drive.
 *
 * Everything the 3D scene, the physics containment and the minimap need to
 * agree on lives here, so the road you see is exactly the road you can drive
 * on and exactly the road drawn on the minimap.
 *
 * Axes follow three.js: +X is east, -Z is north, +Y is up. The cab starts at
 * the depot facing north (heading 0) and drives up the main boulevard.
 */

/** Half-width of a two-lane road, in metres. */
export const ROAD_HALF = 7;

/** Where the cab spawns, and which way it faces. */
export const SPAWN = { x: 0, z: 14, heading: 0 } as const;

/** Z positions of the three cross-street intersections along the boulevard. */
export const JUNCTION_Z = [-80, -180, -280] as const;

/** X position of the destination plazas either side of each cross street. */
export const PLAZA_X = 80;

/** Half-size of a destination plaza. */
export const PLAZA_HALF = 20;

/** The boulevard's far end, where the drop-off sits. */
export const TERMINUS_Z = -400;

/** How close the cab must get to a plaza centre before the section opens. */
export const ARRIVAL_HALF = 14;

export type Approach = "left" | "right" | "straight";

export type Destination = {
  /** Matches the id of the existing section so anchors keep working. */
  id: string;
  /** Short name on the road signs. */
  sign: string;
  /** Human label for the HUD and minimap. */
  label: string;
  /** Plaza centre. */
  x: number;
  z: number;
  /** Which way the driver turns off the boulevard to reach it. */
  approach: Approach;
  /** Z of the junction this destination hangs off (terminus uses its own Z). */
  junctionZ: number;
};

/**
 * The seven drivable destinations. "Pick-up" is not in this list — it is the
 * depot you start in, and its content is the welcome card.
 */
export const DESTINATIONS: Destination[] = [
  { id: "book", sign: "BOOK", label: "Book a cab", x: -PLAZA_X, z: JUNCTION_Z[0], approach: "left", junctionZ: JUNCTION_Z[0] },
  { id: "services", sign: "SERVICES", label: "Services", x: PLAZA_X, z: JUNCTION_Z[0], approach: "right", junctionZ: JUNCTION_Z[0] },
  { id: "fleet", sign: "FLEET", label: "The fleet", x: -PLAZA_X, z: JUNCTION_Z[1], approach: "left", junctionZ: JUNCTION_Z[1] },
  { id: "fares", sign: "FARES", label: "Fares", x: PLAZA_X, z: JUNCTION_Z[1], approach: "right", junctionZ: JUNCTION_Z[1] },
  { id: "reviews", sign: "REVIEWS", label: "Reviews", x: -PLAZA_X, z: JUNCTION_Z[2], approach: "left", junctionZ: JUNCTION_Z[2] },
  { id: "faq", sign: "FAQ", label: "FAQ", x: PLAZA_X, z: JUNCTION_Z[2], approach: "right", junctionZ: JUNCTION_Z[2] },
  { id: "call", sign: "DROP-OFF", label: "Drop-off", x: 0, z: TERMINUS_Z, approach: "straight", junctionZ: TERMINUS_Z },
];

/** An axis-aligned patch of tarmac. Used for drawing *and* for containment. */
export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

const rect = (cx: number, cz: number, halfX: number, halfZ: number): Rect => ({
  minX: cx - halfX,
  maxX: cx + halfX,
  minZ: cz - halfZ,
  maxZ: cz + halfZ,
});

/** The boulevard, from behind the depot to past the drop-off. */
export const MAIN_ROAD: Rect = {
  minX: -ROAD_HALF,
  maxX: ROAD_HALF,
  minZ: TERMINUS_Z - PLAZA_HALF - 4,
  maxZ: SPAWN.z + 24,
};

/** The three cross streets, each running the full width out to both plazas. */
export const CROSS_ROADS: Rect[] = JUNCTION_Z.map((z) =>
  rect(0, z, PLAZA_X + PLAZA_HALF, ROAD_HALF),
);

/** Plaza aprons — the wide bit of tarmac you park on at each destination. */
export const PLAZAS: Rect[] = DESTINATIONS.map((d) =>
  d.approach === "straight"
    ? rect(d.x, d.z, PLAZA_HALF + 4, PLAZA_HALF + 4)
    : rect(d.x, d.z, PLAZA_HALF, PLAZA_HALF),
);

/** Every surface the cab is allowed on. */
export const DRIVABLE: Rect[] = [MAIN_ROAD, ...CROSS_ROADS, ...PLAZAS];

/** Outer bounds of the whole map, used as invisible walls. */
export const WORLD_BOUNDS: Rect = {
  minX: -PLAZA_X - PLAZA_HALF - 30,
  maxX: PLAZA_X + PLAZA_HALF + 30,
  minZ: TERMINUS_Z - PLAZA_HALF - 30,
  maxZ: SPAWN.z + 50,
};

export function isInside(r: Rect, x: number, z: number, pad = 0): boolean {
  return x >= r.minX - pad && x <= r.maxX + pad && z >= r.minZ - pad && z <= r.maxZ + pad;
}

/** True when the cab is on tarmac rather than ploughing through the verge. */
export function isOnRoad(x: number, z: number, pad = 0): boolean {
  for (const r of DRIVABLE) if (isInside(r, x, z, pad)) return true;
  return false;
}

/**
 * Squared distance from a point to the nearest drivable rect. Zero when on
 * road. The physics step uses this to nudge a lost driver back toward tarmac
 * instead of hard-blocking them.
 */
export function nearestRoadPoint(x: number, z: number): { x: number; z: number; dist: number } {
  let best = { x, z, dist: Infinity };
  for (const r of DRIVABLE) {
    const cx = Math.min(Math.max(x, r.minX), r.maxX);
    const cz = Math.min(Math.max(z, r.minZ), r.maxZ);
    const d = Math.hypot(cx - x, cz - z);
    if (d < best.dist) best = { x: cx, z: cz, dist: d };
  }
  return best;
}

/** The destination whose arrival zone contains this point, if any. */
export function destinationAt(x: number, z: number): Destination | null {
  for (const d of DESTINATIONS) {
    const half = d.approach === "straight" ? ARRIVAL_HALF + 6 : ARRIVAL_HALF;
    if (Math.abs(x - d.x) <= half && Math.abs(z - d.z) <= half) return d;
  }
  return null;
}

/* ------------------------------------------------------------------- routing */

export type RoutePoint = { x: number; z: number };

/**
 * The lane-accurate path from the boulevard to a destination, as a polyline.
 *
 * Wayfinding on a road only works if the guidance *is* the road: a line that
 * runs down the driving lane and swings through the junction tells you where
 * to go and how to get there in one read, which a written instruction cannot.
 * These points are used both by the painted route line in the world and by the
 * minimap, so the two can never disagree.
 */
export function routeTo(target: Destination): RoutePoint[] {
  /** Sit in the correct half of the carriageway rather than on the centre. */
  const lane = ROAD_HALF / 2;
  const start = SPAWN.z + 10;

  if (target.approach === "straight") {
    return [
      { x: lane, z: start },
      { x: lane, z: target.z + PLAZA_HALF },
      { x: 0, z: target.z },
    ];
  }

  const side = Math.sign(target.x);
  const jz = target.junctionZ;
  // Keeping right means the far half of the cross street when heading east and
  // the near half when heading west, so the line never crosses oncoming lanes.
  const exitZ = jz + side * lane;

  return [
    { x: lane, z: start },
    // Ease into the turning lane well before the junction.
    { x: lane, z: jz + 30 },
    { x: side * lane, z: jz + 14 },
    // Round the corner: one point inside the junction, one on the way out.
    { x: side * lane, z: jz + 3 },
    { x: side * (ROAD_HALF + 3), z: exitZ },
    { x: target.x - side * (PLAZA_HALF - 2), z: exitZ },
    { x: target.x, z: target.z },
  ];
}

/* ------------------------------------------------- holographic section panels */

/**
 * Every section of the site is a hologram the cab projects in front of you
 * when you pull into a stop, rather than a billboard bolted to a wall.
 *
 * The reason is comfort: a fixed board forces the driver to hunt for the one
 * parking spot where it reads well. A projected panel arrives already square
 * to the windscreen at a fixed distance, so you drive up, read, and drive off
 * without ever repositioning. It is still a real object in the world — it has
 * perspective, it drifts into place, and the road shows through it.
 */
export const HOLO = {
  /**
   * CSS pixel size of the DOM element behind the panel. Chosen together with
   * `screenFraction` so the content lands near 1:1 with the viewer's screen —
   * big enough to read, small enough to leave the road visible round it.
   */
  pxW: 800,
  pxH: 460,
  /** How far in front of the driver's eye it sits, in metres. */
  distance: 9,
  /** Fraction of the viewport width it should span. */
  screenFraction: 0.55,
  /**
   * Sits a touch below the eyeline — like a head-up display cast onto the
   * bonnet. Keeps the top of the windscreen, the road signs and the nav strip
   * clear while the panel is up.
   */
  riseY: -0.45,
} as const;

/** Panels, in the order they appear on the route. */
export const PANEL_IDS = ["top", ...DESTINATIONS.map((d) => d.id)] as const;

/**
 * The depot forecourt. Treated as a stop in its own right so the welcome
 * panel greets you at the wheel and clears the moment you pull away.
 */
export const DEPOT_ZONE: Rect = rect(SPAWN.x, SPAWN.z, ROAD_HALF + 2, 16);

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * How strongly a stop is "present" from where the cab is standing: 1 parked in
 * the middle of the bay, 0 at the edge of its zone and beyond.
 *
 * A panel that is either fully on or fully off has to pick a moment to vanish,
 * and any moment it picks is wrong — too early and it disappears while you are
 * still reading, too late and it hangs in the windscreen after you have pulled
 * away. Tying it to distance instead means backing out of a bay dims it as you
 * go and rolling back in brings it up again, with no threshold anywhere.
 */
export function zonePresence(
  x: number,
  z: number,
): { id: string | null; presence: number } {
  const dest = destinationAt(x, z);
  if (dest) {
    const half = dest.approach === "straight" ? ARRIVAL_HALF + 6 : ARRIVAL_HALF;
    const d = Math.max(Math.abs(x - dest.x), Math.abs(z - dest.z)) / half;
    return { id: dest.id, presence: 1 - smoothstep(0.2, 0.8, d) };
  }

  if (isInside(DEPOT_ZONE, x, z)) {
    const cx = (DEPOT_ZONE.minX + DEPOT_ZONE.maxX) / 2;
    const cz = (DEPOT_ZONE.minZ + DEPOT_ZONE.maxZ) / 2;
    const d = Math.max(
      Math.abs(x - cx) / ((DEPOT_ZONE.maxX - DEPOT_ZONE.minX) / 2),
      Math.abs(z - cz) / ((DEPOT_ZONE.maxZ - DEPOT_ZONE.minZ) / 2),
    );
    return { id: "top", presence: 1 - smoothstep(0.2, 0.8, d) };
  }

  return { id: null, presence: 0 };
}

/** Painted "stop here" bay at each destination, and at the depot. */
export const BAYS: Array<{ x: number; z: number; rotY: number }> = [
  { x: SPAWN.x, z: SPAWN.z, rotY: 0 },
  ...DESTINATIONS.map((d) => ({
    x: d.x,
    z: d.z,
    rotY: d.approach === "straight" ? 0 : Math.PI / 2,
  })),
];

/** Sign gantries: one on the approach to each junction, plus the terminus. */
export type Gantry = {
  z: number;
  left: string | null;
  right: string | null;
  ahead: string;
};

export const GANTRIES: Gantry[] = [
  { z: JUNCTION_Z[0] + 34, left: "BOOK", right: "SERVICES", ahead: "FLEET · FARES" },
  { z: JUNCTION_Z[1] + 34, left: "FLEET", right: "FARES", ahead: "REVIEWS · FAQ" },
  { z: JUNCTION_Z[2] + 34, left: "REVIEWS", right: "FAQ", ahead: "DROP-OFF" },
];
