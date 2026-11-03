/**
 * components/BabyGame/casa-kit.ts — the painter's kit for the cottage: pixels, materials, palettes, shared pieces
 *
 * Small pure helpers drawn on a 2D context (`px`, `disc`, `plaster`, `wood`, `parquet`, glass, arches, stairs) shared by
 * `casa-paint.ts` (the three first floors and the frame) and `casa-rooms.ts` (the rooms off them). Plaster is cream with a seafoam
 * shade and a crackle of cracks; wood is honey; glass is blue, teal, green and white; metal is silver, never gold.
 */

import { CEIL, CT } from "@/lib/baby-game/casa"
import { bayerAt } from "./dither"

export type Ctx = CanvasRenderingContext2D

export const px = (ctx: Ctx, c: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}
export const h2 = (x: number, y: number, k = 0) => {
  let t = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0
  t = (t ^ (t >>> 13)) * 1274126177
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const rgb = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] as const
export const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  const f = (u: number, v: number) => Math.round(u + (v - u) * t).toString(16).padStart(2, "0")
  return `#${f(r1, r2)}${f(g1, g2)}${f(b1, b2)}`
}

export function disc(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string | ((x: number, y: number) => string)) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) px(ctx, typeof color === "string" ? color : color(x, y), x, y)
    }
  }
}

// ─── palette ────────────────────────────────────────────────────────────────

export const PLASTER = ["#a9c7c6", "#bfd8d3", "#d4e7e0", "#e6f2ec", "#f6fbf7"]
export const WOOD = { hi: "#efc690", lite: "#e2ac74", mid: "#cb9058", deep: "#a26e42", dark: "#6f4630" }
export const STONE = { hi: "#fbfdfb", lite: "#e8f0ec", mid: "#cddcd8", shade: "#a9bfbf" }
export const SILVER = { hi: "#f3f7fc", mid: "#cfd8e6", deep: "#8e9ab4" }
export const LEAD = "#7e9bb8"
export const GLASS = ["#f4faf8", "#d4eef4", "#9fd3f0", "#6fb4e8", "#4f8fd8", "#5fc2b8", "#8fdcc8", "#b8e4c8", "#b9b8f0"]
export const GLASS_W = [3, 2, 3, 3, 2, 3, 3, 2, 0.4]
export const glassAt = (a: number, b: number, k = 0) => {
  const total = GLASS_W.reduce((p, q) => p + q, 0)
  let r = h2(a, b, k) * total
  for (let i = 0; i < GLASS.length; i++) {
    r -= GLASS_W[i]!
    if (r <= 0) return i
  }
  return 0
}

// ─── materials ──────────────────────────────────────────────────────────────

/** Cream plaster in five dithered steps, with the fine crackle the walls of the house have everywhere. */
export function plaster(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, light: (x: number, y: number) => number, pal: readonly string[] = PLASTER) {
  const cell = 12
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = clamp(Math.round(light(x, y) * 4 + bayerAt(x, y) - 0.5), 0, 4)
      // crackle: a pixel is a crack where it sits nearly as close to a second cell centre as to the first
      const cx = Math.floor(x / cell)
      const cy = Math.floor(y / cell)
      let d1 = 1e9
      let d2 = 1e9
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const fx = (cx + ox + 0.2 + h2(cx + ox, cy + oy, 1) * 0.6) * cell
          const fy = (cy + oy + 0.2 + h2(cx + ox, cy + oy, 2) * 0.6) * cell
          const d = Math.hypot(x - fx, y - fy)
          if (d < d1) {
            d2 = d1
            d1 = d
          } else if (d < d2) d2 = d
        }
      }
      px(ctx, pal[d2 - d1 < 0.9 ? Math.max(0, i - 1) : i]!, x, y)
    }
  }
}

/** How lit the wall is at a pixel: a soft swirl round (cx, cy), dark in the ceiling's corners and at the room's edges. */
export const wallLight = (cx: number, cy: number, W: number) => (x: number, y: number) => {
  const edge = Math.max(0, (28 - Math.min(x, W - x)) / 28) ** 2
  const ceil = Math.max(0, (46 - (y + CEIL * CT)) / 46) ** 1.5
  const foot = y > 104 ? ((y - 104) / 24) * 0.4 : 0
  return clamp(0.72 + 0.09 * Math.sin(x * 0.035 + 1.2 * Math.sin(y * 0.04)) + 0.11 * Math.sin(Math.hypot(x - cx, (y - cy) * 1.5) * 0.14) - 0.34 * ceil - 0.3 * edge - foot, 0, 1)
}

export function wood(ctx: Ctx, x: number, y: number, w: number, h: number, seed = 0) {
  px(ctx, WOOD.mid, x, y, w, h)
  for (let j = 1; j < h; j += 3) {
    for (let i = 0; i < w; i++) {
      const r = h2(Math.floor((x + i) / 9), y + j, seed)
      if (r < 0.34) px(ctx, WOOD.lite, x + i, y + j)
      else if (r > 0.78) px(ctx, WOOD.deep, x + i, y + j)
    }
  }
  px(ctx, WOOD.hi, x, y, w, 1)
  px(ctx, WOOD.deep, x, y + h - 1, w, 1)
}

/** Honey herringbone: planks in zigzag rows, each a shade of its own, seams soft, a gloss that fades toward you. */
export function parquet(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  const cols = ["#e0a870", "#d79d62", "#e8b47c", "#cf9358", "#dba46a"]
  for (let y = y0; y < y1; y++) {
    const gloss = clamp(1 - (y - y0) / 70, 0, 1) * 0.22
    for (let x = x0; x < x1; x++) {
      const zig = Math.abs((x % 16) - 8)
      const v = y + zig
      const row = Math.floor(v / 6)
      const seam = v % 6 === 0 || x % 16 === 0
      let c = seam ? "#b9804e" : cols[Math.floor(h2(Math.floor(x / 16), row, 3) * 5)]!
      if (!seam && (x + y) % 5 === 0 && h2(x, y, 9) > 0.7) c = mix(c, "#a8703e", 0.35)
      px(ctx, gloss > 0.01 ? mix(c, "#fff6ea", gloss) : c, x, y)
    }
  }
}

// ─── the world outside the windows ──────────────────────────────────────────

export const TREES = Array.from({ length: 16 }, (_, i) => ({ x: 70 + i * 24 + h2(i, 1) * 14, y: 100 + h2(i, 2) * 8, r: 12 + h2(i, 3) * 9, c: ["#7fc08a", "#5fa878", "#8fd0a0", "#6fb890"][i % 4]! }))
export const CLOUDS = [[150, 70, 24, 5], [250, 62, 30, 6], [335, 80, 20, 4], [90, 76, 18, 4]] as const

/** The meadow seen through the bay: pale sky, soft clouds, a row of round trees and lawn. */
export function view(x: number, y: number): string {
  if (y > 112 + Math.round(2 * Math.sin(x * 0.08))) return (x + y) % 7 === 0 ? "#9fd8a8" : "#b4e4b4"
  for (const t of TREES) {
    const d = (x - t.x) ** 2 + ((y - t.y) * 1.1) ** 2
    if (d < t.r * t.r) return d < (t.r * 0.45) ** 2 && x < t.x ? mix(t.c, "#ffffff", 0.3) : t.c
  }
  for (const [cx, cy, rx, ry] of CLOUDS) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) return y > cy + 1 ? "#e6f2f8" : "#ffffff"
  return mix("#8ec8ee", "#e2f3f8", clamp((y - 40) / 72, 0, 1))
}
export function paintView(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, skip?: (x: number, y: number) => boolean) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!skip?.(x, y)) px(ctx, view(x, y), x, y)
}

// ─── shared pieces ──────────────────────────────────────────────────────────

/** A glass disc held in lead, with a swirl in it and a spark of light. */
export function glassDisc(ctx: Ctx, cx: number, cy: number, r: number, i: number) {
  const base = GLASS[i]!
  disc(ctx, cx, cy, r, r, (x, y) => (Math.hypot(x - cx, y - cy) > r - 1 ? LEAD : (Math.floor((Math.atan2(y - cy, x - cx) + Math.PI) * 1.6 + Math.hypot(x - cx, y - cy) * 0.7) & 1 ? mix(base, "#ffffff", 0.22) : base)))
  px(ctx, "#ffffff", cx - r * 0.5, cy - r * 0.55, 1, 1)
}

/** A wide arch ring of plaster standing out of the wall: lit on its left, shaded on its right. */
export function archRing(ctx: Ctx, cx: number, cy: number, r0: number, r1: number, baseY: number) {
  for (let y = Math.floor(cy - r1); y < baseY; y++) {
    for (let x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x++) {
      const d = y < cy ? Math.hypot(x - cx, y - cy) : Math.abs(x - cx)
      if (d < r0 || d > r1) continue
      const t = (d - r0) / (r1 - r0)
      const left = x < cx
      px(ctx, PLASTER[clamp(Math.round(4 - t * 2 - (left ? 0 : 1.4) + (bayerAt(x, y) - 0.5)), 0, 4)]!, x, y)
    }
  }
}

/** A tall arched wooden door with leaf-shaped panels and an oval of glass, as on the stair landings. */
export function archDoor(ctx: Ctx, x: number, y: number, w: number, h: number, seed = 0) {
  const top = (px0: number) => y + Math.round((w / 2) * 0.55 * (1 - Math.sqrt(Math.max(0, 1 - ((px0 - x - w / 2) / (w / 2)) ** 2))))
  for (let i = 0; i < w; i++) {
    const t = top(x + i)
    wood(ctx, x + i, t, 1, y + h - t, seed)
  }
  wood(ctx, x, y + Math.round(h * 0.45), w, 3, seed + 1)
  // transom of glass discs
  for (let k = 0; k < 3; k++) glassDisc(ctx, x + w * (0.25 + 0.25 * k), y + Math.round(h * 0.2) + (k === 1 ? -3 : 0), 4, glassAt(k, seed, 8))
  // leaf panels
  for (const [lx, ly, lw, lh] of [[x + 4, y + Math.round(h * 0.5), w / 2 - 6, Math.round(h * 0.36)], [x + w / 2 + 2, y + Math.round(h * 0.5), w / 2 - 6, Math.round(h * 0.36)]] as const) {
    disc(ctx, lx + lw / 2, ly + lh / 2, lw / 2, lh / 2, (px0, py0) => (px0 < lx + lw / 2 && py0 < ly + lh / 2 ? WOOD.lite : WOOD.deep))
    disc(ctx, lx + lw / 2, ly + lh / 2, lw / 2 - 2, lh / 2 - 2, (px0, py0) => (px0 < lx + lw / 2 ? WOOD.hi : WOOD.mid))
  }
  px(ctx, SILVER.mid, x + w / 2 + 3, y + Math.round(h * 0.62), 2, 3)
  px(ctx, WOOD.dark, x, y + h - 1, w, 1)
}

/** A silver-and-white iron stair rail with a honey handrail, running from (x0, y0) up to (x1, y1) on posts. */
export function stairRail(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, posts: number) {
  for (let i = 0; i <= posts * 4; i++) {
    const t = i / (posts * 4)
    const x = x0 + (x1 - x0) * t
    const y = y0 + (y1 - y0) * t - 22
    px(ctx, WOOD.lite, x, y, 1, 2)
    px(ctx, WOOD.hi, x, y - 1)
    px(ctx, WOOD.deep, x, y + 2)
    const wave = Math.sin(i * 1.1) * 2.2
    px(ctx, "#f6fbfb", x + wave, y + 4 + (i % 4) * 3, 1, 3)
    if (i % 4 === 2) px(ctx, "#cfe0e4", x - 1, y + 7, 3, 1)
  }
  for (let i = 0; i <= posts; i++) {
    const x = x0 + ((x1 - x0) * i) / posts
    const y = y0 + ((y1 - y0) * i) / posts
    px(ctx, "#eef6f6", x, y - 21, 2, 21)
    px(ctx, "#cfe0e4", x + 1, y - 21, 1, 21)
  }
}

/** A flight of marble steps climbing up and to the right, riser tiled blue and white. `gy` is the floor it stands on. */
export function stairFlight(ctx: Ctx, x0: number, gy: number, steps: number, run: number, rise: number) {
  const edge = x0 + steps * run
  for (let i = 0; i < steps; i++) {
    const sx = x0 + i * run
    const top = gy - (i + 1) * rise
    const w = i === steps - 1 ? 512 : run
    for (let y = top; y < gy; y++) {
      for (let x = sx; x < sx + w && x < sx + 400; x++) {
        let c: string
        if (y < top + 2) c = STONE.hi
        else if (y === top + 2) c = STONE.mid
        else if (y === top + 3) c = "#7f9fb0"
        else {
          // tile, lighter on the riser and in shade below it, so every step reads as a step
          const d = (Math.floor((x + y) / 4) + Math.floor((x - y + 600) / 4)) % 2
          const under = y >= top + rise
          c = d ? (under ? "#86b0d4" : "#a8d2ee") : under ? "#cfe0ea" : "#f0f7fb"
          if (x === sx && !under) c = "#7f9fb0"
        }
        px(ctx, c, x, y)
      }
    }
  }
  void edge
}
