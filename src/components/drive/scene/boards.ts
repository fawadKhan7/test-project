/**
 * The section screens — the site itself, installed in the city.
 *
 * Each one is a real DOM element positioned in 3D by CSS3DRenderer rather than
 * a texture, which is what makes them worth doing: the type stays sharp at any
 * distance, the booking form still works, links are still links, and screen
 * readers still see a page. A texture would have been a picture of a website;
 * this is the website.
 *
 * Each screen stands at a fixed place in the world — high and set well back
 * from its parking bay — and never moves. That is the whole design. A screen
 * pinned to the camera is unavoidably in the way, because there is no head
 * position that escapes it; a screen bolted to a place gets bigger as you
 * approach, fills the frame when you park in front of it, and is simply behind
 * you once you drive off.
 *
 * Fading is by distance in both directions. Far away it is off because there
 * is nothing to read yet; *very* close it is also off, because pulling up
 * underneath a 22-metre display would put it across the entire windscreen —
 * the one thing this layout exists to prevent.
 *
 * Compositing: this layer sits above the WebGL canvas, so a screen's alpha
 * blends against the rendered world and it is never occluded by geometry. The
 * arrival camera is framed around that: the screen sits in the upper part of
 * the frame and the cab in the lower, so the two never fight for the same
 * pixels.
 */

import * as THREE from "three";
import {
  CSS3DObject,
  CSS3DRenderer,
} from "three/addons/renderers/CSS3DRenderer.js";
import { HOLO, PANEL_ANCHORS } from "@/lib/drive/world-map";

export type Boards = {
  /** Append this above the WebGL canvas. */
  domElement: HTMLElement;
  setSize(width: number, height: number): void;
  /** Fades each screen by how far the camera is from it. */
  update(camera: THREE.PerspectiveCamera, dt: number): void;
  render(camera: THREE.PerspectiveCamera): void;
  dispose(): void;
};

/** Metres. Below `NEAR_OUT` the screen is off; by `NEAR_IN` it is fully lit. */
const NEAR_OUT = 12;
const NEAR_IN = 19;
/**
 * And it fades away again between these, so distant stops stay quiet. `FAR_IN`
 * has to clear the arrival camera's own distance — it stands 15m further back
 * than the cab does — or the screen would dim at exactly the moment the camera
 * pulls out to look at it.
 */
const FAR_IN = 52;
const FAR_OUT = 92;

/**
 * A screen only lights up when the camera is more or less looking at it.
 *
 * This is the rule that keeps them out of the driver's way, and it exists
 * because of angular size: 26 metres of screen at 30 metres' range subtends
 * about 50°, so one sitting off to the side does not politely occupy the
 * corner of a wide driving lens — it wraps past the edge of the frame and
 * smears across it. Off-axis, therefore, is off.
 *
 * It costs nothing elsewhere. Driving up to a stop you are pointed straight at
 * its screen, and the arrival camera aims at the screen by construction, so
 * the two cases that matter are both dead centre.
 */
const AXIS_IN = Math.cos(THREE.MathUtils.degToRad(14));
const AXIS_OUT = Math.cos(THREE.MathUtils.degToRad(26));

/** Fade rates, per second. Out is quicker than in, as with any exit. */
const FADE_IN_RATE = 4.5;
const FADE_OUT_RATE = 11;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function buildBoards(hosts: Map<string, HTMLElement>): Boards {
  const scene = new THREE.Scene();

  const renderer = new CSS3DRenderer();
  const dom = renderer.domElement;
  dom.style.position = "absolute";
  dom.style.inset = "0";
  dom.style.zIndex = "2";
  // Only the screens themselves take pointer input; the space around them must
  // stay transparent to clicks so the HUD underneath keeps working.
  dom.style.pointerEvents = "none";

  /** Metres per CSS pixel. Fixed, because the screen has a physical size. */
  const scale = HOLO.worldWidth / HOLO.pxW;

  type Entry = {
    id: string;
    host: HTMLElement;
    object: CSS3DObject;
    /** Screen centre, for the distance fade and for the camera to aim at. */
    position: THREE.Vector3;
    opacity: number;
  };
  const entries: Entry[] = [];

  for (const [id, host] of hosts) {
    const anchor = PANEL_ANCHORS[id];
    if (!anchor) continue;

    host.style.width = `${HOLO.pxW}px`;
    host.style.height = `${HOLO.pxH}px`;

    const object = new CSS3DObject(host);
    object.position.set(anchor.x, anchor.y, anchor.z);
    object.rotation.y = anchor.rotY;
    object.scale.setScalar(scale);
    object.visible = false;
    scene.add(object);

    entries.push({
      id,
      host,
      object,
      position: object.position.clone(),
      opacity: 0,
    });
  }

  const camPos = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const toScreen = new THREE.Vector3();

  return {
    domElement: dom,

    setSize(width, height) {
      renderer.setSize(width, height);
    },

    update(camera, dt) {
      camera.getWorldPosition(camPos);
      camera.getWorldDirection(forward);

      for (const e of entries) {
        const d = camPos.distanceTo(e.position);
        toScreen.subVectors(e.position, camPos).normalize();
        const onAxis = smoothstep(AXIS_OUT, AXIS_IN, forward.dot(toScreen));

        const wanted =
          smoothstep(NEAR_OUT, NEAR_IN, d) *
          (1 - smoothstep(FAR_IN, FAR_OUT, d)) *
          onAxis;

        const rate = wanted < e.opacity ? FADE_OUT_RATE : FADE_IN_RATE;
        e.opacity += (wanted - e.opacity) * (1 - Math.exp(-rate * dt));

        if (e.opacity < 0.02) {
          e.opacity = 0;
          if (e.object.visible) {
            e.object.visible = false;
            e.host.style.opacity = "0";
            // Nothing behind a hidden screen should be clickable.
            e.host.style.pointerEvents = "none";
          }
          continue;
        }

        e.object.visible = true;
        e.host.style.opacity = e.opacity.toFixed(3);
        // Only take clicks once it is actually readable, so a screen fading
        // past the windscreen never swallows a stray one.
        e.host.style.pointerEvents = e.opacity > 0.6 ? "auto" : "none";
      }
    },

    render(camera) {
      renderer.render(scene, camera);
    },

    dispose() {
      for (const e of entries) e.object.removeFromParent();
      entries.length = 0;
      dom.remove();
    },
  };
}

/** Where a given section's screen stands, for the camera to frame. */
export function screenPosition(id: string): THREE.Vector3 | null {
  const a = PANEL_ANCHORS[id];
  return a ? new THREE.Vector3(a.x, a.y, a.z) : null;
}
