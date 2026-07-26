/**
 * Builds the drivable city.
 *
 * The whole world is flat-shaded boxes and planes, which is both the Bauhaus
 * look the site already uses and the cheapest thing a phone GPU can draw.
 *
 * The one thing this file is really designed around is legibility from the
 * driver's seat. Every surface belongs to a fixed contrast ladder (see
 * `SURFACE` in ./textures) with tarmac as the brightest large area in the
 * scene, so "where am I allowed to drive" is answered by brightness before any
 * marking or sign resolves. On top of that ladder sit three cues, deliberately
 * ordered by how far away they work:
 *
 *   far   — beacons over the stops, unfogged (see ./nav-route)
 *   mid   — a lighter junction pad and its yellow box, visible as a shape
 *   close — kerb line, edge paint, lane arrows, chevron boards
 *
 * A driver approaching a turn therefore gets the same message three times,
 * each one arriving as the last stops being useful.
 *
 * Colour is never load-bearing on its own: the ladder is luminance, the
 * turnings are also geometry (a gap in an otherwise continuous kerb), and
 * every direction is also an arrow shape.
 */

import * as THREE from "three";
import {
  BAYS,
  CROSS_ROADS,
  DESTINATIONS,
  GANTRIES,
  JUNCTION_Z,
  KERB_W,
  MAIN_ROAD,
  PAVEMENT_W,
  PLAZAS,
  PLAZA_HALF,
  PLAZA_X,
  ROAD_HALF,
  SPAWN,
  WORLD_BOUNDS,
  boulevardHoles,
  crossStreetHoles,
  spans,
  type Rect,
} from "@/lib/drive/world-map";
import {
  INK,
  PAINT,
  SURFACE,
  YELLOW,
  makeCheckerTexture,
  makeChevronBoard,
  makeDirectionSign,
  makeGlowTexture,
  makeRoadArrow,
} from "./textures";
import { buildCity } from "./city";
import { buildProps } from "./props";
import {
  LANDMARK_SITES,
  LANDMARK_STREET_HOLES,
  buildLandmarks,
} from "./landmarks";

export type World = {
  group: THREE.Group;
  /** Lamp glows and beacons that pulse over time. */
  update(elapsed: number): void;
  dispose(): void;
};

const rectW = (r: Rect) => r.maxX - r.minX;
const rectD = (r: Rect) => r.maxZ - r.minZ;
const rectCx = (r: Rect) => (r.minX + r.maxX) / 2;
const rectCz = (r: Rect) => (r.minZ + r.maxZ) / 2;

/** Kerb height. Its width and the footway's come from the shared street model. */
const KERB_H = 0.26;

export function buildWorld(maxAnisotropy: number): World {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const glowTex = track(makeGlowTexture());
  const checkerTex = track(makeCheckerTexture(maxAnisotropy));

  /* ------------------------------------------------------------ materials */

  // Ground surfaces are unlit. The scene is a night city, and leaving the road
  // at the mercy of a dim key light is exactly what made it indistinguishable
  // from the verge — this way the contrast ladder is guaranteed, whatever the
  // lighting is doing.
  const groundMat = track(new THREE.MeshBasicMaterial({ color: SURFACE.verge }));
  const tarmacMat = track(new THREE.MeshBasicMaterial({ color: SURFACE.road }));
  const junctionMat = track(new THREE.MeshBasicMaterial({ color: SURFACE.junction }));
  const pavementMat = track(new THREE.MeshBasicMaterial({ color: SURFACE.pavement }));
  const whitePaintMat = track(new THREE.MeshBasicMaterial({ color: PAINT.white }));
  const yellowPaintMat = track(new THREE.MeshBasicMaterial({ color: PAINT.yellow }));

  // Anything with height keeps its shading, so the city still has form.
  const kerbMat = track(
    new THREE.MeshLambertMaterial({ color: SURFACE.kerb, emissive: 0x53565c }),
  );
  const checkerMat = track(new THREE.MeshBasicMaterial({ map: checkerTex }));
  const postMat = track(new THREE.MeshLambertMaterial({ color: 0x2a2a2a, emissive: 0x121212 }));
  const signBackMat = track(new THREE.MeshLambertMaterial({ color: INK }));
  const lampMat = track(new THREE.MeshBasicMaterial({ color: YELLOW }));

  /* --------------------------------------------------------------- ground */

  const groundGeo = track(new THREE.PlaneGeometry(1400, 1400));
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  group.add(ground);

  /* ---------------------------------------------------------- road surface */

  const roadGeo = track(new THREE.PlaneGeometry(1, 1));
  const flat = (mat: THREE.Material, r: Rect, y: number) => {
    const m = new THREE.Mesh(roadGeo, mat);
    m.scale.set(rectW(r), rectD(r), 1);
    m.rotation.x = -Math.PI / 2;
    m.position.set(rectCx(r), y, rectCz(r));
    group.add(m);
    return m;
  };

  for (const r of [MAIN_ROAD, ...CROSS_ROADS]) flat(tarmacMat, r, 0);
  // Plazas are where you park and read, so they get the lighter tone: it makes
  // the destination itself visible as a bright apron off the main drag.
  for (const r of PLAZAS) flat(junctionMat, r, 0.002);

  /* -------------------------------------------- kerbs, footways and verges */

  const kerbGeo = track(new THREE.BoxGeometry(1, KERB_H, 1));
  const kerbs: THREE.Matrix4[] = [];
  const pavements: THREE.Matrix4[] = [];

  const pushKerb = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(x, KERB_H / 2, z),
      new THREE.Quaternion(),
      new THREE.Vector3(w, 1, d),
    );
    kerbs.push(m);
  };

  const pushPavement = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(x, KERB_H - 0.02, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
      new THREE.Vector3(w, d, 1),
    );
    pavements.push(m);
  };

  // Boulevard: kerb and footway down both sides, broken at every junction and
  // at the drop-off apron.
  const boulevardSpans = spans(MAIN_ROAD.minZ, MAIN_ROAD.maxZ, boulevardHoles());

  for (const s of boulevardSpans) {
    const cz = (s.from + s.to) / 2;
    const d = s.to - s.from;
    for (const side of [-1, 1]) {
      pushKerb(side * (ROAD_HALF + KERB_W / 2), cz, KERB_W, d);
      pushPavement(
        side * (ROAD_HALF + KERB_W + PAVEMENT_W / 2),
        cz,
        PAVEMENT_W,
        d,
      );
    }
  }

  // Cross streets: same treatment, broken at the boulevard and at the plazas.
  const crossFrom = -PLAZA_X - PLAZA_HALF;
  const crossTo = PLAZA_X + PLAZA_HALF;
  for (const jz of JUNCTION_Z) {
    const crossSpans = spans(crossFrom, crossTo, crossStreetHoles());
    for (const s of crossSpans) {
      const cx = (s.from + s.to) / 2;
      const w = s.to - s.from;
      for (const side of [-1, 1]) {
        pushKerb(cx, jz + side * (ROAD_HALF + KERB_W / 2), w, KERB_W);
        pushPavement(
          cx,
          jz + side * (ROAD_HALF + KERB_W + PAVEMENT_W / 2),
          w,
          PAVEMENT_W,
        );
      }
    }
  }

  const kerbMesh = new THREE.InstancedMesh(kerbGeo, kerbMat, kerbs.length);
  kerbs.forEach((m, i) => kerbMesh.setMatrixAt(i, m));
  kerbMesh.instanceMatrix.needsUpdate = true;
  group.add(kerbMesh);

  const pavementGeo = track(new THREE.PlaneGeometry(1, 1));
  const pavementMesh = new THREE.InstancedMesh(
    pavementGeo,
    pavementMat,
    pavements.length,
  );
  pavements.forEach((m, i) => pavementMesh.setMatrixAt(i, m));
  pavementMesh.instanceMatrix.needsUpdate = true;
  group.add(pavementMesh);

  /* --------------------------------------------- junction pads and hatching */

  // A lighter square of tarmac at each crossing, visible from much further off
  // than any sign, so the turn registers early.
  for (const jz of JUNCTION_Z) {
    const pad = new THREE.Mesh(roadGeo, junctionMat);
    pad.scale.set(ROAD_HALF * 2, ROAD_HALF * 2, 1);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.006, jz);
    group.add(pad);
  }

  /* --------------------------------------------------------- lane markings */

  const markGeo = track(new THREE.PlaneGeometry(1, 1));
  const whiteMarks: THREE.Matrix4[] = [];
  const yellowMarks: THREE.Matrix4[] = [];

  const mark = (
    list: THREE.Matrix4[],
    x: number,
    z: number,
    w: number,
    d: number,
  ) => {
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(x, 0.012, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
      new THREE.Vector3(w, d, 1),
    );
    list.push(m);
  };

  const nearJunction = (z: number) =>
    JUNCTION_Z.some((jz) => Math.abs(z - jz) < ROAD_HALF + 3);

  // White for boundaries, yellow for anything that wants a decision. Keeping
  // those two jobs on two colours means the eye can filter for turns without
  // reading every line on the road.
  for (let z = MAIN_ROAD.maxZ - 4; z > MAIN_ROAD.minZ + 4; z -= 9) {
    if (nearJunction(z)) continue;
    mark(yellowMarks, 0, z, 0.36, 4.5);
  }
  for (let z = MAIN_ROAD.maxZ; z > MAIN_ROAD.minZ; z -= 10) {
    if (nearJunction(z)) continue;
    mark(whiteMarks, -ROAD_HALF + 0.5, z, 0.5, 10);
    mark(whiteMarks, ROAD_HALF - 0.5, z, 0.5, 10);
  }

  for (const jz of JUNCTION_Z) {
    for (let x = -PLAZA_X - PLAZA_HALF + 4; x < PLAZA_X + PLAZA_HALF - 4; x += 9) {
      if (Math.abs(x) < ROAD_HALF + 3) continue;
      mark(yellowMarks, x, jz, 4.5, 0.36);
      mark(whiteMarks, x, jz - ROAD_HALF + 0.5, 9, 0.5);
      mark(whiteMarks, x, jz + ROAD_HALF - 0.5, 9, 0.5);
    }

    // Stop lines on the boulevard approaches.
    mark(whiteMarks, ROAD_HALF / 2, jz + ROAD_HALF + 1.4, ROAD_HALF - 1, 0.7);
    mark(whiteMarks, -ROAD_HALF / 2, jz - ROAD_HALF - 1.4, ROAD_HALF - 1, 0.7);

    // Yellow box round the junction mouth, so the turning reads as an opening
    // in the kerb line rather than a gap you might miss.
    for (const side of [-1, 1]) {
      mark(yellowMarks, side * ROAD_HALF, jz, 0.55, ROAD_HALF * 2);
      mark(yellowMarks, 0, jz + side * ROAD_HALF, ROAD_HALF * 2, 0.55);
    }
  }

  // Painted outline round each plaza, so the parking apron has an edge even
  // though it has no kerb.
  for (const r of PLAZAS) {
    const w = rectW(r);
    const d = rectD(r);
    const cx = rectCx(r);
    const cz = rectCz(r);
    mark(whiteMarks, cx, r.minZ + 0.35, w, 0.7);
    mark(whiteMarks, cx, r.maxZ - 0.35, w, 0.7);
    mark(whiteMarks, r.minX + 0.35, cz, 0.7, d);
    mark(whiteMarks, r.maxX - 0.35, cz, 0.7, d);
  }

  for (const [list, mat] of [
    [whiteMarks, whitePaintMat],
    [yellowMarks, yellowPaintMat],
  ] as const) {
    const mesh = new THREE.InstancedMesh(markGeo, mat, list.length);
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  /* --------------------------------------------------------- lane arrows */

  // Left in the left lane, right in the right, repeated twice on the approach
  // so the turn is still being announced once the first pair is under the car.
  const arrowGeo = track(new THREE.PlaneGeometry(3.4, 6.8));
  const arrowFor = (dir: "left" | "right") =>
    track(
      new THREE.MeshBasicMaterial({
        map: track(makeRoadArrow(dir, maxAnisotropy)),
        transparent: true,
        depthWrite: false,
      }),
    );
  const leftArrowMat = arrowFor("left");
  const rightArrowMat = arrowFor("right");

  for (const jz of JUNCTION_Z) {
    for (const [side, mat] of [
      [-1, leftArrowMat],
      [1, rightArrowMat],
    ] as const) {
      for (const back of [9, 24]) {
        const arrow = new THREE.Mesh(arrowGeo, mat);
        arrow.rotation.x = -Math.PI / 2;
        arrow.position.set(side * 3.5, 0.02, jz + ROAD_HALF + back);
        group.add(arrow);
      }
    }
  }

  /* ------------------------------------------- junction corners & chevrons */

  // Checker blocks on the four corners of every junction. Reserved for exactly
  // this: hazard striping is the loudest thing in the palette, so it only
  // appears where the road actually pinches.
  const cornerGeo = track(new THREE.BoxGeometry(2.2, 1.1, 2.2));
  for (const jz of JUNCTION_Z) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const block = new THREE.Mesh(cornerGeo, checkerMat);
        block.position.set(
          sx * (ROAD_HALF + 1.2),
          0.55,
          jz + sz * (ROAD_HALF + 1.2),
        );
        group.add(block);
      }
    }
  }

  // Chevron boards framing each junction mouth, facing back up the boulevard.
  const chevronGeo = track(new THREE.PlaneGeometry(7.4, 2.45));
  const chevronMat = (dir: "left" | "right") =>
    track(
      new THREE.MeshBasicMaterial({
        map: track(makeChevronBoard(dir, maxAnisotropy)),
      }),
    );
  const leftChevron = chevronMat("left");
  const rightChevron = chevronMat("right");

  for (const jz of JUNCTION_Z) {
    for (const [side, mat] of [
      [-1, leftChevron],
      [1, rightChevron],
    ] as const) {
      const board = new THREE.Mesh(chevronGeo, mat);
      board.position.set(side * (ROAD_HALF + 5.6), 1.5, jz - ROAD_HALF - 1.4);
      group.add(board);
    }
  }

  /* ----------------------------------------------------------- street lamps */

  const glowGeo = track(new THREE.PlaneGeometry(24, 24));
  const glowMat = track(
    new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  /**
   * Just clear of the kerb top. A light pool laid flat on the road cuts a hard
   * line where it intersects the raised kerb, which reads as a rendering fault
   * rather than as light; a few centimetres of clearance removes it, and at
   * pool scale the lift is invisible.
   */
  const POOL_Y = KERB_H + 0.06;
  const poleGeo = track(new THREE.CylinderGeometry(0.16, 0.22, 8, 6));
  const armGeo = track(new THREE.BoxGeometry(2.6, 0.22, 0.22));
  const headGeo = track(new THREE.BoxGeometry(1.6, 0.3, 0.7));

  const addLamp = (x: number, z: number, facing: number) => {
    const lamp = new THREE.Group();
    lamp.position.set(x, 0, z);
    lamp.rotation.y = facing;

    const pole = new THREE.Mesh(poleGeo, postMat);
    pole.position.y = 4;
    lamp.add(pole);

    const arm = new THREE.Mesh(armGeo, postMat);
    arm.position.set(1.3, 7.9, 0);
    lamp.add(arm);

    const head = new THREE.Mesh(headGeo, lampMat);
    head.position.set(2.4, 7.75, 0);
    lamp.add(head);

    const pool = new THREE.Mesh(glowGeo, glowMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(2.4, POOL_Y, 0);
    lamp.add(pool);

    group.add(lamp);
  };

  // Alternating sides, close enough together that the pools of light overlap
  // into a continuous lit ribbon — the road is never dark between lamps.
  for (let z = MAIN_ROAD.maxZ - 10; z > MAIN_ROAD.minZ + 10; z -= 34) {
    addLamp(-ROAD_HALF - 1.6, z, Math.PI);
    addLamp(ROAD_HALF + 1.6, z - 17, 0);
  }
  for (const jz of JUNCTION_Z) {
    for (let x = -PLAZA_X + 10; x <= PLAZA_X - 10; x += 34) {
      if (Math.abs(x) < ROAD_HALF + 6) continue;
      addLamp(x, jz + ROAD_HALF + 1.6, -Math.PI / 2);
    }
  }

  /* ------------------------------------------------- city, props, landmarks */

  // Three layers, deliberately separated by how far away they work: the
  // skyline you navigate by, the street furniture you measure speed against,
  // and the handful of one-off landmarks that make the map memorable.
  const landmarks = buildLandmarks(maxAnisotropy);
  group.add(landmarks.group);

  const city = buildCity(
    maxAnisotropy,
    new THREE.Box2(
      new THREE.Vector2(WORLD_BOUNDS.minX - 80, WORLD_BOUNDS.minZ - 80),
      new THREE.Vector2(WORLD_BOUNDS.maxX + 80, WORLD_BOUNDS.maxZ + 80),
    ),
    LANDMARK_SITES,
  );
  group.add(city.group);

  const props = buildProps(maxAnisotropy, LANDMARK_STREET_HOLES);
  group.add(props.group);

  /* ------------------------------------------------------------------ signs */

  /**
   * A physical sign board: textured face, dark sides and back, so it reads as
   * an object rather than a floating decal when you drive past it.
   */
  const signMaterials = (face: THREE.Texture) => {
    const faceMat = track(new THREE.MeshBasicMaterial({ map: face }));
    return [signBackMat, signBackMat, signBackMat, signBackMat, faceMat, signBackMat];
  };

  const boardGeo = track(new THREE.BoxGeometry(1, 1, 0.22));

  const addBoard = (
    tex: THREE.Texture,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    rotY = 0,
  ) => {
    const mesh = new THREE.Mesh(boardGeo, signMaterials(tex));
    mesh.scale.set(w, h, 1);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    group.add(mesh);
    return mesh;
  };

  // Overhead gantries on the approach to each junction.
  const gantryPostGeo = track(new THREE.BoxGeometry(0.55, 8.4, 0.55));
  const gantryBeamGeo = track(new THREE.BoxGeometry(ROAD_HALF * 2 + 3.6, 0.6, 0.6));

  for (const g of GANTRIES) {
    const beam = new THREE.Mesh(gantryBeamGeo, postMat);
    beam.position.set(0, 8.1, g.z);
    group.add(beam);

    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(gantryPostGeo, postMat);
      post.position.set(side * (ROAD_HALF + 1.5), 4.2, g.z);
      group.add(post);
    }

    if (g.left) {
      addBoard(track(makeDirectionSign(g.left, "left", "yellow", maxAnisotropy)), 6.4, 2, -3.6, 6.6, g.z);
    }
    if (g.right) {
      addBoard(track(makeDirectionSign(g.right, "right", "yellow", maxAnisotropy)), 6.4, 2, 3.6, 6.6, g.z);
    }
    addBoard(
      track(makeDirectionSign(g.ahead, "up", "dark", maxAnisotropy)),
      5.2,
      2.6,
      0,
      4.1,
      g.z,
    );
  }

  // Roadside posts right at the junction, repeating the turn at eye level.
  const smallPostGeo = track(new THREE.BoxGeometry(0.3, 3.2, 0.3));
  for (const d of DESTINATIONS) {
    if (d.approach === "straight") continue;
    const side = d.approach === "left" ? -1 : 1;
    const x = side * (ROAD_HALF + 3.4);
    const z = d.junctionZ + ROAD_HALF + 5;

    const post = new THREE.Mesh(smallPostGeo, postMat);
    post.position.set(x, 1.6, z);
    group.add(post);

    addBoard(
      track(makeDirectionSign(d.sign, d.approach, "yellow", maxAnisotropy)),
      4.6,
      1.45,
      x,
      3.7,
      z,
    );
  }

  /* --------------------------------------------------------- reading bays */

  // The section panels project themselves in front of the driver, so nothing
  // needs mounting. What is still worth painting is where to stop: a marked
  // bay at each destination and at the depot.
  const bayGeo = track(new THREE.PlaneGeometry(1, 1));
  const bayInnerMat = track(new THREE.MeshBasicMaterial({ color: SURFACE.bay }));

  for (const bay of BAYS) {
    const outer = new THREE.Mesh(bayGeo, yellowPaintMat);
    outer.scale.set(7, 4, 1);
    outer.rotation.x = -Math.PI / 2;
    outer.rotation.z = -bay.rotY;
    outer.position.set(bay.x, 0.03, bay.z);
    group.add(outer);

    // Hollowed out to a painted outline rather than a solid yellow slab.
    const inner = new THREE.Mesh(bayGeo, bayInnerMat);
    inner.scale.set(6.4, 3.4, 1);
    inner.rotation.x = -Math.PI / 2;
    inner.rotation.z = -bay.rotY;
    inner.position.set(bay.x, 0.034, bay.z);
    group.add(inner);
  }

  /* ------------------------------------------------------------- depot apron */

  const apronTex = track(makeCheckerTexture(maxAnisotropy));
  apronTex.repeat.set(6, 3);
  const apronMat = track(new THREE.MeshBasicMaterial({ map: apronTex }));
  const apron = new THREE.Mesh(roadGeo, apronMat);
  apron.scale.set(ROAD_HALF * 2, 10, 1);
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, 0.008, SPAWN.z + 12);
  group.add(apron);

  checkerTex.repeat.set(3, 1);

  return {
    group,
    update(elapsed: number) {
      // Lamps breathe very slightly so the world never looks frozen.
      glowMat.opacity = 0.5 + Math.sin(elapsed * 1.1) * 0.04;
      props.update(elapsed);
      landmarks.update(elapsed);
    },
    dispose() {
      city.dispose();
      props.dispose();
      landmarks.dispose();
      for (const d of disposables) d.dispose();
      group.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
      group.clear();
    },
  };
}
