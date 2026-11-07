/**
 * components/BabyGame/slimeart.ts — paints the slime mold's body over the ground
 *
 * Each cell of `lib/baby-game/slime.ts` is a 32×32 patch. A patch is painted once per (cell, mass level, which sides
 * join a neighbour) and cached: a lavender film, then a pink vein network that runs from its middle to every joined
 * side, with twigs, curls and a tip that reaches out where it has nothing beside it. The veins of two patches meet
 * at the middle of their shared edge, so the body reads as one thing. On top, live: pulses that stream outward from
 * the hearts, a bright tangle at each heart, and spores that drift up. The palette is the lab picture's: dusk lavender,
 * rose, a pale blush at the core. No yellow.
 */

import { CELL, CW, cellCentre, cellX, cellY, type SlimeState } from "@/lib/baby-game/slime"
import { TILE } from "@/lib/baby-game/world"

const SIZE = CELL * TILE
const LEVELS = 8

const PAL = {
  film: "rgba(168,146,232,0.42)",
  filmIn: "rgba(224,170,232,0.5)",
  rim: "#7a52b0",
  vein: "#c46ac0",
  body: "#f08cc8",
  core: "#ffc8e2",
  hot: "#fff0f6",
}

const hash = (a: number, b = 0, c = 0) => {
  let v = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0
  v = Math.imul(v ^ (v >>> 13), 1274126177)
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296
}

type Pt = [number, number]
type Patch = { canvas: HTMLCanvasElement; mains: Pt[][] }
const cache = new Map<string, Patch>()

/** A wiggling path from a to b, the same each time for the same seed. */
function wander(a: Pt, b: Pt, seed: number, wob: number): Pt[] {
  const out: Pt[] = [a]
  const n = 6
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  for (let i = 1; i < n; i++) {
    const u = i / n
    const off = (hash(seed, i, 3) - 0.5) * 2 * wob * Math.sin(Math.PI * u)
    out.push([a[0] + dx * u + (-dy / len) * off, a[1] + dy * u + (dx / len) * off])
  }
  out.push(b)
  return out
}

function line(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, w: number) {
  ctx.fillStyle = color
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!
    const [x1, y1] = pts[i]!
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps)
      const y = Math.round(y0 + ((y1 - y0) * s) / steps)
      ctx.fillRect(x - Math.floor((w - 1) / 2), y - Math.floor((w - 1) / 2), w, w)
    }
  }
}

const SIDES: Pt[] = [[SIZE / 2, 0], [SIZE, SIZE / 2], [SIZE / 2, SIZE], [0, SIZE / 2]]

function paint(cell: number, level: number, mask: number): Patch {
  const m = level / LEVELS
  const c = document.createElement("canvas")
  c.width = SIZE
  c.height = SIZE
  const ctx = c.getContext("2d")!
  const mid: Pt = [SIZE / 2, SIZE / 2]
  const seed = cell * 7 + 1
  const mains: Pt[][] = []

  // the film: a ragged disc, joined by a corridor to every neighbour
  const r0 = 3 + 11 * m
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = hash(cell + x * 31, y * 17, 1)
      let inside = Math.hypot(x - mid[0], y - mid[1]) < r0 + (n - 0.5) * 5
      if (!inside) {
        for (let k = 0; k < 4; k++) {
          if (!(mask & (1 << k))) continue
          const [sx, sy] = SIDES[k]!
          const along = k % 2 === 0 ? Math.abs(x - sx) : Math.abs(y - sy)
          const toward = k % 2 === 0 ? (k === 0 ? y < SIZE / 2 : y > SIZE / 2) : k === 1 ? x > SIZE / 2 : x < SIZE / 2
          if (toward && along < 1.5 + 5 * m + (n - 0.5) * 3) inside = true
        }
      }
      if (!inside) continue
      const deep = Math.hypot(x - mid[0], y - mid[1]) < r0 * 0.6
      if (!deep && (x + y) % 2) continue
      ctx.fillStyle = deep ? PAL.filmIn : PAL.film
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const w = m > 0.72 ? 3 : m > 0.38 ? 2 : 1
  const draw = (pts: Pt[], width: number) => {
    line(ctx, pts, PAL.rim, width + 2)
    line(ctx, pts, PAL.vein, width + 1)
    line(ctx, pts, PAL.body, width)
    if (width >= 2) line(ctx, pts, m > 0.85 ? PAL.hot : PAL.core, width - 1)
  }

  // the roads to joined sides, with twigs
  for (let k = 0; k < 4; k++) {
    if (!(mask & (1 << k))) continue
    const path = wander(mid, SIDES[k]!, seed + k, 5)
    mains.push(path)
    draw(path, w)
    const twigs = Math.floor(m * 3.2)
    for (let t = 0; t < twigs; t++) {
      const at = path[1 + Math.floor(hash(seed, k, t) * (path.length - 2))]!
      const ang = hash(seed + 5, k, t) * Math.PI * 2
      const len = 4 + hash(seed + 9, k, t) * 8 * m
      draw(wander(at, [at[0] + Math.cos(ang) * len, at[1] + Math.sin(ang) * len], seed + k * 13 + t, 2), 1)
    }
  }

  // a tip reaching out where nothing joins, and curls at the middle of a thick patch
  for (let k = 0; k < 4; k++) {
    if (mask & (1 << k)) continue
    if (hash(seed, k, 8) > 0.3 + m * 0.7) continue
    const len = 3 + m * 11 * (0.5 + hash(seed, k, 9))
    const tip: Pt = [mid[0] + (SIDES[k]![0] - mid[0]) * (len / (SIZE / 2)), mid[1] + (SIDES[k]![1] - mid[1]) * (len / (SIZE / 2))]
    draw(wander(mid, tip, seed + k * 3, 3), Math.max(1, w - 1))
  }
  if (m > 0.55) {
    for (let k = 0; k < 2 + Math.floor(m * 3); k++) {
      const a0 = hash(seed, k, 21) * 6.28
      const rr = 3 + hash(seed, k, 22) * 8
      const curl: Pt[] = []
      for (let i = 0; i < 12; i++) {
        const a = a0 + i * 0.55
        const r = rr * (1 - i / 16)
        curl.push([mid[0] + Math.cos(a) * r, mid[1] + Math.sin(a) * r])
      }
      draw(curl, 1)
    }
  }
  return { canvas: c, mains }
}

const patchFor = (cell: number, mass: number, mask: number): Patch => {
  const level = Math.max(1, Math.min(LEVELS, Math.ceil(mass * LEVELS)))
  const key = `${cell}:${level}:${mask}`
  let p = cache.get(key)
  if (!p) {
    if (cache.size > 1800) cache.clear()
    p = paint(cell, level, mask)
    cache.set(key, p)
  }
  return p
}

const along = (pts: Pt[], u: number): Pt => {
  const f = Math.max(0, Math.min(0.999, u)) * (pts.length - 1)
  const i = Math.floor(f)
  const a = pts[i]!
  const b = pts[i + 1]!
  const r = f - i
  return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]
}

const near = (s: SlimeState, i: number) => (s.mass[i] ?? 0) > 0.04

/** The cells in view, with their mass, for the glow and the pulses. */
function visible(s: SlimeState, camX: number, camY: number, viewW: number, viewH: number) {
  const out: Array<{ i: number; m: number; x: number; y: number }> = []
  const cx0 = Math.max(0, Math.floor(camX / SIZE))
  const cx1 = Math.floor((camX + viewW) / SIZE)
  const cy0 = Math.max(0, Math.floor(camY / SIZE))
  const cy1 = Math.floor((camY + viewH) / SIZE)
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const i = cy * CW + cx
      const m = s.mass[i]
      if (m !== undefined && m > 0.04) out.push({ i, m, x: cx * SIZE, y: cy * SIZE })
    }
  }
  return out
}

const heartDist = (i: number, hearts: number[]) => {
  let d = 99
  for (const h of hearts) d = Math.min(d, Math.abs(cellX(i) - cellX(h)) + Math.abs(cellY(i) - cellY(h)))
  return d
}

/** Draw the slime over the ground. The caller has translated by the camera. */
export function drawSlime(ctx: CanvasRenderingContext2D, s: SlimeState, t: number, camX: number, camY: number, viewW: number, viewH: number) {
  const cells = visible(s, camX, camY, viewW, viewH)
  if (!cells.length) return
  for (const c of cells) {
    const mask = (near(s, c.i - CW) ? 1 : 0) | (near(s, c.i + 1) ? 2 : 0) | (near(s, c.i + CW) ? 4 : 0) | (near(s, c.i - 1) ? 8 : 0)
    ctx.drawImage(patchFor(c.i, c.m, mask).canvas, c.x, c.y)
  }
  // pulses stream outward from the hearts along the roads, a slow breath of light
  for (const c of cells) {
    const mask = (near(s, c.i - CW) ? 1 : 0) | (near(s, c.i + 1) ? 2 : 0) | (near(s, c.i + CW) ? 4 : 0) | (near(s, c.i - 1) ? 8 : 0)
    const p = patchFor(c.i, c.m, mask)
    const hd = heartDist(c.i, s.hearts)
    p.mains.forEach((path, k) => {
      const u = (((t * 0.32 - hd * 0.21 - k * 0.07) % 1) + 1) % 1
      const [x, y] = along(path, u)
      ctx.fillStyle = "rgba(255,225,240,0.85)"
      ctx.fillRect(Math.round(c.x + x) - 1, Math.round(c.y + y) - 1, 2, 2)
      ctx.fillStyle = PAL.hot
      ctx.fillRect(Math.round(c.x + x), Math.round(c.y + y), 1, 1)
    })
    // a spore lifts off the thick places
    if (c.m > 0.55) {
      const ph = (t * 0.25 + hash(c.i, 1, 2)) % 1
      const sx = c.x + 4 + hash(c.i, 2, 3) * (SIZE - 8) + Math.sin(t + c.i) * 2
      const sy = c.y + SIZE - ph * (SIZE + 10)
      ctx.fillStyle = `rgba(255,170,215,${(1 - ph) * 0.85})`
      ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1)
    }
  }
  // each heart: a bright tangle that breathes
  for (const h of s.hearts) {
    const p = cellCentre(h)
    if (p.x < camX - 24 || p.x > camX + viewW + 24 || p.y < camY - 24 || p.y > camY + viewH + 24) continue
    const breath = 1 + Math.sin(t * 1.6 + h) * 0.12
    const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 22 * breath)
    g.addColorStop(0, "rgba(255,240,248,0.85)")
    g.addColorStop(0.4, "rgba(255,150,210,0.4)")
    g.addColorStop(1, "rgba(255,150,210,0)")
    ctx.fillStyle = g
    ctx.fillRect(p.x - 24, p.y - 24, 48, 48)
    for (let k = 0; k < 9; k++) {
      const a = hash(h, k, 4) * 6.28 + Math.sin(t * 0.7 + k) * 0.35
      const r = (4 + hash(h, k, 5) * 10) * breath
      const x = Math.round(p.x + Math.cos(a) * r)
      const y = Math.round(p.y + Math.sin(a) * r * 0.7)
      ctx.fillStyle = k % 3 === 0 ? PAL.hot : k % 3 === 1 ? PAL.core : PAL.body
      ctx.fillRect(x, y, 2, 1)
    }
  }
}

/** The brightest thick patches in view, as lights for the night veil. */
export function slimeLights(s: SlimeState, camX: number, camY: number, viewW: number, viewH: number): Array<{ x: number; y: number; r: number; power: number }> {
  return visible(s, camX, camY, viewW, viewH)
    .filter((c) => c.m > 0.5)
    .sort((a, b) => b.m - a.m)
    .slice(0, 12)
    .map((c) => ({ x: c.x + SIZE / 2 - camX, y: c.y + SIZE / 2 - camY, r: 14 + c.m * 12, power: 0.25 + c.m * 0.35 }))
}
