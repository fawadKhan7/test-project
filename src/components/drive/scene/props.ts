/**
 * Street level.
 *
 * The skyline is what you look at; this is what you drive *past*, and it is
 * what actually sells the speed. Tower blocks 80m away barely move across the
 * windscreen — a bin, a tree and a parked car two metres from the kerb sweep
 * by, and that parallax is most of the sensation of travelling through
 * somewhere rather than over a texture.
 *
 * Two rules govern everything here:
 *
 *  1. **Nothing stands on tarmac.** Every prop lives on the footway or behind
 *     it. There is no collision system, so anything on the carriageway would
 *     be something you drive straight through — which looks far worse than not
 *     having it at all.
 *  2. **Everything breaks where the street breaks.** Shops, trees, cars and
 *     kerbs all derive their runs from the same `spans` call, so a junction is
 *     a clean gap through every layer at once.
 */

import * as THREE from "three";
import {
  JUNCTION_Z,
  KERB_W,
  MAIN_ROAD,
  PAVEMENT_W,
  PLAZA_HALF,
  PLAZA_X,
  ROAD_HALF,
  SPAWN,
  boulevardHoles,
  crossStreetHoles,
  spans,
} from "@/lib/drive/world-map";
import { makeFacadeTexture, makeShopfrontTexture } from "./textures";

export type Props = {
  group: THREE.Group;
  update(elapsed: number): void;
  dispose(): void;
};

/** Back edge of the footway — where the buildings' ground floor starts. */
const FRONTAGE = ROAD_HALF + KERB_W + PAVEMENT_W;
/**
 * Parked cars sit just *behind* the kerb rather than against it in the road.
 * From the driving seat the difference is invisible — they read as parked at
 * the kerb either way — but it guarantees you can never drive through one,
 * which with no collision system is the only thing that matters.
 */
const PARKING = ROAD_HALF + KERB_W + 1.3;

/**
 * One shopfront unit. A fixed length so the texture never stretches — the
 * whole point of a shop frontage is that the units are a recognisable human
 * size, and a stretched one immediately looks like scenery.
 */
const SHOP_UNIT = 13;
/** Ground floor only. Shopfronts are about 4m tall; the rest is flats above. */
const SHOP_HEIGHT = 4.4;
/** The storeys over the shops, which is what actually encloses the street. */
const UPPER_HEIGHT = 8.5;
const PODIUM_DEPTH = 3.4;

const TREE_SPACING = 17;
const CAR_SPACING = 15;

/** Traffic signal cycle, seconds. */
const CYCLE = 11;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A run of street, and which way is "toward the road" from it. */
type Edge = {
  /** Points along the run. */
  at(t: number): { x: number; z: number };
  /** Length of the run. */
  length: number;
  /** Y rotation for something facing the carriageway. */
  facing: number;
  /** Offset a point sideways, positive being away from the road. */
  out(p: { x: number; z: number }, by: number): { x: number; z: number };
};

export function buildProps(
  maxAnisotropy: number,
  /**
   * Extra stretches of boulevard frontage to leave bare, passed in rather than
   * imported: the street layer has no business knowing what a landmark is, and
   * whoever assembles the world already knows about both.
   */
  extraHoles: Array<[number, number]> = [],
): Props {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const rand = rng(90210);

  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));

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

  /* ------------------------------------------------------------- the edges */

  // Both sides of the boulevard, then both sides of each cross street.
  const edges: Edge[] = [];

  // The forecourt is left bare on top of the usual breaks: the opening shot
  // looks straight down it, and it wants the depot arch and the taxi, not a
  // row of parked cars.
  const streetHoles: Array<[number, number]> = [
    ...boulevardHoles(),
    ...extraHoles,
    [SPAWN.z - 6, MAIN_ROAD.maxZ],
  ];

  for (const side of [-1, 1]) {
    for (const s of spans(MAIN_ROAD.minZ, MAIN_ROAD.maxZ, streetHoles, 14)) {
      edges.push({
        length: s.to - s.from,
        at: (t) => ({ x: side * FRONTAGE, z: s.from + t }),
        // Faces inward across the carriageway.
        facing: side < 0 ? Math.PI / 2 : -Math.PI / 2,
        out: (p, by) => ({ x: p.x + side * by, z: p.z }),
      });
    }
  }

  for (const jz of JUNCTION_Z) {
    for (const side of [-1, 1]) {
      for (const s of spans(
        -PLAZA_X - PLAZA_HALF,
        PLAZA_X + PLAZA_HALF,
        crossStreetHoles(),
        14,
      )) {
        edges.push({
          length: s.to - s.from,
          at: (t) => ({ x: s.from + t, z: jz + side * FRONTAGE }),
          facing: side < 0 ? Math.PI : 0,
          out: (p, by) => ({ x: p.x, z: p.z + side * by }),
        });
      }
    }
  }

  /* ---------------------------------------------------------- shop podiums */

  // A continuous lit retail frontage behind the footway. This is the single
  // biggest change at street level: it closes the street in, so the road reads
  // as a corridor between buildings instead of a strip in an empty field.
  const shopTex = track(makeShopfrontTexture(maxAnisotropy));
  const shopMat = track(new THREE.MeshBasicMaterial({ map: shopTex }));
  const shopGeo = track(
    new THREE.BoxGeometry(SHOP_UNIT, SHOP_HEIGHT, PODIUM_DEPTH),
  );

  // Flats over the shops, on the same footprint. Reusing a facade texture here
  // rather than inventing another keeps the street wall in the same family as
  // the skyline behind it.
  const upperTex = track(makeFacadeTexture("tenement", 11, maxAnisotropy));
  upperTex.repeat.set(3, 2);
  const upperMat = track(new THREE.MeshLambertMaterial({ map: upperTex }));
  const upperGeo = track(
    new THREE.BoxGeometry(SHOP_UNIT, UPPER_HEIGHT, PODIUM_DEPTH - 0.3),
  );

  const shops: THREE.Matrix4[] = [];
  const uppers: THREE.Matrix4[] = [];
  const shopCaps: THREE.Matrix4[] = [];

  for (const e of edges) {
    const units = Math.floor(e.length / SHOP_UNIT);
    for (let i = 0; i < units; i++) {
      const p = e.at((i + 0.5) * SHOP_UNIT);
      const q = e.out(p, PODIUM_DEPTH / 2);
      compose(shops, q.x, SHOP_HEIGHT / 2, q.z, 1, 1, 1, e.facing);
      // Cornice between the shopfront and the flats — the line that tells you
      // where one ends and the other begins, on every real high street.
      compose(
        shopCaps,
        q.x,
        SHOP_HEIGHT + 0.25,
        q.z,
        SHOP_UNIT + 0.5,
        0.5,
        PODIUM_DEPTH + 0.4,
        e.facing,
      );
      compose(
        uppers,
        q.x,
        SHOP_HEIGHT + 0.5 + UPPER_HEIGHT / 2,
        q.z,
        1,
        1,
        1,
        e.facing,
      );
      compose(
        shopCaps,
        q.x,
        SHOP_HEIGHT + 0.5 + UPPER_HEIGHT + 0.3,
        q.z,
        SHOP_UNIT + 0.6,
        0.6,
        PODIUM_DEPTH + 0.5,
        e.facing,
      );
    }
  }

  /* ----------------------------------------------------------------- trees */

  // Offset from the lamp posts rather than shared with them, so the footway
  // has a rhythm of alternating verticals instead of one repeated object.
  const trunks: THREE.Matrix4[] = [];
  const canopies: THREE.Matrix4[] = [];

  for (const e of edges) {
    for (let t = 8; t < e.length - 6; t += TREE_SPACING) {
      if (rand() < 0.22) continue;
      const p = e.at(t);
      const q = e.out(p, -(PAVEMENT_W * 0.5) + 0.4);
      const height = 3.6 + rand() * 1.4;
      const spread = 2 + rand() * 0.9;
      compose(trunks, q.x, height / 2, q.z, 0.26, height, 0.26);

      // Two offset, differently-turned blocks rather than one. A single cube
      // of foliage catches the light on one face and reads as a flat green
      // billboard; overlapping two gives the silhouette a broken edge and
      // enough shading variation to pass as a canopy at driving speed.
      compose(
        canopies,
        q.x,
        height + spread * 0.3,
        q.z,
        spread,
        spread * 0.8,
        spread,
        rand() * 1.5,
      );
      compose(
        canopies,
        q.x + (rand() - 0.5) * 0.7,
        height + spread * 0.78,
        q.z + (rand() - 0.5) * 0.7,
        spread * 0.72,
        spread * 0.62,
        spread * 0.72,
        rand() * 1.5,
      );
    }
  }

  /* ----------------------------------------------------------- parked cars */

  const carBodies: THREE.Matrix4[] = [];
  const carRoofs: THREE.Matrix4[] = [];
  const bodyColours: THREE.Color[] = [];
  const roofColours: THREE.Color[] = [];
  // Muted, so a row of parked cars never competes with the taxi or with the
  // road markings for attention. The taxi stays the only yellow thing moving.
  const PAINT_POOL = [0x2c3038, 0x3d3a34, 0x24303a, 0x3a2f2c, 0x2f3a30, 0x45464a];

  for (const e of edges) {
    for (let t = 14; t < e.length - 10; t += CAR_SPACING) {
      if (rand() < 0.38) continue;
      const p = e.at(t);
      const q = e.out(p, -(FRONTAGE - PARKING));
      // Parallel to the kerb, with a little scatter so the row is not a comb.
      const yaw = e.facing + Math.PI / 2 + (rand() - 0.5) * 0.09;
      compose(carBodies, q.x, 0.62, q.z, 1.9, 0.85, 4.3, yaw);
      compose(carRoofs, q.x, 1.35, q.z, 1.7, 0.62, 2.2, yaw);
      const colour = new THREE.Color(
        PAINT_POOL[Math.floor(rand() * PAINT_POOL.length)],
      );
      bodyColours.push(colour);
      roofColours.push(colour);
    }
  }

  /* --------------------------------------------------------- small clutter */

  // Bins, hydrants, boxes. Individually invisible; collectively the difference
  // between a pavement and a grey stripe.
  const clutter: THREE.Matrix4[] = [];
  for (const e of edges) {
    for (let t = 5; t < e.length - 5; t += 9) {
      if (rand() < 0.62) continue;
      const p = e.at(t);
      const q = e.out(p, -(PAVEMENT_W * 0.5) + 1.6 + rand() * 1.4);
      const kind = rand();
      if (kind < 0.4) compose(clutter, q.x, 0.5, q.z, 0.7, 1.0, 0.7, rand());
      else if (kind < 0.7) compose(clutter, q.x, 0.35, q.z, 0.45, 0.7, 0.45);
      else compose(clutter, q.x, 0.6, q.z, 1.5, 1.2, 0.6, e.facing);
    }
  }

  /* --------------------------------------------------------- traffic lights */

  // Shared materials, so every signal in the city changes on one cycle and the
  // whole animation costs six colour writes a frame.
  const lampMat = (colour: number) =>
    track(new THREE.MeshBasicMaterial({ color: colour }));
  const nsLamps = [lampMat(0x4a1410), lampMat(0x4a3410), lampMat(0x0f3a18)];
  const ewLamps = [lampMat(0x4a1410), lampMat(0x4a3410), lampMat(0x0f3a18)];

  const signalPost = track(
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a, emissive: 0x0a0a0a }),
  );
  const poleGeo = track(new THREE.BoxGeometry(0.18, 5, 0.18));
  const headGeo = track(new THREE.BoxGeometry(0.52, 1.36, 0.36));
  const lensGeo = track(new THREE.BoxGeometry(0.26, 0.26, 0.08));

  // Instanced by part rather than one mesh per signal: twelve signals built the
  // obvious way is sixty draw calls for something the driver glances at.
  const poles: THREE.Matrix4[] = [];
  const heads: THREE.Matrix4[] = [];
  const lenses: THREE.Matrix4[][] = [[], [], [], [], [], []];
  const up = new THREE.Vector3(0, 1, 0);

  const addSignal = (x: number, z: number, facing: number, ew: boolean) => {
    compose(poles, x, 2.5, z, 1, 1, 1);
    compose(heads, x, 5.4, z, 1, 1, 1, facing);

    for (let i = 0; i < 3; i++) {
      const offset = new THREE.Vector3(0, 0.42 - i * 0.42, 0.2)
        .applyAxisAngle(up, facing)
        .add(new THREE.Vector3(x, 5.4, z));
      compose(lenses[(ew ? 3 : 0) + i], offset.x, offset.y, offset.z, 1, 1, 1, facing);
    }
  };

  for (const jz of JUNCTION_Z) {
    const off = ROAD_HALF + 2.8;
    // Facing the boulevard's two approaches…
    addSignal(-off, jz + off, 0, false);
    addSignal(off, jz - off, Math.PI, false);
    // …and the cross street's.
    addSignal(off, jz + off, Math.PI / 2, true);
    addSignal(-off, jz - off, -Math.PI / 2, true);
  }

  /* -------------------------------------------------------------- steam */

  // Vents breathing over the gratings. Cheap, and the only thing in the city
  // that moves when the car does not.
  const steamMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x9aa4b4,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const steamGeo = track(new THREE.PlaneGeometry(3.4, 6));
  const steams: THREE.Mesh[] = [];
  for (const e of edges) {
    if (rand() < 0.78) continue;
    const p = e.at(e.length * (0.3 + rand() * 0.4));
    const q = e.out(p, -(PAVEMENT_W * 0.5));
    for (const rot of [0, Math.PI / 2]) {
      const s = new THREE.Mesh(steamGeo, steamMat);
      s.position.set(q.x, 3, q.z);
      s.rotation.y = rot;
      s.userData.phase = rand() * Math.PI * 2;
      group.add(s);
      steams.push(s);
    }
  }

  /* --------------------------------------------------------------- meshes */

  const addInstanced = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    list: THREE.Matrix4[],
    colours?: THREE.Color[],
  ) => {
    if (list.length === 0) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    if (colours) {
      colours.forEach((c, i) => mesh.setColorAt(i, c));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    group.add(mesh);
    return mesh;
  };

  const trimMat = track(
    new THREE.MeshLambertMaterial({ color: 0x14161b, emissive: 0x080a0d }),
  );
  const barkMat = track(
    new THREE.MeshLambertMaterial({ color: 0x1d1a16, emissive: 0x0a0906 }),
  );
  // Dark enough to stay a silhouette against the shopfronts behind it. Street
  // trees at night are a shape blocking light, not a green object.
  const leafMat = track(
    new THREE.MeshLambertMaterial({ color: 0x121e15, emissive: 0x050a07 }),
  );
  const carMat = track(new THREE.MeshLambertMaterial({ emissive: 0x0a0a0c }));

  addInstanced(shopGeo, shopMat, shops);
  addInstanced(upperGeo, upperMat, uppers);
  addInstanced(boxGeo, trimMat, shopCaps);
  addInstanced(boxGeo, barkMat, trunks);
  addInstanced(boxGeo, leafMat, canopies);
  addInstanced(boxGeo, trimMat, clutter);

  addInstanced(boxGeo, carMat, carBodies, bodyColours);
  addInstanced(boxGeo, carMat, carRoofs, roofColours);

  addInstanced(poleGeo, signalPost, poles);
  addInstanced(headGeo, signalPost, heads);
  [...nsLamps, ...ewLamps].forEach((mat, i) => {
    addInstanced(lensGeo, mat, lenses[i]);
  });

  return {
    group,

    update(elapsed: number) {
      /* --- signals ------------------------------------------------------- */
      const t = elapsed % CYCLE;
      // One phase table rather than branching per lamp: green, amber, red for
      // the boulevard, mirrored for the cross street.
      const nsGreen = t < CYCLE * 0.42;
      const nsAmber = !nsGreen && t < CYCLE * 0.5;
      const ewGreen = t > CYCLE * 0.52 && t < CYCLE * 0.94;
      const ewAmber = !ewGreen && t >= CYCLE * 0.94;

      const set = (
        lamps: THREE.MeshBasicMaterial[],
        green: boolean,
        amber: boolean,
      ) => {
        lamps[0].color.setHex(!green && !amber ? 0xff3b20 : 0x4a1410);
        lamps[1].color.setHex(amber ? 0xffb020 : 0x4a3410);
        lamps[2].color.setHex(green ? 0x3ce06a : 0x0f3a18);
      };
      set(nsLamps as THREE.MeshBasicMaterial[], nsGreen, nsAmber);
      set(ewLamps as THREE.MeshBasicMaterial[], ewGreen, ewAmber);

      /* --- steam --------------------------------------------------------- */
      for (const s of steams) {
        const phase = (s.userData.phase as number) + elapsed * 0.45;
        const rise = (phase % (Math.PI * 2)) / (Math.PI * 2);
        s.position.y = 1.6 + rise * 5;
        s.scale.setScalar(0.6 + rise * 1.5);
      }
      steamMat.opacity = 0.05 + Math.abs(Math.sin(elapsed * 0.35)) * 0.06;
    },

    dispose() {
      for (const d of disposables) d.dispose();
      group.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
      group.clear();
    },
  };
}
