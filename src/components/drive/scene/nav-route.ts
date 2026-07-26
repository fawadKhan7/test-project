/**
 * Turn-by-turn guidance, painted onto the road itself.
 *
 * A written instruction ("turn left in 40m") asks the driver to do two things
 * at once: read words, and then map them onto the junction coming at them.
 * First-timers lose the turn in that gap. So the guidance here is not text —
 * it is a lane-width line of chevrons lying on the tarmac, running down the
 * driving lane and curving through the junction it wants you to take. Follow
 * the line and you have followed the instruction; there is nothing to decode.
 *
 * The second half is the beacons: a soft column of light standing over every
 * destination, drawn without fog so it is visible from the far end of the
 * boulevard. They answer "where is there anything to go to?" from the moment
 * the visitor pulls away, which is the question a map in the corner of the
 * screen answers far too slowly.
 */

import * as THREE from "three";
import {
  DESTINATIONS,
  routeTo,
  type Destination,
  type RoutePoint,
} from "@/lib/drive/world-map";
import { makeBeaconTexture, makeRouteChevrons } from "./textures";

export type NavRoute = {
  group: THREE.Group;
  /** Null shows the default line: straight on, down the boulevard. */
  setTarget(target: Destination | null): void;
  update(dt: number, elapsed: number): void;
  dispose(): void;
};

/** Metres of route per chevron tile. */
const TILE = 7;
/** How fast the chevrons crawl toward the destination, tiles/second. */
const SCROLL = 0.55;
const ROUTE_WIDTH = 3.2;
/** Above the lane markings, below anything with height. */
const ROUTE_Y = 0.05;

const BEACON_HEIGHT = 34;
const BEACON_WIDTH = 5.5;

/**
 * Smooths the route corners and lays a constant-width strip along it.
 *
 * The corners matter: a polyline with hard angles reads as a diagram, while a
 * curve reads as a driving line you could actually follow, which is the whole
 * point of putting the guidance on the road instead of in a caption.
 */
function ribbonGeometry(points: RoutePoint[]): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p.x, 0, p.z)),
    false,
    "catmullrom",
    0.25,
  );

  const approxLength = curve.getLength();
  const divisions = Math.max(8, Math.round(approxLength / 1.5));
  const samples = curve.getSpacedPoints(divisions);

  const position: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];

  const half = ROUTE_WIDTH / 2;
  let travelled = 0;
  const tangent = new THREE.Vector3();

  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    if (i > 0) travelled += p.distanceTo(samples[i - 1]);

    // Perpendicular in the ground plane. The route never doubles back on
    // itself, so a simple forward difference is stable the whole way along.
    const a = samples[Math.max(0, i - 1)];
    const b = samples[Math.min(samples.length - 1, i + 1)];
    tangent.subVectors(b, a).setY(0);
    if (tangent.lengthSq() < 1e-8) tangent.set(0, 0, -1);
    tangent.normalize();

    const nx = -tangent.z;
    const nz = tangent.x;
    const v = travelled / TILE;

    position.push(p.x - nx * half, ROUTE_Y, p.z - nz * half);
    position.push(p.x + nx * half, ROUTE_Y, p.z + nz * half);
    uv.push(0, v, 1, v);

    if (i > 0) {
      const base = (i - 1) * 2;
      index.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}

export function buildNavRoute(maxAnisotropy: number): NavRoute {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  /* ------------------------------------------------------------ route line */

  const chevrons = track(makeRouteChevrons(maxAnisotropy));
  const routeMat = track(
    new THREE.MeshBasicMaterial({
      map: chevrons,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      // The strip is generated from a curve, so its winding flips wherever the
      // route turns back on itself. Two-sided is simply correct here.
      side: THREE.DoubleSide,
      // Sits flush on the tarmac; the offset keeps it off the z-fighting line.
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
  );

  const routeMesh = new THREE.Mesh(new THREE.BufferGeometry(), routeMat);
  routeMesh.frustumCulled = false;
  group.add(routeMesh);

  /* --------------------------------------------------------------- beacons */

  const beaconTex = track(makeBeaconTexture());
  const beaconGeo = track(new THREE.PlaneGeometry(BEACON_WIDTH, BEACON_HEIGHT));
  const ringGeo = track(new THREE.RingGeometry(9, 11.4, 40));

  type Beacon = {
    id: string;
    mat: THREE.MeshBasicMaterial;
    ringMat: THREE.MeshBasicMaterial;
  };
  const beacons: Beacon[] = [];

  for (const d of DESTINATIONS) {
    // Unfogged on purpose: the column is the one thing allowed to punch
    // through the night, because "there is something over there" has to be
    // answerable from the moment the cab pulls away.
    const mat = track(
      new THREE.MeshBasicMaterial({
        map: beaconTex,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        side: THREE.DoubleSide,
      }),
    );

    // Two crossed quads, so the column has presence from any approach angle.
    for (const rot of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(beaconGeo, mat);
      blade.position.set(d.x, BEACON_HEIGHT / 2, d.z);
      blade.rotation.y = rot;
      group.add(blade);
    }

    const ringMat = track(
      new THREE.MeshBasicMaterial({
        color: 0xffd100,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(d.x, 0.07, d.z);
    group.add(ring);

    beacons.push({ id: d.id, mat, ringMat });
  }

  /* ---------------------------------------------------------------- state */

  let targetId: string | null = null;

  const setRoute = (points: RoutePoint[]) => {
    routeMesh.geometry.dispose();
    routeMesh.geometry = ribbonGeometry(points);
  };

  const applyTarget = (target: Destination | null) => {
    targetId = target?.id ?? null;

    // With nothing chosen, the line still runs — straight down the boulevard
    // to the drop-off. A visitor who does nothing but hold the throttle is
    // therefore already following a route, and passes every turning on the way.
    const route = target ?? DESTINATIONS[DESTINATIONS.length - 1];
    setRoute(routeTo(route));
    routeMat.color.set(target ? 0xffd100 : 0xfffbea);
    routeMat.opacity = target ? 0.95 : 0.78;
  };

  applyTarget(null);

  return {
    group,

    setTarget(target) {
      if ((target?.id ?? null) === targetId) return;
      applyTarget(target);
    },

    update(dt, elapsed) {
      chevrons.offset.y -= SCROLL * dt;

      // The chosen stop's beacon breathes; the rest sit at a steady low glow
      // so they read as "somewhere to go" rather than "go here now".
      const pulse = 0.5 + Math.sin(elapsed * 2.2) * 0.5;
      for (const b of beacons) {
        const active = b.id === targetId;
        b.mat.opacity = active ? 0.6 + pulse * 0.35 : 0.3;
        b.ringMat.opacity = active ? 0.35 + pulse * 0.35 : 0.22;
      }
    },

    dispose() {
      routeMesh.geometry.dispose();
      for (const d of disposables) d.dispose();
      group.clear();
    },
  };
}
