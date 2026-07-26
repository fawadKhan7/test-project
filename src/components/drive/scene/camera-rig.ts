/**
 * The camera, and the one decision it makes: are we driving, or have we
 * arrived?
 *
 * Driving is first person, from the driver's eye inside the cab. Arriving
 * swings the camera out and back until the cab and the destination's screen
 * are in frame together, like stepping out to look at an arrivals board. The
 * two poses are blended, never cut between, so the visitor keeps their bearings
 * — they can see the same taxi the whole way through the move, which is what
 * stops a viewpoint change from reading as a scene change.
 *
 * Nothing here takes control away. The blend runs to "arrived" on its own when
 * you stop at a stop, and starts running back the instant you touch a pedal;
 * the car is drivable at every point in between, including mid-transition.
 */

import * as THREE from "three";

/** Field of view when driving. Wide, to open up the windscreen. */
export const DRIVE_FOV = 80;
/**
 * Narrower on arrival. A long lens is what makes a 22m screen 40m away read
 * as a wall of text rather than a distant billboard, and it flattens the
 * perspective so the content stays square to the reader.
 */
export const ARRIVED_FOV = 45;

/**
 * The arrival framing. These three are one setting, not three, and they are
 * tuned against HOLO.setBack so that parking in a bay puts the screen across
 * roughly the top 70% of the frame and the whole cab in the bottom 20%.
 */
const BACK_OFF = 15;
const RISE = 4.2;
/** The camera aims below the screen's centre, which is what keeps the cab in. */
const AIM_DROP = 4;

/** Seconds to settle into the arrival view, and to come back out of it. */
const ENTER_SECONDS = 1.0;
const EXIT_SECONDS = 0.6;

/** Below this blend the cab interior is drawn; above it, the exterior. */
export const SHELL_SWAP = 0.35;

export type RigFrame = {
  camera: THREE.PerspectiveCamera;
  dt: number;
  /** Whether the cab is parked at a stop right now. */
  arrived: boolean;
  /** The driver's eye, in the body rig's local space. */
  eye: THREE.Vector3;
  /** The rig carrying the car's roll, pitch and bob. */
  body: THREE.Object3D;
  /** Extra camera-only roll, radians. */
  roll: number;
  /** The arrived-at screen's world position, if there is one. */
  anchor: THREE.Vector3 | null;
  /** First-person field of view for this frame; speed widens it. */
  driveFov: number;
};

export type CameraRig = {
  /** 0 = driving (first person), 1 = arrived (third person). */
  readonly blend: number;
  update(frame: RigFrame): void;
};

const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function createCameraRig(): CameraRig {
  let raw = 0;
  let blend = 0;

  const fpPos = new THREE.Vector3();
  const fpQuat = new THREE.Quaternion();
  const rollQuat = new THREE.Quaternion();
  const rollAxis = new THREE.Vector3(0, 0, 1);

  const tpPos = new THREE.Vector3();
  const tpQuat = new THREE.Quaternion();
  const carPos = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const away = new THREE.Vector3();
  const lookMatrix = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0);

  return {
    get blend() {
      return blend;
    },

    update({ camera, dt, arrived, eye, body, roll, anchor, driveFov }) {
      // Only hold the arrival view while there is somewhere to look at.
      const wants = arrived && anchor !== null;
      const seconds = wants ? ENTER_SECONDS : EXIT_SECONDS;
      raw = THREE.MathUtils.clamp(raw + ((wants ? 1 : -1) * dt) / seconds, 0, 1);
      blend = smoothstep(raw);

      /* --- first person: the driver's eye, carried by the body rig -------- */
      body.updateWorldMatrix(true, false);
      fpPos.copy(eye).applyMatrix4(body.matrixWorld);
      body.getWorldQuaternion(fpQuat);
      fpQuat.multiply(rollQuat.setFromAxisAngle(rollAxis, roll));

      if (blend <= 0.0001 || !anchor) {
        camera.position.copy(fpPos);
        camera.quaternion.copy(fpQuat);
        if (Math.abs(camera.fov - driveFov) > 0.01) {
          camera.fov = driveFov;
          camera.updateProjectionMatrix();
        }
        return;
      }

      /* --- third person: behind the cab, on the cab→screen axis ----------- */
      body.getWorldPosition(carPos);
      carPos.y = 0;

      // Straight back from the screen, through the car and out the other side.
      // Derived from the screen rather than the car's heading on purpose: how
      // neatly the visitor happened to park should not change the framing.
      away.subVectors(carPos, anchor).setY(0);
      if (away.lengthSq() < 1) away.set(0, 0, 1);
      away.normalize();

      tpPos.copy(carPos).addScaledVector(away, BACK_OFF).setY(RISE);
      aim.copy(anchor).setY(anchor.y - AIM_DROP);

      lookMatrix.lookAt(tpPos, aim, UP);
      tpQuat.setFromRotationMatrix(lookMatrix);

      camera.position.lerpVectors(fpPos, tpPos, blend);
      camera.quaternion.slerpQuaternions(fpQuat, tpQuat, blend);

      const fov = THREE.MathUtils.lerp(driveFov, ARRIVED_FOV, blend);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
