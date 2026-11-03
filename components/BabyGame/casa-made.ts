/**
 * components/BabyGame/casa-made.ts — the furniture that is painted in code: a plaster tree, a bay of books, stained glass, nets
 *
 * Pieces named in `lib/baby-game/casa-pieces.ts` (`MADE`, their sizes). Each painter fills a w×h canvas with its foot on the bottom
 * edge, in pixels, lit from the upper left; `madeCanvas(id)` paints one once and keeps it. After the "future home" board
 * (`homedesignref/`): the organic plaster columns (0001, 0007), the curved reading bay (0067), the star-cut dome (0058), the tulip
 * and oval stained glass (0078, 0245), the glass-bead curtain, the iridescent bubbles (0020), the leather sofa (0166), the spiral
 * stair (0003, 0102), the net hammock and the alcove bed (0231). Silver, never gold; nothing yellow-dominant.
 */

import { MADE } from "@/lib/baby-game/casa-pieces"
import { bayerAt } from "./dither"
import { clamp, disc, h2, LEAD, mix, PLASTER, px, SILVER, view, WOOD, type Ctx } from "./casa-kit"

const INK = "#4c6a76"

type Circle = { x: number; y: number; r: number }

/** Round shapes (a trunk, its boughs) merged into one lit solid: the nearest-to-you circle decides each pixel's tone. */
function blob(ctx: Ctx, w: number, h: number, circles: Circle[], pal: readonly string[] = PLASTER, ink = INK) {
  const z = new Float32Array(w * h).fill(-1)
  const tone = new Float32Array(w * h)
  for (const c of circles) {
    for (let y = Math.max(0, Math.floor(c.y - c.r)); y <= Math.min(h - 1, Math.ceil(c.y + c.r)); y++) {
      for (let x = Math.max(0, Math.floor(c.x - c.r)); x <= Math.min(w - 1, Math.ceil(c.x + c.r)); x++) {
        const nx = (x - c.x) / c.r
        const ny = (y - c.y) / c.r
        const d = nx * nx + ny * ny
        if (d > 1) continue
        const nz = Math.sqrt(1 - d)
        const depth = c.r * nz
        if (depth <= z[y * w + x]!) continue
        z[y * w + x] = depth
        tone[y * w + x] = clamp(0.55 - 0.5 * nx - 0.32 * ny + 0.35 * nz, 0, 1)
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (z[i]! < 0) continue
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || z[i - 1]! < 0 || z[i + 1]! < 0 || z[i - w]! < 0 || z[i + w]! < 0
      px(ctx, edge ? ink : pal[clamp(Math.round(tone[i]! * 4 + bayerAt(x, y) - 0.5), 0, 4)]!, x, y)
    }
  }
}

/** A bough: circles along a quadratic curve from a to b, bent by `bend`, thinning from r0 to r1. */
function bough(a: [number, number], b: [number, number], bend: [number, number], r0: number, r1: number, n = 26): Circle[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const u = 1 - t
    return { x: u * u * a[0] + 2 * u * t * bend[0] + t * t * b[0], y: u * u * a[1] + 2 * u * t * bend[1] + t * t * b[1], r: r0 + (r1 - r0) * t }
  })
}

/** A puffed cushion: an ellipse lit from the upper left in a 5-step palette. */
function puff(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, pal: readonly string[], ink?: string) {
  disc(ctx, cx, cy, rx, ry, (x, y) => {
    const nx = (x - cx) / rx
    const ny = (y - cy) / ry
    const d = nx * nx + ny * ny
    if (ink && d > 0.82) return ink
    return pal[clamp(Math.round(2.2 - 1.7 * nx - 1.5 * ny + 1.2 * Math.sqrt(Math.max(0, 1 - d)) + bayerAt(x, y) - 0.5), 0, 4)]!
  })
}

const LEATHER = ["#3b2418", "#5a3624", "#7a4b32", "#a06a4c", "#cf9a7a"]
const ROSE = ["#b5758c", "#cf93a6", "#e4b0c0", "#f1ccd6", "#fbe8ee"]
const PLUM = ["#3d2a52", "#59407a", "#7a5d9c", "#a285bd", "#cdb6e0"]
const MOSS = ["#2d6648", "#3f7f5a", "#5a9b72", "#82bd94", "#b4dcbc"]
const BOOKS = ["#5a7a9e", "#7a5d9c", "#4f8a74", "#c27a6a", "#e8dfd0", "#9fb8d2", "#b5758c", "#3f6b50", "#d9b3a0", "#6f8fb8"]

// ─── the painters ───────────────────────────────────────────────────────────

const PAINT: Record<string, (ctx: Ctx, w: number, h: number) => void> = {
  /** A column that is a tree of plaster: a flared root, a trunk, and boughs that open into arches in the vault. */
  "column-tree": (ctx, w, h) => {
    const c: Circle[] = [
      ...bough([50, h - 2], [50, 112], [50, 150], 30, 15),
      ...bough([50, 122], [18, 54], [42, 84], 15, 9),
      ...bough([50, 122], [82, 54], [58, 84], 15, 9),
      ...bough([50, 112], [50, 22], [46, 66], 13, 7),
      ...bough([18, 54], [5, 14], [10, 36], 9, 4),
      ...bough([82, 54], [95, 14], [90, 36], 9, 4),
      ...bough([18, 54], [33, 8], [20, 28], 8, 4),
      ...bough([82, 54], [67, 8], [80, 28], 8, 4),
      ...bough([44, 158], [6, 176], [24, 156], 10, 5, 14),
      ...bough([56, 158], [94, 178], [76, 156], 10, 5, 14),
    ]
    blob(ctx, w, h, c)
    // creeping ivy up the trunk, and a few leaves hanging from the boughs
    for (let i = 0; i < 30; i++) {
      const y = h - 16 - i * 4.6
      const x = 50 + Math.sin(i * 0.9) * (19 - i * 0.2)
      const dark = h2(i, 3) > 0.5
      disc(ctx, x, y, 2.6, 2, (px0) => (px0 < x ? "#8fd0a0" : dark ? "#2f7a58" : "#4f9a6c"))
    }
    for (const [lx, ly] of [[4, 18], [96, 18], [32, 12], [68, 12], [16, 44], [84, 44]] as const) {
      for (let k = 0; k < 4; k++) disc(ctx, lx + (k % 2) * 2, ly + 3 + k * 4, 2, 2.6, k % 2 ? "#4f9a6c" : "#8fd0a0")
    }
  },

  /** A reading bay: an arch of plaster, a window onto the meadow, shelves of books to the ceiling, and a pink seat. */
  "bookcase-bay": (ctx, w, h) => {
    const mid = w / 2
    const topAt = (x: number) => 4 + 34 * (1 - Math.sqrt(Math.max(0, 1 - ((x - mid) / mid) ** 2)))
    for (let x = 0; x < w; x++) {
      const t = Math.round(topAt(x))
      for (let y = t; y < h - 12; y++) {
        const rim = y < t + 3 || x < 3 || x > w - 4
        px(ctx, rim ? (x < mid ? PLASTER[4]! : PLASTER[2]!) : y < t + 5 ? PLASTER[1]! : "#dfe9e2", x, y)
      }
    }
    // the window: arched, with the meadow in it and a lead cross
    const wx0 = 42
    const wx1 = w - 42
    for (let x = wx0; x < wx1; x++) {
      const t = Math.round(24 + 18 * (1 - Math.sqrt(Math.max(0, 1 - ((x - mid) / ((wx1 - wx0) / 2)) ** 2))))
      for (let y = t; y < 76; y++) px(ctx, view(x + 130, y + 52), x, y)
    }
    px(ctx, LEAD, mid, 24, 1, 52)
    px(ctx, LEAD, wx0, 44, wx1 - wx0, 1)
    px(ctx, PLASTER[4]!, wx0 - 2, 40, 2, 38)
    px(ctx, PLASTER[4]!, wx1, 40, 2, 38)
    px(ctx, PLASTER[1]!, wx0 - 3, 76, wx1 - wx0 + 6, 3)
    // shelves each side: boards every 15px, books standing in them
    for (const [sx0, sx1] of [[6, 38], [w - 38, w - 6]] as const) {
      for (let row = 0; row < 5; row++) {
        const by = 18 + row * 15 + (sx0 < mid ? 0 : 0)
        let x = sx0
        while (x < sx1 - 1) {
          const bw = 2 + Math.floor(h2(x, row, sx0) * 3)
          const bh = 9 + Math.floor(h2(row, x, 4) * 4)
          if (by - bh >= topAt(x) + 4 && h2(x, row, 9) > 0.1) {
            const c = BOOKS[Math.floor(h2(x, row, 2) * BOOKS.length)]!
            px(ctx, c, x, by - bh, bw, bh)
            px(ctx, mix(c, "#ffffff", 0.35), x, by - bh, 1, bh)
            px(ctx, mix(c, "#2c3a4c", 0.35), x + bw - 1, by - bh, 1, bh)
          }
          x += bw
        }
        px(ctx, WOOD.deep, sx0 - 1, by, sx1 - sx0 + 2, 2)
        px(ctx, WOOD.lite, sx0 - 1, by, sx1 - sx0 + 2, 1)
      }
    }
    // the curved seat: plaster plinth, a pink cushion, two pillows
    px(ctx, PLASTER[2]!, 0, h - 14, w, 14)
    px(ctx, PLASTER[4]!, 0, h - 14, w, 2)
    px(ctx, PLASTER[0]!, 0, h - 3, w, 3)
    for (let x = 4; x < w - 4; x++) {
      const top = h - 28 + Math.round(2.2 * Math.sin((x / w) * Math.PI))
      for (let y = top; y < h - 14; y++) px(ctx, y < top + 2 ? ROSE[4]! : y < top + 6 ? ROSE[3]! : ROSE[1]!, x, y)
      if (x % 14 === 0) px(ctx, ROSE[0]!, x, top + 2, 1, 10)
    }
    puff(ctx, 30, h - 30, 9, 7, PLUM, "#2c1f3d")
    puff(ctx, w - 30, h - 30, 9, 7, MOSS, "#1f3d2c")
    puff(ctx, mid, h - 28, 11, 6, ["#c9c3dc", "#d9d4e8", "#e8e4f2", "#f4f1fa", "#ffffff"])
  },

  /** A low brown leather sofa of three fat lumps (the board's 1970s one). */
  "sofa-leather": (ctx, w, h) => {
    px(ctx, "#2b1a12", 8, h - 3, 3, 3)
    px(ctx, "#2b1a12", w - 11, h - 3, 3, 3)
    puff(ctx, 22, 12, 19, 11, LEATHER, "#24140d")
    puff(ctx, 52, 12, 19, 11, LEATHER, "#24140d")
    puff(ctx, w / 2, 22, 34, 10, LEATHER, "#24140d")
    puff(ctx, 9, 22, 9, 11, LEATHER, "#24140d")
    puff(ctx, w - 9, 22, 9, 11, LEATHER, "#24140d")
    for (let i = 0; i < 14; i++) px(ctx, "#e8b896", 12 + h2(i, 1) * 50, 6 + h2(i, 2) * 8, 1, 1)
  },

  /** A round smoked-glass table on stacked chrome rings. */
  "table-chrome": (ctx, w, h) => {
    const cx = w / 2
    px(ctx, SILVER.deep, cx - 1, 14, 3, h - 18)
    for (let k = 0; k < 4; k++) {
      const y = 18 + k * 6
      disc(ctx, cx, y, 15 - k, 3.2, (x) => (x < cx - 4 ? SILVER.hi : x > cx + 5 ? SILVER.deep : SILVER.mid))
      disc(ctx, cx, y, 12 - k, 1.6, "#6f7f98")
    }
    disc(ctx, cx, h - 3, 20, 3.4, (x) => (x < cx - 6 ? SILVER.hi : x > cx + 7 ? SILVER.deep : SILVER.mid))
    disc(ctx, cx, 11, 28, 7.5, (x, y) => (y < 8 ? "#d7e4ec" : x < cx - 6 ? "#a8bccb" : "#8ba1b4"))
    disc(ctx, cx, 10, 25, 5.5, (x, y) => (x + y * 2 < cx + 10 ? "#e6f1f6" : "#c4d6e0"))
    for (let i = 0; i < 6; i++) px(ctx, "#ffffff", cx - 16 + i * 2, 8 - (i % 2), 1, 1)
  },

  /** A lime stool on chrome rings. */
  "stool-lime": (ctx, w, h) => {
    const cx = w / 2
    disc(ctx, cx, 5, 8, 3.6, (x, y) => (y < 4 ? "#dcec9a" : x < cx ? "#b4d46a" : "#8fb24a"))
    for (const y of [10, 14]) disc(ctx, cx, y, 6, 2, (x) => (x < cx - 1 ? SILVER.hi : SILVER.deep))
    disc(ctx, cx, h - 2, 8, 2, (x) => (x < cx ? SILVER.mid : SILVER.deep))
  },

  /** Three iridescent glass bubbles on cords: pink, cyan and lilac where the light turns in them. */
  "pendant-bubbles": (ctx, w) => {
    for (const [bx, by, r] of [[12, 60, 11], [34, 86, 14], [26, 30, 8]] as const) {
      px(ctx, SILVER.mid, bx, 0, 1, by - r)
      disc(ctx, bx, by, r, r, (x, y) => {
        const a = Math.atan2(y - by, x - bx)
        const d = Math.hypot(x - bx, y - by) / r
        if (d > 0.88) return "#6f8fb8"
        if (x < bx - r * 0.35 && y < by - r * 0.3 && d < 0.7) return "#ffffff"
        const hue = [mix("#f0c0e0", "#ffffff", 0.45), mix("#a0e0f0", "#ffffff", 0.4), mix("#c8b8f0", "#ffffff", 0.35), mix("#b0f0d0", "#ffffff", 0.45)]
        return hue[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 4 + d * 2 + h2(x >> 1, y >> 1, 3) * 0.3) % 4]!
      })
      px(ctx, "#ffffff", bx + r * 0.35, by + r * 0.45, 2, 1)
    }
    void w
  },

  /** An arched window of leaded glass: three pink tulips on green stems. */
  "window-tulip": (ctx, w, h) => {
    const mid = w / 2
    const topAt = (x: number) => 3 + 24 * (1 - Math.sqrt(Math.max(0, 1 - ((x - mid) / mid) ** 2)))
    for (let x = 0; x < w; x++) for (let y = Math.round(topAt(x)); y < h; y++) px(ctx, x < 3 || x > w - 4 || y < topAt(x) + 3 ? (x < mid ? PLASTER[4]! : PLASTER[2]!) : mix("#c7dcf0", "#e2d4ee", h2(x >> 2, y >> 2, 1)), x, y)
    for (const [tx, ty, s] of [[mid, 36, 1.15], [mid - 13, 50, 0.9], [mid + 13, 46, 0.95]] as const) {
      for (let y = ty; y < h - 6; y++) px(ctx, "#2f7a58", tx + Math.sin(y * 0.2) * 1.2, y, 2, 1)
      for (let i = 0; i < 12; i++) disc(ctx, tx + (i % 2 ? 7 : -7) * s * (1 - i * 0.05), h - 22 - i * 3.2 + (tx > mid ? 5 : 0), 5 * s, 1.6, i % 2 ? "#4f9a6c" : "#7fc08a")
      disc(ctx, tx, ty, 6 * s, 8 * s, (x, y) => (y < ty - 4 * s ? mix("#f06aa0", "#ffffff", 0.2) : x < tx ? "#f49ac0" : "#e0508a"))
      disc(ctx, tx, ty + 1, 3 * s, 5 * s, "#fbd0e0")
      for (const dx of [-5, 0, 5]) px(ctx, "#fff0f6", tx + dx * s, ty - 7 * s, 1, 2)
      px(ctx, LEAD, tx - 6 * s, ty + 2, 12 * s, 1)
    }
    for (let y = 28; y < h; y += 14) px(ctx, LEAD, 3, y, w - 6, 1)
    px(ctx, LEAD, mid, 28, 1, h - 28)
    px(ctx, PLASTER[1]!, 0, h - 4, w, 4)
  },

  /** An oval of stained glass, a mosaic of teal, green, lilac and rose leaded in cells. */
  "window-oval": (ctx, w, h) => {
    const cx = w / 2
    const cy = h / 2
    const seeds = Array.from({ length: 30 }, (_, i) => ({ x: h2(i, 1, 5) * w, y: h2(i, 2, 5) * h, c: ["#5fc2b8", "#8fdcc8", "#7fb4e8", "#b9b8f0", "#e49ac0", "#9fd3a0", "#f0c0d6", "#4f8fd8"][Math.floor(h2(i, 3, 5) * 8)]! }))
    disc(ctx, cx, cy, cx, cy, (x, y) => (Math.hypot((x - cx) / cx, (y - cy) / cy) > 0.86 ? (x < cx ? PLASTER[4]! : PLASTER[2]!) : "#fff"))
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const e = Math.hypot((x - cx) / cx, (y - cy) / cy)
        if (e > 0.86 || e > 1) continue
        let d1 = 1e9
        let d2 = 1e9
        let c = "#fff"
        for (const s of seeds) {
          const d = Math.hypot(x - s.x, (y - s.y) * 0.9)
          if (d < d1) {
            d2 = d1
            d1 = d
            c = s.c
          } else if (d < d2) d2 = d
        }
        px(ctx, d2 - d1 < 1.5 || e > 0.8 ? LEAD : x + y < cx + cy - 6 && d1 < 8 ? mix(c, "#ffffff", 0.35) : c, x, y)
      }
    }
  },

  /** A shallow dome cut with stars, the sky showing pale through them. */
  "dome-stars": (ctx, w, h) => {
    const cx = w / 2
    disc(ctx, cx, h, cx, h - 1, (x, y) => {
      const e = Math.hypot((x - cx) / cx, (y - h) / (h - 1))
      return e > 0.9 ? PLASTER[4]! : PLASTER[clamp(Math.round(3.1 - 1.4 * ((x - cx) / cx) + (bayerAt(x, y) - 0.5) - e * 1.2), 0, 4)]!
    })
    const star = (sx: number, sy: number, R: number) => {
      for (let y = Math.floor(sy - R); y <= Math.ceil(sy + R); y++) {
        for (let x = Math.floor(sx - R); x <= Math.ceil(sx + R); x++) {
          const a = Math.atan2(y - sy, x - sx)
          const k = Math.abs(((a * 6) / (Math.PI * 2)) % 1)
          const reach = R * (0.38 + 0.62 * Math.abs(k * 2 - 1) ** 1.2)
          if (Math.hypot(x - sx, y - sy) <= reach && (x - cx) ** 2 / cx ** 2 + (y - h) ** 2 / (h - 1) ** 2 < 0.8) px(ctx, Math.hypot(x - sx, y - sy) < R * 0.4 ? "#ffffff" : "#d6eefa", x, y)
        }
      }
    }
    for (const [sx, sy, R] of [[cx, 20, 7], [cx - 32, 32, 6], [cx + 32, 32, 6], [cx - 14, 40, 4.5], [cx + 16, 42, 4.5], [cx - 50, 52, 4], [cx + 50, 52, 4], [cx, 52, 5]] as const) star(sx, sy, R)
  },

  /** A curtain of glass beads on chains: red, orange, green, blue and violet discs, each held in lead. */
  "curtain-stained": (ctx, w, h) => {
    px(ctx, SILVER.mid, 0, 0, w, 2)
    px(ctx, SILVER.hi, 0, 0, w, 1)
    const cols = ["#d9546a", "#e8884a", "#4fa56a", "#4f8fd8", "#8a6fd0", "#e49ac0", "#5fc2b8", "#9fd3f0"]
    for (let k = 0; k < 6; k++) {
      const x = 4 + k * 8
      for (let y = 2; y < h - 4 - (k % 2) * 8; y++) px(ctx, SILVER.deep, x, y)
      for (let y = 6 + (k % 3) * 4; y < h - 8 - (k % 2) * 8; y += 12) {
        const c = cols[Math.floor(h2(k, y, 11) * cols.length)]!
        disc(ctx, x, y, 3.6, 4.6, (px0, py0) => (Math.hypot(px0 - x, (py0 - y) * 0.8) > 3 ? LEAD : px0 < x && py0 < y ? mix(c, "#ffffff", 0.45) : c))
      }
    }
  },

  /** A green net slung between two iron posts, a plum pillow in it. */
  "hammock-net": (ctx, w, h) => {
    for (const x of [3, w - 5]) {
      px(ctx, "#3f6b50", x, 4, 2, h - 4)
      px(ctx, "#8cc09e", x, 4, 1, h - 4)
      disc(ctx, x + 1, 4, 3, 2, "#cfe0e4")
    }
    px(ctx, "rgba(40,60,90,0.18)", 8, h - 3, w - 16, 3)
    const sag = (x: number) => 8 + 44 * Math.sin(((x - 4) / (w - 8)) * Math.PI)
    for (let x = 5; x < w - 5; x++) {
      const top = Math.round(sag(x) - 4 * Math.sin(((x - 4) / (w - 8)) * Math.PI))
      const bottom = Math.round(sag(x) + 8 * Math.sin(((x - 4) / (w - 8)) * Math.PI))
      for (let y = top; y <= bottom; y++) {
        const mesh = (x + y) % 5 === 0 || (x - y + 200) % 5 === 0
        if (mesh) px(ctx, y === top || y === bottom ? "#2f7a58" : "#5fb27c", x, y)
        else if (y === top + 1) px(ctx, "#a8d8b4", x, y)
      }
    }
    puff(ctx, 30, Math.round(sag(30)) - 1, 13, 5, PLUM, "#2c1f3d")
    puff(ctx, 66, Math.round(sag(66)) - 2, 11, 4.2, ROSE, "#5a2c40")
  },

  /** Ivy hanging in loops from a ledge, dense at the top, thinning to a few strands. */
  "plant-ivy": (ctx, w, h) => {
    for (let s = 0; s < 9; s++) {
      const x0 = 4 + s * 7 + h2(s, 1) * 4
      const len = 30 + h2(s, 2) * (h - 34)
      const ph = h2(s, 3) * 6
      for (let y = 0; y < len; y++) {
        const x = x0 + Math.sin(y * 0.11 + ph) * 4
        px(ctx, "#2f6a4a", x, y, 1, 1)
        if (y % 7 === 3 || (y < len * 0.5 && y % 5 === 1)) {
          const dir = (y + s) % 2 ? 1 : -1
          const g = h2(s, y, 4)
          disc(ctx, x + dir * 3, y + 1, 3, 2.4, (px0, py0) => (px0 < x + dir * 3 && py0 < y + 1 ? "#a8e0b4" : g > 0.5 ? "#4f9a6c" : "#2f7a58"))
        }
      }
      disc(ctx, x0 + Math.sin(len * 0.11 + ph) * 4, len, 2.5, 3, "#8fd0a0")
    }
    px(ctx, "#2f6a4a", 0, 0, w, 2)
  },

  /** A bed built into an arched alcove in the wall: terracotta glow, a plum quilt, cream pillows, a round shelf of books. */
  "nook-bed": (ctx, w, h) => {
    const mid = w / 2
    const topAt = (x: number) => 2 + 36 * (1 - Math.sqrt(Math.max(0, 1 - ((x - mid) / mid) ** 2)))
    for (let x = 0; x < w; x++) {
      for (let y = Math.round(topAt(x)); y < h; y++) {
        const rim = x < 4 || x > w - 5 || y < topAt(x) + 4
        const t = clamp((y - topAt(x)) / 60, 0, 1)
        px(ctx, rim ? (x < mid ? PLASTER[4]! : PLASTER[2]!) : mix(mix("#e8896a", "#c26a5e", t), "#7a3d56", clamp((x - mid) / w + 0.15, 0, 1) * 0.5) , x, y)
      }
    }
    disc(ctx, w - 24, 38, 11, 11, (x, y) => (Math.hypot(x - (w - 24), y - 38) > 8.5 ? PLASTER[3]! : (x * 3 + y) % 5 === 0 ? "#cfe6f0" : BOOKS[Math.floor(h2(x >> 1, y >> 1, 2) * BOOKS.length)]!))
    px(ctx, "#fbe8ee", 10, h - 40, 3, 26)
    puff(ctx, 22, h - 34, 11, 6, ["#cdbfd0", "#ddd0dc", "#ece2ea", "#f7f1f5", "#ffffff"])
    puff(ctx, 44, h - 31, 9, 5, ROSE)
    for (let x = 8; x < w - 8; x++) {
      const top = h - 28 + Math.round(2 * Math.sin(x * 0.18))
      for (let y = top; y < h - 6; y++) px(ctx, y < top + 2 ? PLUM[3]! : (x + y) % 6 < 3 ? PLUM[1]! : PLUM[2]!, x, y)
    }
    px(ctx, PLASTER[2]!, 0, h - 8, w, 8)
    px(ctx, PLASTER[4]!, 0, h - 8, w, 1)
  },

  /** A round rug in plum, teal and cream: a medallion, bands of pattern, a fringe. */
  "rug-persian": (ctx, w, h) => {
    const cx = w / 2
    const cy = h / 2
    disc(ctx, cx, cy, cx, cy, (x, y) => {
      const e = Math.hypot((x - cx) / cx, (y - cy) / cy)
      if (e > 0.97) return "#efe6ea"
      if (e > 0.88) return (x >> 2) % 2 ? "#59407a" : "#cdb6e0"
      if (e > 0.8) return "#efe6ea"
      if (e > 0.5) {
        const a = Math.atan2((y - cy) * 2.2, x - cx)
        return Math.floor((a + Math.PI) * 3.2) % 2 ? ((x + y) % 4 === 0 ? "#cdb6e0" : "#7a5d9c") : (x + y) % 4 === 0 ? "#9fd3c8" : "#3f8f86"
      }
      if (e > 0.42) return "#efe6ea"
      return Math.floor(e * 14) % 2 ? "#b5758c" : "#e8c4d0"
    })
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2
      px(ctx, "#efe6ea", cx + Math.cos(a) * (cx + 1), cy + Math.sin(a) * (cy + 1), 1, 1)
    }
  },

  /** A soft moss rug with a pale rim. */
  "rug-moss": (ctx, w, h) => {
    const cx = w / 2
    const cy = h / 2
    disc(ctx, cx, cy, cx, cy, (x, y) => {
      const e = Math.hypot((x - cx) / cx, (y - cy) / cy)
      if (e > 0.9) return "#e8f2e4"
      return h2(x, y, 6) > 0.8 ? MOSS[4]! : h2(x, y, 7) > 0.6 ? MOSS[2]! : MOSS[3]!
    })
  },

  /** A silver swan holding a white candle. */
  "swan-candle": (ctx, w, h) => {
    disc(ctx, 8, 15, 7, 3.4, (x) => (x < 6 ? "#ffffff" : "#c9d8e4"))
    for (let y = 8; y < 15; y++) px(ctx, "#e8f0f6", 12 + Math.round(Math.sin((y - 8) * 0.5) * 1.4), y, 2, 1)
    px(ctx, SILVER.deep, 14, 7, 2, 1)
    px(ctx, "#fafcff", 3, 3, 3, 9)
    px(ctx, "#ffd9c0", 4, 1, 1, 2)
    void w
    void h
  },

  /** A tall celadon vase with a branch of blossom. */
  "vase-tall": (ctx, w, h) => {
    for (let y = 18; y < h; y++) {
      const hw = Math.round(3 + 4.5 * Math.sin(((y - 18) / (h - 18)) * Math.PI * 0.95) + (y > h - 4 ? -1 : 0))
      for (let x = -hw; x <= hw; x++) px(ctx, x < -hw / 3 ? "#bfe2d2" : x > hw / 2 ? "#6fa592" : "#98c8b4", 9 + x, y)
    }
    for (const [dx, dy] of [[-4, 12], [0, 6], [4, 10], [-1, 1], [5, 3]] as const) {
      for (let k = 0; k < 6; k++) px(ctx, "#6f5a50", 9 + dx * (k / 6), 18 - k * 2.6 + (dy > 5 ? 0 : 0), 1, 1)
      disc(ctx, 9 + dx, dy, 2.2, 2.2, (x) => (x < 9 + dx ? "#fbe0ea" : "#ee9fbb"))
    }
  },

  /** A glass-faced orb clock: silver rim, ticks, two hands. */
  "clock-orb": (ctx, w, h) => {
    const c = w / 2
    disc(ctx, c, c, c - 1, c - 1, (x, y) => (Math.hypot(x - c, y - c) > c - 3.2 ? SILVER.mid : x < c - 3 && y < c - 3 ? "#ffffff" : "#eef6f6"))
    for (let i = 0; i < 12; i++) px(ctx, "#5f7f98", c + Math.cos((i * Math.PI) / 6) * (c - 5), c + Math.sin((i * Math.PI) / 6) * (c - 5), 1, 1)
    for (let k = 0; k < 6; k++) px(ctx, "#2c3a4c", c, c - k, 1, 1)
    for (let k = 0; k < 5; k++) px(ctx, "#2c3a4c", c + k, c + (k >> 1), 1, 1)
    void h
  },

  /** A stair that winds round a pole of iron: stone treads in a spiral, a silver rail climbing with them. */
  "stair-spiral": (ctx, w, h) => {
    const cx = w / 2
    px(ctx, SILVER.hi, cx - 1, 0, 1, h - 4)
    px(ctx, SILVER.deep, cx + 1, 0, 1, h - 4)
    px(ctx, SILVER.mid, cx, 0, 1, h - 4)
    for (let i = 0; i < 12; i++) {
      const y = h - 8 - i * 10.4
      const a = i * 0.9
      const reach = 27 * Math.cos(a)
      const x0 = cx + Math.min(0, reach)
      const wd = Math.abs(reach) + 3
      for (let x = Math.round(x0); x < Math.round(x0 + wd); x++) {
        px(ctx, "#ffffff", x, y, 1, 1)
        px(ctx, PLASTER[3]!, x, y + 1, 1, 2)
        px(ctx, mix(PLASTER[1]!, "#6a8fa0", 0.3), x, y + 3, 1, 1)
        px(ctx, INK, x, y + 4, 1, 1)
      }
      px(ctx, INK, Math.round(x0) - 1, y + 1, 1, 3)
      px(ctx, INK, Math.round(x0 + wd), y + 1, 1, 3)
      const rx = cx + Math.sign(reach || 1) * (Math.abs(reach) + 2)
      px(ctx, SILVER.deep, rx, y - 8, 1, 9)
      px(ctx, SILVER.hi, rx - 1, y - 8, 1, 9)
    }
    for (let k = 0; k < 120; k++) px(ctx, WOOD.lite, cx + 22 * Math.cos(k * 0.18 - 0.4), h - 20 - k * 0.92, 1, 1)
    disc(ctx, cx, h - 4, 14, 3.5, (x) => (x < cx ? PLASTER[3]! : PLASTER[1]!))
    px(ctx, WOOD.dark, 0, 0, 0, 0)
    void w
  },
}

const cache = new Map<string, HTMLCanvasElement>()

/** A code-painted piece in a canvas of its size; null when no such piece is made. */
export function madeCanvas(id: string): HTMLCanvasElement | null {
  const size = MADE[id]
  const paint = PAINT[id]
  if (!size || !paint) return null
  let c = cache.get(id)
  if (!c) {
    c = document.createElement("canvas")
    c.width = size.w
    c.height = size.h
    const ctx = c.getContext("2d")!
    ctx.imageSmoothingEnabled = false
    paint(ctx, size.w, size.h)
    cache.set(id, c)
  }
  return c
}

/** Ids that have a painter, for the test that every size has one. */
export const MADE_PAINTERS = Object.keys(PAINT)
