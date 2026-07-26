/**
 * The section holograms — the site itself, projected into the world.
 *
 * Each one is a real DOM element positioned in 3D by CSS3DRenderer rather
 * than a texture, which is what makes them worth doing: the type stays sharp
 * at any distance, the booking form still works, links are still links, and
 * screen readers still see a page. A texture would have been a picture of a
 * website; this is the website.
 *
 * The panel is not bolted to a wall. When you pull into a stop it glides into
 * place a fixed distance in front of the windscreen and squares itself to
 * your view, so it is readable the instant it appears and the driver never
 * has to shuffle back and forth hunting for the one good angle. Touch the
 * throttle and it fades out of the way again.
 *
 * Compositing: this layer sits *above* the WebGL canvas, so the panel's alpha
 * blends against the rendered world — you can see the road through it. That
 * is also why it needs no depth trickery: a hologram projected from the cab
 * is supposed to read in front of everything.
 */

import * as THREE from "three";
import {
  CSS3DObject,
  CSS3DRenderer,
} from "three/addons/renderers/CSS3DRenderer.js";
import { HOLO } from "@/lib/drive/world-map";

export type Boards = {
  /** Append this above the WebGL canvas. */
  domElement: HTMLElement;
  setSize(width: number, height: number): void;
  /** Keeps the panel's world size pinned to a share of the viewport. */
  setProjection(aspect: number, verticalFovDeg: number): void;
  /** Which section is showing, or null for none. */
  setActive(id: string | null): void;
  /**
   * `presence` is how close the cab is to the middle of the stop, 0..1. It is
   * the panel's opacity ceiling, so driving away dims it continuously rather
   * than leaving it lit until some threshold trips.
   */
  update(
    camera: THREE.PerspectiveCamera,
    dt: number,
    mph: number,
    presence: number,
  ): void;
  render(camera: THREE.PerspectiveCamera): void;
  dispose(): void;
};

/** Above this speed the panel is fully out of the way. */
const FADE_START_MPH = 5;
const FADE_END_MPH = 15;
/** How quickly the panel chases the view. Low enough to feel physical. */
const GLIDE_RATE = 5;
/**
 * Fading in is unhurried — the panel should arrive, not pop. Fading out is
 * roughly four times quicker, because by then the driver has decided to leave
 * and anything still in the windscreen is in the way. (Exit faster than enter
 * is the general rule for UI motion; here it is also a visibility issue.)
 */
const FADE_IN_RATE = 4.5;
const FADE_OUT_RATE = 16;

export function buildBoards(hosts: Map<string, HTMLElement>): Boards {
  const scene = new THREE.Scene();

  const renderer = new CSS3DRenderer();
  const dom = renderer.domElement;
  dom.style.position = "absolute";
  dom.style.inset = "0";
  dom.style.zIndex = "2";
  // Only the panel itself takes pointer input; the space around it must stay
  // transparent to clicks.
  dom.style.pointerEvents = "none";

  type Entry = { id: string; host: HTMLElement; object: CSS3DObject };
  const entries = new Map<string, Entry>();

  for (const [id, host] of hosts) {
    host.style.width = `${HOLO.pxW}px`;
    host.style.height = `${HOLO.pxH}px`;

    const object = new CSS3DObject(host);
    object.visible = false;
    scene.add(object);
    entries.set(id, { id, host, object });
  }

  let activeId: string | null = null;
  /** The panel currently being drawn, which outlives `activeId` while it fades. */
  let shown: Entry | null = null;
  /** True once the cab has left the stop: `shown` is on its way out. */
  let leaving = false;
  let opacity = 0;
  let scale = HOLO.screenFraction / HOLO.pxW;
  /** Set on activation so a freshly shown panel doesn't fly in from the map. */
  let needsSnap = false;

  const hide = (e: Entry | null) => {
    if (!e) return;
    e.object.visible = false;
    e.host.style.opacity = "0";
  };

  const camPos = new THREE.Vector3();
  const camQuat = new THREE.Quaternion();
  const forward = new THREE.Vector3();
  const target = new THREE.Vector3();

  return {
    domElement: dom,

    setSize(width, height) {
      renderer.setSize(width, height);
    },

    setProjection(aspect, verticalFovDeg) {
      // Screen share is independent of viewport pixels: the world width that
      // fills a given fraction of the frame depends only on fov and distance.
      const halfV = (verticalFovDeg * Math.PI) / 360;
      const worldWidth =
        2 * HOLO.screenFraction * HOLO.distance * Math.tan(halfV) * aspect;
      scale = worldWidth / HOLO.pxW;
    },

    setActive(id) {
      if (id === activeId) return;
      activeId = id;

      if (!id) {
        // Left the stop. The panel stops tracking the windscreen from here on,
        // so it stays where it was projected and the cab drives away from it —
        // which is what makes leaving read as leaving rather than as a panel
        // that happens to switch off.
        leaving = shown !== null;
        return;
      }

      leaving = false;
      const next = entries.get(id) ?? null;
      if (next !== shown) {
        hide(shown);
        shown = next;
        opacity = 0;
        needsSnap = true;
      }
    },

    update(camera, dt, mph, presence) {
      if (!shown) return;

      // Speed pushes the panel out of the way so it never blocks the road, and
      // distance from the bay caps it so it is already faint by the time the
      // cab is clear of the stop.
      const speedFade =
        1 -
        THREE.MathUtils.clamp(
          (mph - FADE_START_MPH) / (FADE_END_MPH - FADE_START_MPH),
          0,
          1,
        );
      const wanted = leaving
        ? 0
        : Math.min(speedFade, THREE.MathUtils.clamp(presence, 0, 1));

      const rate = wanted < opacity ? FADE_OUT_RATE : FADE_IN_RATE;
      opacity += (wanted - opacity) * (1 - Math.exp(-rate * dt));

      if (opacity < 0.02 && wanted === 0) {
        opacity = 0;
        hide(shown);
        // Whatever brings it back should place it fresh in front of the
        // windscreen rather than flying it in from wherever it went dark.
        needsSnap = true;
        // Only drop the reference once the cab has genuinely left; a panel
        // dimmed by speed alone stays loaded so easing off brings it straight
        // back without a re-entry animation.
        if (leaving) {
          shown = null;
          leaving = false;
        }
        return;
      }

      if (!leaving) {
        camera.getWorldPosition(camPos);
        camera.getWorldQuaternion(camQuat);
        forward.set(0, 0, -1).applyQuaternion(camQuat);

        target
          .copy(camPos)
          .addScaledVector(forward, HOLO.distance)
          .setY(camPos.y + HOLO.riseY);

        if (needsSnap) {
          shown.object.position.copy(target);
          shown.object.quaternion.copy(camQuat);
          needsSnap = false;
        } else {
          const k = 1 - Math.exp(-GLIDE_RATE * dt);
          shown.object.position.lerp(target, k);
          shown.object.quaternion.slerp(camQuat, k);
        }
      }

      shown.object.scale.setScalar(scale);
      shown.object.visible = true;
      shown.host.style.opacity = opacity.toFixed(3);
    },

    render(camera) {
      renderer.render(scene, camera);
    },

    dispose() {
      for (const e of entries.values()) e.object.removeFromParent();
      entries.clear();
      dom.remove();
    },
  };
}
