/**
 * The cab, seen from outside.
 *
 * Until now the vehicle was only ever an interior — pillars, a bonnet and a
 * wheel framing the road. That works for the whole drive and is invisible the
 * moment the camera steps out of the car, which is exactly what happens when
 * you arrive at a stop. So this is the other half: a body the interior fits
 * inside, built to the same flat-shaded, two-colour rules as the city.
 *
 * Local space matches the cockpit's: +X right, +Y up, **-Z forward**. The
 * origin sits on the road under the middle of the car, so the whole thing can
 * be parented straight to the car rig without an offset.
 *
 * Only the front wheels steer and only the wheels spin — everything else is
 * static geometry. That is enough: at the distance the third-person camera
 * sits, wheel rotation is the entire difference between "a model" and "a car".
 */

import * as THREE from "three";
import { SURFACE, YELLOW, makeCheckerTexture, makeMirrorTag } from "./textures";

export type CarBody = {
  group: THREE.Group;
  update(steer: number, wheelSpin: number): void;
  dispose(): void;
};

/**
 * Overall envelope, sized so the cockpit interior sits inside it — which makes
 * this a tall cab rather than a saloon, because the interior was built with the
 * generous glasshouse the driving view needs.
 *
 * The body is deliberately narrower than the track: wheels tucked inside the
 * flanks read as a slab on castors, and getting them proud of the bodywork is
 * most of what separates "a box" from "a car" at third-person distance.
 */
const LENGTH = 5.5;
const WIDTH = 1.95;
const FRONT_Z = -3.35;
const REAR_Z = FRONT_Z + LENGTH;

const WHEEL_R = 0.38;
const WHEEL_W = 0.3;
/** Track set so ~18cm of each wheel stands clear of the body side. */
const AXLE_X = 1.0;
const FRONT_AXLE_Z = -2.3;
const REAR_AXLE_Z = 1.3;

/** Steering lock at the wheel, radians. Visual only. */
const WHEEL_LOCK = 0.5;

export function buildCarBody(maxAnisotropy: number): CarBody {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  // A little emissive on every panel: the city is a dark night and an unlit
  // yellow reads as brown once the key light falls off behind the buildings.
  const bodyMat = track(
    new THREE.MeshLambertMaterial({ color: YELLOW, emissive: 0x4a3900 }),
  );
  const trimMat = track(
    new THREE.MeshLambertMaterial({ color: 0x131313, emissive: 0x070707 }),
  );
  const glassMat = track(
    new THREE.MeshLambertMaterial({ color: 0x0a0d12, emissive: 0x0d1520 }),
  );
  const tyreMat = track(
    new THREE.MeshLambertMaterial({ color: 0x101010, emissive: 0x060606 }),
  );
  const hubMat = track(
    new THREE.MeshLambertMaterial({ color: SURFACE.kerb, emissive: 0x3c3e42 }),
  );
  const lampMat = track(new THREE.MeshBasicMaterial({ color: 0xfff3cc }));
  const tailMat = track(new THREE.MeshBasicMaterial({ color: 0xff7a1a }));

  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ) => {
    const geo = track(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  const bodyCz = (FRONT_Z + REAR_Z) / 2;

  /* ------------------------------------------------------------------ body */

  box(WIDTH, 0.86, LENGTH, 0, 0.77, bodyCz, bodyMat);

  // Sill between the axles, and bumpers at both ends: they break the slab into
  // a car-shaped silhouette without adding a single curved surface. The sill
  // stops short of the wheels rather than running the full length, so it never
  // masks the one moving part on the car.
  box(WIDTH + 0.03, 0.2, REAR_AXLE_Z - FRONT_AXLE_Z - 1.1, 0, 0.4, bodyCz, trimMat);
  box(WIDTH + 0.06, 0.28, 0.3, 0, 0.55, FRONT_Z + 0.08, trimMat);
  box(WIDTH + 0.06, 0.28, 0.3, 0, 0.55, REAR_Z - 0.08, trimMat);

  /* ------------------------------------------------------------ greenhouse */

  // The glass band. Set well in from the body sides so the shoulder line reads
  // as a shoulder rather than as a second box stacked on the first.
  box(WIDTH - 0.22, 0.66, 2.7, 0, 1.53, 0.05, glassMat);
  // Roof cap over it, back in body colour.
  box(WIDTH - 0.14, 0.1, 2.55, 0, 1.91, 0.05, bodyMat);

  /* -------------------------------------------------------- checker stripe */

  // The one place hazard striping is allowed on the car: the beltline, where
  // a real cab carries its livery band. It also makes the cab findable in the
  // third-person frame at a glance.
  const stripeTex = track(makeCheckerTexture(maxAnisotropy));
  stripeTex.repeat.set(10, 1);
  const stripeMat = track(new THREE.MeshBasicMaterial({ map: stripeTex }));
  const stripeGeo = track(new THREE.PlaneGeometry(LENGTH - 1.1, 0.24));
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(side * (WIDTH / 2 + 0.012), 1.0, bodyCz);
    stripe.rotation.y = side * (Math.PI / 2);
    group.add(stripe);
  }

  /* ------------------------------------------------------------ roof sign */

  box(0.64, 0.24, 0.32, 0, 2.08, -0.35, bodyMat);
  const signTex = track(makeMirrorTag(maxAnisotropy));
  const signGeo = track(new THREE.PlaneGeometry(0.6, 0.2));
  const signMat = track(
    new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }),
  );
  for (const side of [-1, 1]) {
    const face = new THREE.Mesh(signGeo, signMat);
    face.position.set(0, 2.08, -0.35 + side * 0.17);
    face.rotation.y = side < 0 ? Math.PI : 0;
    group.add(face);
  }

  /* --------------------------------------------------------------- lights */

  for (const side of [-1, 1]) {
    box(0.4, 0.16, 0.1, side * 0.62, 0.9, FRONT_Z - 0.02, lampMat);
    box(0.32, 0.14, 0.1, side * 0.66, 0.96, REAR_Z + 0.02, tailMat);
  }

  /* --------------------------------------------------------------- wheels */

  // Pre-rotated so the cylinder's axis runs along X. That way spinning is a
  // plain rotation.x on the mesh and steering is a rotation.y on its parent,
  // with no gimbal argument between the two.
  const tyreGeo = track(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_W, 14));
  tyreGeo.rotateZ(Math.PI / 2);
  const hubGeo = track(new THREE.BoxGeometry(WHEEL_W + 0.02, 0.26, 0.26));

  type Wheel = { pivot: THREE.Group; spin: THREE.Group };
  const wheels: Wheel[] = [];
  const steered: Wheel[] = [];

  const addWheel = (x: number, z: number, steers: boolean) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_R, z);
    group.add(pivot);

    const spin = new THREE.Group();
    pivot.add(spin);

    spin.add(new THREE.Mesh(tyreGeo, tyreMat));
    // Two crossed spokes, so the rotation is actually visible on a flat tyre.
    const hubA = new THREE.Mesh(hubGeo, hubMat);
    spin.add(hubA);
    const hubB = new THREE.Mesh(hubGeo, hubMat);
    hubB.rotation.x = Math.PI / 2;
    spin.add(hubB);

    // Arch over the wheel, in body colour and standing proud of the flank, so
    // the wheel reads as belonging to the car rather than parked beside it.
    const arch = new THREE.Mesh(
      track(new THREE.BoxGeometry(WHEEL_W + 0.16, 0.14, WHEEL_R * 2.5)),
      bodyMat,
    );
    arch.position.set(x, WHEEL_R + 0.4, z);
    group.add(arch);

    const wheel = { pivot, spin };
    wheels.push(wheel);
    if (steers) steered.push(wheel);
  };

  for (const side of [-1, 1]) {
    addWheel(side * AXLE_X, FRONT_AXLE_Z, true);
    addWheel(side * AXLE_X, REAR_AXLE_Z, false);
  }

  return {
    group,

    update(steer, wheelSpin) {
      for (const w of wheels) w.spin.rotation.x = wheelSpin;
      // Negative: positive steer input turns the car right, which is a
      // negative Y rotation in this right-handed, -Z-forward space.
      for (const w of steered) w.pivot.rotation.y = -steer * WHEEL_LOCK;
    },

    dispose() {
      for (const d of disposables) d.dispose();
      group.clear();
    },
  };
}
