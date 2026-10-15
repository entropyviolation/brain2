/**
 * components/Lists/lib/list-icon-pile.ts — List Icons "PILE UP"
 *
 * Live rectangular-container physics in the spirit of Willpower gems: circle
 * bodies bounce on the floor and walls of the auto-organize playfield, with
 * dish κ = 0 so the habit oval is not the container. Screen-down is applied
 * on the collision plane (solver y). Positions are unscaled canvas pixels.
 *
 * The animated path is requestAnimationFrame with a fixed-timestep accumulator
 * (1/60, max 6 steps/frame). Playfield metrics freeze after pile start and
 * reshape only on a real width change. Paint is DOM-driven every frame during
 * flight; React commits once at the end so freeform drag works after settle.
 */

import {
  VELVET_ICON_BOX,
  VELVET_ICON_CELL,
  velvetGridColumns,
  type IconPos,
} from "@/components/Lists/lib/velvet-icon-grid"
import {
  DEFAULT_WILLPOWER_PHYSICS,
  emptyWillpowerWorld,
  makeWillpowerGem,
  resolveWillpowerOverlaps,
  stepWillpowerWorld,
  WILLPOWER_GEM_RADIUS,
  type WillpowerBody,
  type WillpowerPhysicsParams,
  type WillpowerWorld,
} from "@/lib/willpower-physics"

/**
 * Collision radius ≈ half the velvet icon box (~104px) so contacts match paint.
 * Large lists shrink slightly for O(n²) contacts.
 */
export const LIST_ICON_PILE_RADIUS = 50

/** Fixed sim step — accumulator catch-up, not one variable-dt step per frame. */
export const LIST_ICON_PILE_FIXED_DT = 1 / 60
export const LIST_ICON_PILE_MAX_STEPS = 6
/** Clamp a single frame's contributed dt before it feeds the accumulator. */
export const LIST_ICON_PILE_MAX_FRAME_DT = 1 / 30

/** @deprecated Paint every frame during visible flight; kept for call-site compat. */
export const LIST_ICON_PILE_PAINT_MS = 0

/** Cap the live bounce show; then force-commit even if gems still jitter. */
export const LIST_ICON_PILE_MAX_MS = 5500

/** After this, grab/throw is live during the fall (pile stays interactive). */
export const LIST_ICON_PILE_INTERACT_MS = 650

/** Post-settle fling wake — short second act when the user throws an orb. */
export const LIST_ICON_PILE_FLING_WAKE_MS = 1800

/** Freeform release speed (px/s) that re-awakens physics after settle. */
export const LIST_ICON_PILE_FLING_SPEED = 360

/** Clamp throw impulse so a flick stays readable, not a warp. */
export const LIST_ICON_PILE_THROW_MAX = 1400

/** Screen-down acceleration (px/s²) on solver y. Solver `g` stays 0. */
export const LIST_ICON_PILE_GRAVITY = 980

/** Floor restitution rest cutoff (px/s) — same spirit as willpower FLOOR_REST_VZ. */
export const LIST_ICON_PILE_FLOOR_REST = 28

/** Coulomb-ish ground friction (px/s²) while sliding on the rect floor. */
export const LIST_ICON_PILE_FLOOR_FRICTION = 110

/**
 * Rectangular plate. dishK = 0 so the pile does not bowl into an oval.
 * Tuned for readable fall + playful bounce (not chaotic jitter).
 */
export const LIST_ICON_PILE_PHYSICS: WillpowerPhysicsParams = {
  ...DEFAULT_WILLPOWER_PHYSICS,
  g: 0,
  dishK: 0,
  /** Willpower plate friction is for z-grounded xy slide — pile uses y-gravity + floor fric. */
  friction: 0,
  linearDrag: 0.3,
  quadDrag: 0.0008,
  magnus: 0,
  chaos: 0,
  restitution: 0.62,
  wallRestitution: 0.68,
  repulsion: 180,
  mass: 1,
  stirHop: 0,
  stirSpeed: 0,
}

/** Icon-position location for items in an open list. Distinct from folder keys (`home:…`). */
export function listItemsIconLocation(openTargetKey: string): string {
  return `items:${openTargetKey}`
}

/** Slightly smaller orbs when the list is large so O(n²) contacts stay frame-friendly. */
export function pileRadiusForCount(count: number): number {
  if (count > 120) return 36
  if (count > 64) return 42
  return LIST_ICON_PILE_RADIUS
}

export function listIconPlayfield(canvasWidth: number, count: number): {
  cols: number
  rows: number
  playfieldHeight: number
} {
  const cols = velvetGridColumns(canvasWidth)
  const rows = Math.max(1, Math.ceil(Math.max(count, 0) / cols))
  const playfieldHeight = rows * VELVET_ICON_CELL.h + VELVET_ICON_CELL.pad * 2
  return { cols, rows, playfieldHeight }
}

/**
 * Container height for the live bounce. At least the auto-organize playfield,
 * never shorter than ~3 velvet rows, and when a viewport is known **at least
 * that viewport** so the simulation floor is the bottom of the visible velvet
 * (`.fm-icon-canvas`). A shorter box leaves an ugly mid-screen shelf with empty
 * velvet below; a taller-than-viewport “cinematic” box + settle scroll did the
 * same by parking the heap mid-view.
 */
export function listIconPileContainerHeight(
  canvasWidth: number,
  count: number,
  viewportHeight = 0,
): number {
  const { playfieldHeight } = listIconPlayfield(canvasWidth, count)
  const minShow = VELVET_ICON_CELL.h * 3 + VELVET_ICON_CELL.pad * 2
  const velvetFloor = viewportHeight > 0 ? Math.ceil(viewportHeight) : 0
  return Math.max(playfieldHeight, minShow, velvetFloor)
}

/**
 * How far to scale the flight layer so the whole playfield fits. Never above 1.
 * Prefer `pileFitScale` from `list-icon-pile-camera.ts` for the live camera path.
 */
export function listIconZoomScale(viewportHeight: number, playfieldHeight: number): number {
  if (!(viewportHeight > 0) || !(playfieldHeight > 0)) return 1
  return Math.min(1, viewportHeight / playfieldHeight)
}

/** Body center → icon `left` / `top` in unscaled canvas pixels. */
export function pileBodiesToIconPositions(
  bodies: Array<Pick<WillpowerBody, "id" | "x" | "y">>,
): Record<string, IconPos> {
  const out: Record<string, IconPos> = {}
  for (const body of bodies) {
    out[body.id] = {
      x: body.x - VELVET_ICON_BOX.w / 2,
      y: body.y - VELVET_ICON_BOX.h / 2,
    }
  }
  return out
}

export type PileContainer = {
  width: number
  height: number
  minX: number
  maxX: number
  ceilY: number
  floorY: number
}

export function pileContainer(width: number, playfieldHeight: number, radius = LIST_ICON_PILE_RADIUS): PileContainer {
  const w = Math.max(width, VELVET_ICON_CELL.w)
  const h = Math.max(playfieldHeight, VELVET_ICON_CELL.h)
  const insetX = Math.min(Math.max(radius, VELVET_ICON_BOX.w / 2), w / 2)
  const ceilY = Math.min(radius + VELVET_ICON_CELL.pad, h / 2)
  const floorY = h - Math.min(Math.max(radius, VELVET_ICON_BOX.h / 2), h / 2)
  return {
    width: w,
    height: h,
    minX: insetX,
    maxX: Math.max(insetX, w - insetX),
    ceilY,
    floorY: Math.max(ceilY, floorY),
  }
}

/** @deprecated Prefer `pileContainer(...).floorY` — kept for call sites/tests. */
export function pileFloorY(playfieldHeight: number): number {
  return pileContainer(640, playfieldHeight).floorY
}

export function makePileWorld(width: number, playfieldHeight: number, radius = LIST_ICON_PILE_RADIUS): WillpowerWorld {
  const world = emptyWillpowerWorld()
  const box = pileContainer(width, playfieldHeight, radius)
  world.width = box.width
  world.height = box.height
  world.cx = box.width / 2
  world.cy = box.height / 2
  // Huge oval so clampOval never becomes the real wall — the rect clamp is.
  const span = Math.max(box.width, box.height, 1)
  world.rx = span * 8
  world.ry = span * 8
  world.scale = radius / WILLPOWER_GEM_RADIUS
  world.stirAge = 99
  return world
}

/**
 * True when the live canvas width changed enough to reshape the frozen playfield.
 * Mid-sim minHeight / applyPileContainer every rAF caused size jumps — only resize.
 */
export function pileContainerNeedsReshape(frozenWidth: number, liveWidth: number, epsilon = 1): boolean {
  return Math.abs(liveWidth - frozenWidth) > epsilon
}

/**
 * Resize the physics box instantly. Bodies outside the new walls are pushed
 * in with a bounce impulse so a shrink feels like the box closed on them.
 */
export function applyPileContainer(
  world: WillpowerWorld,
  bodies: WillpowerBody[],
  width: number,
  playfieldHeight: number,
  radius = LIST_ICON_PILE_RADIUS,
): PileContainer {
  const box = pileContainer(width, playfieldHeight, radius)
  world.width = box.width
  world.height = box.height
  world.cx = box.width / 2
  world.cy = box.height / 2
  const span = Math.max(box.width, box.height, 1)
  world.rx = span * 8
  world.ry = span * 8
  world.scale = radius / WILLPOWER_GEM_RADIUS
  const eWall = LIST_ICON_PILE_PHYSICS.wallRestitution
  for (const body of bodies) {
    body.r = radius
    if (body.x < box.minX) {
      body.x = box.minX
      if (body.vx < 0) body.vx = -body.vx * eWall
    } else if (body.x > box.maxX) {
      body.x = box.maxX
      if (body.vx > 0) body.vx = -body.vx * eWall
    }
    if (body.y < box.ceilY) {
      body.y = box.ceilY
      if (body.vy < 0) body.vy = -body.vy * eWall
    } else if (body.y > box.floorY) {
      body.y = box.floorY
      if (body.vy > 0) body.vy = -body.vy * LIST_ICON_PILE_PHYSICS.restitution
    }
  }
  return box
}

export type MakePileBodiesOpts = {
  /** Existing icon top-lefts; centers are used as start poses when present. */
  seedPositions?: Record<string, IconPos>
}

/**
 * Spawn bodies inside the container. Keep seed X when given (desktop scatter),
 * but always drop from the ceiling so the fall reads across the velvet box.
 */
export function makePileBodies(
  ids: string[],
  width: number,
  playfieldHeight: number,
  world?: WillpowerWorld,
  opts?: MakePileBodiesOpts,
): WillpowerBody[] {
  const radius = pileRadiusForCount(ids.length)
  const pileWorld = world ?? makePileWorld(width, playfieldHeight, radius)
  const box = pileContainer(width, playfieldHeight, radius)
  const slot = radius * 2.15
  const cols = Math.max(1, Math.floor(Math.max(box.maxX - box.minX, slot) / slot))
  const seeds = opts?.seedPositions
  return ids.map((id, i) => {
    const seed = seeds?.[id]
    const col = i % cols
    const row = Math.floor(i / cols)
    const rowCount = Math.min(cols, ids.length - row * cols)
    const rowSpan = Math.max(rowCount - 1, 0) * slot
    const origin = box.minX + Math.max(0, (box.maxX - box.minX - rowSpan) / 2)
    const gridX = origin + col * slot
    const x = Math.min(
      box.maxX,
      Math.max(box.minX, seed ? seed.x + VELVET_ICON_BOX.w / 2 : gridX),
    )
    // Ceiling drop + stagger — never start already sitting mid-field or on the floor.
    const y = Math.min(
      box.floorY,
      Math.max(box.ceilY, box.ceilY + (row % 5) * (radius * 0.55) + (i % 3) * 3),
    )
    const gem = makeWillpowerGem(id, x, y, pileWorld, LIST_ICON_PILE_PHYSICS)
    gem.r = radius
    gem.x = x
    gem.y = y
    gem.z = 0
    gem.vz = 0
    gem.vx = (pileWorld.cx - x) * 0.06 + ((i % 5) - 2) * 12
    gem.vy = 55 + (i % 5) * 10
    gem.omega = 0
    return gem
  })
}

export type PileBounds = PileContainer

/**
 * One fixed sim step. Gravity pulls solver y downward; walls are the playfield rect.
 * Floor uses floor restitution + rest cutoff; ground friction when resting on floor.
 */
export function stepIconPile(
  bodies: WillpowerBody[],
  world: WillpowerWorld,
  dt: number,
  bounds: PileContainer,
): WillpowerBody[] {
  const stepDt = Math.min(Math.max(dt, 0), LIST_ICON_PILE_MAX_FRAME_DT)
  if (bodies.length === 0 || stepDt === 0) return bodies
  for (const body of bodies) {
    body.z = 0
    body.vz = 0
    // Held orbs are kinematic (pointer) — do not pile gravity on them.
    if (body.held) continue
    body.vy += LIST_ICON_PILE_GRAVITY * stepDt
  }
  const next = stepWillpowerWorld(bodies, world, stepDt, LIST_ICON_PILE_PHYSICS)
  const eWall = LIST_ICON_PILE_PHYSICS.wallRestitution
  const eFloor = LIST_ICON_PILE_PHYSICS.restitution
  for (const body of next) {
    if (body.held) {
      body.z = 0
      body.vz = 0
      continue
    }
    if (body.x < bounds.minX) {
      body.x = bounds.minX
      if (body.vx < 0) body.vx = -body.vx * eWall
    } else if (body.x > bounds.maxX) {
      body.x = bounds.maxX
      if (body.vx > 0) body.vx = -body.vx * eWall
    }
    if (body.y < bounds.ceilY) {
      body.y = bounds.ceilY
      if (body.vy < 0) body.vy = -body.vy * eWall
    } else if (body.y > bounds.floorY) {
      body.y = bounds.floorY
      if (body.vy > 0) {
        body.vy = -body.vy * eFloor
        if (Math.abs(body.vy) < LIST_ICON_PILE_FLOOR_REST) body.vy = 0
      }
      // Ground friction while on the floor (not ad-hoc vx*=0.88).
      if (Math.abs(body.vy) < 1) {
        const mag = Math.abs(body.vx)
        const decel = LIST_ICON_PILE_FLOOR_FRICTION * stepDt
        body.vx = mag <= decel ? 0 : body.vx - Math.sign(body.vx) * decel
      }
    } else if (body.y < bounds.floorY - 2 && Math.abs(body.vx) < 1 && Math.abs(body.vy) < 1) {
      // Willpower's z-grounded rest freeze (dishK=0, friction=0) can pin a gem mid-air.
      // Nudge it so the next gravity impulse keeps the fall alive.
      body.vy = Math.max(body.vy, LIST_ICON_PILE_GRAVITY * stepDt)
    }
    body.z = 0
    body.vz = 0
  }
  return next
}

/**
 * Advance the pile with a fixed-timestep accumulator. Clamps frame dt, runs at
 * most MAX_STEPS substeps, returns leftover accumulator for the next frame.
 */
export function accumulateIconPile(
  bodies: WillpowerBody[],
  world: WillpowerWorld,
  bounds: PileContainer,
  frameDtSec: number,
  accumulatorSec: number,
): { bodies: WillpowerBody[]; accumulator: number; steps: number } {
  const frameDt = Math.min(LIST_ICON_PILE_MAX_FRAME_DT, Math.max(frameDtSec, 0))
  let acc = accumulatorSec + frameDt
  let next = bodies
  let steps = 0
  while (acc >= LIST_ICON_PILE_FIXED_DT && steps < LIST_ICON_PILE_MAX_STEPS) {
    next = stepIconPile(next, world, LIST_ICON_PILE_FIXED_DT, bounds)
    acc -= LIST_ICON_PILE_FIXED_DT
    steps += 1
  }
  if (steps >= LIST_ICON_PILE_MAX_STEPS) acc = 0
  return { bodies: next, accumulator: acc, steps }
}

/** Settled when planar speed is quiet — same soft threshold as worldIsLive (speed² ≤ 64). */
export function pileIsSettled(bodies: WillpowerBody[]): boolean {
  if (bodies.length === 0) return true
  for (const body of bodies) {
    if (body.held) return false
    if (body.vx * body.vx + body.vy * body.vy > 64) return false
  }
  return true
}

/** Nearest body under a world-space pointer (collision radius hit). */
export function pileHitTest(
  bodies: Array<Pick<WillpowerBody, "id" | "x" | "y" | "r">>,
  worldX: number,
  worldY: number,
): string | null {
  let best: string | null = null
  let bestDist = Infinity
  for (const body of bodies) {
    const d = Math.hypot(body.x - worldX, body.y - worldY)
    const reach = Math.max(body.r, LIST_ICON_PILE_RADIUS) * 1.15
    if (d <= reach && d < bestDist) {
      best = body.id
      bestDist = d
    }
  }
  return best
}

export function pileClampThrow(vx: number, vy: number): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy)
  if (speed <= LIST_ICON_PILE_THROW_MAX || speed < 1e-6) return { vx, vy }
  const k = LIST_ICON_PILE_THROW_MAX / speed
  return { vx: vx * k, vy: vy * k }
}

/** Grab an orb — kinematic until release (willpower `held`). */
export function pileGrabBody(bodies: WillpowerBody[], id: string): WillpowerBody[] {
  return bodies.map((b) =>
    b.id === id ? { ...b, held: true, vx: 0, vy: 0, vz: 0, z: 0 } : b,
  )
}

/** Pose a held orb at a world-space center with pointer velocity. */
export function pileDragBody(
  bodies: WillpowerBody[],
  id: string,
  worldX: number,
  worldY: number,
  vx: number,
  vy: number,
  bounds?: PileContainer,
): WillpowerBody[] {
  return bodies.map((b) => {
    if (b.id !== id || !b.held) return b
    let x = worldX
    let y = worldY
    if (bounds) {
      x = Math.min(bounds.maxX, Math.max(bounds.minX, x))
      y = Math.min(bounds.floorY, Math.max(bounds.ceilY, y))
    }
    return { ...b, x, y, vx, vy, vz: 0, z: 0 }
  })
}

/** Release with a throw impulse — pile responds on the next steps. */
export function pileThrowBody(
  bodies: WillpowerBody[],
  id: string,
  vx: number,
  vy: number,
): WillpowerBody[] {
  const impulse = pileClampThrow(vx, vy)
  return bodies.map((b) =>
    b.id === id
      ? { ...b, held: false, vx: impulse.vx, vy: impulse.vy, vz: 0, z: 0 }
      : b,
  )
}

/** Seed a short post-settle wake from freeform poses + one thrown id. */
export function makePileBodiesFromPositions(
  ids: string[],
  positions: Record<string, IconPos>,
  width: number,
  playfieldHeight: number,
  world?: WillpowerWorld,
): WillpowerBody[] {
  const radius = pileRadiusForCount(ids.length)
  const pileWorld = world ?? makePileWorld(width, playfieldHeight, radius)
  const box = pileContainer(width, playfieldHeight, radius)
  return ids.map((id, i) => {
    const pos = positions[id]
    const x = Math.min(
      box.maxX,
      Math.max(box.minX, (pos?.x ?? box.minX) + VELVET_ICON_BOX.w / 2),
    )
    const y = Math.min(
      box.floorY,
      Math.max(box.ceilY, (pos?.y ?? box.ceilY) + VELVET_ICON_BOX.h / 2),
    )
    const gem = makeWillpowerGem(id, x, y, pileWorld, LIST_ICON_PILE_PHYSICS)
    gem.r = radius
    gem.x = x
    gem.y = y
    gem.z = 0
    gem.vz = 0
    gem.vx = ((i % 5) - 2) * 2
    gem.vy = 0
    gem.omega = 0
    gem.held = false
    return gem
  })
}

function restPile(bodies: WillpowerBody[], world: WillpowerWorld, bounds: PileContainer): WillpowerBody[] {
  let next = bodies
  const passes = bodies.length > 64 ? 2 : 4
  for (let pass = 0; pass < passes; pass++) {
    next = resolveWillpowerOverlaps(next, LIST_ICON_PILE_PHYSICS)
    for (const body of next) {
      body.x = Math.min(bounds.maxX, Math.max(bounds.minX, body.x))
      body.y = Math.min(bounds.floorY, Math.max(bounds.ceilY, body.y))
      body.vx = 0
      body.vy = 0
      body.vz = 0
      body.z = 0
    }
  }
  world.stirAge = 99
  return next
}

/**
 * Sync settle for tests / reduced-motion. Large lists skip the O(n²) loop.
 */
export function solveIconPile(
  ids: string[],
  canvasWidth: number,
  playfieldHeight: number,
  maxSteps = 120,
): Record<string, IconPos> {
  if (ids.length === 0) return {}
  if (ids.length > 48) return compactHeapPositions(ids, canvasWidth, playfieldHeight)
  const width = Math.max(canvasWidth, VELVET_ICON_CELL.w)
  const height = Math.max(playfieldHeight, VELVET_ICON_CELL.h)
  const radius = pileRadiusForCount(ids.length)
  const world = makePileWorld(width, height, radius)
  const bounds = pileContainer(width, height, radius)
  const steps = Math.min(maxSteps, 180)
  let bodies = makePileBodies(ids, width, height, world)
  let acc = 0
  for (let i = 0; i < steps; i++) {
    const advanced = accumulateIconPile(bodies, world, bounds, LIST_ICON_PILE_FIXED_DT, acc)
    bodies = advanced.bodies
    acc = advanced.accumulator
    if (pileIsSettled(bodies) && bodies.every((body) => body.y > height * 0.2)) break
  }
  bodies = restPile(bodies, world, bounds)
  // Soft stop — do not compactHeap on a normal settle that already reached the floor.
  const lowest = Math.max(...bodies.map((body) => body.y), 0)
  if (lowest < height * 0.12) return compactHeapPositions(ids, width, height)
  return pileBodiesToIconPositions(bodies)
}

/**
 * Final pose after the rAF fall — overlap passes only.
 * Compact heap is an emergency fallback (pile never left the ceiling), not the
 * normal settle path.
 */
export function finalizeIconPile(
  bodies: WillpowerBody[],
  world: WillpowerWorld,
  bounds: PileContainer,
  ids: string[],
  canvasWidth: number,
  playfieldHeight: number,
): Record<string, IconPos> {
  if (bodies.length === 0) return {}
  const lowest = Math.max(...bodies.map((body) => body.y), 0)
  if (lowest < playfieldHeight * 0.12) {
    return compactHeapPositions(ids, canvasWidth, playfieldHeight)
  }
  const rested = restPile(bodies, world, bounds)
  return pileBodiesToIconPositions(rested)
}

/**
 * Post-pile React handoff: freeform layout is already committed; clear the
 * motion overlay so beginPointerDrag is not blocked by a stale motionPos.
 */
export function pileClearMotionAfterCommit(): null {
  return null
}

export function prefersIconPileReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** Compact non-overlapping heap for reduced motion and emergency settle fallbacks. */
export function compactHeapPositions(
  ids: string[],
  canvasWidth: number,
  playfieldHeight: number,
): Record<string, IconPos> {
  const radius = pileRadiusForCount(ids.length)
  const box = pileContainer(canvasWidth, playfieldHeight, radius)
  const slot = radius * 2
  const cols = Math.max(1, Math.floor(Math.max(box.maxX - box.minX, slot) / slot))
  const out: Record<string, IconPos> = {}
  ids.forEach((id, i) => {
    const rowFromBottom = Math.floor(i / cols)
    const col = i % cols
    const rowCount = Math.min(cols, ids.length - rowFromBottom * cols)
    const rowWidth = Math.max(rowCount - 1, 0) * slot
    const origin = box.minX + Math.max(0, (box.maxX - box.minX - rowWidth) / 2)
    const stagger = rowFromBottom % 2 === 1 ? slot * 0.35 : 0
    const x = Math.min(box.maxX, origin + col * slot + stagger)
    const y = box.floorY - rowFromBottom * (radius * 1.72)
    out[id] = {
      x: x - VELVET_ICON_BOX.w / 2,
      y: y - VELVET_ICON_BOX.h / 2,
    }
  })
  return out
}
