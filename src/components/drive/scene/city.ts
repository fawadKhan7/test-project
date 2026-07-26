/**
 * The skyline.
 *
 * The previous city was one box per plot with one facade texture and a random
 * height, and it read as exactly that: wallpaper. Three things fix it, in
 * descending order of how much they matter from a moving car.
 *
 * **Silhouette.** Random heights make a hedge, not a skyline. Heights here are
 * biased toward two downtown clusters, so the roofline actually rises and falls
 * as you drive and there is somewhere that reads as "the centre of town". This
 * is also the single strongest orientation cue in the whole map — you always
 * know roughly where you are relative to the towers.
 *
 * **Grain.** A tenement and a glass tower differ mainly in how many windows
 * they have per storey. Buildings are therefore sorted into classes with their
 * own facade, height band and texture repeat, so window size stays plausible
 * instead of stretching with the box.
 *
 * **Tops.** Roofs are what you actually see of a low building from street
 * level, and a bare box top is the giveaway. Every building gets a parapet;
 * the shorter ones get water tanks, plant and aerials.
 *
 * All of it is instanced — one draw call per class and per prop type — so the
 * variety costs geometry, not frames.
 */

import * as THREE from "three";
import { isInside, isOnRoad, type Rect } from "@/lib/drive/world-map";
import { makeFacadeTexture, type FacadeKind } from "./textures";

export type City = {
  group: THREE.Group;
  dispose(): void;
};

/**
 * Two high-rise clusters. Two rather than one so the skyline has a middle
 * distance: from anywhere on the boulevard, one is near and one is far.
 */
const DOWNTOWNS = [
  { x: 62, z: -205, reach: 190, weight: 1 },
  { x: -78, z: -348, reach: 150, weight: 0.72 },
];

type BuildingClass = {
  kind: FacadeKind;
  /** Height band this class covers. */
  min: number;
  max: number;
  /** Texture repeat, tuned to the band so windows keep a constant size. */
  repeat: [number, number];
};

const CLASSES: BuildingClass[] = [
  { kind: "warehouse", min: 0, max: 13, repeat: [2, 1] },
  { kind: "tenement", min: 13, max: 21, repeat: [2, 2] },
  { kind: "slab", min: 21, max: 32, repeat: [2, 2] },
  { kind: "office", min: 32, max: 46, repeat: [2, 3] },
  { kind: "ribbon", min: 46, max: 62, repeat: [2, 4] },
  { kind: "tower", min: 62, max: Infinity, repeat: [2, 6] },
];

/** Roofs above this are never seen from a car, so they get no clutter. */
const ROOF_DETAIL_MAX_H = 30;
/** …and only when the building is close enough to the road to be looked at. */
const ROOF_DETAIL_RANGE = 34;

const PLOT = 25;

/** Deterministic RNG so the city is identical on every visit. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function buildCity(
  maxAnisotropy: number,
  bounds: THREE.Box2,
  /** Ground already occupied by hand-placed landmarks. */
  reserved: Rect[] = [],
): City {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const rand = rng(20260726);

  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const massesByClass = new Map<FacadeKind, THREE.Matrix4[]>();
  for (const c of CLASSES) massesByClass.set(c.kind, []);

  const parapets: THREE.Matrix4[] = [];
  const tanks: THREE.Matrix4[] = [];
  const plant: THREE.Matrix4[] = [];
  const aerials: THREE.Matrix4[] = [];

  const compose = (
    list: THREE.Matrix4[],
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rotY = 0,
  ) => {
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
      new THREE.Vector3(w, h, d),
    );
    list.push(m);
  };

  /** 0 at the edge of town, 1 in the middle of a high-rise cluster. */
  const downtownPull = (x: number, z: number) => {
    let best = 0;
    for (const d of DOWNTOWNS) {
      const dist = Math.hypot(x - d.x, z - d.z);
      best = Math.max(best, (1 - clamp01(dist / d.reach)) * d.weight);
    }
    return best;
  };

  for (let px = bounds.min.x; px < bounds.max.x; px += PLOT) {
    for (let pz = bounds.min.y; pz < bounds.max.y; pz += PLOT) {
      const cx = px + rand() * 9 - 4.5;
      const cz = pz + rand() * 9 - 4.5;

      let w = 9 + rand() * 10;
      let d = 9 + rand() * 10;

      const reach = Math.max(w, d) / 2;

      // Clear the footway as well as the carriageway, so buildings sit behind
      // the pavement rather than growing out of the kerb.
      if (isOnRoad(cx, cz, reach + 11)) continue;
      // …and stay off the landmarks, which would otherwise be grown through.
      if (reserved.some((r) => isInside(r, cx, cz, reach))) continue;
      if (rand() < 0.16) continue;

      const pull = downtownPull(cx, cz);
      // Squared random against a downtown-scaled ceiling: most plots stay low
      // wherever they are, and the tall ones cluster.
      const h = 7 + rand() ** 2 * (13 + pull ** 1.5 * 78);

      // Towers get a squarer, larger footprint — a 9m-wide 70m spike looks
      // like a mast, not a building.
      if (h > 46) {
        const grow = 1 + (h - 46) / 70;
        w = Math.min(w * grow, 26);
        d = Math.min(d * grow, 26);
      }

      const cls = CLASSES.find((c) => h >= c.min && h < c.max) ?? CLASSES[0];
      const masses = massesByClass.get(cls.kind);
      if (!masses) continue;

      // A slight yaw stops the whole city sharing one grid direction.
      const rotY = (rand() - 0.5) * 0.1;

      // Stepped tops on the tall ones: one setback is enough to turn a slab
      // into something with a profile.
      const stepped = h > 40 && rand() < 0.65;
      const baseH = stepped ? h * (0.62 + rand() * 0.14) : h;

      compose(masses, cx, baseH / 2, cz, w, baseH, d, rotY);
      compose(parapets, cx, baseH + 0.3, cz, w + 0.5, 0.6, d + 0.5, rotY);

      let roofY = baseH;
      let roofW = w;
      let roofD = d;

      if (stepped) {
        const topH = h - baseH;
        const topW = w * (0.6 + rand() * 0.16);
        const topD = d * (0.6 + rand() * 0.16);
        compose(masses, cx, baseH + topH / 2, cz, topW, topH, topD, rotY);
        compose(parapets, cx, h + 0.3, cz, topW + 0.4, 0.6, topD + 0.4, rotY);
        roofY = h;
        roofW = topW;
        roofD = topD;
      }

      /* ------------------------------------------------------ roof clutter */

      if (h > ROOF_DETAIL_MAX_H) continue;
      if (!isOnRoad(cx, cz, ROOF_DETAIL_RANGE)) continue;

      const spot = () => ({
        x: cx + (rand() - 0.5) * roofW * 0.55,
        z: cz + (rand() - 0.5) * roofD * 0.55,
      });

      if (rand() < 0.55) {
        const p = spot();
        const r = 0.8 + rand() * 0.5;
        compose(tanks, p.x, roofY + 1.55, p.z, r, 1.9, r);
        compose(plant, p.x, roofY + 0.3, p.z, r * 1.5, 0.6, r * 1.5);
      }
      const units = Math.floor(rand() * 3);
      for (let i = 0; i < units; i++) {
        const p = spot();
        compose(plant, p.x, roofY + 0.45, p.z, 1.4, 0.9, 1.1, rand() * 1.2);
      }
      if (rand() < 0.4) {
        const p = spot();
        const mastH = 2.4 + rand() * 2.6;
        compose(aerials, p.x, roofY + mastH / 2, p.z, 0.14, mastH, 0.14);
        compose(aerials, p.x, roofY + mastH * 0.78, p.z, 1.5, 0.1, 0.1);
      }
    }
  }

  /* --------------------------------------------------------------- meshes */

  const addInstanced = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    list: THREE.Matrix4[],
  ) => {
    if (list.length === 0) return;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  };

  CLASSES.forEach((cls, i) => {
    const list = massesByClass.get(cls.kind);
    if (!list || list.length === 0) return;
    const tex = track(makeFacadeTexture(cls.kind, i * 37 + 5, maxAnisotropy));
    tex.repeat.set(cls.repeat[0], cls.repeat[1]);
    addInstanced(boxGeo, track(new THREE.MeshLambertMaterial({ map: tex })), list);
  });

  // Roof furniture is all one dark material: at street level these are
  // silhouettes against the sky, and silhouettes are all they need to be.
  const roofMat = track(
    new THREE.MeshLambertMaterial({ color: 0x101218, emissive: 0x07080b }),
  );
  addInstanced(boxGeo, roofMat, parapets);
  addInstanced(boxGeo, roofMat, plant);
  addInstanced(boxGeo, roofMat, aerials);
  addInstanced(
    track(new THREE.CylinderGeometry(1, 1, 1, 8)),
    track(new THREE.MeshLambertMaterial({ color: 0x1b1a17, emissive: 0x0a0a08 })),
    tanks,
  );

  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose();
      group.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
      group.clear();
    },
  };
}
