/**
 * Arcade cab physics.
 *
 * Deliberately not a simulator — it is tuned so that a first-time visitor can
 * read a road sign, brake, and make the turn without ever having played a
 * driving game. The two things that sell "driving" rather than "moving" are
 * speed-dependent steering (you cannot pivot on the spot) and the load
 * transfer values fed to the camera.
 *
 * Two rules keep the controls honest, and both matter more than any tuning
 * constant:
 *
 *  1. A pedal always means the same thing. Throttle is "go forward" whatever
 *     the car is currently doing — while rolling backwards it brakes the
 *     reverse first and then pulls away, exactly like a real automatic. Brake
 *     is "go backward" in the same way. Neither ever needs a gear reset.
 *  2. Nothing is integrated at frame rate. The step is subdivided, so a 30fps
 *     phone and a 144Hz desktop get the same car.
 */

import { WORLD_BOUNDS, isOnRoad, nearestRoadPoint } from "./world-map";

export type VehicleInput = {
  throttle: number; // 0..1
  brake: number; // 0..1  — also reverses once stopped
  steer: number; // -1 (left) .. 1 (right)
  handbrake: boolean;
};

export type VehicleState = {
  x: number;
  z: number;
  /** Radians. 0 faces -Z (north); positive turns left. */
  heading: number;
  /** Metres per second, signed. Negative is reverse. */
  speed: number;
  /** Smoothed steering position, -1..1. Drives the steering wheel mesh. */
  steer: number;
  /** Smoothed pedal travel, 0..1. Stops digital keys feeling like a switch. */
  throttlePedal: number;
  brakePedal: number;
  /** Lateral load, -1..1. Camera rolls into corners with this. */
  lateralG: number;
  /** Longitudinal load, -1..1. Camera pitches under accel/braking. */
  accelG: number;
  /** Cumulative wheel rotation, radians. */
  wheelSpin: number;
  /** True while off the tarmac — triggers rumble and a speed cap. */
  offRoad: boolean;
  /** 0..1 rumble intensity, for camera shake. */
  rumble: number;
};

export const MAX_SPEED = 26; // ~58 mph
const MAX_REVERSE = 9;
const ACCEL = 12;
const BRAKE_FORCE = 26;
/** Throttle applied while still rolling backwards, and vice versa. */
const COUNTER_BRAKE = 20;
const REVERSE_ACCEL = 9;
const ENGINE_DRAG = 2.2;
const ROLLING_DRAG = 0.02;
const HANDBRAKE_FORCE = 32;

/** How fast a pedal travels from released to floored, and back. */
const PEDAL_PRESS = 8;
const PEDAL_RELEASE = 13;

/** Peak yaw rate at full lock, rad/s. */
const STEER_MAX = 1.45;
/** How fast the wheel moves toward the requested angle at a standstill. */
const STEER_RESPONSE = 7;
const STEER_RETURN = 6;

const OFFROAD_MAX_SPEED = 8;
const OFFROAD_DRAG = 9;

const WHEEL_RADIUS = 0.34;

/** Longest slice the integrator will take. Anything longer is subdivided. */
const MAX_SUBSTEP = 1 / 120;

export function createVehicle(x: number, z: number, heading: number): VehicleState {
  return {
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    throttlePedal: 0,
    brakePedal: 0,
    lateralG: 0,
    accelG: 0,
    wheelSpin: 0,
    offRoad: false,
    rumble: 0,
  };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Frame-rate independent exponential approach. */
const approach = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

/**
 * How much the steering actually bites at the current speed.
 * Near zero when stopped (no pivoting), full in town-speed range, and eased
 * off at the top end so the cab stays stable on the long straights.
 */
function steeringGrip(speed: number): number {
  const s = Math.abs(speed);
  // Bites a little earlier than a real car so pulling out of a bay at walking
  // pace still turns — first-timers steer before they are properly rolling.
  const spool = clamp(s / 3.2, 0, 1);
  const highSpeedEase = 1 - 0.45 * clamp((s - 12) / 18, 0, 1);
  return spool * highSpeedEase;
}

export function stepVehicle(v: VehicleState, input: VehicleInput, dt: number): void {
  // Clamp dt so a backgrounded tab cannot teleport the cab across the map.
  const total = clamp(dt, 0, 1 / 15);
  if (total <= 0) return;

  const prevSpeed = v.speed;
  const substeps = Math.max(1, Math.ceil(total / MAX_SUBSTEP));
  const step = total / substeps;

  let yawRate = 0;
  for (let i = 0; i < substeps; i++) {
    yawRate = integrate(v, input, step);
  }

  // --- Surface ------------------------------------------------------------
  const onRoad = isOnRoad(v.x, v.z, 0.6);
  v.offRoad = !onRoad;

  if (v.offRoad) {
    // Gentle magnetism back toward tarmac: enough to recover from a missed
    // turn without wrestling control away from the driver.
    const near = nearestRoadPoint(v.x, v.z);
    if (near.dist > 0.001) {
      const pull = clamp(near.dist / 14, 0, 1) * 5 * total;
      v.x += (near.x - v.x) * pull;
      v.z += (near.z - v.z) * pull;
    }
    v.rumble = clamp(Math.abs(v.speed) / OFFROAD_MAX_SPEED, 0, 1);
  } else {
    v.rumble = approach(v.rumble, 0, 8, total);
  }

  // --- Load transfer, for the camera -------------------------------------
  const measuredAccel = (v.speed - prevSpeed) / Math.max(total, 1e-4);
  const targetAccelG = clamp(measuredAccel / 14, -1, 1);
  v.accelG = approach(v.accelG, targetAccelG, 6, total);

  const targetLateral = clamp((yawRate * v.speed) / 14, -1, 1);
  v.lateralG = approach(v.lateralG, targetLateral, 5, total);

  v.wheelSpin += (v.speed / WHEEL_RADIUS) * total;
}

/** One physics slice. Returns the yaw rate used, for the camera's roll. */
function integrate(v: VehicleState, input: VehicleInput, step: number): number {
  const before = v.speed;

  // --- Pedals -------------------------------------------------------------
  // Keys are on/off, but a pedal is not. Ramping them is what turns a tap of
  // W from a jolt into a squeeze of throttle.
  const throttleWanted = clamp(input.throttle, 0, 1);
  const brakeWanted = clamp(input.brake, 0, 1);
  v.throttlePedal = approach(
    v.throttlePedal,
    throttleWanted,
    throttleWanted > v.throttlePedal ? PEDAL_PRESS : PEDAL_RELEASE,
    step,
  );
  v.brakePedal = approach(
    v.brakePedal,
    brakeWanted,
    brakeWanted > v.brakePedal ? PEDAL_PRESS : PEDAL_RELEASE,
    step,
  );

  const throttle = v.throttlePedal;
  const brake = v.brakePedal;
  // Intent is read from the *key*, not the ramped pedal, so a press takes
  // effect on the same frame it happens.
  const wantsForward = throttleWanted > 0;
  const wantsBack = brakeWanted > 0;

  const rollingForward = v.speed > 0.05;
  const rollingBack = v.speed < -0.05;

  // --- Longitudinal -------------------------------------------------------
  let accel = 0;

  if (throttle > 0) {
    if (rollingBack) {
      // Still moving backwards: the throttle is a brake until the car has
      // stopped, then it pulls away forwards on the very next slice. This is
      // the whole reason the cab never needs a handbrake to change direction.
      accel += throttle * COUNTER_BRAKE;
    } else {
      // Falls off near top speed so acceleration feels like it has gears.
      const headroom = 1 - clamp(v.speed / MAX_SPEED, 0, 1) ** 2;
      accel += throttle * ACCEL * headroom;
    }
  }

  if (brake > 0) {
    if (rollingForward) {
      accel -= brake * BRAKE_FORCE;
    } else if (!wantsForward) {
      // Stopped, or already rolling back, and not being asked to go forward:
      // the brake doubles as reverse.
      const headroom = 1 - clamp(-v.speed / MAX_REVERSE, 0, 1) ** 2;
      accel -= brake * REVERSE_ACCEL * headroom;
    }
  }

  if (input.handbrake) {
    accel -= Math.sign(v.speed) * HANDBRAKE_FORCE;
  }

  // Coasting losses, applied whenever the driver is not asking for motion in
  // the direction the car is already travelling.
  const drivingOn =
    (rollingForward && wantsForward) || (rollingBack && wantsBack);
  if (!drivingOn && !input.handbrake) {
    accel -= Math.sign(v.speed) * ENGINE_DRAG;
  }
  accel -= v.speed * Math.abs(v.speed) * ROLLING_DRAG;

  if (v.offRoad) {
    accel -= Math.sign(v.speed) * OFFROAD_DRAG;
  }

  v.speed += accel * step;

  // Anything that only *slows* the car must stop at a standstill rather than
  // dragging it out the other side. Crossing zero is allowed exactly when the
  // driver is asking for the new direction — which is what makes reverse to
  // forward one continuous movement instead of two separate states.
  if (before > 0 && v.speed < 0 && !wantsBack) v.speed = 0;
  else if (before < 0 && v.speed > 0 && !wantsForward) v.speed = 0;
  else if (input.handbrake && before * v.speed < 0) v.speed = 0;

  if (Math.abs(v.speed) < 0.02 && !wantsForward && !wantsBack) v.speed = 0;

  const speedCap = v.offRoad ? OFFROAD_MAX_SPEED : MAX_SPEED;
  v.speed = clamp(v.speed, -MAX_REVERSE, speedCap);

  // --- Steering -----------------------------------------------------------
  const target = clamp(input.steer, -1, 1);
  // Slower rack the faster you go: quick and darty round the bays, calm and
  // stable on the long straight, without ever changing the lock available.
  const speedRatio = clamp(Math.abs(v.speed) / MAX_SPEED, 0, 1);
  const rate =
    target === 0 ? STEER_RETURN : STEER_RESPONSE * (1 - 0.4 * speedRatio);
  v.steer = approach(v.steer, target, rate, step);

  const grip = steeringGrip(v.speed);
  // Reversing steers the other way round, as it does in a real car.
  const yawRate = -v.steer * STEER_MAX * grip * Math.sign(v.speed || 1);
  v.heading += yawRate * step;

  // --- Integrate ----------------------------------------------------------
  const forwardX = -Math.sin(v.heading);
  const forwardZ = -Math.cos(v.heading);

  // Hard walls at the edge of the map so you can never drive into the void.
  v.x = clamp(v.x + forwardX * v.speed * step, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
  v.z = clamp(v.z + forwardZ * v.speed * step, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ);

  return yawRate;
}

/** Speed in mph, for the HUD. */
export function toMph(speed: number): number {
  return Math.abs(speed) * 2.23694;
}
