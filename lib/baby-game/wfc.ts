/**
 * lib/baby-game/wfc.ts — Wave Function Collapse, the simple tiled model
 *
 * After mxgmn/WaveFunctionCollapse. Every cell starts able to be any tile; the cell with the fewest options (by weighted
 * entropy, plus a seeded nudge to break ties) picks one by weight, and the choice is propagated to its neighbours until
 * no more options can be removed. A contradiction restarts with the next seed, so `solveWfc` is pure: the same rules,
 * size, seed and pins give the same grid. Rules come from `adjacencyFromSample` (learn what may sit beside what from a
 * small hand-made picture, the point of the method) or are written by hand. The game uses it in `scenery.ts`.
 */

export type Dir = 0 | 1 | 2 | 3 // up, right, down, left
const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]

export type WfcRules = {
  tiles: string[]
  /** Relative chance of each tile; missing is 1. */
  weights?: Record<string, number>
  /** `allow[dir][a]` is the set of tiles that may sit on side `dir` of tile `a`. */
  allow: Array<Map<string, Set<string>>>
}

/** Learn the rules from example rows (each character is a tile): what is beside what in the sample may be beside it in the output. Weights are how often a tile appears. */
export function adjacencyFromSample(rows: string[]): WfcRules {
  const tiles = [...new Set(rows.join(""))]
  const weights: Record<string, number> = {}
  const allow: WfcRules["allow"] = [0, 1, 2, 3].map(() => new Map(tiles.map((t) => [t, new Set<string>()])))
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const a = row[x]!
      weights[a] = (weights[a] ?? 0) + 1
      for (const d of [0, 1, 2, 3] as const) {
        const b = rows[y + DY[d]!]?.[x + DX[d]!]
        if (b) allow[d]!.get(a)!.add(b)
      }
    }
  })
  return { tiles, weights, allow }
}

/** Symmetric rules written as pairs: `["a","b"]` lets a and b sit side by side in either order and either direction; `["a","a"]` lets a repeat. */
export function adjacencyFromPairs(tiles: string[], pairs: Array<[string, string]>, weights: Record<string, number> = {}): WfcRules {
  const allow: WfcRules["allow"] = [0, 1, 2, 3].map(() => new Map(tiles.map((t) => [t, new Set<string>()])))
  for (const [a, b] of pairs) for (const d of [0, 1, 2, 3]) {
    allow[d]!.get(a)!.add(b)
    allow[d]!.get(b)!.add(a)
  }
  return { tiles, weights, allow }
}

/** A small seeded generator (mulberry32), so a solve is repeatable. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type WfcOptions = {
  seed?: number
  /** Cells whose options are limited before the solve: index `y * w + x` to the tiles it may be. A cell pinned to one tile is a fixed tile. */
  pins?: Map<number, string[]>
  /** Whole solves to try, each with its own seed, before giving up. */
  attempts?: number
}

/** One attempt. Returns the grid of tile names, or null on a contradiction. */
function attempt(rules: WfcRules, w: number, h: number, rand: () => number, pins?: Map<number, string[]>): string[] | null {
  const n = rules.tiles.length
  const idx = new Map(rules.tiles.map((t, i) => [t, i]))
  const wt = rules.tiles.map((t) => rules.weights?.[t] ?? 1)
  // compatible[d][a] = bitless list of tile indices allowed on side d of a
  const comp = [0, 1, 2, 3].map((d) => rules.tiles.map((t) => [...(rules.allow[d]!.get(t) ?? [])].map((b) => idx.get(b)!).filter((b) => b !== undefined)))
  const cells = Array.from({ length: w * h }, () => new Uint8Array(n).fill(1))
  const count = new Int32Array(w * h).fill(n)

  const ban = (c: number, t: number, stack: number[]) => {
    if (!cells[c]![t]) return
    cells[c]![t] = 0
    count[c]!--
    stack.push(c)
  }
  const propagate = (stack: number[]): boolean => {
    while (stack.length) {
      const c = stack.pop()!
      if (count[c] === 0) return false
      const cx = c % w
      const cy = (c - cx) / w
      for (const d of [0, 1, 2, 3] as const) {
        const nx = cx + DX[d]!
        const ny = cy + DY[d]!
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const nc = ny * w + nx
        // a tile in the neighbour survives only if some tile still possible here allows it on that side
        const ok = new Uint8Array(n)
        for (let a = 0; a < n; a++) if (cells[c]![a]) for (const b of comp[d]![a]!) ok[b] = 1
        for (let b = 0; b < n; b++) if (cells[nc]![b] && !ok[b]) ban(nc, b, stack)
      }
    }
    return true
  }

  const first: number[] = []
  if (pins) {
    for (const [c, allowed] of pins) {
      const ok = new Set(allowed.map((t) => idx.get(t)).filter((i): i is number => i !== undefined))
      for (let t = 0; t < n; t++) if (!ok.has(t)) ban(c, t, first)
    }
    if (!propagate(first)) return null
  }

  for (;;) {
    // the undecided cell with the least entropy
    let best = -1
    let bestE = Infinity
    for (let c = 0; c < w * h; c++) {
      if (count[c]! <= 1) continue
      let sum = 0
      let sumLog = 0
      for (let t = 0; t < n; t++) if (cells[c]![t]) {
        sum += wt[t]!
        sumLog += wt[t]! * Math.log(wt[t]!)
      }
      const e = Math.log(sum) - sumLog / sum + rand() * 1e-4
      if (e < bestE) {
        bestE = e
        best = c
      }
    }
    if (best < 0) break
    let sum = 0
    for (let t = 0; t < n; t++) if (cells[best]![t]) sum += wt[t]!
    let roll = rand() * sum
    let pick = -1
    for (let t = 0; t < n; t++) if (cells[best]![t]) {
      pick = t
      roll -= wt[t]!
      if (roll <= 0) break
    }
    const stack: number[] = []
    for (let t = 0; t < n; t++) if (t !== pick) ban(best, t, stack)
    if (!propagate(stack)) return null
  }
  return Array.from({ length: w * h }, (_, c) => {
    const t = cells[c]!.findIndex((v) => v === 1)
    return rules.tiles[t]!
  })
}

/** Solve a `w`×`h` grid, row by row. Null when every attempt hit a contradiction (loosen the pins or the rules). */
export function solveWfc(rules: WfcRules, w: number, h: number, opts: WfcOptions = {}): string[] | null {
  const base = opts.seed ?? 1
  for (let i = 0; i < (opts.attempts ?? 12); i++) {
    const grid = attempt(rules, w, h, rng(base * 7919 + i * 104729), opts.pins)
    if (grid) return grid
  }
  return null
}
