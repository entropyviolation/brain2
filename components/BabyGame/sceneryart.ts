/**
 * components/BabyGame/sceneryart.ts — Paints the WFC dressing and the living water
 *
 * `drawScenery` stamps each cell of `lib/baby-game/scenery.ts` in game pixels (reeds, ferns and blooms sway, lilies bob, glowcaps
 * pulse, crystals glint). `paintWater` is a water tile: depth bands from the shore (shallow mint to deep cobalt), foam and a wet
 * edge where it meets land, flowing ripple crescents. `drawFalls` is the Sine Hop cascade: a mossy ledge, a sheet of falling
 * water with streaks, spray and rings where it lands. One light (top left), one ink, cool colours.
 */

import type { Scenery } from "@/lib/baby-game/scenery"
import { MAP_W, T, TILE, tileIndex, type World } from "@/lib/baby-game/world"

type Ctx = CanvasRenderingContext2D

const hh = (x: number, y: number, k = 0) => {
  let t = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0
  t = (t ^ (t >>> 13)) * 1274126177
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}
const px = (c: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  c.fillStyle = color
  c.fillRect(Math.round(x), Math.round(y), w, h)
}

const BLOOM = ["#b9a6ff", "#ff9fd0", "#f4f4ff", "#7fe3ff", "#ffb8e8"]

function bloom(c: Ctx, x: number, y: number, tx: number, ty: number, t: number) {
  for (let i = 0; i < 3; i++) {
    const bx = x + 3 + Math.floor(hh(tx, ty, i) * 10)
    const by = y + 6 + Math.floor(hh(tx, ty, i + 5) * 8)
    const sway = Math.round(Math.sin(t * 1.6 + tx + i) * 0.7)
    const col = BLOOM[Math.floor(hh(tx, ty, i + 9) * BLOOM.length)]!
    px(c, "#1f6a62", bx, by - 2, 1, 4)
    px(c, "#35a58a", bx - 1, by + 1, 1, 1)
    px(c, "#35a58a", bx + 1, by, 1, 1)
    px(c, "#14403f", bx - 1, by - 3 + 1, 3, 1)
    px(c, col, bx - 1 + sway, by - 4, 3, 1)
    px(c, col, bx + sway, by - 5, 1, 3)
    px(c, "#ffffff", bx + sway, by - 4, 1, 1)
  }
}

function fern(c: Ctx, x: number, y: number, tx: number, ty: number, t: number) {
  const bx = x + 8
  const by = y + 14
  for (let i = -2; i <= 2; i++) {
    const len = 7 - Math.abs(i)
    const lean = i * 1.1 + Math.sin(t * 1.3 + tx * 2 + i) * 0.5
    for (let s = 1; s <= len; s++) {
      const fx = bx + lean * s * 0.55 + Math.sign(i) * (s * s) * 0.04
      const fy = by - s * 1.6 + (s > len - 3 ? s * 0.5 : 0)
      px(c, s > len - 2 ? "#a8f0d0" : s % 2 ? "#3fbf9a" : "#2a8f7e", fx, fy, 1, 1)
      if (s > 1 && s < len) px(c, "#1f6a62", fx + (i < 0 ? -1 : 1), fy + 1, 1, 1)
    }
  }
  px(c, "#14403f", bx - 1, by, 3, 1)
}

function stones(c: Ctx, x: number, y: number, tx: number, ty: number) {
  const n = 2 + Math.floor(hh(tx, ty, 1) * 2)
  for (let i = 0; i < n; i++) {
    const sx = x + 2 + Math.floor(hh(tx, ty, i + 2) * 9)
    const sy = y + 6 + Math.floor(hh(tx, ty, i + 6) * 7)
    const w = 3 + Math.floor(hh(tx, ty, i + 10) * 3)
    px(c, "#2d2b52", sx - 1, sy, w + 2, 3)
    px(c, "#2d2b52", sx, sy - 1, w, 1)
    px(c, "#7c7aa8", sx, sy, w, 2)
    px(c, "#a8a6d0", sx, sy - 0, w - 1, 1)
    px(c, "#5a5886", sx + 1, sy + 2, w - 1, 1)
    px(c, "#e0defa", sx, sy, 1, 1)
  }
}

function reed(c: Ctx, x: number, y: number, tx: number, ty: number, t: number) {
  for (let i = 0; i < 3; i++) {
    const bx = x + 3 + i * 4 + Math.floor(hh(tx, ty, i) * 2)
    const h = 10 + Math.floor(hh(tx, ty, i + 3) * 6)
    const sway = Math.sin(t * 1.4 + tx * 0.9 + i * 1.7)
    for (let s = 0; s < h; s++) {
      const dx = Math.round(sway * (s / h) * 2)
      px(c, s < 3 ? "#14403f" : i === 1 ? "#58d0a8" : "#2f9a80", bx + dx, y + 14 - s, 1, 1)
    }
    const hx = bx + Math.round(sway * 2)
    px(c, "#3a2146", hx - 1, y + 14 - h - 3, 3, 4)
    px(c, "#8a5a98", hx - 1, y + 14 - h - 3, 1, 3)
  }
}

function lily(c: Ctx, x: number, y: number, tx: number, ty: number, t: number) {
  const bob = Math.round(Math.sin(t * 1.2 + tx * 1.7 + ty) * 0.6)
  const lx = x + 4 + Math.floor(hh(tx, ty, 1) * 5)
  const ly = y + 5 + Math.floor(hh(tx, ty, 2) * 5) + bob
  // a round pad: ink rim, two greens, a notch cut toward the lower right
  const rows: Array<[number, number]> = [[2, 4], [1, 6], [0, 8], [0, 8], [0, 8], [1, 6], [2, 4]]
  rows.forEach(([o, w], j) => {
    px(c, "#12403f", lx + o - 1, ly + j, w + 2, 1)
    px(c, j < 2 ? "#6ee0b8" : j < 5 ? "#2fb08f" : "#1f8a78", lx + o, ly + j, w, 1)
  })
  px(c, "#a8f0d0", lx + 2, ly + 1, 2, 1)
  px(c, "#2d6fb8", lx + 6, ly + 3, 3, 1)
  px(c, "#12403f", lx + 7, ly + 2, 1, 1)
  if (hh(tx, ty, 4) > 0.5) {
    px(c, "#ffd0ec", lx + 2, ly - 1, 3, 2)
    px(c, "#ff8fc8", lx + 3, ly - 2, 1, 2)
    px(c, "#ffffff", lx + 3, ly - 1, 1, 1)
  }
}

function glowcap(c: Ctx, x: number, y: number, tx: number, ty: number, t: number) {
  const bx = x + 5 + Math.floor(hh(tx, ty, 1) * 5)
  const by = y + 12
  const p = 0.5 + 0.5 * Math.sin(t * 2 + tx + ty * 2)
  c.fillStyle = `rgba(120,255,230,${0.10 + p * 0.12})`
  c.beginPath()
  c.arc(bx + 2, by - 2, 7, 0, Math.PI * 2)
  c.fill()
  px(c, "#e8f4ff", bx + 1, by - 1, 2, 3)
  px(c, "#14403f", bx - 1, by - 4, 6, 1)
  px(c, "#3a2a7a", bx - 2, by - 3, 8, 2)
  px(c, p > 0.5 ? "#7cffe0" : "#4fdcc4", bx - 1, by - 4, 6, 2)
  px(c, "#ffffff", bx, by - 4, 1, 1)
  px(c, "#b4a0ff", bx + 3, by - 3, 1, 1)
}

function crystal(c: Ctx, x: number, y: number, tx: number, ty: number, t: number) {
  const bx = x + 4 + Math.floor(hh(tx, ty, 1) * 6)
  const by = y + 13
  for (const [dx, h, col] of [[0, 8, ["#e9fbff", "#7fe0ff", "#3a8ed0"]], [4, 5, ["#f6e6ff", "#c09cff", "#7a52c8"]], [-3, 4, ["#e9fbff", "#7fe0ff", "#3a8ed0"]]] as const) {
    for (let s = 0; s < h; s++) {
      const w = s > h - 3 ? 1 : 3
      px(c, "#1f2a5a", bx + dx - 1, by - s, w + 2, 1)
      px(c, col[1], bx + dx, by - s, w, 1)
      px(c, col[0], bx + dx, by - s, 1, 1)
      px(c, col[2], bx + dx + w - 1, by - s, 1, 1)
    }
  }
  if (Math.sin(t * 2.5 + tx * 3 + ty) > 0.85) {
    px(c, "#ffffff", bx + 1, by - 9, 1, 3)
    px(c, "#ffffff", bx, by - 8, 3, 1)
  }
}

/** Stamp every dressed cell inside the view. */
export function drawScenery(ctx: Ctx, sc: Scenery, t: number, camX: number, camY: number, w: number, h: number) {
  const tx0 = Math.max(0, Math.floor(camX / TILE) - 1)
  const ty0 = Math.max(0, Math.floor(camY / TILE) - 1)
  for (let ty = ty0; ty <= ty0 + h / TILE + 2; ty++) {
    for (let tx = tx0; tx <= tx0 + w / TILE + 2; tx++) {
      const kind = sc.get(tileIndex(tx, ty))
      if (!kind) continue
      const x = tx * TILE
      const y = ty * TILE
      switch (kind) {
        case "bloom": bloom(ctx, x, y, tx, ty, t); break
        case "fern": fern(ctx, x, y, tx, ty, t); break
        case "stones": stones(ctx, x, y, tx, ty); break
        case "reed": reed(ctx, x, y, tx, ty, t); break
        case "lily": lily(ctx, x, y, tx, ty, t); break
        case "glowcap": glowcap(ctx, x, y, tx, ty, t); break
        case "crystal": crystal(ctx, x, y, tx, ty, t); break
      }
    }
  }
}

// ---- water ----------------------------------------------------------------------------------------------------

const DEPTH = [
  ["#5fd8cc", "#8aeadc", "#3fb8c0"], // shallows
  ["#3fa8d0", "#6cc8ea", "#2f86bc"],
  ["#2f78bc", "#4f9ad8", "#2a5aa0"],
  ["#294f98", "#3d6cb8", "#22407e"], // deep
]

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Steps from each tile to the nearest land (8-way), 0 on land: a breadth-first fill, once per world. */
const fields = new WeakMap<World, Uint8Array>()
function distField(world: World): Uint8Array {
  let d = fields.get(world)
  if (d) return d
  const n = world.tiles.length
  d = new Uint8Array(n).fill(255)
  const queue: number[] = []
  for (let i = 0; i < n; i++) if (world.tiles[i] !== T.WATER) {
    d[i] = 0
    queue.push(i)
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!
    const x = i % MAP_W
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx
      const j = i + dy * MAP_W + dx
      if (nx < 0 || nx >= MAP_W || j < 0 || j >= n || d[j] !== 255) continue
      d[j] = Math.min(9, d[i]! + 1)
      queue.push(j)
    }
  }
  fields.set(world, d)
  return d
}

const layers = new WeakMap<World, Map<number, HTMLCanvasElement>>()
/** The still part of a water tile: depth blended smoothly across tile edges (bilinear between tile centres), banded with a Bayer grain. */
function depthLayer(world: World, tx: number, ty: number): HTMLCanvasElement {
  let m = layers.get(world)
  if (!m) layers.set(world, (m = new Map()))
  const key = ty * MAP_W + tx
  let c = m.get(key)
  if (c) return c
  c = document.createElement("canvas")
  c.width = c.height = TILE
  const g = c.getContext("2d")!
  const f = distField(world)
  const at = (x: number, y: number) => f[Math.max(0, Math.min(MAP_W - 1, x)) + Math.max(0, y) * MAP_W] ?? 0
  for (let py = 0; py < TILE; py++) {
    for (let pxl = 0; pxl < TILE; pxl++) {
      const fx = (pxl + 0.5) / TILE - 0.5
      const fy = (py + 0.5) / TILE - 0.5
      const ox = fx < 0 ? -1 : 1
      const oy = fy < 0 ? -1 : 1
      const ax = Math.abs(fx)
      const ay = Math.abs(fy)
      const d = at(tx, ty) * (1 - ax) * (1 - ay) + at(tx + ox, ty) * ax * (1 - ay) + at(tx, ty + oy) * (1 - ax) * ay + at(tx + ox, ty + oy) * ax * ay
      const v = Math.max(0, Math.min(3, (d - 0.9) * 1.1))
      const band = Math.max(0, Math.min(3, Math.floor(v + (BAYER[(py & 3) * 4 + (pxl & 3)]! / 16 - 0.5) * 0.9 + 0.5)))
      g.fillStyle = DEPTH[band]![0]
      g.fillRect(pxl, py, 1, 1)
    }
  }
  m.set(key, c)
  return c
}

/** A water tile: banded by depth, ripple crescents drifting, foam and a wet edge where land is next to it. */
export function paintWater(ctx: Ctx, world: World, tx: number, ty: number, t: number) {
  const x = tx * TILE
  const y = ty * TILE
  ctx.drawImage(depthLayer(world, tx, ty), x, y)
  const band = Math.min(3, Math.max(0, distField(world)[tx + ty * MAP_W]! - 1))
  const [, hi, lo] = DEPTH[band]!
  // ripples: little crescents that slide across at their own speeds
  for (let k = 0; k < 3; k++) {
    const sp = 0.7 + hh(tx, ty, k) * 0.9
    const cx = (hh(tx, ty, k + 4) * 16 + t * sp * 3) % 16
    const cy = 3 + k * 5 + Math.floor(hh(tx, ty, k + 8) * 2)
    px(ctx, hi, x + cx, y + cy, 4, 1)
    px(ctx, hi, x + cx + 1, y + cy + 1, 2, 1)
    px(ctx, lo, x + (cx + 3) % 16, y + cy + 2, 3, 1)
  }
  // land at the sides: a wet shadow in the water and a bright foam line that breathes
  const w = (dx: number, dy: number) => {
    const o = world.tiles[tileIndex(tx + dx, ty + dy)]
    return o !== T.WATER && o !== T.BRIDGE
  }
  const foam = (xx: number, yy: number, ww: number, hhh: number, ph: number) => {
    px(ctx, "#1c4a7a", xx, yy, ww, hhh)
  }
  void foam
  const breathe = Math.round(Math.sin(t * 1.5 + tx * 0.8 + ty * 0.6) * 0.5 + 0.5)
  if (w(0, -1)) {
    px(ctx, "#1c3f78", x, y, TILE, 2)
    for (let i = 0; i < TILE; i += 2) px(ctx, i % 4 === 0 ? "#ffffff" : "#c8fff4", x + i, y + 2 + ((i + tx) % 3 === 0 ? 1 : 0) + breathe, 2, 1)
  }
  if (w(0, 1)) for (let i = 0; i < TILE; i += 2) px(ctx, i % 4 === 0 ? "#ffffff" : "#c8fff4", x + i, y + 14 - breathe + ((i + tx) % 3 === 0 ? -1 : 0), 2, 1)
  if (w(-1, 0)) {
    px(ctx, "#1c3f78", x, y, 2, TILE)
    for (let j = 0; j < TILE; j += 2) px(ctx, j % 4 === 0 ? "#ffffff" : "#c8fff4", x + 2 + breathe + ((j + ty) % 3 === 0 ? 1 : 0), y + j, 1, 2)
  }
  if (w(1, 0)) for (let j = 0; j < TILE; j += 2) px(ctx, j % 4 === 0 ? "#ffffff" : "#c8fff4", x + 13 - breathe - ((j + ty) % 3 === 0 ? 1 : 0), y + j, 1, 2)
  // a glint now and then
  if (Math.sin(t * 1.7 + tx * 2.3 + ty * 1.3) > 0.9) px(ctx, "#ffffff", x + 4 + ((tx * 7 + ty * 3) % 8), y + 6 + ((tx + ty) % 5), 2, 1)
}

// ---- the falls --------------------------------------------------------------------------------------------------

/** Sine Hop: a mossy ledge with a sheet of water pouring into the pond below it. `x, y` is the station tile (the ledge), the sheet falls over the water under it. */
export function drawFalls(ctx: Ctx, x: number, y: number, t: number) {
  // the ledge: layered slate with moss on top and a dark lip
  px(ctx, "#1f1d42", x - 3, y + 4, 22, 12)
  px(ctx, "#5a5886", x - 2, y + 5, 20, 10)
  px(ctx, "#7c7aa8", x - 2, y + 5, 14, 4)
  px(ctx, "#a8a6d0", x - 1, y + 5, 7, 1)
  px(ctx, "#3a3866", x + 1, y + 11, 15, 3)
  px(ctx, "#1f1d42", x + 3, y + 8, 1, 6)
  px(ctx, "#1f1d42", x + 10, y + 7, 1, 7)
  px(ctx, "#35a58a", x - 3, y + 2, 22, 3)
  px(ctx, "#6ee0b8", x - 2, y + 1, 10, 2)
  px(ctx, "#a8f0d0", x, y + 1, 4, 1)
  px(ctx, "#1f6a62", x + 12, y + 3, 6, 1)
  // the sheet falls from the lip over the water: shaded edges, streaks that run down and wrap
  const top = y + 14
  const len = 16
  for (let j = 0; j < len; j++) {
    px(ctx, "#2f78bc", x + 2, top + j, 12, 1)
    px(ctx, "#6cc8ea", x + 3, top + j, 10, 1)
    px(ctx, "#c8fff4", x + 4, top + j, 4, 1)
    px(ctx, "#ffffff", x + 4, top + j, 1, 1)
    px(ctx, "#1c3f78", x + 2, top + j, 1, 1)
    px(ctx, "#1c3f78", x + 13, top + j, 1, 1)
  }
  for (let k = 0; k < 5; k++) {
    const sx = x + 4 + k * 2
    const off = Math.floor(t * 22 + k * 5) % len
    px(ctx, "#ffffff", sx, top + off, 1, 4)
    px(ctx, "#ffffff", sx, top + (off + 8) % len, 1, 3)
  }
  // spray, foam and rings where it lands
  const land = top + len
  for (let i = 0; i < 6; i++) {
    const ph = (t * 3 + i * 0.37) % 1
    const sxp = x + 2 + i * 2 + Math.sin(i * 2.1) * 2
    px(ctx, "#ffffff", sxp + (i % 2 ? ph * 6 : -ph * 6), land - 2 - Math.sin(ph * Math.PI) * 7, 1, 1)
  }
  for (let r = 0; r < 2; r++) {
    const ph = (t * 0.9 + r * 0.5) % 1
    const rx = 3 + ph * 10
    ctx.fillStyle = "rgba(220,255,250,0.85)"
    ctx.fillRect(Math.round(x + 8 - rx), Math.round(land + 1 + ph * 3), Math.max(1, Math.round(rx * 2)), 1)
  }
  px(ctx, "#ffffff", x + 2, land - 1, 12, 2)
  px(ctx, "#c8fff4", x, land, 16, 1)
  // mist in the air above the sheet
  const m = 0.14 + Math.sin(t * 1.6) * 0.05
  ctx.fillStyle = `rgba(220,255,250,${m})`
  ctx.fillRect(x - 2, land - 6, 20, 6)
}
