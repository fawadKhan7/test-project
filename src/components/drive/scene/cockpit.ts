/**
 * The inside of the cab, modelled around the driver's eye point.
 *
 * This is the whole reason the experience reads as first-person rather than a
 * floating camera: the A-pillars and roof rail frame the road, the yellow
 * bonnet sits under it, the wheel turns with your steering, and the meter on
 * the dash shows what you are actually doing. All of it is parented to the
 * car, so it stays locked to you while the world moves past.
 *
 * Local space: +X right, +Y up, -Z forward. Origin sits on the road under the
 * middle of the car. Every position below is set relative to EYE, because the
 * only thing that matters is how the interior frames the view from there.
 *
 * Interior surfaces carry a little emissive: the world is deliberately a dark
 * night city, and without it the cabin would be an unreadable black mass.
 */

import * as THREE from "three";
import { INK, YELLOW, makeMirrorTag } from "./textures";

export type Cockpit = {
  group: THREE.Group;
  /** Where the camera lives — the driver's eye. */
  eye: THREE.Vector3;
  update(steer: number, mph: number, reversing: boolean): void;
  dispose(): void;
};

/** Driver's eye. Left-hand drive, seated slightly back of the B-pillar line. */
const EYE = new THREE.Vector3(-0.32, 1.18, 0.1);

export function buildCockpit(maxAnisotropy: number): Cockpit {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const dashMat = track(
    new THREE.MeshLambertMaterial({ color: 0x1e1e1e, emissive: 0x0d0d0d }),
  );
  const trimMat = track(
    new THREE.MeshLambertMaterial({ color: 0x141414, emissive: 0x080808 }),
  );
  const yellowMat = track(
    new THREE.MeshLambertMaterial({ color: YELLOW, emissive: 0x6a5200 }),
  );
  const wheelMat = track(
    new THREE.MeshLambertMaterial({ color: 0x242424, emissive: 0x101010 }),
  );

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

  /* --------------------------------------------------------------- bonnet */

  // Sits just under the dash line and fills the bottom of the frame with
  // taxi yellow — the strongest cue that you are inside *this* cab.
  const bonnet = box(2.05, 0.1, 1.9, 0, 0.8, -2.2, yellowMat);
  bonnet.rotation.x = 0.05;

  // Front lip, so the bonnet reads as ending rather than fading into fog.
  box(2.05, 0.14, 0.12, 0, 0.83, -3.12, yellowMat);

  // Scuttle: the black strip between glass and bonnet.
  box(2.05, 0.08, 0.42, 0, 0.9, -1.28, trimMat);

  /* ------------------------------------------------------------ dashboard */

  const dash = box(2.05, 0.44, 0.62, 0, 0.72, -0.9, dashMat);
  dash.rotation.x = -0.14;

  // Binnacle hood over the instruments.
  box(0.6, 0.16, 0.34, -0.34, 0.95, -0.84, trimMat);

  // Centre stack with the brand's yellow block accent.
  box(0.46, 0.3, 0.14, 0.34, 0.8, -0.78, trimMat);
  box(0.4, 0.045, 0.035, 0.34, 0.93, -0.72, yellowMat);

  /* ----------------------------------------------------------- fare meter */

  const meterCanvas = document.createElement("canvas");
  meterCanvas.width = 256;
  meterCanvas.height = 128;
  const meterCtx = meterCanvas.getContext("2d");
  const meterTex = track(new THREE.CanvasTexture(meterCanvas));
  meterTex.colorSpace = THREE.SRGBColorSpace;
  meterTex.anisotropy = maxAnisotropy;

  const meterGeo = track(new THREE.PlaneGeometry(0.3, 0.15));
  const meterMat = track(new THREE.MeshBasicMaterial({ map: meterTex }));
  const meter = new THREE.Mesh(meterGeo, meterMat);
  meter.position.set(-0.34, 0.94, -0.72);
  meter.rotation.x = -0.42;
  group.add(meter);

  const meterFont = (() => {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-mono")
      .trim();
    return v ? `${v}, ui-monospace, monospace` : "ui-monospace, monospace";
  })();

  let lastMeter = "";
  const drawMeter = (mph: number, reversing: boolean) => {
    if (!meterCtx) return;
    const value = `${Math.round(mph)}`;
    const gear = reversing ? "R" : mph < 0.5 ? "N" : "D";
    const key = `${value}|${gear}`;
    if (key === lastMeter) return;
    lastMeter = key;

    meterCtx.fillStyle = INK;
    meterCtx.fillRect(0, 0, 256, 128);
    meterCtx.strokeStyle = "#3a3a3a";
    meterCtx.lineWidth = 6;
    meterCtx.strokeRect(3, 3, 250, 122);

    meterCtx.fillStyle = YELLOW;
    meterCtx.textBaseline = "middle";
    meterCtx.textAlign = "right";
    meterCtx.font = `700 70px ${meterFont}`;
    meterCtx.fillText(value, 172, 64);

    meterCtx.textAlign = "left";
    meterCtx.font = `700 24px ${meterFont}`;
    meterCtx.fillText("MPH", 184, 48);
    meterCtx.fillText(gear, 184, 84);

    meterTex.needsUpdate = true;
  };
  drawMeter(0, false);

  /* -------------------------------------------------------- steering wheel */

  // Outer pivot carries the column rake; the inner group is what spins, so
  // the wheel turns about its own axis rather than wobbling.
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(-0.34, 0.86, -0.5);
  wheelPivot.rotation.x = -1.13;
  group.add(wheelPivot);

  const wheelSpin = new THREE.Group();
  wheelPivot.add(wheelSpin);

  const rimGeo = track(new THREE.TorusGeometry(0.185, 0.027, 10, 30));
  wheelSpin.add(new THREE.Mesh(rimGeo, wheelMat));

  const spokeGeo = track(new THREE.BoxGeometry(0.33, 0.034, 0.02));
  wheelSpin.add(new THREE.Mesh(spokeGeo, wheelMat));
  const spokeB = new THREE.Mesh(spokeGeo, wheelMat);
  spokeB.rotation.z = -Math.PI / 3;
  wheelSpin.add(spokeB);

  const hubGeo = track(new THREE.CylinderGeometry(0.052, 0.052, 0.038, 12));
  const hub = new THREE.Mesh(hubGeo, yellowMat);
  hub.rotation.x = Math.PI / 2;
  wheelSpin.add(hub);

  const columnGeo = track(new THREE.CylinderGeometry(0.038, 0.048, 0.26, 8));
  const column = new THREE.Mesh(columnGeo, trimMat);
  column.position.set(-0.34, 0.8, -0.62);
  column.rotation.x = Math.PI / 2 - 1.13;
  group.add(column);

  /* -------------------------------------------------- greenhouse & pillars */

  // A-pillars sit far enough forward to catch both edges of a 16:9 frame.
  for (const side of [-1, 1]) {
    const pillar = box(0.14, 0.86, 0.24, side * 1.02, 1.26, -1.0, trimMat);
    pillar.rotation.x = 0.26;
    pillar.rotation.z = side * 0.1;

    // Door card and window sill, with a yellow line along the top.
    box(0.11, 0.46, 2.1, side * 1.03, 0.74, 0.1, dashMat);
    box(0.13, 0.05, 2.1, side * 1.03, 0.98, 0.1, yellowMat);
  }

  // Header rail sits high and the visors are tucked well back: the glass area
  // is deliberately generous so a junction is readable without the driver
  // having to shuffle the car around to see past the trim.
  box(2.2, 0.12, 0.5, 0, 1.66, -0.9, trimMat);
  box(2.2, 0.1, 2.1, 0, 1.72, 0.35, dashMat);

  // Sun visors, folded up against the roof.
  for (const side of [-1, 1]) {
    const visor = box(0.72, 0.04, 0.24, side * 0.44, 1.6, -0.78, dashMat);
    visor.rotation.x = 0.36;
  }

  /* ----------------------------------------------------------- mirror & tag */

  box(0.38, 0.1, 0.055, 0.02, 1.53, -0.88, trimMat);
  const stalkGeo = track(new THREE.CylinderGeometry(0.013, 0.013, 0.1, 6));
  const stalk = new THREE.Mesh(stalkGeo, trimMat);
  stalk.position.set(0.02, 1.61, -0.89);
  group.add(stalk);

  const tagTex = track(makeMirrorTag(maxAnisotropy));
  const tagGeo = track(new THREE.PlaneGeometry(0.15, 0.075));
  const tagMat = track(
    new THREE.MeshBasicMaterial({ map: tagTex, side: THREE.DoubleSide }),
  );
  const tag = new THREE.Mesh(tagGeo, tagMat);
  tag.position.set(0.02, 1.41, -0.86);
  group.add(tag);
  // Pivot the swing from the mirror rather than the tag's centre.
  tag.geometry.translate(0, -0.0375, 0);

  let swayPhase = 0;

  return {
    group,
    eye: EYE.clone(),
    update(steer: number, mph: number, reversing: boolean) {
      wheelSpin.rotation.z = -steer * 2.4;
      drawMeter(mph, reversing);

      swayPhase += 0.02 + Math.min(mph, 60) * 0.0016;
      tag.rotation.z = Math.sin(swayPhase) * 0.14 - steer * 0.26;
    },
    dispose() {
      for (const d of disposables) d.dispose();
      group.clear();
    },
  };
}
