/**
 * Owns the WebGL context, the DOM-in-3D layer, the render loop and the camera
 * rig.
 *
 * Deliberately framework-free: React mounts it, hands it the canvases, the
 * board host elements and a few callbacks, and otherwise stays out of the
 * frame loop. Telemetry is throttled to ~8Hz because the only thing React
 * draws from it is a speed readout and a hint line — the minimap is painted
 * straight to its own canvas.
 *
 * Nothing here ever takes control away from the driver. There is no pause and
 * no modal: arriving somewhere only changes what the HUD says and which
 * screen is highlighted.
 */

import * as THREE from "three";
import {
  DESTINATIONS,
  DRIVABLE,
  JUNCTION_Z,
  PLAZA_X,
  ROAD_HALF,
  SPAWN,
  TERMINUS_Z,
  nearestRoadPoint,
  routeTo,
  zonePresence,
  type Destination,
} from "@/lib/drive/world-map";
import { MAX_SPEED, createVehicle, stepVehicle, toMph } from "@/lib/drive/vehicle";
import { readInput, type Controls } from "@/lib/drive/controls";
import { buildWorld } from "./build-world";
import { buildCarBody } from "./car-body";
import { buildBoards, screenPosition } from "./boards";
import { buildNavRoute } from "./nav-route";
import { DRIVE_FOV, createCameraRig } from "./camera-rig";
import { PAINT, SURFACE, YELLOW, makeGlowTexture } from "./textures";

/** Night blue-black rather than pure black: it separates sky from tarmac. */
const FOG_COLOUR = 0x080a0f;
const FOG_DENSITY = 0.0052;

/**
 * What counts as "arrived": near the middle of a stop, and stopped. Both are
 * required — rolling through a plaza is not an arrival, and the speed gate is
 * what lets the driver leave simply by driving.
 */
const ARRIVE_PRESENCE = 0.35;
const ARRIVE_MPH = 2.5;
/** Hysteresis, so idling on the threshold cannot flip the camera back and forth. */
const LEAVE_MPH = 5;

/** Which way the next manoeuvre goes, for the HUD's arrow. */
export type TurnCue = "left" | "right" | "straight" | "around";

export type Telemetry = {
  mph: number;
  offRoad: boolean;
  reversing: boolean;
  /** Where to go next, phrased for the HUD. */
  hint: string;
  /** Metres to the next decision point, or null when there isn't one. */
  hintDistance: number | null;
  /** Direction of that manoeuvre, so the HUD can show it as a shape too. */
  turn: TurnCue;
  /** The screen the cab is currently parked at, if any. */
  atBoard: string | null;
  /** True once the camera has stepped out of the cab to frame a screen. */
  arrived: boolean;
};

export type RunnerOptions = {
  canvas: HTMLCanvasElement;
  minimap: HTMLCanvasElement;
  container: HTMLElement;
  controls: Controls;
  /** One element per board id; React portals the section content into these. */
  hosts: Map<string, HTMLElement>;
  onTelemetry: (t: Telemetry) => void;
  onVisit: (id: string) => void;
  onContextLost: () => void;
  /** Trims the pixel ratio and antialiasing on weaker hardware. */
  lowPower: boolean;
};

export type Runner = {
  /** Teleports back to the nearest tarmac, for the "I'm stuck" button. */
  resetToRoad: () => void;
  /** Sets the satnav destination, or clears it with null. */
  setWaypoint: (id: string | null) => void;
  dispose: () => void;
};

export function createRunner(opts: RunnerOptions): Runner {
  const { canvas, minimap, container, controls } = opts;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !opts.lowPower,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.lowPower ? 1 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(FOG_COLOUR, 1);

  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(FOG_COLOUR, FOG_DENSITY);

  /* --------------------------------------------------------------- lights */

  // Lifted well above the old values. The road surface is unlit now, but the
  // kerbs, buildings and cab interior are not, and at the previous levels they
  // collapsed into the same near-black as the verge.
  scene.add(new THREE.HemisphereLight(0x5a4d2a, 0x0c0e12, 1.7));
  const key = new THREE.DirectionalLight(0xfff0c0, 0.7);
  key.position.set(30, 60, 20);
  scene.add(key);

  /* ---------------------------------------------------------------- world */

  const world = buildWorld(maxAniso);
  scene.add(world.group);

  const nav = buildNavRoute(maxAniso);
  scene.add(nav.group);

  /* --------------------------------------------------------------- boards */

  // Layered above the canvas so a screen's alpha blends against the rendered
  // world — you see the city through the hologram.
  const boards = buildBoards(opts.hosts);
  container.appendChild(boards.domElement);

  /* ------------------------------------------------------ car rig & camera */

  const carGroup = new THREE.Group();
  scene.add(carGroup);

  // Body sits between the car and its shell so load transfer leans the cab
  // itself — visible from behind, which is where the camera now lives. The
  // camera deliberately does *not* hang off this: inheriting the bob would put
  // the shake on the whole world instead of on the car.
  const bodyGroup = new THREE.Group();
  carGroup.add(bodyGroup);

  const carBody = buildCarBody(maxAniso);
  bodyGroup.add(carBody.group);

  // The rig owns the camera's transform, so it lives in the scene rather than
  // on the car.
  const camera = new THREE.PerspectiveCamera(DRIVE_FOV, 1, 0.05, 700);
  scene.add(camera);
  const rig = createCameraRig();

  // Headlight spill on the road ahead. Cheaper and more legible at night than
  // a real spot light, and it keeps the flat-colour look intact.
  const beamTex = makeGlowTexture();
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTex,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  // Tighter than it was when the camera sat inside the car: from behind, the
  // whole pool is on screen at once, and anything larger reads as a painted
  // patch travelling with the cab rather than as its headlights.
  const beamGeo = new THREE.PlaneGeometry(11, 30);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.x = -Math.PI / 2;
  // Rides just above kerb height for the same reason the lamp pools do: laid
  // flat it would slice a hard line through every kerb it crosses.
  beam.position.set(0, 0.34, -14);
  carGroup.add(beam);

  /* ------------------------------------------------------------- vehicle */

  const vehicle = createVehicle(SPAWN.x, SPAWN.z, SPAWN.heading);

  /* -------------------------------------------------------------- resize */

  const resize = () => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    boards.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  /* ------------------------------------------------------------- minimap */

  const mapCtx = minimap.getContext("2d");
  let waypoint: Destination | null = null;

  /**
   * Heading-up local map, the way a racing game does it: the cab stays put
   * near the bottom and the city rotates around it, so "the road bending left
   * on the map" and "the road bending left through the windscreen" are the
   * same picture. A whole-city map forced you to do that rotation in your
   * head, which is exactly the hesitation we are trying to remove.
   */
  const MAP_METRES = 170;
  const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
  const MAP_ROAD = hex(SURFACE.road);
  const MAP_EDGE = hex(SURFACE.kerb);

  const drawMinimap = () => {
    if (!mapCtx) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = minimap.clientWidth;
    const h = minimap.clientHeight;
    if (w === 0 || h === 0) return;
    if (minimap.width !== w * dpr || minimap.height !== h * dpr) {
      minimap.width = w * dpr;
      minimap.height = h * dpr;
    }
    mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mapCtx.clearRect(0, 0, w, h);

    const scale = h / MAP_METRES;

    mapCtx.save();
    // Cab sits low in the frame so most of the map is the road ahead.
    mapCtx.translate(w / 2, h * 0.72);
    mapCtx.rotate(vehicle.heading);
    mapCtx.translate(-vehicle.x * scale, -vehicle.z * scale);

    // The map uses the same surface colours as the world, so the shape on the
    // canvas and the shape through the windscreen are recognisably one place.
    mapCtx.fillStyle = MAP_ROAD;
    mapCtx.strokeStyle = MAP_EDGE;
    mapCtx.lineWidth = 1;
    for (const r of DRIVABLE) {
      const x = r.minX * scale;
      const z = r.minZ * scale;
      const rw = (r.maxX - r.minX) * scale;
      const rh = (r.maxZ - r.minZ) * scale;
      mapCtx.fillRect(x, z, rw, rh);
    }

    // The chosen route, drawn as the same line that is painted on the road.
    const routeTarget = waypoint ?? DESTINATIONS[DESTINATIONS.length - 1];
    const points = routeTo(routeTarget);
    mapCtx.beginPath();
    points.forEach((p, i) => {
      const px = p.x * scale;
      const pz = p.z * scale;
      if (i === 0) mapCtx.moveTo(px, pz);
      else mapCtx.lineTo(px, pz);
    });
    mapCtx.strokeStyle = waypoint ? YELLOW : "rgba(255,251,234,0.5)";
    mapCtx.lineWidth = waypoint ? 3.5 : 2;
    mapCtx.lineJoin = "round";
    mapCtx.lineCap = "round";
    mapCtx.stroke();

    for (const d of DESTINATIONS) {
      const target = waypoint?.id === d.id;
      mapCtx.fillStyle = target ? "#fffbea" : YELLOW;
      const s = target ? 9 : 6;
      mapCtx.fillRect(d.x * scale - s / 2, d.z * scale - s / 2, s, s);
      if (target) {
        mapCtx.strokeStyle = YELLOW;
        mapCtx.lineWidth = 2;
        mapCtx.strokeRect(d.x * scale - 8, d.z * scale - 8, 16, 16);
      }
    }

    mapCtx.restore();

    // The cab, always pointing up because the map turns instead.
    mapCtx.save();
    mapCtx.translate(w / 2, h * 0.72);
    mapCtx.beginPath();
    mapCtx.moveTo(0, -8);
    mapCtx.lineTo(6, 6);
    mapCtx.lineTo(-6, 6);
    mapCtx.closePath();
    mapCtx.fillStyle = hex(PAINT.white);
    mapCtx.fill();
    mapCtx.strokeStyle = "#0b0b0b";
    mapCtx.lineWidth = 1.6;
    mapCtx.stroke();
    mapCtx.restore();
  };

  /* ------------------------------------------------------- navigation hint */

  const byJunction = (z: number, side: "left" | "right") =>
    DESTINATIONS.find((d) => d.junctionZ === z && d.approach === side);

  const onBoulevard = () => Math.abs(vehicle.x) < ROAD_HALF + 6;

  type Hint = { hint: string; hintDistance: number | null; turn: TurnCue };

  /** Turn-by-turn once a stop has been chosen from the route list. */
  function waypointHint(target: Destination): Hint {
    if (target.approach === "straight") {
      if (!onBoulevard())
        return { hint: "Back to the boulevard", hintDistance: null, turn: "around" };
      const gap = vehicle.z - target.z;
      if (gap < -6)
        return { hint: "Turn around — you've passed it", hintDistance: null, turn: "around" };
      return {
        hint: `${target.label} — straight on`,
        hintDistance: Math.max(0, gap),
        turn: "straight",
      };
    }

    if (!onBoulevard()) {
      const rightSide = Math.sign(vehicle.x) === Math.sign(target.x);
      const nearJunction = Math.abs(vehicle.z - target.junctionZ) < ROAD_HALF + 8;
      if (rightSide && nearJunction) {
        return {
          hint: `${target.label} — ahead`,
          hintDistance: Math.max(0, Math.abs(target.x - vehicle.x) - 12),
          turn: "straight",
        };
      }
      return { hint: "Back to the boulevard", hintDistance: null, turn: "around" };
    }

    const gap = vehicle.z - target.junctionZ;
    if (gap < -6)
      return { hint: "Turn around — you've passed it", hintDistance: null, turn: "around" };
    const turn = target.approach;
    return {
      hint: `${target.label} — ${turn === "left" ? "turn left" : "turn right"}`,
      hintDistance: Math.max(0, gap),
      turn,
    };
  }

  /** Default wayfinding: name whatever the next junction offers. */
  function browseHint(): Hint {
    if (!onBoulevard()) {
      const junction = JUNCTION_Z.reduce((best, jz) =>
        Math.abs(jz - vehicle.z) < Math.abs(best - vehicle.z) ? jz : best,
      );
      const dest = byJunction(junction, vehicle.x < 0 ? "left" : "right");
      if (dest) {
        return {
          hint: `Ahead — ${dest.label}`,
          hintDistance: Math.max(0, Math.abs(dest.x - vehicle.x) - 12),
          turn: "straight",
        };
      }
    }

    const ahead = JUNCTION_Z.filter((jz) => jz < vehicle.z - 2).sort((a, b) => b - a)[0];
    if (ahead !== undefined) {
      const l = byJunction(ahead, "left");
      const r = byJunction(ahead, "right");
      return {
        // Names the turn as well as the destination: a first-timer reading
        // this while the junction is still a shape in the distance needs to
        // know which way, not just what.
        hint: `${l?.sign ?? ""} left · ${r?.sign ?? ""} right`,
        hintDistance: Math.max(0, vehicle.z - ahead),
        turn: "straight",
      };
    }

    return {
      hint: "Straight on — Drop-off",
      hintDistance: Math.max(0, vehicle.z - TERMINUS_Z),
      turn: "straight",
    };
  }

  /* ------------------------------------------------------------- main loop */

  const clock = new THREE.Clock();
  let telemetryAt = 0;
  let mapAt = 0;
  let bobPhase = 0;
  let disposed = false;
  let lastZone: string | null = null;
  /** Smoothed rumble offsets — raw per-frame noise reads as a broken image. */
  let shakeY = 0;
  let shakeX = 0;
  /** Smoothed camera load, so the view settles rather than tracking spikes. */
  let viewRoll = 0;
  let viewPitch = 0;
  let viewLean = 0;
  /** Latched arrival state, and the screen the camera frames while it holds. */
  let arrived = false;
  // Resolved on the first frame, from whichever zone the cab spawns in.
  let anchor: THREE.Vector3 | null = null;
  let driveFov = DRIVE_FOV;

  /** Frame-rate independent approach, matching the one the physics uses. */
  const approach = (current: number, target: number, rate: number, dt: number) =>
    current + (target - current) * (1 - Math.exp(-rate * dt));

  const frame = () => {
    if (disposed) return;
    const dt = Math.min(clock.getDelta(), 1 / 15);
    const elapsed = clock.elapsedTime;

    stepVehicle(vehicle, readInput(controls), dt);

    carGroup.position.set(vehicle.x, 0, vehicle.z);
    carGroup.rotation.y = vehicle.heading;

    /* --- body roll, pitch and bob ---------------------------------------- */
    const speedRatio = Math.min(Math.abs(vehicle.speed) / MAX_SPEED, 1);

    bobPhase += dt * (5 + speedRatio * 16);
    const bob = Math.sin(bobPhase) * (0.004 + speedRatio * 0.011);

    // Rumble is filtered rather than applied raw: the target is noise, but the
    // camera chases it, which keeps the shake continuous instead of strobing.
    const rumbleShake = vehicle.rumble * 0.035;
    shakeY = approach(shakeY, (Math.random() - 0.5) * rumbleShake, 24, dt);
    shakeX = approach(shakeX, (Math.random() - 0.5) * rumbleShake * 0.6, 24, dt);

    // The load values are already smoothed in the physics; smoothing the
    // camera's response to them again is what separates "the car leans" from
    // "the picture wobbles".
    viewRoll = approach(viewRoll, -vehicle.lateralG * 0.075, 9, dt);
    viewPitch = approach(viewPitch, vehicle.accelG * 0.045, 9, dt);
    viewLean = approach(viewLean, vehicle.lateralG, 7, dt);

    bodyGroup.rotation.z = viewRoll;
    bodyGroup.rotation.x = viewPitch;
    bodyGroup.position.y = bob + shakeY;
    bodyGroup.position.x = shakeX;

    // Speed widens the lens. This does most of the work in making 26 m/s
    // actually feel fast on a screen.
    driveFov = approach(driveFov, DRIVE_FOV + speedRatio * 12, 3.5, dt);

    // Braking only counts while actually moving forward — the same key is
    // reverse once stopped, and lighting the brakes for it would be a lie.
    carBody.update(
      vehicle.steer,
      vehicle.wheelSpin,
      vehicle.brakePedal > 0.05 && vehicle.speed > 0.2,
    );
    world.update(elapsed);
    nav.update(dt, elapsed);

    // Headlight spill, eased off once the camera swings round for an arrival:
    // seen from the side it is a flat glowing sheet rather than light on a road.
    beamMat.opacity = (0.3 + speedRatio * 0.2) * (1 - rig.blend * 0.8);

    /* --- which section are we at? ---------------------------------------- */
    const mph = toMph(vehicle.speed);
    const zone = zonePresence(vehicle.x, vehicle.z);
    if (zone.id !== lastZone) {
      lastZone = zone.id;
      anchor = zone.id ? screenPosition(zone.id) : null;
      if (zone.id) opts.onVisit(zone.id);
    }

    /* --- driving, or arrived? -------------------------------------------- */
    // Latching with two speed thresholds: you have to actually come to rest to
    // arrive, but any real move pulls the camera back into the cab. Anything
    // in between leaves the current view alone, so sitting on the line does
    // not oscillate.
    if (!zone.id || zone.presence < ARRIVE_PRESENCE || mph > LEAVE_MPH) {
      arrived = false;
    } else if (mph < ARRIVE_MPH && zone.presence >= ARRIVE_PRESENCE) {
      arrived = true;
    }

    rig.update({
      camera,
      dt,
      arrived,
      car: carGroup,
      roll: -viewLean * 0.045,
      speedRatio,
      anchor,
      driveFov,
    });

    /* --- render ---------------------------------------------------------- */
    renderer.render(scene, camera);

    // The hologram layer draws over the finished frame, so its transparency
    // blends with the actual world behind it.
    boards.update(camera, dt);
    boards.render(camera);

    /* --- outbound state -------------------------------------------------- */
    if (elapsed - telemetryAt > 0.12) {
      telemetryAt = elapsed;
      const { hint, hintDistance, turn } = waypoint
        ? waypointHint(waypoint)
        : browseHint();
      opts.onTelemetry({
        mph,
        offRoad: vehicle.offRoad,
        reversing: vehicle.speed < -0.2,
        hint,
        hintDistance,
        turn,
        atBoard: zone.id,
        arrived: rig.blend > 0.5,
      });
    }

    if (elapsed - mapAt > 0.1) {
      mapAt = elapsed;
      drawMinimap();
    }
  };

  renderer.setAnimationLoop(frame);

  /* ------------------------------------------------------- context loss */

  const onLost = (e: Event) => {
    e.preventDefault();
    renderer.setAnimationLoop(null);
    opts.onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  return {
    resetToRoad() {
      const near = nearestRoadPoint(vehicle.x, vehicle.z);
      vehicle.x = near.x;
      vehicle.z = near.z;
      vehicle.speed = 0;
      vehicle.steer = 0;
      vehicle.throttlePedal = 0;
      vehicle.brakePedal = 0;
      vehicle.lateralG = 0;
      vehicle.accelG = 0;
      // Point back up the boulevard so the driver is never left facing a wall.
      vehicle.heading =
        Math.abs(vehicle.x) > PLAZA_X - 30 ? (Math.PI / 2) * Math.sign(vehicle.x) : 0;
      // The chase camera lags by design; without this it would fly across the
      // city to catch up with a cab that teleported.
      rig.snap();
    },

    setWaypoint(id) {
      waypoint = id ? (DESTINATIONS.find((d) => d.id === id) ?? null) : null;
      nav.setTarget(waypoint);
    },

    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      canvas.removeEventListener("webglcontextlost", onLost);
      ro.disconnect();
      boards.dispose();
      nav.dispose();
      world.dispose();
      carBody.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      beamTex.dispose();
      scene.clear();
      renderer.dispose();
    },
  };
}
