/**
 * components/Lists/lib/list-icon-gravity.ts — List Icons optional "Gravity"
 *
 * Interactive 2D constellation field for Icons desktop. Icons are particles
 * whose mass and springs come from shared connections (ItemLink edges,
 * dependencies / parentTaskId, shared tags, shared lists). Grab / throw /
 * stir mid-sim; others keep integrating. Distinct from PILE UP (floor bounce).
 * Default off; Reset restores a snapshot taken when Gravity was enabled.
 * Skip to stable (`settleGravityFieldSlice` / `settleGravityField`) jumps to a
 * calm layout under **current** GravityFieldParams (globalG + source gains)
 * without turning Gravity off. Host time-slices on large lists.
 *
 * Pure helpers + rAF-friendly stepper. No willpower / pile imports — rebase-safe
 * beside the pile-polish agent.
 */

import { normalizeTag } from "@/lib/links"
import type { ItemLink } from "@/lib/types"
import {
  VELVET_ICON_CELL,
  type IconPos,
} from "@/components/Lists/lib/velvet-icon-grid"

/** Tunable contribution weights for undirected pair strength. */
export const GRAVITY_WEIGHT = {
  LINK: 1,
  DEPENDENCY: 0.85,
  PARENT: 0.9,
  TAG: 0.35,
  SHARED_LIST: 0.25,
  MAX_EDGE: 3.5,
  BASE_MASS: 1,
  MASS_FROM_EDGES: 0.55,
} as const

/** Per-source gains for pair weights (defaults ≡ GRAVITY_WEIGHT). */
export type GravitySourceGains = {
  link: number
  dependency: number
  parent: number
  tag: number
  sharedList: number
  /** Phase 3 — shared attributes; default 0 (off). */
  attribute: number
}

/**
 * UI-tunable Gravity field params. Defaults match the shipped feel (G=1,
 * current GRAVITY_WEIGHT sources, no attribute drift).
 */
export type GravityFieldParams = {
  /** Global force multiplier for springs + edge attract. Default 1. */
  globalG: number
  sources: GravitySourceGains
  /** Phase 3 — soft attribute attract; default 0 (off). */
  attributeDrift: number
}

export const DEFAULT_GRAVITY_FIELD_PARAMS: GravityFieldParams = {
  globalG: 1,
  sources: {
    link: GRAVITY_WEIGHT.LINK,
    dependency: GRAVITY_WEIGHT.DEPENDENCY,
    parent: GRAVITY_WEIGHT.PARENT,
    tag: GRAVITY_WEIGHT.TAG,
    sharedList: GRAVITY_WEIGHT.SHARED_LIST,
    attribute: 0,
  },
  attributeDrift: 0,
}

const GAIN_MAX = 2
const GLOBAL_G_MAX = 2.5

function clampUnit(n: unknown, fallback: number, max: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(0, n))
}

/** Normalize persisted / patched field prefs; missing keys → defaults. */
export function sanitizeGravityFieldParams(raw: unknown): GravityFieldParams {
  const d = DEFAULT_GRAVITY_FIELD_PARAMS
  if (!raw || typeof raw !== "object") {
    return { globalG: d.globalG, sources: { ...d.sources }, attributeDrift: d.attributeDrift }
  }
  const o = raw as Partial<GravityFieldParams>
  const src =
    o.sources && typeof o.sources === "object" && !Array.isArray(o.sources)
      ? (o.sources as Partial<GravitySourceGains>)
      : {}
  return {
    globalG: clampUnit(o.globalG, d.globalG, GLOBAL_G_MAX),
    sources: {
      link: clampUnit(src.link, d.sources.link, GAIN_MAX),
      dependency: clampUnit(src.dependency, d.sources.dependency, GAIN_MAX),
      parent: clampUnit(src.parent, d.sources.parent, GAIN_MAX),
      tag: clampUnit(src.tag, d.sources.tag, GAIN_MAX),
      sharedList: clampUnit(src.sharedList, d.sources.sharedList, GAIN_MAX),
      attribute: clampUnit(src.attribute, d.sources.attribute, GAIN_MAX),
    },
    attributeDrift: clampUnit(o.attributeDrift, d.attributeDrift, GAIN_MAX),
  }
}

/** Merge a partial patch onto current params (sanitized). */
export function mergeGravityFieldParams(
  current: GravityFieldParams,
  patch: Partial<GravityFieldParams>,
): GravityFieldParams {
  return sanitizeGravityFieldParams({
    ...current,
    ...patch,
    sources: { ...current.sources, ...(patch.sources ?? {}) },
  })
}

/** Stable signature for live edge rebuild (ignores globalG). */
export function gravitySourcesSignature(sources: GravitySourceGains): string {
  return [
    sources.link,
    sources.dependency,
    sources.parent,
    sources.tag,
    sources.sharedList,
    sources.attribute,
  ].join("|")
}

export const GRAVITY_SIM = {
  /** Base spring rest length (px); heavier edges sit closer. */
  REST: 132,
  REST_TIGHTEN: 48,
  /** Spring stiffness × edge weight. */
  SPRING: 58,
  /** Soft long-range attraction along edges (cluster glue). */
  ATTRACT: 18,
  /** Soft all-pairs repulsion. */
  REPEL: 3200,
  REPEL_MIN_DIST: 64,
  /** Soft collision radius (centers). */
  COLLIDE_R: 52,
  COLLIDE_PUSH: 420,
  COLLIDE_BOUNCE: 0.42,
  /** Velocity damping (higher → calmer living field). */
  DAMP: 2.45,
  IDLE_DAMP: 3.6,
  /** Mild center suspension. */
  CENTER: 3.2,
  /** Gentle orbital swirl around playfield center. */
  SWIRL: 9.5,
  PAD: 10,
  /** Live-sim “calm enough” speed (px/s) — not a true rest; idle swirl still runs. */
  SETTLE_SPEED: 18,
  /** Skip to stable hard rest (px/s) before zeroing — springs must be nearly quiet. */
  SETTLE_HARD_SPEED: 0.45,
  /** Max center drift (px) in one settle step before we treat the pose as final. */
  SETTLE_HARD_DELTA: 0.2,
  PAINT_MS: 16,
  COMMIT_MS: 320,
  /**
   * Above this body count, live Gravity degrades: coarser paint/commit, spatial
   * pairs, capped edges, quieter juice. Small lists keep the full rich feel.
   */
  LARGE_N: 80,
  /** Full O(n²) pairwise only at or below this; above uses a grid hash. */
  PAIR_FULL_N: 56,
  /** Max spring edges after build (heaviest kept). */
  MAX_EDGES: 360,
  /** Max ids paired per shared tag/list bucket (bounds O(k²) fan-out). */
  BUCKET_PAIR_CAP: 28,
  /** Large-N live paint / persist cadence (ms). */
  LARGE_PAINT_MS: 50,
  LARGE_COMMIT_MS: 1_200,
  /** After this, soft idle (more damp, quieter swirl). */
  SHOW_MS: 8_000,
  /** prefers-reduced-motion snap max steps (host should still time-slice). */
  REDUCED_STEPS: 56,
  /** Skip to stable base steps; scales with body count (time-sliced on the host). */
  SETTLE_FAST_STEPS: 240,
  SETTLE_FAST_STEPS_CAP: 480,
  /** Steps attempted per Skip rAF slice (also wall-clock budgeted). */
  SETTLE_SLICE_STEPS: 6,
  /** Soft ms budget per Skip slice — yield before the UI stutters. */
  SETTLE_SLICE_MS: 6,
  REDUCED_DT: 1 / 30,
  /** Throw velocity clamp (px/s). */
  THROW_MAX: 1400,
  THROW_GAIN: 1.15,
  /** Stir impulses (willpower-flavored). */
  STIR_SPEED: 380,
  STIR_TANGENTIAL: 0.72,
  STIR_RADIUS: 220,
} as const

/** True when live Gravity should degrade (paint / pairs / juice). */
export function gravityIsLargeN(bodyCount: number): boolean {
  return bodyCount > GRAVITY_SIM.LARGE_N
}

/** Live paint interval — longer for large lists so React/DOM stay responsive. */
export function gravityPaintMs(bodyCount: number): number {
  return gravityIsLargeN(bodyCount) ? GRAVITY_SIM.LARGE_PAINT_MS : GRAVITY_SIM.PAINT_MS
}

/** Persist cadence — avoid rewriting huge iconPositions every few frames. */
export function gravityCommitMs(bodyCount: number): number {
  return gravityIsLargeN(bodyCount) ? GRAVITY_SIM.LARGE_COMMIT_MS : GRAVITY_SIM.COMMIT_MS
}

export type GravityItem = {
  id: string
  tags?: string[]
  links?: ItemLink[]
  lists?: string[]
  dependencies?: string[]
  parentTaskId?: string
}

export type GravityEdge = {
  a: string
  b: string
  weight: number
}

export type GravityBody = {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  mass: number
  /** Kinematic grab — forces skip; pointer owns pose. */
  held?: boolean
}

export type GravityBounds = {
  width: number
  height: number
}

const snapshots = new Map<string, Record<string, IconPos>>()

function undirectedKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function clampWeight(w: number): number {
  if (!Number.isFinite(w) || w <= 0) return 0
  return Math.min(GRAVITY_WEIGHT.MAX_EDGE, w)
}

function linkContribution(
  source: GravityItem,
  targetId: string,
  linkGain: number,
): number {
  let sum = 0
  for (const link of source.links ?? []) {
    if (link.targetId !== targetId) continue
    const w = typeof link.weight === "number" && Number.isFinite(link.weight) ? link.weight : 1
    sum += linkGain * Math.max(0, Math.min(1.5, w))
  }
  return sum
}

/**
 * Connection weight between two items. Heavier → stronger spring, closer rest,
 * brighter cord, more mass influence. Optional `gains` defaults to shipped
 * GRAVITY_WEIGHT values (identity with no UI prefs).
 */
export function pairConnectionWeight(
  a: GravityItem,
  b: GravityItem,
  gains: GravitySourceGains = DEFAULT_GRAVITY_FIELD_PARAMS.sources,
): number {
  if (!a.id || !b.id || a.id === b.id) return 0
  let w = 0

  w += linkContribution(a, b.id, gains.link)
  w += linkContribution(b, a.id, gains.link)

  const depsA = a.dependencies ?? []
  const depsB = b.dependencies ?? []
  if (depsA.includes(b.id) || depsB.includes(a.id)) w += gains.dependency

  if (a.parentTaskId === b.id || b.parentTaskId === a.id) w += gains.parent

  const tagsA = new Set((a.tags ?? []).map(normalizeTag).filter(Boolean))
  let sharedTags = 0
  for (const tag of b.tags ?? []) {
    const n = normalizeTag(tag)
    if (n && tagsA.has(n)) sharedTags += 1
  }
  if (sharedTags > 0) w += gains.tag * Math.min(sharedTags, 4)

  const listsA = new Set((a.lists ?? []).filter(Boolean))
  let sharedLists = 0
  for (const listId of b.lists ?? []) {
    if (listId && listsA.has(listId)) sharedLists += 1
  }
  if (sharedLists > 0) w += gains.sharedList * Math.min(sharedLists, 3)

  return clampWeight(w)
}

/** Keep the heaviest springs when a hub graph exceeds the live edge budget. */
export function capGravityEdges(
  edges: readonly GravityEdge[],
  maxEdges: number = GRAVITY_SIM.MAX_EDGES,
): GravityEdge[] {
  if (edges.length <= maxEdges) return edges.slice()
  return edges
    .slice()
    .sort((a, b) => b.weight - a.weight || a.a.localeCompare(b.a) || a.b.localeCompare(b.b))
    .slice(0, maxEdges)
}

/**
 * Build undirected weighted springs from current source gains.
 * Small lists use all-pairs (exact). Large lists use sparse inverted indexes
 * so enabling Gravity / Skip does not scan O(n²) empty pairs on the click path.
 * Always capped to `GRAVITY_SIM.MAX_EDGES` (heaviest kept).
 */
export function buildGravityEdges(
  items: readonly GravityItem[],
  gains: GravitySourceGains = DEFAULT_GRAVITY_FIELD_PARAMS.sources,
): GravityEdge[] {
  if (items.length <= GRAVITY_SIM.PAIR_FULL_N) {
    const edges: GravityEdge[] = []
    const seen = new Set<string>()
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!
        const b = items[j]!
        const weight = pairConnectionWeight(a, b, gains)
        if (weight <= 0) continue
        const key = undirectedKey(a.id, b.id)
        if (seen.has(key)) continue
        seen.add(key)
        edges.push({ a: a.id, b: b.id, weight })
      }
    }
    return capGravityEdges(edges)
  }

  // Sparse path — accumulate then clamp (matches pairConnectionWeight spirit).
  const byId = new Map(items.map((it) => [it.id, it]))
  const raw = new Map<string, number>()
  const add = (aId: string, bId: string, w: number) => {
    if (!aId || !bId || aId === bId || !(w > 0)) return
    if (!byId.has(aId) || !byId.has(bId)) return
    const key = undirectedKey(aId, bId)
    raw.set(key, (raw.get(key) ?? 0) + w)
  }

  for (const a of items) {
    for (const link of a.links ?? []) {
      if (!link.targetId || !byId.has(link.targetId)) continue
      const lw =
        typeof link.weight === "number" && Number.isFinite(link.weight) ? link.weight : 1
      add(a.id, link.targetId, gains.link * Math.max(0, Math.min(1.5, lw)))
    }
    for (const dep of a.dependencies ?? []) {
      if (dep && byId.has(dep)) add(a.id, dep, gains.dependency)
    }
    if (a.parentTaskId && byId.has(a.parentTaskId)) {
      add(a.id, a.parentTaskId, gains.parent)
    }
  }

  const tagBuckets = new Map<string, string[]>()
  const listBuckets = new Map<string, string[]>()
  for (const it of items) {
    for (const tag of it.tags ?? []) {
      const n = normalizeTag(tag)
      if (!n) continue
      let bucket = tagBuckets.get(n)
      if (!bucket) {
        bucket = []
        tagBuckets.set(n, bucket)
      }
      if (!bucket.includes(it.id)) bucket.push(it.id)
    }
    for (const listId of it.lists ?? []) {
      if (!listId) continue
      let bucket = listBuckets.get(listId)
      if (!bucket) {
        bucket = []
        listBuckets.set(listId, bucket)
      }
      if (!bucket.includes(it.id)) bucket.push(it.id)
    }
  }

  const pairBucket = (bucket: string[], unit: number) => {
    const lim = Math.min(bucket.length, GRAVITY_SIM.BUCKET_PAIR_CAP)
    for (let i = 0; i < lim; i++) {
      for (let j = i + 1; j < lim; j++) {
        add(bucket[i]!, bucket[j]!, unit)
      }
    }
  }
  for (const bucket of tagBuckets.values()) pairBucket(bucket, gains.tag)
  for (const bucket of listBuckets.values()) pairBucket(bucket, gains.sharedList)

  const edges: GravityEdge[] = []
  for (const [key, w] of raw) {
    const weight = clampWeight(w)
    if (weight <= 0) continue
    const sep = key.indexOf("|")
    edges.push({ a: key.slice(0, sep), b: key.slice(sep + 1), weight })
  }
  return capGravityEdges(edges)
}

export function nodeMass(id: string, edges: readonly GravityEdge[]): number {
  let incident = 0
  for (const edge of edges) {
    if (edge.a === id || edge.b === id) incident += edge.weight
  }
  return GRAVITY_WEIGHT.BASE_MASS + GRAVITY_WEIGHT.MASS_FROM_EDGES * incident
}

/** Ideal spring length: heavy bonds hug; weak bonds float farther. */
export function edgeRestLength(weight: number): number {
  const t = Math.min(1, Math.max(0, weight / GRAVITY_WEIGHT.MAX_EDGE))
  return GRAVITY_SIM.REST - GRAVITY_SIM.REST_TIGHTEN * t
}

/** Cord stroke opacity 0.12–0.92 from edge weight. */
export function edgeCordOpacity(weight: number): number {
  const t = Math.min(1, Math.max(0, weight / GRAVITY_WEIGHT.MAX_EDGE))
  return 0.12 + t * 0.8
}

/** Glow band for heavy hubs: 0 none, 1 soft, 2 bright, 3 hub. */
export function nodeGlowLevel(mass: number): 0 | 1 | 2 | 3 {
  if (mass >= 3.2) return 3
  if (mass >= 2.2) return 2
  if (mass >= 1.55) return 1
  return 0
}

export function iconPosToCenter(pos: IconPos): { x: number; y: number } {
  return {
    x: pos.x + VELVET_ICON_CELL.w / 2,
    y: pos.y + VELVET_ICON_CELL.h / 2,
  }
}

export function centerToIconPos(x: number, y: number): IconPos {
  return {
    x: x - VELVET_ICON_CELL.w / 2,
    y: y - VELVET_ICON_CELL.h / 2,
  }
}

export function makeGravityBodies(
  ids: readonly string[],
  positions: Record<string, IconPos>,
  edges: readonly GravityEdge[],
): GravityBody[] {
  return ids.map((id) => {
    const pos = positions[id] ?? { x: VELVET_ICON_CELL.pad, y: VELVET_ICON_CELL.pad }
    const c = iconPosToCenter(pos)
    return {
      id,
      x: c.x,
      y: c.y,
      vx: 0,
      vy: 0,
      mass: nodeMass(id, edges),
      held: false,
    }
  })
}

/** Remass in place after live source-gain edge rebuild (keeps pose / velocity). */
export function remassGravityBodies(
  bodies: GravityBody[],
  edges: readonly GravityEdge[],
): GravityBody[] {
  return bodies.map((b) => ({ ...b, mass: nodeMass(b.id, edges) }))
}

export function gravityBodiesToIconPositions(bodies: readonly GravityBody[]): Record<string, IconPos> {
  const out: Record<string, IconPos> = {}
  for (const body of bodies) {
    out[body.id] = centerToIconPos(body.x, body.y)
  }
  return out
}

function playfieldHeight(count: number, width: number): number {
  const cols = Math.max(1, Math.floor((Math.max(width, 80) - VELVET_ICON_CELL.pad) / VELVET_ICON_CELL.w))
  const rows = Math.max(1, Math.ceil(Math.max(count, 1) / cols))
  return Math.max(
    520,
    rows * VELVET_ICON_CELL.h + VELVET_ICON_CELL.pad * 2,
    VELVET_ICON_CELL.h * 3.5 + VELVET_ICON_CELL.pad * 2,
  )
}

export function gravityBoundsFor(canvasWidth: number, count: number): GravityBounds {
  return {
    width: Math.max(canvasWidth, VELVET_ICON_CELL.w + GRAVITY_SIM.PAD * 2),
    height: playfieldHeight(count, canvasWidth),
  }
}

function clampThrow(vx: number, vy: number): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy)
  if (speed <= GRAVITY_SIM.THROW_MAX) return { vx, vy }
  const s = GRAVITY_SIM.THROW_MAX / speed
  return { vx: vx * s, vy: vy * s }
}

export function grabGravityBody(bodies: GravityBody[], id: string): GravityBody[] {
  return bodies.map((b) => (b.id === id ? { ...b, held: true, vx: 0, vy: 0 } : b))
}

export function dragGravityBody(
  bodies: GravityBody[],
  id: string,
  x: number,
  y: number,
  vx: number,
  vy: number,
): GravityBody[] {
  return bodies.map((b) => (b.id === id && b.held ? { ...b, x, y, vx, vy } : b))
}

export function releaseGravityBody(
  bodies: GravityBody[],
  id: string,
  vx: number,
  vy: number,
): GravityBody[] {
  const flung = clampThrow(vx * GRAVITY_SIM.THROW_GAIN, vy * GRAVITY_SIM.THROW_GAIN)
  return bodies.map((b) =>
    b.id === id ? { ...b, held: false, vx: flung.vx, vy: flung.vy } : b,
  )
}

/** Plate-press whirl: radial kick + tangential swirl around the click. */
export function stirGravityField(
  bodies: GravityBody[],
  clickX: number,
  clickY: number,
  seed = (Math.random() * 0x7fffffff) | 0,
): GravityBody[] {
  let s = seed || 1
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0
    return (s >>> 0) / 0xffffffff
  }
  return bodies.map((b) => {
    if (b.held) return b
    const dx = b.x - clickX
    const dy = b.y - clickY
    const dist = Math.hypot(dx, dy) || 1
    if (dist > GRAVITY_SIM.STIR_RADIUS * 1.35) return b
    const fall = 1 - Math.min(dist / GRAVITY_SIM.STIR_RADIUS, 1)
    const nx = dx / dist
    const ny = dy / dist
    const swirl = rnd() < 0.5 ? 1 : -1
    const power = GRAVITY_SIM.STIR_SPEED * (0.35 + 0.65 * fall) * (0.85 + rnd() * 0.3)
    const tang = power * GRAVITY_SIM.STIR_TANGENTIAL * swirl
    const invM = 1 / Math.max(0.4, b.mass)
    return {
      ...b,
      vx: b.vx + (nx * power + -ny * tang) * invM,
      vy: b.vy + (ny * power + nx * tang) * invM,
    }
  })
}

/** Interaction radius for repel / soft collide (centers). */
function gravityPairCellSize(): number {
  return GRAVITY_SIM.REST * 2.8
}

/** Apply soft repel + overlap push between body indices i < j. */
function applyGravityPairForces(
  bodies: GravityBody[],
  i: number,
  j: number,
  ax: Float64Array,
  ay: Float64Array,
): void {
  const A = bodies[i]!
  const B = bodies[j]!
  const dx = B.x - A.x
  const dy = B.y - A.y
  const dist = Math.hypot(dx, dy) || 0.001
  if (dist > GRAVITY_SIM.REST * 2.8) return
  const soft = Math.max(dist, GRAVITY_SIM.REPEL_MIN_DIST)
  const repel = GRAVITY_SIM.REPEL / (soft * soft)
  const fx = (repel * dx) / dist
  const fy = (repel * dy) / dist
  if (!A.held) {
    ax[i]! -= fx
    ay[i]! -= fy
  }
  if (!B.held) {
    ax[j]! += fx
    ay[j]! += fy
  }
  if (dist < GRAVITY_SIM.COLLIDE_R * 2) {
    const overlap = GRAVITY_SIM.COLLIDE_R * 2 - dist
    const push = GRAVITY_SIM.COLLIDE_PUSH * overlap
    const px = (push * dx) / dist
    const py = (push * dy) / dist
    if (!A.held) {
      ax[i]! -= px
      ay[i]! -= py
    }
    if (!B.held) {
      ax[j]! += px
      ay[j]! += py
    }
  }
}

/** Visit nearby pairs via a uniform grid (large-N path). */
function forEachNearbyGravityPairs(
  bodies: GravityBody[],
  visit: (i: number, j: number) => void,
): void {
  const cell = gravityPairCellSize()
  const buckets = new Map<string, number[]>()
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!
    const key = `${Math.floor(b.x / cell)}|${Math.floor(b.y / cell)}`
    let list = buckets.get(key)
    if (!list) {
      list = []
      buckets.set(key, list)
    }
    list.push(i)
  }
  const seen = new Set<string>()
  for (const [key, list] of buckets) {
    const sep = key.indexOf("|")
    const cx = Number(key.slice(0, sep))
    const cy = Number(key.slice(sep + 1))
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const other = buckets.get(`${cx + ox}|${cy + oy}`)
        if (!other) continue
        for (const i of list) {
          for (const j of other) {
            if (j <= i) continue
            const pairKey = `${i}|${j}`
            if (seen.has(pairKey)) continue
            seen.add(pairKey)
            visit(i, j)
          }
        }
      }
    }
  }
}

/**
 * One explicit-Euler step: weighted springs, soft attraction, repulsion,
 * soft collisions, center suspension, orbital swirl, damping, soft walls.
 * Held bodies keep pointer pose; others keep simulating around them.
 * Large N uses a spatial hash for pairwise work (springs stay on capped edges).
 */
export function stepGravity(
  bodies: GravityBody[],
  edges: readonly GravityEdge[],
  dt: number,
  bounds: GravityBounds,
  opts?: { reducedMotion?: boolean; idle?: boolean; globalG?: number },
): GravityBody[] {
  if (bodies.length === 0 || dt <= 0) return bodies
  const reduced = !!opts?.reducedMotion
  const idle = !!opts?.idle
  const globalG =
    typeof opts?.globalG === "number" && Number.isFinite(opts.globalG)
      ? Math.max(0, opts.globalG)
      : 1
  const damp = reduced ? GRAVITY_SIM.DAMP * 4 : idle ? GRAVITY_SIM.IDLE_DAMP : GRAVITY_SIM.DAMP
  const springK = (reduced ? GRAVITY_SIM.SPRING * 1.5 : GRAVITY_SIM.SPRING) * globalG
  const attractK = (reduced ? GRAVITY_SIM.ATTRACT * 0.5 : GRAVITY_SIM.ATTRACT) * globalG
  const centerK = reduced ? GRAVITY_SIM.CENTER * 0.35 : GRAVITY_SIM.CENTER
  const swirlK = reduced ? 0 : idle ? GRAVITY_SIM.SWIRL * 0.35 : GRAVITY_SIM.SWIRL

  const byId = new Map(bodies.map((b) => [b.id, b]))
  const ax = new Float64Array(bodies.length)
  const ay = new Float64Array(bodies.length)
  const index = new Map(bodies.map((b, i) => [b.id, i]))

  const cx = bounds.width / 2
  const cy = bounds.height / 2

  for (const edge of edges) {
    const A = byId.get(edge.a)
    const B = byId.get(edge.b)
    if (!A || !B) continue
    const i = index.get(edge.a)!
    const j = index.get(edge.b)!
    const dx = B.x - A.x
    const dy = B.y - A.y
    const dist = Math.hypot(dx, dy) || 0.001
    const rest = edgeRestLength(edge.weight)
    const stretch = dist - rest
    const spring = springK * edge.weight * stretch
    // Soft glue so clusters form even when slightly compressed.
    const attract = attractK * edge.weight
    const force = spring - attract
    const fx = (force * dx) / dist
    const fy = (force * dy) / dist
    if (!A.held) {
      ax[i]! += fx
      ay[i]! += fy
    }
    if (!B.held) {
      ax[j]! -= fx
      ay[j]! -= fy
    }
  }

  // Skip settle (reducedMotion) on large N: springs + center only — dense packs
  // make pairwise work dominate the click path even with a spatial hash.
  const skipPairs = reduced && bodies.length > GRAVITY_SIM.PAIR_FULL_N
  if (!skipPairs) {
    if (bodies.length <= GRAVITY_SIM.PAIR_FULL_N) {
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          applyGravityPairForces(bodies, i, j, ax, ay)
        }
      }
    } else {
      forEachNearbyGravityPairs(bodies, (i, j) => applyGravityPairForces(bodies, i, j, ax, ay))
    }
  }

  const halfW = VELVET_ICON_CELL.w / 2
  const halfH = VELVET_ICON_CELL.h / 2
  const minX = GRAVITY_SIM.PAD + halfW
  const minY = GRAVITY_SIM.PAD + halfH
  const maxX = Math.max(minX, bounds.width - GRAVITY_SIM.PAD - halfW)
  const maxY = Math.max(minY, bounds.height - GRAVITY_SIM.PAD - halfH)

  const next: GravityBody[] = new Array(bodies.length)
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]!
    if (body.held) {
      next[i] = { ...body }
      continue
    }
    const invM = 1 / Math.max(0.35, body.mass)
    let vx = body.vx + ax[i]! * invM * dt
    let vy = body.vy + ay[i]! * invM * dt
    // Center suspension — light isolates drift more.
    vx += (cx - body.x) * centerK * invM * dt
    vy += (cy - body.y) * centerK * invM * dt
    // Orbital swirl (information-weight orbit, not noise).
    if (swirlK > 0) {
      const rx = body.x - cx
      const ry = body.y - cy
      const r = Math.hypot(rx, ry) || 1
      const fall = Math.min(1, r / Math.max(bounds.width, bounds.height) * 2)
      const tx = -ry / r
      const ty = rx / r
      vx += tx * swirlK * fall * invM * dt
      vy += ty * swirlK * fall * invM * dt
    }
    const decay = Math.exp(-damp * dt)
    vx *= decay
    vy *= decay
    let x = body.x + vx * dt
    let y = body.y + vy * dt
    if (x < minX) {
      x = minX
      vx = Math.abs(vx) * GRAVITY_SIM.COLLIDE_BOUNCE
    } else if (x > maxX) {
      x = maxX
      vx = -Math.abs(vx) * GRAVITY_SIM.COLLIDE_BOUNCE
    }
    if (y < minY) {
      y = minY
      vy = Math.abs(vy) * GRAVITY_SIM.COLLIDE_BOUNCE
    } else if (y > maxY) {
      y = maxY
      vy = -Math.abs(vy) * GRAVITY_SIM.COLLIDE_BOUNCE
    }
    next[i] = { id: body.id, x, y, vx, vy, mass: body.mass, held: false }
  }

  // Pairwise velocity bounce after integrate (satisfying flings through clusters).
  const bouncePair = (i: number, j: number) => {
    const A = next[i]!
    const B = next[j]!
    if (A.held || B.held) return
    const dx = B.x - A.x
    const dy = B.y - A.y
    const dist = Math.hypot(dx, dy) || 0.001
    if (dist >= GRAVITY_SIM.COLLIDE_R * 1.85) return
    const nx = dx / dist
    const ny = dy / dist
    const rvx = B.vx - A.vx
    const rvy = B.vy - A.vy
    const closing = rvx * nx + rvy * ny
    if (closing >= 0) return
    const invA = 1 / Math.max(0.35, A.mass)
    const invB = 1 / Math.max(0.35, B.mass)
    const jImp = (-(1 + GRAVITY_SIM.COLLIDE_BOUNCE) * closing) / (invA + invB)
    A.vx -= jImp * nx * invA
    A.vy -= jImp * ny * invA
    B.vx += jImp * nx * invB
    B.vy += jImp * ny * invB
    const sep = (GRAVITY_SIM.COLLIDE_R * 1.85 - dist) * 0.5
    A.x -= nx * sep
    A.y -= ny * sep
    B.x += nx * sep
    B.y += ny * sep
  }

  if (!skipPairs) {
    if (next.length <= GRAVITY_SIM.PAIR_FULL_N) {
      for (let i = 0; i < next.length; i++) {
        for (let j = i + 1; j < next.length; j++) bouncePair(i, j)
      }
    } else {
      forEachNearbyGravityPairs(next, bouncePair)
    }
  }

  return next
}

export function gravityMaxSpeed(bodies: readonly GravityBody[]): number {
  let maxSpeed = 0
  for (const body of bodies) {
    if (body.held) continue
    const speed = Math.hypot(body.vx, body.vy)
    if (speed > maxSpeed) maxSpeed = speed
  }
  return maxSpeed
}

export function gravityIsSettled(bodies: readonly GravityBody[]): boolean {
  if (bodies.length === 0) return true
  for (const body of bodies) {
    if (body.held) return false
  }
  return gravityMaxSpeed(bodies) < GRAVITY_SIM.SETTLE_SPEED
}

function settleFastMaxSteps(bodyCount: number, override?: number): number {
  if (typeof override === "number" && Number.isFinite(override) && override >= 0) return override
  return Math.min(
    GRAVITY_SIM.SETTLE_FAST_STEPS_CAP,
    GRAVITY_SIM.SETTLE_FAST_STEPS + Math.floor(bodyCount * 1.5),
  )
}

/** Progress for time-sliced Skip to stable (host drives via rAF). */
export type GravitySettleProgress = {
  bodies: GravityBody[]
  stepsDone: number
  maxSteps: number
  done: boolean
}

function zeroGravityVelocities(bodies: GravityBody[]): GravityBody[] {
  return bodies.map((b) => ({ ...b, vx: 0, vy: 0, held: false }))
}

/** Start a Skip settle — releases held bodies; does not step yet. */
export function beginGravitySettle(
  bodies: GravityBody[],
  opts?: { maxSteps?: number },
): GravitySettleProgress {
  return {
    bodies: bodies.map((b) => (b.held ? { ...b, held: false } : { ...b })),
    stepsDone: 0,
    maxSteps: settleFastMaxSteps(bodies.length, opts?.maxSteps),
    done: bodies.length === 0,
  }
}

/**
 * Advance Skip settle by a budgeted slice. Pass the **current** `globalG` and
 * edges built from the **current** source gains each slice (or refresh edges
 * when settings change). Host must freeze the live rAF stepper when done.
 */
export function settleGravityFieldSlice(
  progress: GravitySettleProgress,
  edges: readonly GravityEdge[],
  bounds: GravityBounds,
  opts?: { globalG?: number; maxStepsThisSlice?: number; timeBudgetMs?: number },
): GravitySettleProgress {
  if (progress.done) return progress
  if (progress.bodies.length === 0) {
    return { ...progress, bodies: [], done: true }
  }
  const slice =
    typeof opts?.maxStepsThisSlice === "number" && opts.maxStepsThisSlice > 0
      ? opts.maxStepsThisSlice
      : GRAVITY_SIM.SETTLE_SLICE_STEPS
  const budget =
    typeof opts?.timeBudgetMs === "number" && opts.timeBudgetMs >= 0
      ? opts.timeBudgetMs
      : GRAVITY_SIM.SETTLE_SLICE_MS
  const globalG = opts?.globalG
  const t0 = typeof performance !== "undefined" ? performance.now() : 0
  let current = progress.bodies
  let stepsDone = progress.stepsDone

  for (let i = 0; i < slice && stepsDone < progress.maxSteps; i++) {
    if (
      budget < Number.POSITIVE_INFINITY &&
      typeof performance !== "undefined" &&
      performance.now() - t0 >= budget
    ) {
      break
    }
    const prev = current
    current = stepGravity(current, edges, GRAVITY_SIM.REDUCED_DT, bounds, {
      reducedMotion: true,
      globalG,
    })
    stepsDone += 1
    const speed = gravityMaxSpeed(current)
    let maxDelta = 0
    for (let j = 0; j < current.length; j++) {
      const a = prev[j]!
      const b = current[j]!
      const d = Math.hypot(b.x - a.x, b.y - a.y)
      if (d > maxDelta) maxDelta = d
    }
    if (speed < GRAVITY_SIM.SETTLE_HARD_SPEED && maxDelta < GRAVITY_SIM.SETTLE_HARD_DELTA) {
      return {
        bodies: zeroGravityVelocities(current),
        stepsDone,
        maxSteps: progress.maxSteps,
        done: true,
      }
    }
  }

  if (stepsDone >= progress.maxSteps) {
    return {
      bodies: zeroGravityVelocities(current),
      stepsDone,
      maxSteps: progress.maxSteps,
      done: true,
    }
  }
  return {
    bodies: current,
    stepsDone,
    maxSteps: progress.maxSteps,
    done: false,
  }
}

/**
 * Sync fast-forward (tests / tiny lists). Prefer `settleGravityFieldSlice` on
 * the UI thread for large N. Uses the same reduced-motion integrator; pass
 * current `globalG`. Host must freeze after settle. Does not turn Gravity off.
 */
export function settleGravityField(
  bodies: GravityBody[],
  edges: readonly GravityEdge[],
  bounds: GravityBounds,
  opts?: { maxSteps?: number; globalG?: number },
): GravityBody[] {
  let progress = beginGravitySettle(bodies, { maxSteps: opts?.maxSteps })
  while (!progress.done) {
    progress = settleGravityFieldSlice(progress, edges, bounds, {
      globalG: opts?.globalG,
      maxStepsThisSlice: 64,
      timeBudgetMs: Number.POSITIVE_INFINITY,
    })
  }
  return progress.bodies
}

/** Reduced-motion enable path — same integrator as settleGravityField, fewer max steps. */
export function settleGravityReduced(
  bodies: GravityBody[],
  edges: readonly GravityEdge[],
  bounds: GravityBounds,
  opts?: { globalG?: number },
): GravityBody[] {
  return settleGravityField(bodies, edges, bounds, {
    maxSteps: GRAVITY_SIM.REDUCED_STEPS,
    globalG: opts?.globalG,
  })
}

export function prefersGravityReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

export function takeGravitySnapshot(location: string, positions: Record<string, IconPos>): void {
  const copy: Record<string, IconPos> = {}
  for (const [id, pos] of Object.entries(positions)) {
    copy[id] = { x: pos.x, y: pos.y }
  }
  snapshots.set(location, copy)
}

export function peekGravitySnapshot(location: string): Record<string, IconPos> | null {
  const snap = snapshots.get(location)
  if (!snap) return null
  const copy: Record<string, IconPos> = {}
  for (const [id, pos] of Object.entries(snap)) {
    copy[id] = { x: pos.x, y: pos.y }
  }
  return copy
}

export function restoreGravitySnapshot(location: string): Record<string, IconPos> | null {
  return peekGravitySnapshot(location)
}

export function clearGravitySnapshot(location: string): void {
  snapshots.delete(location)
}

export function clearAllGravitySnapshots(): void {
  snapshots.clear()
}

export function tasksToGravityItems(
  tasks: ReadonlyArray<{
    id: string
    tags?: string[]
    links?: ItemLink[]
    lists?: string[]
    dependencies?: string[]
    parentTaskId?: string
  }>,
): GravityItem[] {
  return tasks.map((task) => ({
    id: task.id,
    tags: task.tags,
    links: task.links,
    lists: task.lists,
    dependencies: task.dependencies,
    parentTaskId: task.parentTaskId,
  }))
}
