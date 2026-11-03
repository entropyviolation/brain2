/**
 * components/BabyGame/homeart-hi.ts — Friends' homes at twice the detail
 *
 * Each kind is painted once onto a 96×96 canvas (three game tiles wide and tall, bottom-centre on the home tile) and kept,
 * one per kind and per lit window. `drawHomeHi` stamps it at one real pixel per canvas pixel, so the village must be
 * painting at `DETAIL` (2) real pixels per game pixel. Same palette family as `homeart.ts`; the small painters there stay
 * as the fallback for a frame at 1×.
 */

import type { HomeKind } from "@/lib/baby-game/homes"

type Ctx = CanvasRenderingContext2D

export const HOME_PX = 96

const WOOD = { hi: "#d19a7e", mid: "#a06a4e", deep: "#7c4f38", dark: "#503324" }
const STRAW = { hi: "#f0e2cc", mid: "#d6bfa2", deep: "#a98d6f", dark: "#7c6450" }
const STONE = { hi: "#c9d2d9", mid: "#9aa6b0", deep: "#6c7782", dark: "#47515b" }
const LEAF = { hi: "#a4dd8e", mid: "#6cba73", deep: "#3f9060", dark: "#2c6a4c" }
const EARTH = { hi: "#b99a82", mid: "#8a6c56", deep: "#5e4533", hole: "#2b1d1e" }
const ICE = { hi: "#ffffff", mid: "#e6f1fa", deep: "#bcd0e4", line: "#9fb6cc" }
const GLOW = "#ffe9b8"
const GLASS = "#4a5a70"

/** Same seed, same speckle: a tiny deterministic hash for texture. */
const hash = (a: number, b: number) => {
  let t = (a * 374761393 + b * 668265263) >>> 0
  t = (t ^ (t >>> 13)) * 1274126177
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}

const rect = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

/** A filled ellipse made of one-pixel rows, so its edge is hard like the rest of the pixels. */
function disc(c: Ctx, color: string, cx: number, cy: number, rx: number, ry: number, from = -ry, to = ry) {
  c.fillStyle = color
  for (let dy = Math.ceil(from); dy <= to; dy++) {
    const k = Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)))
    const w = Math.round(rx * k)
    c.fillRect(cx - w, cy + dy, w * 2, 1)
  }
}

const shadow = (c: Ctx, cx: number, rx: number) => disc(c, "rgba(20,30,20,0.28)", cx, 92, rx, 4)

/** Grass and flowers along a footing. */
function verge(c: Ctx, x0: number, x1: number, y: number, seed: number) {
  for (let x = x0; x < x1; x += 2) {
    const r = hash(x, seed)
    const h = 2 + Math.floor(r * 4)
    rect(c, r > 0.5 ? LEAF.mid : LEAF.deep, x, y - h, 1, h + 1)
    if (r > 0.9) rect(c, "#fff4c8", x, y - h - 2, 2, 2)
    else if (r < 0.06) rect(c, "#f6a5c0", x, y - h - 2, 2, 2)
  }
}

/** A window with a cross frame; lit ones glow warm. */
function windowAt(c: Ctx, x: number, y: number, w: number, h: number, lit: boolean) {
  rect(c, WOOD.dark, x - 2, y - 2, w + 4, h + 4)
  rect(c, lit ? GLOW : GLASS, x, y, w, h)
  if (!lit) {
    rect(c, "#6f84a0", x + 1, y + 1, 3, 2)
    rect(c, "#6f84a0", x + 1, y + 1, 1, 4)
  } else {
    rect(c, "#fff6dc", x + 2, y + 2, w - 4, h - 4)
  }
  rect(c, WOOD.mid, x + Math.floor(w / 2) - 1, y, 2, h)
  rect(c, WOOD.mid, x, y + Math.floor(h / 2) - 1, w, 2)
  rect(c, WOOD.hi, x - 3, y + h + 2, w + 6, 2)
}

/** Vertical boards with a grain line and the odd knot. */
function planks(c: Ctx, x: number, y: number, w: number, h: number, seed: number) {
  for (let i = 0; i < w; i += 6) {
    rect(c, (i / 6) % 2 ? WOOD.mid : WOOD.deep, x + i, y, Math.min(6, w - i), h)
    rect(c, WOOD.dark, x + i, y, 1, h)
    rect(c, WOOD.hi, x + i + 1, y, 1, h)
    if (hash(i, seed) > 0.7) rect(c, WOOD.dark, x + i + 3, y + 4 + Math.floor(hash(seed, i) * (h - 10)), 2, 2)
  }
}

/** A roof from the ridge down: courses of shingles that step out, each with a light top edge and a dark drip line. */
function shingledRoof(c: Ctx, cx: number, peak: number, eave: number, halfEave: number, base: string[], seed: number) {
  const rows = Math.floor((eave - peak) / 4)
  for (let r = 0; r < rows; r++) {
    const y = peak + r * 4
    const half = Math.round(4 + ((halfEave - 4) * (r + 1)) / rows)
    const col = base[r % 2]!
    rect(c, col, cx - half, y, half * 2, 4)
    for (let x = cx - half + (r % 2) * 4; x < cx + half; x += 8) {
      rect(c, base[2]!, x, y, 1, 4)
      if (hash(x, r + seed) > 0.8) rect(c, base[3]!, x + 2, y + 1, 3, 2)
    }
    rect(c, base[3]!, cx - half, y + 3, half * 2, 1)
    rect(c, base[4]!, cx - half, y, half * 2, 1)
  }
  // a ridge cap
  rect(c, base[2]!, cx - 3, peak - 2, 6, 4)
}

type Painter = (c: Ctx, lit: boolean) => void

const PAINT: Record<HomeKind, Painter> = {
  hutch(c, lit) {
    shadow(c, 48, 40)
    // chimney behind the roof
    rect(c, "#8a4f45", 60, 24, 12, 26)
    rect(c, "#a8665a", 60, 24, 4, 26)
    rect(c, "#5c322c", 58, 22, 16, 4)
    for (let y = 30; y < 50; y += 6) rect(c, "#5c322c", 60, y, 12, 1)
    // body
    planks(c, 16, 50, 64, 40, 3)
    rect(c, STONE.mid, 14, 86, 68, 6)
    for (let x = 14; x < 82; x += 8) rect(c, STONE.hi, x + 1, 87, 5, 2)
    rect(c, WOOD.dark, 14, 48, 68, 3)
    // gable window under the ridge
    rect(c, WOOD.dark, 43, 36, 10, 12)
    rect(c, lit ? GLOW : GLASS, 45, 38, 6, 8)
    shingledRoof(c, 48, 14, 52, 48, ["#4e74e8", "#6c8cf4", "#2f4fb8", "#3a5fd0", "#93aefc"], 1)
    // the door with an arch, a knob and a mat
    rect(c, WOOD.dark, 38, 60, 20, 30)
    rect(c, WOOD.deep, 40, 62, 16, 28)
    rect(c, WOOD.mid, 42, 62, 5, 28)
    rect(c, WOOD.mid, 49, 62, 5, 28)
    rect(c, "#f2d27a", 52, 76, 2, 2)
    rect(c, "#c8544d", 40, 91, 16, 2)
    windowAt(c, 20, 62, 12, 12, lit)
    windowAt(c, 64, 62, 12, 12, lit)
    // flower boxes
    for (const bx of [18, 62]) {
      rect(c, WOOD.deep, bx, 78, 16, 5)
      for (let i = 0; i < 8; i++) rect(c, i % 3 ? "#f6a5c0" : "#fff4c8", bx + 1 + i * 2, 75 - (i % 2), 2, 3)
    }
    verge(c, 10, 86, 91, 5)
  },

  stall(c, lit) {
    shadow(c, 48, 42)
    // back wall, boards, then the dark opening with straw
    planks(c, 8, 44, 80, 46, 7)
    rect(c, WOOD.dark, 8, 44, 80, 3)
    rect(c, "#3a2a24", 26, 54, 44, 36)
    rect(c, "#2b1d1e", 28, 56, 40, 34)
    if (lit) {
      rect(c, "rgba(255,226,170,0.55)", 30, 58, 36, 30)
      disc(c, "rgba(255,240,200,0.5)", 48, 72, 10, 8)
    }
    rect(c, STRAW.mid, 28, 82, 40, 8)
    for (let x = 28; x < 68; x += 3) rect(c, hash(x, 4) > 0.5 ? STRAW.hi : STRAW.deep, x, 80 + Math.floor(hash(x, 9) * 4), 2, 4)
    // posts, a hay rack and a bucket
    rect(c, WOOD.dark, 22, 46, 6, 44)
    rect(c, WOOD.dark, 68, 46, 6, 44)
    rect(c, WOOD.hi, 23, 46, 1, 44)
    rect(c, WOOD.deep, 30, 66, 36, 3)
    rect(c, WOOD.deep, 6, 76, 14, 14)
    rect(c, STRAW.mid, 8, 74, 10, 4)
    // a low roof with a deep overhang and a loft hatch
    for (let r = 0; r < 9; r++) {
      const y = 22 + r * 4
      const half = 36 + r * 2
      rect(c, r % 2 ? "#c9804f" : "#b9703f", 48 - half, y, half * 2, 4)
      for (let x = 48 - half + (r % 2) * 5; x < 48 + half; x += 10) rect(c, "#8d4f2c", x, y, 1, 4)
      rect(c, "#8d4f2c", 48 - half, y + 3, half * 2, 1)
    }
    rect(c, "#e1a070", 12, 22, 72, 1)
    rect(c, WOOD.dark, 40, 28, 16, 10)
    rect(c, STRAW.mid, 42, 30, 12, 6)
    verge(c, 6, 90, 91, 11)
  },

  nest(c, lit) {
    shadow(c, 48, 34)
    // a thick stump with rings, roots and moss
    rect(c, WOOD.deep, 34, 72, 28, 20)
    rect(c, WOOD.mid, 38, 72, 18, 20)
    rect(c, WOOD.hi, 40, 72, 3, 20)
    for (let y = 76; y < 90; y += 5) rect(c, WOOD.dark, 34 + (y % 3), y, 8, 1)
    rect(c, WOOD.deep, 26, 86, 14, 6)
    rect(c, WOOD.deep, 56, 86, 14, 6)
    rect(c, LEAF.mid, 34, 72, 8, 3)
    rect(c, LEAF.hi, 36, 72, 3, 1)
    // the bowl: a round basket of woven straw, widest at the rim
    for (let r = 0; r < 18; r++) {
      const y = 40 + r * 2
      const half = Math.round(42 * Math.sqrt(1 - (r / 20) * (r / 20) * 0.85))
      for (let x = 48 - half; x < 48 + half; x += 2) {
        const k = hash(x + r * 7, r)
        rect(c, k > 0.66 ? STRAW.hi : k > 0.33 ? STRAW.mid : STRAW.deep, x, y, 2, 2)
      }
      rect(c, STRAW.dark, 48 - half, y + 1, half * 2, 1)
      rect(c, STRAW.hi, 48 - half, y, 3, 2)
    }
    disc(c, STRAW.deep, 48, 40, 42, 6)
    disc(c, EARTH.hole, 48, 41, 36, 4)
    disc(c, "#f6e8cf", 36, 40, 6, 3)
    disc(c, "#e8f0f6", 50, 41, 6, 3)
    disc(c, "#f6e8cf", 62, 40, 5, 3)
    rect(c, STRAW.hi, 8, 38, 80, 1)
    // twigs sticking out, a feather, and the round doorway low in the bowl
    rect(c, WOOD.deep, 4, 48, 14, 2)
    rect(c, WOOD.deep, 78, 52, 14, 2)
    rect(c, WOOD.mid, 8, 40, 2, 10)
    rect(c, WOOD.mid, 84, 44, 2, 10)
    disc(c, EARTH.deep, 48, 62, 11, 9)
    disc(c, EARTH.hole, 48, 62, 8, 7)
    if (lit) disc(c, GLOW, 48, 63, 5, 4)
    rect(c, "#f4faf8", 70, 22, 2, 16)
    rect(c, "#cfe0ec", 72, 24, 2, 12)
    rect(c, "#9fb6c8", 70, 22, 1, 16)
    verge(c, 12, 84, 92, 17)
  },

  burrow(c, lit) {
    shadow(c, 48, 42)
    // the mound, banded from dark soil to bright turf
    for (let r = 0; r < 38; r++) {
      const y = 54 + r
      const half = Math.round(46 * Math.sqrt(1 - ((38 - r) / 38) * ((38 - r) / 38) * 0.82))
      rect(c, r < 6 ? LEAF.hi : r < 14 ? LEAF.mid : r < 24 ? LEAF.deep : LEAF.dark, 48 - half, y, half * 2, 1)
    }
    for (let i = 0; i < 70; i++) {
      const x = 8 + Math.floor(hash(i, 1) * 80)
      const y = 56 + Math.floor(hash(i, 2) * 34)
      rect(c, hash(i, 3) > 0.5 ? LEAF.hi : LEAF.dark, x, y, 1, 3)
    }
    // stones round the door and a wooden frame
    disc(c, EARTH.deep, 48, 84, 19, 22, -22, 8)
    disc(c, WOOD.mid, 48, 84, 16, 19, -19, 8)
    disc(c, EARTH.hole, 48, 85, 12, 15, -15, 7)
    if (lit) disc(c, GLOW, 48, 88, 8, 8, -5, 4)
    for (const [sx, sy] of [[28, 88], [26, 78], [30, 68], [68, 88], [70, 78], [66, 68], [40, 64], [56, 64]] as const) {
      rect(c, STONE.mid, sx - 3, sy - 2, 7, 5)
      rect(c, STONE.hi, sx - 3, sy - 2, 7, 1)
      rect(c, STONE.deep, sx - 3, sy + 2, 7, 1)
    }
    // flowers and a carrot sign
    for (const [fx, fy, col] of [[14, 76, "#f6a5c0"], [20, 70, "#fff4c8"], [78, 72, "#fff4c8"], [84, 80, "#f6a5c0"]] as const) {
      rect(c, LEAF.deep, fx, fy, 1, 6)
      rect(c, col, fx - 1, fy - 3, 3, 3)
      rect(c, "#f0b050", fx, fy - 2, 1, 1)
    }
    rect(c, WOOD.mid, 72, 58, 2, 14)
    rect(c, WOOD.hi, 66, 54, 14, 7)
    rect(c, "#e8873a", 70, 56, 6, 3)
    rect(c, LEAF.mid, 72, 54, 2, 2)
    verge(c, 4, 92, 92, 23)
  },

  den(c, lit) {
    shadow(c, 48, 44)
    // a pile of boulders, each shaded top-left to bottom-right
    const rocks: Array<[number, number, number, number, number]> = [
      [20, 56, 20, 26, 0], [4, 72, 20, 18, 1], [64, 54, 24, 30, 2], [78, 74, 14, 16, 0], [34, 40, 34, 20, 1], [28, 36, 18, 14, 2], [50, 34, 20, 16, 0], [40, 30, 12, 8, 1],
    ]
    for (const [x, y, w, h, v] of rocks) {
      const cols = v === 0 ? [STONE.hi, STONE.mid, STONE.deep] : v === 1 ? [STONE.mid, STONE.deep, STONE.dark] : [STONE.hi, "#8793a0", STONE.deep]
      disc(c, cols[2]!, x + w / 2, y + h / 2, w / 2, h / 2)
      disc(c, cols[1]!, x + w / 2 - 1, y + h / 2 - 1, w / 2 - 2, h / 2 - 2)
      disc(c, cols[0]!, x + w / 2 - 3, y + h / 2 - 4, Math.max(2, w / 4), Math.max(2, h / 5))
    }
    // the cave mouth
    rect(c, STONE.deep, 28, 78, 40, 14)
    disc(c, STONE.dark, 48, 80, 24, 28, -28, 12)
    disc(c, EARTH.hole, 48, 82, 19, 24, -24, 10)
    if (lit) {
      disc(c, "rgba(255,170,130,0.75)", 48, 86, 9, 7, -4, 6)
      rect(c, "rgba(255,214,170,0.9)", 44, 86, 8, 2)
    }
    // moss, ferns and a paw print on the doorstep
    for (const [mx, my, mw] of [[6, 82, 14], [28, 56, 16], [70, 52, 12], [74, 86, 16], [44, 28, 10]] as const) {
      rect(c, LEAF.deep, mx, my, mw, 3)
      rect(c, LEAF.mid, mx + 1, my - 1, mw - 3, 2)
      rect(c, LEAF.hi, mx + 2, my - 1, 3, 1)
    }
    rect(c, "#d9c9b4", 44, 90, 3, 3)
    rect(c, "#d9c9b4", 49, 90, 3, 3)
    rect(c, "#d9c9b4", 46, 93, 4, 2)
    verge(c, 2, 94, 92, 29)
  },

  hollow(c, lit) {
    shadow(c, 48, 36)
    // roots flaring out, then the trunk with long bark ridges
    for (const [dx, w] of [[-26, 14], [20, 14], [-14, 10], [8, 12]] as const) {
      rect(c, WOOD.deep, 48 + dx, 84, w, 8)
      rect(c, WOOD.mid, 48 + dx + 2, 84, w - 5, 3)
    }
    for (let y = 30; y < 92; y++) {
      const flare = y > 80 ? (y - 80) / 2 : 0
      const half = 17 + Math.round(flare)
      rect(c, WOOD.deep, 48 - half, y, half * 2, 1)
      rect(c, WOOD.mid, 48 - half + 5, y, half * 2 - 12, 1)
    }
    for (let x = 34; x < 64; x += 5) {
      const top = 36 + Math.floor(hash(x, 2) * 14)
      rect(c, WOOD.dark, x, top, 1, 40)
      rect(c, WOOD.hi, x + 1, top + 6, 1, 26)
    }
    // the round hollow with a lip, a sill and a small ladder
    disc(c, WOOD.dark, 48, 62, 12, 15)
    disc(c, EARTH.hole, 48, 63, 9, 12)
    if (lit) disc(c, GLOW, 48, 66, 6, 7)
    rect(c, WOOD.hi, 38, 76, 20, 3)
    rect(c, WOOD.dark, 42, 79, 2, 13)
    rect(c, WOOD.dark, 52, 79, 2, 13)
    for (let y = 82; y < 92; y += 4) rect(c, WOOD.mid, 42, y, 12, 2)
    // a canopy of leaf clusters, light from the top left
    const puffs: Array<[number, number, number, number]> = [[26, 22, 20, 14], [48, 12, 22, 14], [70, 22, 20, 14], [36, 30, 18, 12], [60, 30, 18, 12], [48, 26, 24, 14]]
    for (const [px, py, rx, ry] of puffs) disc(c, LEAF.dark, px, py + 3, rx, ry)
    for (const [px, py, rx, ry] of puffs) disc(c, LEAF.deep, px, py, rx, ry)
    for (const [px, py, rx, ry] of puffs) disc(c, LEAF.mid, px - 2, py - 2, rx - 4, ry - 4)
    for (const [px, py, rx, ry] of puffs) disc(c, LEAF.hi, px - 5, py - 5, Math.floor(rx / 3), Math.floor(ry / 4))
    for (let i = 0; i < 24; i++) rect(c, hash(i, 8) > 0.5 ? LEAF.hi : LEAF.dark, 8 + Math.floor(hash(i, 5) * 80), 8 + Math.floor(hash(i, 6) * 32), 2, 2)
    verge(c, 14, 82, 92, 31)
  },

  lodge(c, lit) {
    shadow(c, 48, 44)
    // water at its foot
    disc(c, "#8fb8dc", 48, 88, 46, 6)
    disc(c, "#b4d4ee", 40, 87, 20, 2)
    // the dome: horizontal logs, each one a little different and sticking out at the ends
    for (let r = 0; r < 36; r++) {
      const y = 52 + r
      const half = Math.round(44 * Math.sqrt(1 - ((36 - r) / 36) * ((36 - r) / 36) * 0.95))
      for (let x = 48 - half; x < 48 + half; x += 3) {
        const k = hash(x + r * 11, r)
        rect(c, r % 4 === 0 ? WOOD.dark : k > 0.66 ? WOOD.hi : k > 0.33 ? WOOD.mid : WOOD.deep, x, y, 3, 1)
      }
    }
    for (let i = 0; i < 16; i++) {
      const y = 54 + Math.floor(hash(i, 3) * 32)
      const half = Math.round(44 * Math.sqrt(1 - ((88 - y) / 36) * ((88 - y) / 36) * 0.95))
      const side = i % 2 ? 1 : -1
      rect(c, i % 3 ? WOOD.mid : WOOD.deep, 48 + side * (half - 2), y, side * 6 || 6, 2)
    }
    // mud packing, a few reeds, a low round entrance
    for (let i = 0; i < 20; i++) rect(c, EARTH.mid, 8 + Math.floor(hash(i, 4) * 80), 62 + Math.floor(hash(i, 7) * 26), 3, 2)
    disc(c, EARTH.deep, 48, 90, 15, 20, -20, 2)
    disc(c, EARTH.hole, 48, 90, 11, 16, -16, 2)
    if (lit) disc(c, GLOW, 48, 90, 7, 8, -8, 0)
    for (const rx of [8, 12, 84, 88]) {
      rect(c, LEAF.deep, rx, 70, 1, 22)
      rect(c, LEAF.mid, rx + 1, 66, 1, 22)
      rect(c, "#8a6c56", rx - 1, 62, 3, 6)
    }
  },

  igloo(c, lit) {
    shadow(c, 48, 42)
    // a dome of snow blocks: courses that tighten toward the crown, staggered joints
    const R = 42
    for (let r = 0; r < 44; r++) {
      const y = 50 + r
      const half = Math.round(R * Math.sqrt(1 - ((44 - r) / 44) * ((44 - r) / 44)))
      const course = Math.floor(r / 8)
      for (let x = 48 - half; x < 48 + half; x++) {
        const joint = (x + (course % 2) * 7) % 14 === 0
        const edge = r % 8 === 7
        const shade = x < 48 - half * 0.2 ? ICE.hi : x > 48 + half * 0.5 ? ICE.deep : ICE.mid
        rect(c, joint || edge ? ICE.line : shade, x, y, 1, 1)
      }
    }
    // a sparkle on the crown and a drift round the base
    rect(c, "#ffffff", 34, 58, 5, 2)
    rect(c, "#ffffff", 30, 62, 2, 2)
    disc(c, ICE.hi, 48, 92, 46, 5, -5, 0)
    disc(c, ICE.mid, 48, 93, 38, 3, -3, 0)
    // the tunnel entrance: a short snow corridor with a dark mouth
    rect(c, ICE.deep, 30, 74, 36, 18)
    disc(c, ICE.mid, 48, 76, 18, 8, -8, 0)
    rect(c, ICE.line, 30, 74, 36, 1)
    disc(c, "#44607c", 48, 92, 12, 14, -14, 0)
    disc(c, lit ? GLOW : "#2a3a50", 48, 92, 8, 10, -10, 0)
    // icicles hanging from the lip
    for (let x = 34; x < 64; x += 5) rect(c, "#ffffff", x, 78, 2, 2 + Math.floor(hash(x, 3) * 4))
  },
}

const cache = new Map<string, HTMLCanvasElement>()

/** The painted home for a kind, once per lit state. */
export function homeCanvas(kind: HomeKind, lit: boolean): HTMLCanvasElement {
  const key = `${kind}:${lit ? 1 : 0}`
  let c = cache.get(key)
  if (!c) {
    c = document.createElement("canvas")
    c.width = c.height = HOME_PX
    PAINT[kind](c.getContext("2d")!, lit)
    cache.set(key, c)
  }
  return c
}

/** Stand a home on its tile: bottom-centre of the 96px picture on `(baseX, baseY)`, in game pixels, at 1 canvas pixel per
 * real pixel. The context is already scaled by `DETAIL`, so the picture is drawn at `1/DETAIL` and lands 1:1. */
export function drawHomeHi(ctx: Ctx, kind: HomeKind, baseX: number, baseY: number, lit: boolean, detail: number) {
  const img = homeCanvas(kind, lit)
  const size = HOME_PX / detail
  ctx.drawImage(img, Math.round(baseX - size / 2), Math.round(baseY - size), size, size)
}
