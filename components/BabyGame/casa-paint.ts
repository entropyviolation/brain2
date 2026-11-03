/**
 * components/BabyGame/casa-paint.ts — paints the inside of the cottage: Hall, Noble Floor, Loft
 *
 * After Casa Batlló. Every room is painted once into a canvas (`floorCanvas`); a frame copies the camera's slice, stands the
 * columns, plants, bed and lamp and the two walkers sorted by their feet, then lays the night over it. Plaster is cream with a
 * seafoam shade and a crackle of fine cracks; wood is honey; glass is blue, teal, green and white; metal is silver, never gold.
 * The rules, the plan and the walking are `lib/baby-game/casa.ts`.
 */

import { CT, floorOf, type FloorId, type Walker } from "@/lib/baby-game/casa"
import { bayerAt } from "./dither"
import { drawSprite, spriteCanvas, strideFrame, VIEW_H, VIEW_W } from "./render"

type Ctx = CanvasRenderingContext2D

const px = (ctx: Ctx, c: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}
const h2 = (x: number, y: number, k = 0) => {
  let t = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0
  t = (t ^ (t >>> 13)) * 1274126177
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const rgb = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] as const
const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  const f = (u: number, v: number) => Math.round(u + (v - u) * t).toString(16).padStart(2, "0")
  return `#${f(r1, r2)}${f(g1, g2)}${f(b1, b2)}`
}

function disc(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string | ((x: number, y: number) => string)) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) px(ctx, typeof color === "string" ? color : color(x, y), x, y)
    }
  }
}

// ─── palette ────────────────────────────────────────────────────────────────

const PLASTER = ["#a9c7c6", "#bfd8d3", "#d4e7e0", "#e6f2ec", "#f6fbf7"]
const WOOD = { hi: "#efc690", lite: "#e2ac74", mid: "#cb9058", deep: "#a26e42", dark: "#6f4630" }
const STONE = { hi: "#fbfdfb", lite: "#e8f0ec", mid: "#cddcd8", shade: "#a9bfbf" }
const SILVER = { hi: "#f3f7fc", mid: "#cfd8e6", deep: "#8e9ab4" }
const LEAD = "#58789a"
const GLASS = ["#f4faf8", "#d4eef4", "#9fd3f0", "#6fb4e8", "#4f8fd8", "#5fc2b8", "#8fdcc8", "#b8e4c8", "#b9b8f0"]
const GLASS_W = [3, 2, 3, 3, 2, 3, 3, 2, 0.4]
const glassAt = (a: number, b: number, k = 0) => {
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
function plaster(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, light: (x: number, y: number) => number) {
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
      px(ctx, PLASTER[d2 - d1 < 0.9 ? Math.max(0, i - 1) : i]!, x, y)
    }
  }
}

/** How lit the wall is at a pixel: a soft swirl round (cx, cy), dark in the ceiling's corners and at the room's edges. */
const wallLight = (cx: number, cy: number, W: number) => (x: number, y: number) => {
  const edge = Math.max(0, (28 - Math.min(x, W - x)) / 28) ** 2
  const ceil = Math.max(0, (46 - y) / 46) ** 1.5
  const foot = y > 104 ? ((y - 104) / 24) * 0.4 : 0
  return clamp(0.72 + 0.09 * Math.sin(x * 0.035 + 1.2 * Math.sin(y * 0.04)) + 0.11 * Math.sin(Math.hypot(x - cx, (y - cy) * 1.5) * 0.14) - 0.34 * ceil - 0.3 * edge - foot, 0, 1)
}

function wood(ctx: Ctx, x: number, y: number, w: number, h: number, seed = 0) {
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

/** The honey herringbone of the parquet: blocks of planks that turn a quarter each way. */
function parquet(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  const cols = [WOOD.lite, WOOD.mid, "#d49a60", "#e8b47c"]
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const bx = Math.floor(x / 8)
      const by = Math.floor(y / 8)
      const horiz = (bx + by) % 2 === 0
      const lane = horiz ? (y % 8) >> 1 : (x % 8) >> 1
      const seam = horiz ? (y % 2 === 0 && lane === 0) || x % 8 === 0 : (x % 2 === 0 && lane === 0) || y % 8 === 0
      px(ctx, seam ? WOOD.deep : cols[Math.floor(h2(bx, by, lane) * 4)]!, x, y)
    }
  }
}

// ─── the world outside the windows ──────────────────────────────────────────

const TREES = Array.from({ length: 16 }, (_, i) => ({ x: 70 + i * 24 + h2(i, 1) * 14, y: 100 + h2(i, 2) * 8, r: 12 + h2(i, 3) * 9, c: ["#7fc08a", "#5fa878", "#8fd0a0", "#6fb890"][i % 4]! }))
const CLOUDS = [[150, 70, 24, 5], [250, 62, 30, 6], [335, 80, 20, 4], [90, 76, 18, 4]] as const

/** The meadow seen through the bay: pale sky, soft clouds, a row of round trees and lawn. */
function view(x: number, y: number): string {
  if (y > 112 + Math.round(2 * Math.sin(x * 0.08))) return (x + y) % 7 === 0 ? "#9fd8a8" : "#b4e4b4"
  for (const t of TREES) {
    const d = (x - t.x) ** 2 + ((y - t.y) * 1.1) ** 2
    if (d < t.r * t.r) return d < (t.r * 0.45) ** 2 && x < t.x ? mix(t.c, "#ffffff", 0.3) : t.c
  }
  for (const [cx, cy, rx, ry] of CLOUDS) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) return y > cy + 1 ? "#e6f2f8" : "#ffffff"
  return mix("#8ec8ee", "#e2f3f8", clamp((y - 40) / 72, 0, 1))
}
function paintView(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, skip?: (x: number, y: number) => boolean) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!skip?.(x, y)) px(ctx, view(x, y), x, y)
}

// ─── shared pieces ──────────────────────────────────────────────────────────

/** A glass disc held in lead, with a swirl in it and a spark of light. */
function glassDisc(ctx: Ctx, cx: number, cy: number, r: number, i: number) {
  const base = GLASS[i]!
  disc(ctx, cx, cy, r, r, (x, y) => (Math.hypot(x - cx, y - cy) > r - 1 ? LEAD : (Math.floor((Math.atan2(y - cy, x - cx) + Math.PI) * 1.6 + Math.hypot(x - cx, y - cy) * 0.7) & 1 ? mix(base, "#ffffff", 0.22) : base)))
  px(ctx, "#ffffff", cx - r * 0.5, cy - r * 0.55, 1, 1)
}

/** A wide arch ring of plaster standing out of the wall: lit on its left, shaded on its right. */
function archRing(ctx: Ctx, cx: number, cy: number, r0: number, r1: number, baseY: number) {
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
function archDoor(ctx: Ctx, x: number, y: number, w: number, h: number, seed = 0) {
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
function stairRail(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, posts: number) {
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
function stairFlight(ctx: Ctx, x0: number, gy: number, steps: number, run: number, rise: number) {
  for (let i = 0; i < steps; i++) {
    const sx = x0 + i * run
    const top = gy - (i + 1) * rise
    px(ctx, STONE.shade, sx, top, 400, gy - top)
    px(ctx, STONE.hi, sx, top, run, 2)
    px(ctx, STONE.mid, sx, top + 2, run, 1)
    for (let y = top + 3; y < top + rise; y++) {
      for (let x = sx; x < sx + run; x++) {
        const d = (Math.floor((x + y) / 4) + Math.floor((x - y + 400) / 4)) % 2
        px(ctx, d ? "#a8d2ee" : "#eef6fb", x, y)
      }
    }
    px(ctx, STONE.shade, sx, top + rise - 1, run, 1)
  }
}

// ─── the three floors ───────────────────────────────────────────────────────

function paintHall(ctx: Ctx, W: number, H: number) {
  plaster(ctx, 0, 0, W, 128, wallLight(256, 20, W))
  // vaulted ribs sweeping across the ceiling
  for (let k = 0; k < 4; k++) archRing(ctx, 96 + k * 108, 134, 74 + k * 4, 80 + k * 4, 40 + k * 3)
  // the blue-and-white diamond wainscot, its top edge a row of points
  for (let y = 88; y < 128; y++) {
    for (let x = 0; x < W; x++) {
      const peak = 92 + Math.abs(((x % 16) - 8)) * 0.9
      if (y < peak) continue
      const d = (Math.floor((x + y) / 8) + Math.floor((x - y + 400) / 8)) % 2
      let c = d ? "#9fcdee" : "#f0f7fb"
      if ((x + y) % 8 === 0 || (x - y + 400) % 8 === 0) c = d ? "#7fb4e0" : "#cfe4f2"
      px(ctx, c, x, y)
    }
  }
  // the iron lift cage, left: white vines over a dim cabin
  disc(ctx, 24, 96, 20, 30, "#ecf4f2")
  for (let y = 70; y < 160; y++) for (let x = 5; x < 44; x++) if (((x - 24) / 19) ** 2 + (Math.max(0, 96 - y) / 26) ** 2 <= 1) px(ctx, y > 150 ? "#8aaaae" : "#3d6674", x, y)
  px(ctx, "#cfeaf0", 10, 96, 28, 40)
  for (let y = 70; y < 160; y++) {
    for (const [ph, c] of [[0, "#ffffff"], [2, "#dbe8ea"]] as const) {
      const x = 24 + Math.sin(y * 0.18 + ph) * 12
      px(ctx, c, x, y, 2, 1)
      if (y % 11 === 0) px(ctx, c, x + 2, y, 4, 2)
    }
  }
  px(ctx, SILVER.mid, 4, 160, 40, 2)
  px(ctx, "#8a6a52", 14, 124, 20, 16)
  // the ticket window: a wooden oval-topped nook with its lamp lit and nobody home
  for (let y = 62; y < 114; y++) {
    const half = y < 76 ? Math.round(22 * Math.sqrt((y - 62) / 14)) : 22
    px(ctx, WOOD.deep, 88 - half - 3, y, half * 2 + 7, 1)
    wood(ctx, 88 - half - 2, y, half * 2 + 5, 1, 4)
    px(ctx, y < 70 ? "#f6eee0" : "#f9f2e6", 88 - half + 1, y, half * 2 - 1, 1)
  }
  px(ctx, WOOD.deep, 66, 90, 44, 2)
  px(ctx, WOOD.mid, 86, 62, 4, 52)
  px(ctx, "#ffffff", 76, 76, 4, 2)
  px(ctx, "#8aaaae", 92, 100, 10, 8)
  // the alcove with its blue tile and two oval doors
  for (let y = 48; y < 128; y++) {
    const half = y < 80 ? Math.round(62 * Math.sqrt((y - 48) / 32)) : 62
    for (let x = 256 - half; x <= 256 + half; x++) {
      const d = (Math.floor((x + y) / 7) + Math.floor((x - y + 400) / 7)) % 2
      px(ctx, d ? "#a8d2ee" : "#eef6fb", x, y)
    }
  }
  archRing(ctx, 256, 80, 58, 70, 128)
  for (const ox of [-22, 22]) {
    disc(ctx, 256 + ox, 112, 14, 25, (x, y) => (x < 256 + ox - 7 || y < 98 ? WOOD.hi : x > 256 + ox + 7 ? WOOD.deep : WOOD.mid))
    disc(ctx, 256 + ox, 112, 11, 22, (x, y) => ((x + (y >> 2)) % 5 === 0 ? WOOD.deep : y < 100 ? WOOD.lite : WOOD.mid))
    px(ctx, SILVER.hi, 256 + ox + (ox < 0 ? 6 : -7), 114, 2, 3)
  }
  // a pendant globe in the vault
  px(ctx, SILVER.mid, 256, 0, 1, 24)
  disc(ctx, 256, 32, 8, 9, (x, y) => (x < 255 && y < 30 ? "#ffffff" : "#d8eef4"))
  // the floor: pale marble in cool squares, veined, with silver studs at the corners
  for (let y = 128; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sq = (Math.floor(x / 16) + Math.floor(y / 16)) % 2
      let c = sq ? "#e6f0ee" : "#d8e8e8"
      if (h2(x >> 2, y >> 2, 6) > 0.93) c = "#c4d8dc"
      if (Math.abs(((x * 0.7 + y * 0.35) % 41) - 20) < 0.6 && h2(x >> 4, y >> 4, 2) > 0.5) c = "#b8d0d6"
      px(ctx, c, x, y)
    }
  }
  for (let y = 128; y < H; y += 16) for (let x = 0; x < W; x += 16) px(ctx, SILVER.mid, x, y)
  // a round tiled rug at the foot of the stair, and the door mat
  disc(ctx, 256, 240, 70, 24, (x, y) => (((Math.hypot((x - 256) / 70, (y - 240) / 24) * 6) | 0) % 2 ? "#a8d2ee" : "#e4f1f6"))
  disc(ctx, 256, 240, 44, 14, "#f4faf8")
  px(ctx, "#8fc4a8", 208, 296, 96, 8)
  px(ctx, "#cfeee0", 220, 298, 72, 6)
  px(ctx, "#ffffff", 232, 298, 48, 1)
  // the great stair on the right, with its balustrade
  px(ctx, mix("#aec9c6", "#6a8fa0", 0.5), 336, 40, 176, 136)
  stairFlight(ctx, 336, 176, 11, 16, 8)
  stairRail(ctx, 344, 176, 512, 92, 10)
  px(ctx, WOOD.deep, 332, 100, 6, 78)
  px(ctx, WOOD.hi, 332, 100, 2, 78)
  disc(ctx, 335, 98, 5, 5, (x) => (x < 335 ? WOOD.hi : WOOD.mid))
}

function paintNoble(ctx: Ctx, W: number, H: number) {
  plaster(ctx, 0, 0, W, 128, wallLight(240, 18, W))
  // three great arches over the three bays, ribbed into the swirl of the ceiling
  for (let b = 0; b < 3; b++) archRing(ctx, 144 + b * 96, 64, 44, 56, 128)
  // the bay: lead-and-glass band, a wavy wooden frame, a view of the meadow
  paintView(ctx, 96, 52, 384, 128)
  px(ctx, LEAD, 96, 40, 288, 50)
  const band = (x: number) => 86 + Math.round(4 * Math.sin((x - 96) * 0.065))
  for (let y = 42; y < 96; y++) for (let x = 96; x < 384; x++) if (y < band(x)) px(ctx, LEAD, x, y)
  for (let j = 0; j < 6; j++) {
    for (let i = 0; i < 27; i++) {
      const cx = 101 + i * 11 + (j % 2) * 5.5
      const cy = 46 + j * 9.6
      if (cx > 380 || cy + 5 > band(cx)) continue
      const top = 56 - Math.round(Math.sqrt(Math.max(0, 1 - ((cx - 240) % 96) ** 2 / 2300)) * 14)
      if (cy - 4 < top - 8) continue
      glassDisc(ctx, cx, cy, 4.6, glassAt(i, j))
    }
  }
  for (let x = 96; x < 384; x++) {
    const rail = 84 + Math.round(3.5 * Math.sin((x - 96) * 0.065))
    wood(ctx, x, rail, 1, 8, 3)
  }
  for (let k = 0; k <= 12; k++) {
    const x = 96 + k * 24
    for (let y = 90; y < 128; y++) wood(ctx, x - 2 + Math.round(1.2 * Math.sin(y * 0.15)), y, 4, 1, 5)
  }
  wood(ctx, 96, 106, 288, 5, 7)
  // oval lower panes in a wooden band
  wood(ctx, 96, 111, 288, 17, 9)
  for (let k = 0; k < 12; k++) {
    const cx = 108 + k * 24
    disc(ctx, cx, 119, 9.5, 6, (x, y) => (Math.hypot((x - cx) / 9.5, (y - 119) / 6) > 0.84 ? WOOD.deep : view(x, y)))
    if (k % 2 === 0) px(ctx, WOOD.dark, cx - 1, 126, 3, 2)
  }
  // bone-shaped pillars of plaster at the bay's two ends
  for (const px0 of [96, 384]) {
    for (let y = 30; y < 128; y++) {
      const hw = Math.round(10 + 5 * Math.cos(((y - 30) / 98) * Math.PI * 2))
      for (let x = px0 - hw; x <= px0 + hw; x++) px(ctx, PLASTER[clamp(Math.round(((x - px0) / hw) * -1.4 + 3 + (bayerAt(x, y) - 0.5)), 0, 4)]!, x, y)
    }
  }
  // the folding doors, right: fan-folded leaves with roundels of glass in the arch
  const dx0 = 408
  const dw = 104
  for (let x = dx0; x < dx0 + dw; x++) {
    const rel = (x - dx0 - dw / 2) / (dw / 2)
    const top = 52 + Math.round(26 * (1 - Math.sqrt(Math.max(0, 1 - rel * rel))) * 0.6) + Math.round(2 * Math.sin(x * 0.4))
    wood(ctx, x, top, 1, 128 - top, 2)
  }
  for (let k = 0; k < 14; k++) glassDisc(ctx, dx0 + 14 + (k % 7) * 13 + (k > 6 ? 6 : 0), k > 6 ? 70 : 64 + Math.round(3 * Math.abs(((k % 7) - 3) / 3)), k % 3 === 0 ? 5 : 4, glassAt(k, 4, 2))
  for (let k = 0; k < 5; k++) {
    const lx = dx0 + 4 + k * 19
    px(ctx, k % 2 ? WOOD.deep : WOOD.lite, lx, 84, 2, 44)
    px(ctx, "#cfeaf0", lx + 3, 90, 12, 14)
    px(ctx, "#a8d2ee", lx + 3, 96, 12, 8)
    px(ctx, WOOD.hi, lx + 3, 90, 12, 1)
    for (const [py0, ph] of [[106, 10], [118, 8]] as const) {
      disc(ctx, lx + 9, py0 + ph / 2, 6, ph / 2, (x) => (x < lx + 9 ? WOOD.lite : WOOD.mid))
      disc(ctx, lx + 9, py0 + ph / 2, 4, ph / 2 - 1.5, (x) => (x < lx + 9 ? WOOD.hi : WOOD.lite))
    }
  }
  px(ctx, WOOD.dark, dx0, 127, dw, 1)
  // the way down, left: an arched wooden door
  archDoor(ctx, 24, 56, 48, 72, 2)
  // the stair up, right, behind a column of plaster
  px(ctx, mix("#aec9c6", "#6a8fa0", 0.5), 536, 20, 104, 156)
  stairFlight(ctx, 544, 176, 6, 16, 12)
  stairRail(ctx, 552, 176, 640, 104, 5)
  px(ctx, WOOD.deep, 540, 120, 6, 58)
  px(ctx, WOOD.hi, 540, 120, 2, 58)
  // the floor: parquet, with the bay's coloured light thrown across it
  parquet(ctx, 0, 128, W, H)
  for (let y = 128; y < H; y++) for (let x = 0; x < W; x++) if (y < 150) px(ctx, `rgba(255,255,255,${0.22 - (y - 128) * 0.008})`, x, y)
  ctx.globalAlpha = 0.2
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 24; i++) {
      const g = glassAt(i, j)
      if (g === 0) continue
      const fx = 104 + i * 12 + j * 7 + 30
      const fy = 168 + j * 22 + (i % 3) * 3
      disc(ctx, fx, fy, 6, 3, GLASS[g]!)
    }
  }
  ctx.globalAlpha = 1
  // the chandelier: a bell of crystal beads hung from the swirl of the ceiling
  px(ctx, SILVER.mid, 240, 0, 1, 14)
  const bead = (x: number, y: number, k: number) => {
    px(ctx, k % 3 === 0 ? "#ffffff" : k % 3 === 1 ? "#d4eef4" : "#9fd3f0", x, y, 2, 2)
  }
  disc(ctx, 240, 40, 36, 20, (x, y) => (y < 38 ? "rgba(0,0,0,0)" : "#dcecf0"))
  for (let k = 0; k <= 28; k++) {
    const a = -1 + (2 * k) / 28
    for (let s = 0; s <= 1; s += 0.05) bead(240 + a * (4 + 34 * s ** 0.9), 14 + 42 * s ** 0.85, k + Math.floor(s * 20))
  }
  for (let k = 0; k < 18; k++) bead(204 + k * 4.2, 57 + Math.round(Math.sin(k) * 1), k)
  for (let k = 0; k < 12; k++) bead(216 + k * 4.2, 63, k + 1)
  px(ctx, "#cfe6ee", 232, 64, 16, 20)
  for (let k = 0; k < 5; k++) for (let j = 0; j < 4; j++) bead(232 + k * 3.4, 65 + j * 5, k + j)
}

function paintLoft(ctx: Ctx, W: number, H: number) {
  plaster(ctx, 0, 0, W, 128, wallLight(200, 10, W))
  // two pebble-shaped skylights of leaded oval glass
  for (const [cx, cy, rx, ry] of [[150, 20, 52, 19], [318, 30, 40, 17]] as const) {
    disc(ctx, cx, cy, rx + 3, ry + 3, (x, y) => (x < cx && y < cy ? "#f6fbf7" : "#c4dcd8"))
    disc(ctx, cx, cy, rx, ry, (x, y) => {
      const gx = Math.floor((x - (cx - rx)) / 11)
      const gy = Math.floor((y - (cy - ry)) / 7)
      const lx = ((x - (cx - rx)) % 11) - 5.5
      const ly = ((y - (cy - ry)) % 7) - 3.5
      return (lx / 5) ** 2 + (ly / 3.2) ** 2 > 1 ? "#98b4c4" : mix("#e6f4fc", "#ffffff", h2(gx, gy, 4) * 0.8)
    })
    // light falling down the wall in a soft wedge
    for (let y = cy + ry; y < 128; y++) {
      const spread = (y - cy - ry) * 0.18
      for (let x = Math.floor(cx - rx - spread); x < cx + rx + spread; x++) if (((x + y) & 1) === 0 && h2(x, y, 3) < 0.5) px(ctx, "rgba(255,255,255,0.2)", x, y)
    }
  }
  // wavy honey wainscot, its panels cut on the slant, with a rolling top edge
  for (let x = 0; x < W; x++) {
    const top = 102 + Math.round(3.4 * Math.sin(x * 0.085))
    wood(ctx, x, top, 1, 128 - top, Math.floor(x / 36))
    px(ctx, WOOD.hi, x, top, 1, 1)
    if (x % 36 === 0) px(ctx, WOOD.deep, x, top + 1, 1, 128 - top)
    if ((x + 12) % 36 < 2) px(ctx, WOOD.dark, x, top + 8, 1, 120 - top)
  }
  // the round-windowed door: a wooden door with a great circle cut through it, a monstera standing behind
  const rx = 320
  const ry = 90
  for (let x = 256; x < 384; x++) {
    const rel = (x - 320) / 64
    const top = 56 + Math.round(14 * (1 - Math.sqrt(Math.max(0, 1 - rel * rel))))
    wood(ctx, x, top, 1, 128 - top, 6)
  }
  disc(ctx, rx, ry, 37, 37, WOOD.deep)
  disc(ctx, rx, ry, 34, 34, "#e8f2ee")
  disc(ctx, rx, ry, 34, 34, (x, y) => (y < 78 ? ((x + y) % 9 === 0 ? "#cfe0dc" : "#eef6f2") : (x + y) % 6 === 0 ? "#dcebe6" : "#e8f2ee"))
  for (let k = 0; k < 3; k++) glassDisc(ctx, 304 + k * 16, 68 + (k === 1 ? 4 : 0), 5, glassAt(k, 9))
  // monstera leaves through the circle: a bloom of big notched hearts
  for (const [lx, ly, lr, sh] of [[310, 108, 15, 0], [332, 104, 14, 1], [318, 94, 13, 2], [336, 90, 11, 0], [304, 92, 10, 1], [322, 112, 11, 2]] as const) {
    const g = ["#2f7a58", "#3f9a68", "#5fb27c"][sh]!
    disc(ctx, lx, ly, lr, lr * 0.82, (x, y) => {
      const a = Math.atan2(y - ly, x - lx)
      if (Math.abs(Math.sin(a * 5)) > 0.9 && Math.hypot(x - lx, y - ly) > lr * 0.45) return "rgba(0,0,0,0)"
      return x < lx - 2 && y < ly ? "#8fd0a0" : g
    })
  }
  px(ctx, "#5a4630", 321, 112, 3, 14)
  for (let y = 56; y < 128; y++) for (let x = 252; x < 388; x++) if (Math.hypot(x - rx, y - ry) < 37 && Math.hypot(x - rx, y - ry) >= 34) px(ctx, WOOD.hi, x, y)
  // radiating panels in the lower door, cut in the shape of petals
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (0.12 + (k * 0.76) / 6)
    const ex = rx + Math.cos(a) * 44
    const ey = ry + Math.sin(a) * 36
    if (ey > 126) continue
    disc(ctx, ex, ey + 3, 7, 5.5, (x, y) => (y < ey + 1 ? WOOD.lite : WOOD.deep))
    disc(ctx, ex, ey + 3, 5, 4, WOOD.mid)
  }
  // the way down, right: an arched door
  archDoor(ctx, 448, 58, 48, 70, 5)
  // swallows of iron flying uphill, each holding a coat
  for (let k = 0; k < 5; k++) {
    const bx = 394 + k * 11
    const by = 98 - k * 7
    for (const [dx, dy] of [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2], [5, 2], [6, 1], [2, 1], [3, 2]] as const) px(ctx, "#4a6a78", bx + dx, by + dy)
    px(ctx, "#8aaaae", bx + 2, by + 1)
  }
  // the floor: parquet in a wash of skylight
  parquet(ctx, 0, 128, W, H)
  ctx.globalAlpha = 0.16
  disc(ctx, 150, 200, 58, 18, "#ffffff")
  disc(ctx, 318, 214, 46, 15, "#ffffff")
  ctx.globalAlpha = 1
  // a round rug of blue-green ripples
  disc(ctx, 270, 232, 98, 36, (x, y) => (Math.floor(Math.hypot((x - 270) / 98, (y - 232) / 36) * 8) % 2 ? "#8fd0c0" : "#b8e0f2"))
  disc(ctx, 270, 232, 24, 9, "#f4faf8")
  for (let x = 172; x < 368; x += 4) px(ctx, "#f4faf8", x, 232 + Math.round(Math.sin(x * 0.2) * 3), 2, 1)
}

// ─── standing things, sorted with the walkers ───────────────────────────────

type Prop = { floor: FloorId; kind: "column" | "fern" | "palm" | "ottoman" | "bed" | "lamp" | "monstera"; x: number; y: number }

/** `x` is the middle and `y` the foot line, in pixels. */
export const CASA_PROPS: Prop[] = [
  { floor: 0, kind: "fern", x: 72, y: 272 },
  { floor: 0, kind: "fern", x: 440, y: 272 },
  { floor: 1, kind: "column", x: 192, y: 160 },
  { floor: 1, kind: "column", x: 288, y: 160 },
  { floor: 1, kind: "palm", x: 88, y: 192 },
  { floor: 1, kind: "ottoman", x: 320, y: 256 },
  { floor: 2, kind: "bed", x: 88, y: 176 },
  { floor: 2, kind: "lamp", x: 200, y: 176 },
  { floor: 2, kind: "monstera", x: 416, y: 176 },
]

const sizes: Record<Prop["kind"], [number, number]> = { column: [44, 124], fern: [34, 34], palm: [40, 60], ottoman: [44, 22], bed: [152, 104], lamp: [24, 80], monstera: [48, 70] }

function leaf(ctx: Ctx, cx: number, cy: number, r: number, dark: boolean) {
  disc(ctx, cx, cy, r, r * 0.7, (x, y) => (x < cx - 1 && y < cy ? "#8fd0a0" : dark ? "#2f7a58" : "#4f9a6c"))
}

function paintProp(ctx: Ctx, kind: Prop["kind"]) {
  const [w, h] = sizes[kind]
  const cx = w / 2
  const fy = h
  const pot = (pw: number, ph: number, c: string) => {
    px(ctx, c, cx - pw / 2, fy - ph, pw, ph)
    px(ctx, mix(c, "#ffffff", 0.4), cx - pw / 2, fy - ph, pw, 2)
    px(ctx, mix(c, "#4a6a8a", 0.35), cx - pw / 2 + 1, fy - 2, pw - 2, 2)
  }
  if (kind === "column") {
    // octagonal foot, fluted shaft, a twisted collar, and a capital that opens into the vault
    px(ctx, STONE.shade, cx - 12, fy - 12, 24, 12)
    px(ctx, STONE.mid, cx - 12, fy - 12, 24, 4)
    px(ctx, STONE.hi, cx - 10, fy - 12, 8, 2)
    for (let y = 40; y < fy - 12; y++) {
      for (let x = -7; x <= 7; x++) px(ctx, x < -3 ? STONE.hi : x < 3 ? STONE.lite : x < 6 ? STONE.mid : STONE.shade, cx + x, y)
    }
    for (let y = 62; y < 80; y++) {
      for (let x = -10; x <= 10; x++) {
        const twist = ((x + y * 0.9) % 6 + 6) % 6
        px(ctx, twist < 2 ? STONE.hi : twist < 4 ? STONE.lite : STONE.shade, cx + x, y)
      }
    }
    px(ctx, STONE.shade, cx - 10, 80, 21, 1)
    for (let y = 8; y < 42; y++) {
      const t = (42 - y) / 34
      const hw = 7 + Math.round(15 * t ** 1.6)
      for (let x = -hw; x <= hw; x++) px(ctx, PLASTER[clamp(Math.round(3.2 - (x / hw) * 1.2 + (bayerAt(x + cx, y) - 0.5)), 0, 4)]!, cx + x, y)
    }
    px(ctx, STONE.shade, cx - 8, 42, 17, 2)
  } else if (kind === "fern") {
    pot(16, 12, "#b8dcf0")
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI + (k / 8) * Math.PI
      for (let s = 3; s < 17; s++) px(ctx, k % 2 ? "#4f9a6c" : "#6fb88a", cx + Math.cos(a) * s * 0.95, fy - 12 - Math.sin(-a) * s * 0.7 + (s * s) / 40, 2, 1)
    }
  } else if (kind === "palm") {
    pot(18, 14, "#b8dcf0")
    px(ctx, "#8a6a4a", cx - 1, fy - 40, 3, 28)
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI * 0.95 + (k / 6) * Math.PI * 0.9
      for (let s = 2; s < 20; s++) px(ctx, k % 2 ? "#3f8a60" : "#5fb27c", cx + Math.cos(a) * s, fy - 40 + Math.sin(a) * s * 0.5 + (s * s) / 28, 2, 2)
    }
  } else if (kind === "ottoman") {
    disc(ctx, cx, fy - 9, 21, 10, (x, y) => (y < fy - 12 ? "#cfe6f4" : x < cx ? "#a8d2ee" : "#8fc0e0"))
    disc(ctx, cx, fy - 12, 14, 5, "#e4f1f8")
    for (let k = 0; k < 8; k++) px(ctx, "#ffffff", cx - 16 + k * 4.4, fy - 6 + (k % 2), 2, 1)
    px(ctx, STONE.shade, cx - 12, fy - 2, 24, 2)
  } else if (kind === "bed") {
    // a wavy wooden headboard on the wall, a quilt of blue and green, pillows, and a footboard
    for (let x = 0; x < w; x++) {
      const top = 6 + Math.round(5 * Math.sin(x * 0.07 + 1))
      wood(ctx, x, top, 1, 62 - top, 8)
    }
    for (let k = 0; k < 4; k++) disc(ctx, 20 + k * 38, 40, 14, 12, (x, y) => (y < 38 ? WOOD.lite : WOOD.deep))
    for (let k = 0; k < 4; k++) disc(ctx, 20 + k * 38, 40, 11, 9, WOOD.mid)
    px(ctx, "#f4faf8", 10, 58, 62, 14)
    px(ctx, "#ffffff", 10, 58, 62, 2)
    px(ctx, "#e4f1f6", 80, 58, 62, 14)
    px(ctx, "#ffffff", 80, 58, 62, 2)
    for (let y = 70; y < 96; y++) {
      for (let x = 8; x < 144; x++) {
        const band = Math.floor((y - 70) / 4) % 2
        const c = (Math.floor((x + (y % 8 < 4 ? 0 : 5)) / 10) + band) % 2 ? "#8fd0c0" : "#a8d2ee"
        px(ctx, y === 70 ? "#ffffff" : (x + y) % 11 === 0 ? "#f4faf8" : c, x, y)
      }
    }
    for (let x = 8; x < 144; x++) px(ctx, "#f4faf8", x, 96 + Math.round(Math.sin(x * 0.5) * 1.2), 1, 2)
    for (let x = 4; x < 148; x++) {
      const top = 94 + Math.round(2.5 * Math.sin(x * 0.09))
      wood(ctx, x, top, 1, 10, 9)
    }
  } else if (kind === "lamp") {
    // a standing lamp: a twisted white foot, a slim silver stem, a crystal egg lit from inside
    for (let y = 58; y < fy; y++) {
      const hw = y > 70 ? 5 : 2 + Math.round(2 * Math.sin(y * 0.8))
      px(ctx, y % 4 < 2 ? "#f6fbfb" : "#cfe0e4", cx - hw, y, hw * 2 + 1)
    }
    px(ctx, SILVER.mid, cx, 22, 1, 40)
    disc(ctx, cx, 14, 7, 10, (x, y) => (x < cx - 1 && y < 12 ? "#ffffff" : (x + y) % 3 === 0 ? "#cfeaf4" : "#e6f6fa"))
    px(ctx, SILVER.hi, cx - 1, 2, 3, 2)
    px(ctx, SILVER.mid, cx - 4, 24, 9, 2)
  } else if (kind === "monstera") {
    pot(22, 22, "#b8dcf0")
    px(ctx, "#6a8a5a", cx - 1, 14, 3, h - 34)
    for (const [lx, ly, lr, d] of [[cx - 11, 38, 11, false], [cx + 11, 34, 11, true], [cx - 6, 20, 10, true], [cx + 8, 16, 10, false], [cx, 8, 8, true]] as const) leaf(ctx, lx, ly, lr, d)
  }
}

const propCache = new Map<string, HTMLCanvasElement>()
function propCanvas(kind: Prop["kind"]) {
  let c = propCache.get(kind)
  if (!c) {
    const [w, h] = sizes[kind]
    c = document.createElement("canvas")
    c.width = w
    c.height = h
    paintProp(c.getContext("2d")!, kind)
    propCache.set(kind, c)
  }
  return c
}

// ─── floors and frames ──────────────────────────────────────────────────────

const floorCache = new Map<FloorId, HTMLCanvasElement>()

export function floorCanvas(id: FloorId): HTMLCanvasElement {
  let c = floorCache.get(id)
  if (!c) {
    const f = floorOf(id)
    c = document.createElement("canvas")
    c.width = f.w * CT
    c.height = f.h * CT
    const ctx = c.getContext("2d")!
    ctx.imageSmoothingEnabled = false
    if (id === 0) paintHall(ctx, c.width, c.height)
    else if (id === 1) paintNoble(ctx, c.width, c.height)
    else paintLoft(ctx, c.width, c.height)
    // the side walls: a soft dark edge so the room reads as a room
    for (let x = 0; x < 14; x++) {
      px(ctx, `rgba(40,70,90,${0.32 - x * 0.023})`, x, 0, 1, c.height)
      px(ctx, `rgba(40,70,90,${0.32 - x * 0.023})`, c.width - 1 - x, 0, 1, c.height)
    }
    floorCache.set(id, c)
  }
  return c
}

/** Pools of light, in room pixels: (x, y, radius). Cut out of the night. */
const LIGHTS: Record<FloorId, Array<[number, number, number]>> = {
  0: [[256, 40, 80], [88, 90, 46], [24, 110, 30]],
  1: [[240, 60, 110], [450, 100, 50], [48, 100, 30]],
  2: [[200, 100, 70], [150, 30, 60], [318, 90, 50]],
}

export type CasaFrame = { w: Walker; t: number; night: boolean; petSprite: string; near: string | null }

/** Paint a frame of the house into a 304×192 context. */
export function drawCasa(ctx: Ctx, f: CasaFrame) {
  const { w, t } = f
  const floor = floorCanvas(w.floor)
  const camX = clamp(Math.round(w.x - VIEW_W / 2), 0, floor.width - VIEW_W)
  const camY = clamp(Math.round(w.y - VIEW_H / 2 - 8), 0, floor.height - VIEW_H)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, VIEW_W, VIEW_H)
  ctx.drawImage(floor, camX, camY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H)
  ctx.translate(-camX, -camY)

  // glints in the chandelier and the skylights
  if (w.floor === 1) {
    for (let k = 0; k < 9; k++) {
      const a = t * 1.3 + k * 2.1
      if (Math.sin(a * 2) > 0.5) px(ctx, "#ffffff", 240 + Math.cos(a) * 30, 28 + (k * 5) % 34, 1, 1)
    }
  }
  if (w.floor === 2) {
    for (let k = 0; k < 6; k++) if (Math.sin(t * 1.7 + k * 1.9) > 0.8) px(ctx, "#ffffff", 120 + k * 11, 14 + ((k * 7) % 12), 2, 1)
  }

  type Body = { y: number; draw: () => void }
  const bodies: Body[] = CASA_PROPS.filter((p) => p.floor === w.floor).map((p) => {
    const [pw, ph] = sizes[p.kind]
    return { y: p.y, draw: () => ctx.drawImage(propCanvas(p.kind), Math.round(p.x - pw / 2), Math.round(p.y - ph)) }
  })
  const shadow = (x: number, y: number, sw: number) => {
    ctx.fillStyle = "rgba(40,60,90,0.22)"
    ctx.fillRect(Math.round(x - sw / 2), Math.round(y - 1), sw, 3)
  }
  const stride = strideFrame(t, w.running)
  bodies.push({
    y: w.y,
    draw: () => {
      shadow(w.x, w.y + 4, 14)
      drawSprite(ctx, spriteCanvas("player", w.moving ? w.facing : "back", w.moving ? stride : -1, null), w.x, w.y + 4 - (w.moving ? stride & 1 : 0), w.face)
    },
  })
  bodies.push({
    y: w.pet.y,
    draw: () => {
      shadow(w.pet.x, w.pet.y + 4, 12)
      drawSprite(ctx, spriteCanvas(f.petSprite, w.moving ? w.facing : "front", w.moving ? strideFrame(t, w.running, 0.5) : -1, null), w.pet.x, w.pet.y + 4, w.x >= w.pet.x ? 1 : -1)
    },
  })
  bodies.sort((a, b) => a.y - b.y)
  for (const b of bodies) b.draw()

  // after dark the windows go blue and the lamps are pools of light
  if (f.night) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = "rgba(30,46,96,0.36)"
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.globalCompositeOperation = "screen"
    for (const [lx, ly, lr] of LIGHTS[w.floor]) {
      const g = ctx.createRadialGradient(lx - camX, ly - camY, 2, lx - camX, ly - camY, lr)
      g.addColorStop(0, "rgba(220,240,255,0.5)")
      g.addColorStop(1, "rgba(220,240,255,0)")
      ctx.fillStyle = g
      ctx.fillRect(lx - camX - lr, ly - camY - lr, lr * 2, lr * 2)
    }
    ctx.globalCompositeOperation = "source-over"
  }
}
