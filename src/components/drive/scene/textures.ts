/**
 * Canvas-drawn textures for the drive.
 *
 * Road signs need real typography, and shipping image files for seven section
 * names would be wasteful, so every sign face is painted into a 2D canvas at
 * runtime and uploaded as a texture. Everything else in the scene is flat
 * colour, which keeps the whole world under a handful of materials.
 */

import * as THREE from "three";

export const INK = "#0b0b0b";
export const YELLOW = "#ffd100";
export const CREAM = "#fffbea";

/**
 * The surface contrast ladder.
 *
 * Everything a driver needs to read at speed is decided here, so it is worth
 * being explicit about it. The rule the whole world obeys: **the tarmac is the
 * brightest large surface in the scene.** Nothing off-road is allowed to be as
 * light as the road, which means "where can I drive" is answered by luminance
 * alone — before any marking, sign or arrow is resolved, and regardless of how
 * far away it is or how small it is on screen.
 *
 * Approximate relative luminance, darkest first:
 *   verge 0.02 · pavement 0.10 · kerb top 0.55 · road 0.24 · junction 0.34
 *
 * The kerb is the odd one out on purpose. It is a thin bright line, not a
 * surface, so it never competes with the tarmac for area — it just draws the
 * edge of it.
 */
export const SURFACE = {
  /** Ground beyond the pavement. Near-black, so the city reads as a void. */
  verge: 0x090c0a,
  /** Footway either side of every road: dark, matte, obviously not drivable. */
  pavement: 0x1b1d22,
  /** Bright concrete edge. The single strongest "road ends here" cue. */
  kerb: 0xb9bcc3,
  /** Tarmac. */
  road: 0x4a4d55,
  /** Junction boxes and plaza aprons — a step lighter, visible from far off. */
  junction: 0x5e626b,
  /** Painted bay interiors, a touch darker than the road they sit on. */
  bay: 0x3a3d44,
} as const;

/** Lane paint. White for edges and lanes, yellow reserved for hazards/turns. */
export const PAINT = {
  white: 0xf2efe2,
  yellow: 0xffd100,
} as const;

/**
 * The display face loaded by next/font, read off the CSS custom property so
 * the signs match the rest of the site. Falls back to a heavy system stack.
 */
function displayFont(): string {
  const fallback = '"Arial Black", Impact, system-ui, sans-serif';
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
  return v ? `${v}, ${fallback}` : fallback;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, aniso: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  tex.needsUpdate = true;
  return tex;
}

/** Shrinks the font until the text fits the given width. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  font: string,
) {
  let size = startPx;
  do {
    ctx.font = `${size}px ${font}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > 10);
  return size;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dir: "left" | "right" | "up",
  color: string,
) {
  ctx.save();
  ctx.translate(cx, cy);
  if (dir === "left") ctx.rotate(Math.PI);
  if (dir === "up") ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = color;

  const head = size * 0.5;
  const shaftH = size * 0.26;
  const shaftW = size * 0.5;

  ctx.beginPath();
  ctx.moveTo(-shaftW, -shaftH / 2);
  ctx.lineTo(head * 0.1, -shaftH / 2);
  ctx.lineTo(head * 0.1, -head / 2);
  ctx.lineTo(size * 0.62, 0);
  ctx.lineTo(head * 0.1, head / 2);
  ctx.lineTo(head * 0.1, shaftH / 2);
  ctx.lineTo(-shaftW, shaftH / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * A directional sign panel: chunky arrow beside an uppercase destination.
 * `theme` flips the colourway so gantry panels and roadside posts read
 * differently at a glance.
 */
export function makeDirectionSign(
  label: string,
  dir: "left" | "right" | "up",
  theme: "yellow" | "dark",
  aniso: number,
): THREE.CanvasTexture {
  const W = 1024;
  const H = 320;
  const { c, ctx } = canvas(W, H);
  const font = displayFont();

  const bg = theme === "yellow" ? YELLOW : INK;
  const fg = theme === "yellow" ? INK : YELLOW;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Hard border, matching the site's brutalist blocks.
  ctx.strokeStyle = fg;
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, W - 14, H - 14);

  const arrowSize = 150;
  const arrowCx = dir === "right" ? W - 150 : 150;
  const textLeft = dir === "right" ? 60 : 250;
  const textRight = dir === "right" ? W - 250 : W - 60;

  if (dir === "up") {
    drawArrow(ctx, W / 2, 100, 120, "up", fg);
    const size = fitText(ctx, label, W - 120, 118, font);
    ctx.font = `${size}px ${font}`;
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, W / 2, 232);
  } else {
    drawArrow(ctx, arrowCx, H / 2, arrowSize, dir, fg);
    const size = fitText(ctx, label, textRight - textLeft, 150, font);
    ctx.font = `${size}px ${font}`;
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, (textLeft + textRight) / 2, H / 2 + 4);
  }

  return finish(c, aniso);
}

/** Building facade: dark slab pricked with warm windows, some lit. */
export function makeBuildingTexture(seed: number, aniso: number): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const { c, ctx } = canvas(W, H);

  // A touch lighter and cooler than the ink used elsewhere, so the skyline
  // reads as a mass of buildings against the night rather than as a hole in
  // it — the road needs something to be bounded *by*.
  ctx.fillStyle = "#1a1d24";
  ctx.fillRect(0, 0, W, H);

  // Deterministic pseudo-random so the skyline is stable across reloads.
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const cols = 6;
  const rows = 8;
  const padX = 12;
  const padY = 10;
  const cw = (W - padX * 2) / cols;
  const ch = (H - padY * 2) / rows;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rand();
      if (lit < 0.42) continue;
      ctx.fillStyle = lit > 0.88 ? YELLOW : lit > 0.62 ? "#8a7413" : "#3a3208";
      ctx.fillRect(
        padX + col * cw + cw * 0.16,
        padY + r * ch + ch * 0.18,
        cw * 0.68,
        ch * 0.58,
      );
    }
  }

  const tex = finish(c, aniso);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Roadside chevron board — the real-world "the road goes this way" marker.
 *
 * Placed in pairs framing each junction mouth, they say which way the turnings
 * run before any word on any sign can be read, and they keep saying it in
 * peripheral vision while the driver is looking at the road.
 */
export function makeChevronBoard(
  dir: "left" | "right",
  aniso: number,
): THREE.CanvasTexture {
  const W = 512;
  const H = 170;
  const { c, ctx } = canvas(W, H);

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = YELLOW;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, W - 10, H - 10);

  const s = dir === "left" ? -1 : 1;
  ctx.strokeStyle = YELLOW;
  ctx.lineWidth = 26;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let i = 0; i < 3; i++) {
    const cx = W / 2 + s * (i - 1) * 128;
    ctx.beginPath();
    ctx.moveTo(cx - s * 48, 38);
    ctx.lineTo(cx + s * 48, H / 2);
    ctx.lineTo(cx - s * 48, H - 38);
    ctx.stroke();
  }

  return finish(c, aniso);
}

/** Yellow/black checker, used on kerb barriers and the depot apron. */
export function makeCheckerTexture(aniso: number): THREE.CanvasTexture {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, S / 2, S / 2);
  ctx.fillRect(S / 2, S / 2, S / 2, S / 2);
  const tex = finish(c, aniso);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Lane arrow painted on the tarmac. Drawn on a transparent canvas so it sits
 * on the road surface rather than in a box, and pointed so a driver reads the
 * turn from the road itself, not just from the overhead signs.
 */
export function makeRoadArrow(
  dir: "left" | "right" | "straight",
  aniso: number,
): THREE.CanvasTexture {
  const W = 256;
  const H = 512;
  const { c, ctx } = canvas(W, H);

  const shaft = (): void => {
    ctx.beginPath();
    if (dir === "straight") {
      ctx.moveTo(W / 2, H - 40);
      ctx.lineTo(W / 2, 150);
    } else {
      const s = dir === "left" ? -1 : 1;
      // Shaft up from the driver, then a quarter turn across the lane.
      ctx.moveTo(W / 2, H - 40);
      ctx.lineTo(W / 2, 250);
      ctx.quadraticCurveTo(W / 2, 150, W / 2 + s * 70, 150);
    }
    ctx.stroke();
  };

  const head = (): void => {
    ctx.beginPath();
    if (dir === "straight") {
      ctx.moveTo(W / 2, 40);
      ctx.lineTo(W / 2 + 78, 165);
      ctx.lineTo(W / 2 - 78, 165);
    } else {
      const s = dir === "left" ? -1 : 1;
      ctx.moveTo(W / 2 + s * 210, 150);
      ctx.lineTo(W / 2 + s * 90, 150 - 78);
      ctx.lineTo(W / 2 + s * 90, 150 + 78);
    }
    ctx.closePath();
    ctx.fill();
  };

  // Dark halo first. The tarmac under these arrows is deliberately the
  // lightest surface in the world, so yellow alone would lose its edge — the
  // outline is what keeps the turn readable from the far end of the straight.
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 68;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  shaft();
  ctx.save();
  ctx.lineWidth = 26;
  head();
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = YELLOW;
  ctx.fillStyle = YELLOW;
  ctx.lineWidth = 44;
  ctx.lineCap = "butt";
  shaft();
  head();

  return finish(c, aniso);
}

/**
 * Repeating chevrons for the painted route line.
 *
 * Tiled along the route and scrolled toward the destination, so the line does
 * not just mark the path — it points down it. That directionality is what lets
 * a first-time driver tell "follow this" from "do not cross this" at a glance,
 * and it survives being seen almost edge-on at road level, which a flat stripe
 * does not.
 */
export function makeRouteChevrons(aniso: number): THREE.CanvasTexture {
  const W = 128;
  const H = 128;
  const { c, ctx } = canvas(W, H);

  // Two chevrons per tile, pointing to -Y (which maps to "away from the
  // driver" once the strip is laid down the route).
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 20;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const yBase of [30, 94]) {
    ctx.beginPath();
    ctx.moveTo(18, yBase + 22);
    ctx.lineTo(W / 2, yBase - 20);
    ctx.lineTo(W - 18, yBase + 22);
    ctx.stroke();
  }

  const tex = finish(c, aniso);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * A soft vertical gradient for the destination beacons — bright at the road,
 * fading out well before the top so the column reads as light rather than as a
 * solid post blocking the view.
 */
export function makeBeaconTexture(): THREE.CanvasTexture {
  const W = 8;
  const H = 128;
  const { c, ctx } = canvas(W, H);
  const g = ctx.createLinearGradient(0, H, 0, 0);
  g.addColorStop(0, "rgba(255,209,0,0.85)");
  g.addColorStop(0.35, "rgba(255,209,0,0.34)");
  g.addColorStop(1, "rgba(255,209,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft radial falloff, used for lamp pools and headlight spill.
 *
 * Warm white rather than saturated yellow, and weak. Additive light over the
 * old near-black tarmac needed to be strong to show at all; over a road this
 * bright the same values stop reading as illumination and start reading as
 * yellow paint on the carriageway, which is actively misleading.
 */
export function makeGlowTexture(): THREE.CanvasTexture {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,238,190,0.42)");
  g.addColorStop(0.35, "rgba(255,232,170,0.16)");
  g.addColorStop(1, "rgba(255,228,160,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** "TAXI" tag that hangs off the rear-view mirror. */
export function makeMirrorTag(aniso: number): THREE.CanvasTexture {
  const W = 256;
  const H = 128;
  const { c, ctx } = canvas(W, H);
  const font = displayFont();
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, W - 10, H - 10);
  ctx.font = `64px ${font}`;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TAXI", W / 2, H / 2 + 4);
  return finish(c, aniso);
}
