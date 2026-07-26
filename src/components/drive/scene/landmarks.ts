/**
 * The handful of things in this city that exist exactly once.
 *
 * A procedurally scattered skyline has no memory in it: every view is
 * plausible and none is recognisable, so a driver never builds a mental map
 * and every junction feels like the last one. Landmarks fix that, and they are
 * doing navigational work as much as decorative — "the one after the clock
 * tower" is a far better instruction than "the second junction", and it is one
 * the visitor gives themselves.
 *
 * Each is placed to be seen from the boulevard, sited clear of the drivable
 * surface, and built from the same flat boxes as everything else. Two of them
 * — the viaduct you drive under and the gasholder at the far end — also break
 * up the long straight, which is the stretch most at risk of feeling empty.
 */

import * as THREE from "three";
import { JUNCTION_Z, TERMINUS_Z, type Rect } from "@/lib/drive/world-map";
import { CREAM, YELLOW, makeClockFace, makeNeonSign } from "./textures";

export type Landmarks = {
  group: THREE.Group;
  update(elapsed: number): void;
  dispose(): void;
};

const site = (cx: number, cz: number, halfX: number, halfZ: number): Rect => ({
  minX: cx - halfX,
  maxX: cx + halfX,
  minZ: cz - halfZ,
  maxZ: cz + halfZ,
});

/**
 * Ground the procedural city must leave alone.
 *
 * Kept here, beside the things that occupy it, because the failure mode is
 * silent: a tower block generated on the viaduct's alignment simply grows up
 * through the deck, and nothing complains. Exporting the sites from the module
 * that places them is what stops the two drifting apart.
 */
/** Where the elevated railway crosses the boulevard. */
export const VIADUCT_Z = (JUNCTION_Z[0] + JUNCTION_Z[1]) / 2 + 18;

/**
 * Stretches of street frontage the landmarks need cleared.
 *
 * The viaduct is the only one that matters: shop terraces running unbroken
 * through its alignment would hide every pier, leaving a deck apparently
 * floating over the road. Driving *under* something only works if you can see
 * what is holding it up.
 */
export const LANDMARK_STREET_HOLES: Array<[number, number]> = [
  [VIADUCT_Z - 11, VIADUCT_Z + 11],
];

export const LANDMARK_SITES: Rect[] = [
  // Viaduct corridor — the full width it spans.
  site(0, VIADUCT_Z, 120, 9),
  // Clock tower.
  site(-34, JUNCTION_Z[0] - 26, 12, 12),
  // Neon hotel block.
  site(38, JUNCTION_Z[1] + 30, 16, 14),
  // Gasholder.
  site(-62, JUNCTION_Z[2] - 46, 20, 20),
  // Mast.
  site(40, TERMINUS_Z - 54, 14, 14),
  // Park square.
  site(46, JUNCTION_Z[0] - 42, 26, 23),
];

export function buildLandmarks(maxAnisotropy: number): Landmarks {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const stoneMat = track(
    new THREE.MeshLambertMaterial({ color: 0x2b2c31, emissive: 0x131417 }),
  );
  const darkMat = track(
    new THREE.MeshLambertMaterial({ color: 0x15161a, emissive: 0x0a0b0d }),
  );
  const steelMat = track(
    new THREE.MeshLambertMaterial({ color: 0x3a3d44, emissive: 0x17181c }),
  );
  const yellowMat = track(
    new THREE.MeshLambertMaterial({ color: YELLOW, emissive: 0x4a3900 }),
  );

  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    rotY = 0,
  ) => {
    const geo = track(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    group.add(mesh);
    return mesh;
  };

  /**
   * Repeats — piers, columns, park trees — go through here rather than becoming
   * one mesh each. Landmarks are hand-placed, so it is easy to end up with a
   * couple of hundred draw calls for a few objects without noticing.
   */
  const repeat = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    placements: Array<{
      x: number;
      y: number;
      z: number;
      rotY?: number;
      scale?: number;
      rotX?: number;
    }>,
  ) => {
    if (placements.length === 0) return;
    const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
    const m = new THREE.Matrix4();
    placements.forEach((p, i) => {
      const s = p.scale ?? 1;
      m.compose(
        new THREE.Vector3(p.x, p.y, p.z),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(p.rotX ?? 0, p.rotY ?? 0, 0),
        ),
        new THREE.Vector3(s, s, s),
      );
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  };

  /* ------------------------------------------------------------ clock tower */

  // On the approach to the first junction, north-west corner. The first thing
  // a visitor ever drives toward, and the anchor for "turn left at the clock".
  {
    const x = -34;
    const z = JUNCTION_Z[0] - 26;

    box(11, 26, 11, x, 13, z, stoneMat);
    box(12.4, 1.4, 12.4, x, 26.4, z, darkMat);
    box(8.4, 12, 8.4, x, 33, z, stoneMat);
    box(9.6, 1.2, 9.6, x, 39.4, z, darkMat);

    // Pyramid cap, faked with two shrinking blocks — cheaper than a cone and
    // more in keeping with a city made of boxes.
    box(6.6, 2.6, 6.6, x, 41.3, z, stoneMat);
    box(3.4, 2.6, 3.4, x, 43.9, z, stoneMat);
    box(0.5, 5, 0.5, x, 47.7, z, yellowMat);

    const faceTex = track(makeClockFace(maxAnisotropy));
    const faceMat = track(new THREE.MeshBasicMaterial({ map: faceTex }));
    const faceGeo = track(new THREE.PlaneGeometry(6.4, 6.4));
    // All four faces, because you approach it from two directions and pass it.
    for (let i = 0; i < 4; i++) {
      const face = new THREE.Mesh(faceGeo, faceMat);
      const a = (i * Math.PI) / 2;
      face.position.set(x + Math.sin(a) * 4.25, 33, z + Math.cos(a) * 4.25);
      face.rotation.y = a;
      group.add(face);
    }
  }

  /* --------------------------------------------------------------- viaduct */

  // An elevated railway crossing the boulevard between the first two
  // junctions. Chosen for the middle of the longest straight in the map: you
  // drive *under* it, which is the only moment in the drive where the city
  // passes overhead, and it reads from a long way off as a horizon line.
  {
    const z = VIADUCT_Z;
    const DECK_Y = 14;

    // Deck, well clear of the 8m sign gantries and the cab.
    box(230, 2.2, 9, 0, DECK_Y, z, steelMat);
    box(230, 1.1, 0.7, 0, DECK_Y + 1.6, z - 4.6, darkMat);
    box(230, 1.1, 0.7, 0, DECK_Y + 1.6, z + 4.6, darkMat);

    // Piers. The innermost pair sits immediately outside the shop frontage,
    // so the span over the road is a believable single jump rather than the
    // 70m one you get by stepping outward from the centre line.
    const pierAt: Array<{ x: number; y: number; z: number }> = [];
    const capAt: Array<{ x: number; y: number; z: number }> = [];
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const px = dir * (20 + i * 24);
        pierAt.push({ x: px, y: (DECK_Y - 1) / 2, z });
        capAt.push({ x: px, y: DECK_Y - 1.4, z });
      }
    }
    repeat(track(new THREE.BoxGeometry(3.4, DECK_Y - 1, 3.4)), stoneMat, pierAt);
    repeat(track(new THREE.BoxGeometry(5, 1.2, 5)), darkMat, capAt);

    // A stopped train on the deck, so it is a railway and not a wall.
    for (let i = 0; i < 4; i++) {
      const cx = -46 + i * 19;
      box(18, 3.4, 3.1, cx, DECK_Y + 2.8, z, darkMat);
      // Lit carriage windows: a warm strip at that height is unmistakable.
      const win = track(new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      for (const side of [-1, 1]) {
        const strip = new THREE.Mesh(
          track(new THREE.PlaneGeometry(15, 1.1)),
          win,
        );
        strip.position.set(cx, DECK_Y + 3.1, z + side * 1.58);
        strip.rotation.y = side < 0 ? Math.PI : 0;
        group.add(strip);
      }
    }
  }

  /* ---------------------------------------------------------- neon hotel */

  // A corner block with a vertical blade sign, opposite the second junction.
  // Blade signs are the one piece of city furniture that reads as *night*.
  const neonMats: THREE.MeshBasicMaterial[] = [];
  {
    const x = 30;
    const z = JUNCTION_Z[1] + 30;

    box(20, 34, 18, x + 8, 17, z, stoneMat);
    box(21.4, 1.4, 19.4, x + 8, 34.4, z, darkMat);

    for (const [text, offset] of [
      ["HOTEL", 0],
      ["ROOMS", 1],
    ] as const) {
      const tex = track(makeNeonSign(text, maxAnisotropy));
      const mat = track(
        new THREE.MeshBasicMaterial({
          map: tex,
          side: THREE.DoubleSide,
          transparent: true,
        }),
      );
      neonMats.push(mat);
      const blade = new THREE.Mesh(track(new THREE.PlaneGeometry(3.2, 12.8)), mat);
      blade.position.set(x - 1.6, 24 - offset * 14, z - 9.2 + offset * 18);
      blade.rotation.y = -Math.PI / 2;
      group.add(blade);
    }
  }

  /* -------------------------------------------------------------- gasholder */

  // Beyond the third junction: a cylindrical frame that breaks up an otherwise
  // rectilinear skyline, and marks the last stretch before the drop-off.
  {
    const x = -62;
    const z = JUNCTION_Z[2] - 46;
    const R = 15;

    const ringGeo = track(new THREE.TorusGeometry(R, 0.4, 6, 26));
    for (const y of [7, 15, 23]) {
      const ring = new THREE.Mesh(ringGeo, steelMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y, z);
      group.add(ring);
    }
    const columns = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      return { x: x + Math.sin(a) * R, y: 13, z: z + Math.cos(a) * R, rotY: a };
    });
    repeat(track(new THREE.BoxGeometry(0.7, 26, 0.7)), steelMat, columns);
    // The drum inside, sitting low as though the holder is half empty.
    const drum = new THREE.Mesh(
      track(new THREE.CylinderGeometry(R - 1.4, R - 1.4, 12, 22)),
      darkMat,
    );
    drum.position.set(x, 6, z);
    group.add(drum);
  }

  /* --------------------------------------------------------------- mast */

  // The tallest thing in the city, with an aircraft warning light. Placed past
  // the drop-off so it sits on the horizon down the whole boulevard: a "there
  // is an end to this road, and it is that way" marker from the very start.
  const beaconMat = track(new THREE.MeshBasicMaterial({ color: 0xff3b20 }));
  {
    const x = 40;
    const z = TERMINUS_Z - 54;

    box(9, 3, 9, x, 1.5, z, darkMat);
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      const nt = (i + 1) / 5;
      const w = 7 * (1 - t * 0.78);
      const h = 17;
      box(w, h, w, x, 3 + i * h + h / 2, z, steelMat);
      // Collar at each change of section, so it tapers visibly.
      box(w * 1.15, 0.7, w * 1.15, x, 3 + nt * 5 * h, z, darkMat);
    }
    box(0.6, 14, 0.6, x, 95, z, steelMat);

    const beacon = new THREE.Mesh(
      track(new THREE.SphereGeometry(1.3, 10, 8)),
      beaconMat,
    );
    beacon.position.set(x, 103, z);
    group.add(beacon);
  }

  /* ----------------------------------------------------------- park square */

  // A block of trees and a fountain, off the first junction. Somewhere in the
  // city that is not built on reads as deliberate planning rather than a gap.
  {
    const cx = 46;
    const cz = JUNCTION_Z[0] - 42;

    const lawn = new THREE.Mesh(
      track(new THREE.PlaneGeometry(46, 40)),
      track(new THREE.MeshBasicMaterial({ color: 0x111a13 })),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(cx, 0.02, cz);
    group.add(lawn);

    const barkMat = track(
      new THREE.MeshLambertMaterial({ color: 0x1d1a16, emissive: 0x0a0906 }),
    );
    const leafMat = track(
      new THREE.MeshLambertMaterial({ color: 0x16281c, emissive: 0x0a120c }),
    );
    const trunkGeo = track(new THREE.BoxGeometry(0.4, 5, 0.4));
    const canopyGeo = track(new THREE.BoxGeometry(1, 1, 1));

    let s = 4242;
    const rand = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };

    const trunkAt: Array<{ x: number; y: number; z: number }> = [];
    const canopyAt: Array<{
      x: number;
      y: number;
      z: number;
      rotY: number;
      scale: number;
    }> = [];

    for (let i = 0; i < 22; i++) {
      const tx = cx + (rand() - 0.5) * 42;
      const tz = cz + (rand() - 0.5) * 36;
      if (Math.hypot(tx - cx, tz - cz) < 7) continue;
      const size = 3.4 + rand() * 2;
      trunkAt.push({ x: tx, y: 2.5, z: tz });
      canopyAt.push({ x: tx, y: 5 + size * 0.3, z: tz, rotY: rand(), scale: size });
    }
    repeat(trunkGeo, barkMat, trunkAt);
    repeat(canopyGeo, leafMat, canopyAt);

    // Fountain basin, with a lit plume — the one bright point in the park.
    const basin = new THREE.Mesh(
      track(new THREE.CylinderGeometry(5, 5.6, 1.1, 18)),
      stoneMat,
    );
    basin.position.set(cx, 0.55, cz);
    group.add(basin);

    const plume = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.5, 1.6, 5, 12)),
      track(
        new THREE.MeshBasicMaterial({
          color: CREAM,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        }),
      ),
    );
    plume.position.set(cx, 3.4, cz);
    group.add(plume);
  }

  /* --------------------------------------------------------- depot arch */

  // A gateway across the forecourt, just north of the spawn bay, so the very
  // first thing pulling away does is take you *out* of somewhere. Posts stand
  // on the footway; the beam clears the cab by nine metres.
  {
    const z = 1;
    for (const side of [-1, 1]) {
      box(2, 11, 2, side * 10.6, 5.5, z, stoneMat);
    }
    box(23.2, 2.4, 2.2, 0, 11.8, z, yellowMat);
    box(23.2, 0.7, 2.6, 0, 13.3, z, darkMat);

    const label = track(makeNeonSign("DEPOT", maxAnisotropy));
    const labelMat = track(
      new THREE.MeshBasicMaterial({
        map: label,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    );
    neonMats.push(labelMat);
    const sign = new THREE.Mesh(track(new THREE.PlaneGeometry(2.4, 9.6)), labelMat);
    // On the near face of the left post, square to the driver leaving the bay.
    sign.position.set(-12.1, 6.4, z + 0.2);
    group.add(sign);
  }

  /* ---------------------------------------------------------------- lights */

  // A couple of soft fills so the landmarks are not silhouettes against the
  // fog. Cheap: two lights for the whole set.
  const clockFill = new THREE.PointLight(0xffe0a0, 90, 70, 2);
  clockFill.position.set(-34, 30, JUNCTION_Z[0] - 26);
  group.add(clockFill);

  const parkFill = new THREE.PointLight(0xfff0c0, 60, 55, 2);
  parkFill.position.set(46, 9, JUNCTION_Z[0] - 42);
  group.add(parkFill);

  return {
    group,

    update(elapsed: number) {
      // Aircraft warning light: a slow double blink, the way real masts do it.
      const t = elapsed % 3;
      const on = t < 0.16 || (t > 0.42 && t < 0.58);
      beaconMat.color.setHex(on ? 0xff4a2a : 0x2a0f0a);

      // Neon runs slightly unstable, which is the whole charm of neon. Kept
      // shallow so it never reads as a rendering fault.
      const flicker =
        0.86 +
        Math.sin(elapsed * 11) * 0.05 +
        Math.sin(elapsed * 27.3) * 0.035 +
        (Math.sin(elapsed * 3.1) > 0.985 ? -0.35 : 0);
      for (const m of neonMats) m.opacity = Math.max(0.3, flicker);
    },

    dispose() {
      for (const d of disposables) d.dispose();
      group.clear();
    },
  };
}
