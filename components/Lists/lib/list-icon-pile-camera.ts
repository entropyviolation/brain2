/**
 * components/Lists/lib/list-icon-pile-camera.ts — PILE UP flight camera
 *
 * One continuous camera on the velvet flight layer: translate + scale only.
 * Icon CSS size never changes mid-anim — perceived size comes solely from
 * this transform, so there is no pop between “desktop icon” and “tiny orb”.
 *
 * Driven every rAF from sim focus (spawn → fall centroid → settled pile).
 * Not Three.js: DOM orbs already carry the velvet photos; a WebGL layer would
 * fight React layout and force a texture round-trip on commit.
 */

export type PileCamera = {
  /** 1 = native icon size. Never jump; always ease. */
  scale: number
  /** Screen-space Y shift after scale (origin top-center). */
  panY: number
}

export type PileCameraPhase = "overview" | "follow" | "settle"

export const PILE_CAMERA_IDENTITY: PileCamera = { scale: 1, panY: 0 }

/** Fit the playfield in the viewport without upscaling past native size. */
export function pileFitScale(viewportHeight: number, playfieldHeight: number): number {
  if (!(viewportHeight > 0) || !(playfieldHeight > 0)) return 1
  return Math.min(1, viewportHeight / playfieldHeight)
}

/**
 * `panY` that places world Y = playfieldHeight on the velvet viewport bottom
 * (transform-origin top center: screenY = panY + worldY * scale).
 * Keeps the pile floor glued to the stage — never a rising shelf mid-canvas.
 */
export function pileFloorPinPanY(scale: number, viewportHeight: number, playfieldHeight: number): number {
  if (!(viewportHeight > 0) || !(playfieldHeight > 0)) return 0
  const s = Math.max(scale, 0.05)
  return viewportHeight - playfieldHeight * s
}

/**
 * Target camera for the cinematic. Overview shows the whole box; follow keeps
 * the falling centroid near the upper-middle of the viewport; settle returns
 * to identity (scroll takes over so desktop icons stay native size).
 * Overview / follow never lift the playfield floor above the velvet bottom.
 */
export function pileCameraTarget(args: {
  phase: PileCameraPhase
  viewportHeight: number
  playfieldHeight: number
  /** World Y of the point to keep in view (body centroid). */
  focusY: number
}): PileCamera {
  const fit = pileFitScale(args.viewportHeight, args.playfieldHeight)
  if (args.phase === "settle") return { ...PILE_CAMERA_IDENTITY }
  const floorPan = pileFloorPinPanY(fit, args.viewportHeight, args.playfieldHeight)
  if (args.phase === "overview") {
    return { scale: fit, panY: floorPan }
  }
  // follow — track focus, but never raise the floor above the velvet bottom.
  const followPan = args.viewportHeight * 0.4 - args.focusY * fit
  return { scale: fit, panY: Math.max(followPan, floorPan) }
}

/** Exponential ease toward target — smooth, no overshoot, frame-rate friendly. */
export function easePileCamera(
  current: PileCamera,
  target: PileCamera,
  dtSec: number,
  stiffness = 5.5,
): PileCamera {
  const t = dtSec <= 0 ? 0 : 1 - Math.exp(-stiffness * dtSec)
  return {
    scale: current.scale + (target.scale - current.scale) * t,
    panY: current.panY + (target.panY - current.panY) * t,
  }
}

/** CSS transform for the flight layer. Scale alone changes orb screen size. */
export function pileCameraCss(cam: PileCamera): string {
  const s = Number.isFinite(cam.scale) ? cam.scale : 1
  const y = Number.isFinite(cam.panY) ? cam.panY : 0
  if (Math.abs(s - 1) < 0.0005 && Math.abs(y) < 0.5) return "none"
  return `translate3d(0, ${y.toFixed(2)}px, 0) scale(${s.toFixed(4)})`
}

/**
 * Scroll offset once the camera is identity. Pin the playfield **bottom**
 * (pile floor) to the velvet viewport bottom whenever content is taller than
 * the view — never center the heap mid-canvas with empty velvet below.
 * `focusY` is unused (call-site compat); floor alignment always wins.
 */
export function pileSettleScrollTop(_focusY: number, viewportHeight: number, playfieldHeight: number): number {
  return Math.max(0, playfieldHeight - viewportHeight)
}

/** True when scale stepped more than a continuous ease should in one frame. */
export function pileScaleJump(prev: number, next: number, maxStep = 0.12): boolean {
  return Math.abs(next - prev) > maxStep
}

/**
 * Invert flight-layer camera (translate3d then scale, origin top-center) so a
 * pointer in canvas client space maps to unscaled playfield pixels.
 */
export function pilePointerToWorld(args: {
  clientX: number
  clientY: number
  canvasLeft: number
  canvasTop: number
  scrollTop: number
  canvasWidth: number
  cam: PileCamera
}): { x: number; y: number } {
  const scale = Math.max(args.cam.scale, 0.05)
  const localX = args.clientX - args.canvasLeft
  const localY = args.clientY - args.canvasTop + args.scrollTop
  const originX = args.canvasWidth / 2
  return {
    x: originX + (localX - originX) / scale,
    y: (localY - args.cam.panY) / scale,
  }
}
