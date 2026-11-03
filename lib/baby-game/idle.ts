/**
 * lib/baby-game/idle.ts — idle life: blinks, breaths, ear flicks and glances
 *
 * Like the walk frames (`walk.ts`), the poses are made from the still grids so every body gets them.
 * `idlePose(id, t)` is the schedule: a pure function of the body's name and the clock, so each friend keeps its
 * own rhythm with no state to save. `idleGrid` turns a pose into a grid.
 *
 * - **blink**: the dark eye pixels (a dark pixel touching a white glint, away from the outline) close to a line.
 * - **breathe**: the torso above the legs squashes down a pixel, a slow breath out.
 * - **earL / earR**: the top rows on one half slide a pixel outward, an ear flick (front and back views).
 * - **glance** is not a grid: the renderer shows the side view for a moment, as if the friend looked over.
 */

import { SPRITE_SIZE, type SpriteView } from "./sprites"

export type IdlePose = "blink" | "breathe" | "earL" | "earR" | "glance"

const hash = (s: string, k: number) => {
  let h = 2166136261 ^ k
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

/** A repeating event: once every `period` seconds, lasting `len`, at a per-body offset. */
function due(id: string, t: number, k: number, period: number, len: number): boolean {
  const p = period * (0.8 + hash(id, k) * 0.5)
  return (t + hash(id, k + 50) * p) % p < len
}

/** What a still body is doing right now, or `null` for the plain still. */
export function idlePose(id: string, t: number): IdlePose | null {
  if (due(id, t, 1, 11, 1.1)) return "glance"
  if (due(id, t, 2, 3.4, 0.13)) return "blink"
  if (due(id, t, 3, 7, 0.16)) return hash(id, Math.floor(t / 7)) > 0.5 ? "earL" : "earR"
  if (Math.sin(t * 1.6 + hash(id, 4) * 6.28) > 0.55) return "breathe"
  return null
}

const DARK = "kyz"
const cache = new Map<string, string[]>()

/** The grid for a pose, or the base grid when the pose does not apply. */
export function idleGrid(base: readonly string[], view: SpriteView, pose: Exclude<IdlePose, "glance">): string[] {
  const cells = base.map((row) => row.split(""))
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= SPRITE_SIZE || y >= SPRITE_SIZE ? "." : cells[y]![x]!)
  const out = cells.map((row) => row.slice())

  let first = -1
  let bottom = -1
  cells.forEach((row, y) => {
    if (row.some((ch) => ch !== ".")) {
      if (first < 0) first = y
      bottom = y
    }
  })
  if (first < 0) return [...base]

  if (pose === "blink") {
    const seen = new Set<string>()
    for (let y = 1; y < SPRITE_SIZE - 1; y++) {
      for (let x = 1; x < SPRITE_SIZE - 1; x++) {
        if (at(x, y) !== "w") continue
        // eyes sit in the upper half of a body; a glint lower down is a nose or a tooth
        if (y > first + (bottom - first) * 0.45) continue
        let solid = true
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === ".") solid = false
        if (!solid) continue
        // the eye: the glint plus the dark pixels around it
        const eye: Array<[number, number]> = [[x, y]]
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          if (DARK.includes(at(x + dx, y + dy))) eye.push([x + dx, y + dy])
        }
        if (eye.length < 2 || eye.length > 6 || seen.has(`${x},${y}`)) continue
        // fur colour: the most common neighbour that is neither dark, glint nor empty
        const count = new Map<string, number>()
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const ch = at(x + dx, y + dy)
            if (ch !== "." && ch !== "w" && !DARK.includes(ch)) count.set(ch, (count.get(ch) ?? 0) + 1)
          }
        }
        const fur = [...count.entries()].sort((p, q) => q[1] - p[1])[0]?.[0]
        if (!fur) continue
        const low = Math.max(...eye.map(([, ey]) => ey))
        for (const [ex, ey] of eye) {
          seen.add(`${ex},${ey}`)
          out[ey]![ex] = ey === low && DARK.includes(at(ex, ey)) ? "k" : fur
        }
      }
    }
    return out.map((row) => row.join(""))
  }

  if (pose === "breathe") {
    const legTop = Math.max(first + 2, bottom - 2)
    if (first < 1) return [...base]
    const res = cells.map((row, y) => (y >= legTop ? row.slice() : new Array(SPRITE_SIZE).fill(".")))
    for (let y = first; y < legTop; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const ch = cells[y]![x]!
        if (ch !== "." && y + 1 <= legTop) {
          if (y + 1 < legTop) res[y + 1]![x] = ch
          else if (res[legTop]![x] !== "." || ch !== ".") res[legTop]![x] = ch
        }
      }
    }
    return res.map((row) => row.join(""))
  }

  // ear flick: the top three rows on one half slide a pixel outward
  let left = SPRITE_SIZE
  let right = -1
  for (let y = first; y <= bottom; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      if (cells[y]![x] !== ".") {
        left = Math.min(left, x)
        right = Math.max(right, x)
      }
    }
  }
  const mid = Math.floor((left + right + 1) / 2)
  const dir = pose === "earL" ? -1 : 1
  for (let y = first; y < first + 3 && y < bottom; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const ch = cells[y]![x]!
      if (ch === "." || (dir < 0 ? x >= mid : x < mid)) continue
      out[y]![x] = "."
    }
  }
  for (let y = first; y < first + 3 && y < bottom; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const ch = cells[y]![x]!
      if (ch === "." || (dir < 0 ? x >= mid : x < mid)) continue
      const nx = x + dir
      if (nx >= 0 && nx < SPRITE_SIZE) out[y]![nx] = ch
    }
  }
  void view
  return out.map((row) => row.join(""))
}

export function cachedIdle(key: string, base: readonly string[], view: SpriteView, pose: Exclude<IdlePose, "glance">): string[] {
  const k = `${key}:${view}:${pose}`
  let hit = cache.get(k)
  if (!hit) {
    hit = idleGrid(base, view, pose)
    cache.set(k, hit)
  }
  return hit
}
