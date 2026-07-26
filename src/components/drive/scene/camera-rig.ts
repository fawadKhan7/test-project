/**
 * The camera, and the one decision it makes: are we driving, or have we
 * arrived?
 *
 * Driving is a chase camera, sitting behind and above the cab. Arriving swings
 * it further out and round until the cab and the destination's screen are in
 * frame together. The two are blended, never cut between, so the visitor keeps
 * their bearings — the taxi is on screen the whole way through the move, which
 * is what stops a viewpoint change from reading as a scene change.
 *
 * The chase pose is not computed and applied directly; it is a target the
 * camera *eases toward*, and the lag is the point. A rigidly attached camera
 * gives you a car that appears motionless in a moving world, because nothing
 * on screen ever changes relative to anything else. Letting the camera fall
 * behind through a corner and catch up on the straight is most of what makes
 * the cab feel like it has mass.
 *
 * Nothing here takes control away. The blend runs to "arrived" on its own when
 * you stop at a stop, and starts running back the instant you touch a pedal;
 * the car is drivable at every point in between, including mid-transition.
 */

import * as THREE from "three";

/** Field of view when driving. Speed widens it from here. */
export const DRIVE_FOV = 68;
/**
 * Narrower on arrival. A long lens is what makes a 26m screen 40m away read as
 * a wall of text rather than a distant billboard, and it flattens the
 * perspective so the content stays square to the reader.
 */
export const ARRIVED_FOV = 45;

/* ------------------------------------------------------------ chase camera */

/**
 * Distance behind the cab at rest, and how much further at full speed.
 *
 * Close enough that the taxi is the subject of the shot rather than a detail
 * in it — at this range its livery, its wheels turning and its brake lights
 * are all legible, which is the whole reason for being outside the car.
 */
const CHASE_BACK = 5.3;
const CHASE_BACK_AT_SPEED = 1.6;
/** Height above the road. Low enough to see the road surface and its markings. */
const CHASE_HEIGHT = 2.8;
/** The camera aims at a point out in front of the cab, not at the cab itself. */
const LOOK_AHEAD = 8;
const LOOK_Y = 1.6;

/**
 * How fast the camera catches up, per second. Deliberately different for
 * position and aim: the body lags through a corner while the gaze stays on the
 * road ahead, which is how a chase shot is actually filmed.
 */
const FOLLOW_RATE = 7;
const AIM_RATE = 9.5;

/* ---------------------------------------------------------- arrival camera */

/**
 * These three are one setting, not three, and they are tuned against
 * HOLO.setBack so that parking in a bay puts the screen across roughly the top
 * 70% of the frame and the whole cab in the bottom 20%.
 */
const BACK_OFF = 15;
const RISE = 4.2;
/** The camera aims below the screen's centre, which is what keeps the cab in. */
const AIM_DROP = 4;

/** Seconds to settle into the arrival view, and to come back out of it. */
const ENTER_SECONDS = 1.0;
const EXIT_SECONDS = 0.6;

export type RigFrame = {
  camera: THREE.PerspectiveCamera;
  dt: number;
  /** Whether the cab is parked at a stop right now. */
  arrived: boolean;
  /** The car rig: world position and heading, without the body's roll and bob. */
  car: THREE.Object3D;
  /** Camera roll, radians — a little lean into the corners. */
  roll: number;
  /** 0..1 of top speed, which pushes the camera back and widens the lens. */
  speedRatio: number;
  /** The arrived-at screen's world position, if there is one. */
  anchor: THREE.Vector3 | null;
  /** Driving field of view for this frame; speed widens it. */
  driveFov: number;
};

export type CameraRig = {
  /** 0 = driving (chase), 1 = arrived. */
  readonly blend: number;
  /** Drops the follow lag, for teleports. Otherwise the camera flies the map. */
  snap(): void;
  update(frame: RigFrame): void;
};

const smoothstep = (t: number) => t * t * (3 - 2 * t);
/** Frame-rate independent exponential approach. */
const approach = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export function createCameraRig(): CameraRig {
  let raw = 0;
  let blend = 0;
  let placed = false;

  const chasePos = new THREE.Vector3();
  const chaseAim = new THREE.Vector3();
  const wantPos = new THREE.Vector3();
  const wantAim = new THREE.Vector3();

  const carPos = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const carQuat = new THREE.Quaternion();

  const driveQuat = new THREE.Quaternion();
  const rollQuat = new THREE.Quaternion();
  const rollAxis = new THREE.Vector3(0, 0, 1);

  const tpPos = new THREE.Vector3();
  const tpQuat = new THREE.Quaternion();
  const aim = new THREE.Vector3();
  const away = new THREE.Vector3();
  const lookMatrix = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0);

  return {
    get blend() {
      return blend;
    },

    snap() {
      placed = false;
    },

    update({ camera, dt, arrived, car, roll, speedRatio, anchor, driveFov }) {
      // Only hold the arrival view while there is somewhere to look at.
      const wants = arrived && anchor !== null;
      const seconds = wants ? ENTER_SECONDS : EXIT_SECONDS;
      raw = THREE.MathUtils.clamp(raw + ((wants ? 1 : -1) * dt) / seconds, 0, 1);
      blend = smoothstep(raw);

      /* --- chase: behind the cab, looking down the road ------------------- */
      car.updateWorldMatrix(true, false);
      car.getWorldPosition(carPos);
      car.getWorldQuaternion(carQuat);
      forward.set(0, 0, -1).applyQuaternion(carQuat).setY(0);
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
      forward.normalize();

      const back = CHASE_BACK + speedRatio * CHASE_BACK_AT_SPEED;
      wantPos
        .copy(carPos)
        .addScaledVector(forward, -back)
        .setY(carPos.y + CHASE_HEIGHT);
      wantAim
        .copy(carPos)
        .addScaledVector(forward, LOOK_AHEAD)
        .setY(carPos.y + LOOK_Y);

      if (!placed) {
        chasePos.copy(wantPos);
        chaseAim.copy(wantAim);
        placed = true;
      } else {
        chasePos.lerp(wantPos, approach(FOLLOW_RATE, dt));
        chaseAim.lerp(wantAim, approach(AIM_RATE, dt));
      }

      lookMatrix.lookAt(chasePos, chaseAim, UP);
      driveQuat.setFromRotationMatrix(lookMatrix);
      driveQuat.multiply(rollQuat.setFromAxisAngle(rollAxis, roll));

      if (blend <= 0.0001 || !anchor) {
        camera.position.copy(chasePos);
        camera.quaternion.copy(driveQuat);
        if (Math.abs(camera.fov - driveFov) > 0.01) {
          camera.fov = driveFov;
          camera.updateProjectionMatrix();
        }
        return;
      }

      /* --- arrival: further back, on the cab→screen axis ------------------ */
      away.subVectors(carPos, anchor).setY(0);
      // Straight back from the screen, through the car and out the other side.
      // Derived from the screen rather than the car's heading on purpose: how
      // neatly the visitor happened to park should not change the framing.
      if (away.lengthSq() < 1) away.copy(forward).negate();
      away.normalize();

      tpPos.copy(carPos).addScaledVector(away, BACK_OFF).setY(RISE);
      aim.copy(anchor).setY(anchor.y - AIM_DROP);

      lookMatrix.lookAt(tpPos, aim, UP);
      tpQuat.setFromRotationMatrix(lookMatrix);

      camera.position.lerpVectors(chasePos, tpPos, blend);
      camera.quaternion.slerpQuaternions(driveQuat, tpQuat, blend);

      const fov = THREE.MathUtils.lerp(driveFov, ARRIVED_FOV, blend);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
