/**
 * components/BabyGame/art.ts — Hand-painted scenery: the marble cottage, plants, the campfire, crops, and rain
 *
 * Everything here draws with plain rectangles at the game's native pixel size, so it stays crisp when the canvas is scaled.
 * The cottage is a white marble ruin in the Escher manner: arched doorway between fluted columns, arched windows, a roof that is
 * half terracotta and half open sky, ivy, and a stairway that climbs the right side to an arch that opens onto nothing.
 */

type Ctx = CanvasRenderingContext2D

function px(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

const h2 = (x: number, y: number, k = 0) => {
  let t = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0
  t = (t ^ (t >>> 13)) * 1274126177
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}

const M = { hi: "#fbf9fd", lite: "#f0ecf5", mid: "#dcd6e6", shade: "#bdb5cc", deep: "#9a92ab", vein: "#c9c1d7", crack: "#8a829c" }
const TERRA = { hi: "#e8926a", mid: "#d0724e", deep: "#a8523a", rim: "#7e3a2c" }
const IVY = { hi: "#8fd48a", mid: "#4f9a4e", deep: "#2f7a45" }

function block(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number) {
  px(ctx, M.lite, x, y, w, h)
  px(ctx, M.hi, x, y, w, 1)
  px(ctx, M.hi, x, y, 1, h)
  px(ctx, M.shade, x, y + h - 1, w, 1)
  px(ctx, M.shade, x + w - 1, y, 1, h)
  if (h2(seed, 1) < 0.5) px(ctx, M.vein, x + 2 + Math.floor(h2(seed, 2) * (w - 6)), y + 1 + Math.floor(h2(seed, 3) * (h - 3)), 3, 1)
  if (h2(seed, 4) < 0.18) px(ctx, M.crack, x + 3, y + 2, 1, Math.max(1, h - 4))
}

/** A fluted column, capital and base, `h` tall. */
function column(ctx: Ctx, x: number, y: number, h: number) {
  px(ctx, M.mid, x + 1, y + 3, 6, h - 6)
  px(ctx, M.hi, x + 1, y + 3, 1, h - 6)
  px(ctx, M.hi, x + 3, y + 3, 1, h - 6)
  px(ctx, M.shade, x + 5, y + 3, 1, h - 6)
  px(ctx, M.shade, x + 7, y + 3, 1, h - 6)
  px(ctx, M.lite, x, y, 8, 3)
  px(ctx, M.hi, x, y, 8, 1)
  px(ctx, M.shade, x, y + 2, 8, 1)
  px(ctx, M.lite, x - 1, y + h - 3, 10, 3)
  px(ctx, M.shade, x - 1, y + h - 1, 10, 1)
}

function archFill(ctx: Ctx, cx: number, top: number, w: number, h: number, fill: string, rim = M.shade) {
  // a round-headed opening: a rectangle with a half-disc on top
  const r = w / 2
  for (let y = 0; y < h; y++) {
    const inset = y < r ? Math.round(r - Math.sqrt(Math.max(0, r * r - (r - y) * (r - y)))) : 0
    px(ctx, fill, cx - r + inset, top + y, w - inset * 2, 1)
  }
  for (let y = 0; y < Math.min(h, r + 1); y++) {
    const inset = Math.round(r - Math.sqrt(Math.max(0, r * r - (r - y) * (r - y))))
    px(ctx, rim, cx - r + inset - 1, top + y, 1, 1)
    px(ctx, rim, cx + r - inset, top + y, 1, 1)
  }
}

/** The whole cottage, painted on a 80×64 area whose top-left is (ox, oy): five tiles wide, four tall. */
export function paintHouse(ctx: Ctx, ox: number, oy: number) {
  const P = (c: string, x: number, y: number, w = 1, h = 1) => px(ctx, c, ox + x, oy + y, w, h)

  // the broken roof: terracotta barrels on the left, open sky and a bare rafter on the right
  const roofTop = 16
  for (let row = 0; row < 7; row++) {
    const left = 4 + row
    const right = row < 4 ? 66 - row * 2 : 58 - (row - 3) * 2
    for (let x = left; x < right; x += 4) {
      const tone = (x / 4 + row) % 2 ? TERRA.mid : TERRA.hi
      P(tone, x, roofTop + row * 4, 4, 4)
      P(TERRA.deep, x + 3, roofTop + row * 4, 1, 4)
      P(TERRA.rim, x, roofTop + row * 4 + 3, 4, 1)
    }
  }
  // sky showing through the fallen part, a beam across it
  P("#a8d8f4", 52, 24, 14, 8)
  P("#c8e8fa", 52, 24, 14, 2)
  P("#6b4630", 50, 30, 18, 2)
  P("#8a5a44", 50, 30, 18, 1)

  // the marble body
  const bodyTop = 32
  for (let by = bodyTop; by < 58; by += 7) {
    for (let bx = 4; bx < 76; bx += 11) block(ctx, ox + bx + ((by / 7) % 2 ? 5 : 0) - 5 * ((by / 7) % 2 ? 1 : 0), oy + by, 11, 7, bx * 7 + by)
  }
  px(ctx, M.lite, ox + 2, oy + bodyTop - 3, 76, 3)
  px(ctx, M.hi, ox + 2, oy + bodyTop - 3, 76, 1)
  px(ctx, M.shade, ox + 2, oy + bodyTop - 1, 76, 1)
  // a cornice with a few missing teeth
  for (let x = 4; x < 76; x += 5) if (h2(x, 9) > 0.25) px(ctx, M.mid, ox + x, oy + bodyTop - 5, 3, 2)

  // the doorway: columns and a round arch, a plank door inside
  column(ctx, ox + 25, oy + 31, 33)
  column(ctx, ox + 47, oy + 31, 33)
  archFill(ctx, ox + 40, oy + 33, 18, 31, M.shade, M.deep)
  archFill(ctx, ox + 40, oy + 36, 14, 28, "#7a4e3a", M.deep)
  for (let x = 34; x < 47; x += 3) P("#5a3628", x, 40, 1, 24)
  P("#5a3628", 33, 50, 14, 1)
  P("#ffb3d1", 44, 52, 2, 2)
  // the keystone
  P(M.hi, 38, 33, 4, 3)
  P(M.shade, 38, 35, 4, 1)

  // arched windows with sky-blue glass and a flower box
  for (const wx of [11, 62]) {
    archFill(ctx, ox + wx + 4, oy + 38, 10, 14, "#7fb8d8", M.deep)
    px(ctx, "#c8e8fa", ox + wx, oy + 41, 3, 1)
    px(ctx, "#4e86a8", ox + wx + 4, oy + 42, 1, 10)
    px(ctx, "#4e86a8", ox + wx, oy + 46, 9, 1)
    px(ctx, M.shade, ox + wx - 1, oy + 52, 11, 2)
    px(ctx, "#8a5a44", ox + wx, oy + 52, 9, 2)
    for (let i = 0; i < 4; i++) {
      px(ctx, i % 2 ? "#ff9db8" : "#ffffff", ox + wx + 1 + i * 2, oy + 50, 2, 2)
      px(ctx, "#4f9a4e", ox + wx + 1 + i * 2, oy + 52, 1, 1)
    }
  }

  // ivy climbing the left and over the cornice
  for (let i = 0; i < 26; i++) {
    const y = 34 + Math.floor(i * 0.9)
    const x = 6 + Math.round(Math.sin(i * 0.7) * 2)
    P(i % 3 ? IVY.mid : IVY.hi, x, y, 3, 2)
    if (i % 4 === 0) P(IVY.deep, x + 2, y + 1, 2, 2)
  }
  for (let i = 0; i < 12; i++) P(i % 2 ? IVY.mid : IVY.hi, 8 + i * 5, bodyTop - 5 + (i % 3), 3, 3)

  // the plinth and three worn steps
  px(ctx, M.mid, ox, oy + 58, 80, 3)
  px(ctx, M.hi, ox, oy + 58, 80, 1)
  px(ctx, M.shade, ox + 4, oy + 61, 72, 2)
  px(ctx, M.lite, ox + 28, oy + 61, 24, 3)
  px(ctx, M.shade, ox + 28, oy + 63, 24, 1)

  // the impossible stairway on the right: it climbs up the corner to an arch that opens onto the sky, and the top step is the bottom one
  for (let i = 0; i < 7; i++) {
    px(ctx, i % 2 ? M.lite : M.hi, ox + 62 + i * 2, oy + 29 - i * 3, 14 - i * 2, 3)
    px(ctx, M.shade, ox + 62 + i * 2, oy + 31 - i * 3, 14 - i * 2, 1)
  }
  column(ctx, ox + 69, oy + 4, 14)
  archFill(ctx, ox + 74, oy + 6, 8, 12, "#a8d8f4", M.deep)
  P("#ffffff", 72, 8, 2, 1)

  // pots and a bench on the plinth
  for (const [x, c] of [[16, "#ff9db8"], [60, "#c9a8ff"]] as const) {
    px(ctx, "#b9764a", ox + x, oy + 54, 5, 4)
    px(ctx, "#8a4f2e", ox + x, oy + 57, 5, 1)
    px(ctx, "#2f7a45", ox + x, oy + 51, 5, 3)
    px(ctx, c, ox + x + 1, oy + 50, 2, 2)
  }
}

/** Painted over the whole map once, after the tiles: the cottage over its five-by-four tile block. */
export const HOUSE_TILES = { x: 19, y: 14, w: 5, h: 4 }

// ─── plants and ground things ──────────────────────────────────────────────

export function drawNodeArt(ctx: Ctx, kind: string, x: number, y: number, ready: boolean, t: number) {
  const dim = !ready
  const sway = Math.round(Math.sin(t * 1.6 + x * 0.3) * 0.8)
  switch (kind) {
    case "berry": {
      // a round bush with berries and leaf highlights
      px(ctx, "rgba(20,30,20,0.25)", x + 2, y + 13, 12, 2)
      px(ctx, dim ? "#3d7a50" : "#2c7a45", x + 2, y + 5, 12, 9)
      px(ctx, dim ? "#4f8f62" : "#3d9a58", x + 3, y + 3, 10, 9)
      px(ctx, dim ? "#62a073" : "#5fbf75", x + 4, y + 3, 4, 2)
      px(ctx, dim ? "#62a073" : "#5fbf75", x + 3, y + 6, 2, 2)
      px(ctx, "#1f5a3a", x + 5, y + 11, 8, 2)
      if (!dim) for (const [bx, by] of [[4, 8], [8, 5], [10, 9], [6, 11], [12, 6]] as const) {
        px(ctx, "#c8324e", x + bx, y + by, 3, 3)
        px(ctx, "#f0607a", x + bx, y + by, 1, 1)
        px(ctx, "#8a1f3a", x + bx + 1, y + by + 2, 2, 1)
      }
      break
    }
    case "acorn": {
      // a small oak sapling with acorns
      px(ctx, "rgba(20,30,20,0.25)", x + 3, y + 14, 10, 2)
      px(ctx, "#6b4630", x + 7, y + 8, 2, 7)
      px(ctx, "#4e3224", x + 8, y + 8, 1, 7)
      px(ctx, dim ? "#3d7a50" : "#2f8248", x + 2, y + 2, 12, 8)
      px(ctx, dim ? "#4f8f62" : "#45a05a", x + 3, y + 1, 9, 7)
      px(ctx, "#8fdc92", x + 4, y + 2, 3, 2)
      if (!dim) for (const [bx, by] of [[4, 7], [10, 6], [8, 9]] as const) {
        px(ctx, "#a8683c", x + bx, y + by + 1, 3, 3)
        px(ctx, "#5f3f31", x + bx, y + by, 3, 1)
      }
      break
    }
    case "reed": {
      px(ctx, "rgba(30,60,90,0.25)", x + 2, y + 14, 12, 2)
      for (const [bx, h] of [[3, 11], [6, 13], [9, 12], [12, 10]] as const) {
        const s = bx % 2 ? sway : -sway
        px(ctx, dim ? "#7aa07a" : "#4fbf5a", x + bx + s * 0, y + 14 - h, 1, h)
        px(ctx, dim ? "#6a8f6a" : "#2a9a4a", x + bx + 1, y + 14 - h + 3, 1, h - 3)
        if (!dim) {
          px(ctx, "#6b4630", x + bx - 1 + s, y + 14 - h - 1, 3, 4)
          px(ctx, "#8a5a44", x + bx + s, y + 14 - h - 1, 1, 3)
        }
      }
      px(ctx, "#8fd48a", x + 1, y + 12, 4, 1)
      break
    }
    case "clover": {
      px(ctx, "rgba(20,30,20,0.2)", x + 2, y + 13, 12, 2)
      for (const [bx, by] of [[3, 8], [8, 5], [6, 11], [11, 10]] as const) {
        const c1 = dim ? "#7aa87a" : "#2a9a4a"
        const c2 = dim ? "#8cb88c" : "#5fd27a"
        px(ctx, c1, x + bx, y + by, 2, 2)
        px(ctx, c1, x + bx + 2, y + by, 2, 2)
        px(ctx, c1, x + bx + 1, y + by - 2, 2, 2)
        px(ctx, c2, x + bx + 1, y + by - 1, 2, 2)
        px(ctx, "#2a7a3e", x + bx + 1, y + by + 2, 1, 3)
      }
      if (!dim) px(ctx, "#ffffff", x + 12, y + 4, 2, 2)
      break
    }
    case "pebble": {
      px(ctx, "rgba(20,20,30,0.25)", x + 2, y + 12, 12, 2)
      px(ctx, "#8e99a4", x + 2, y + 8, 6, 5)
      px(ctx, "#b8c2cb", x + 3, y + 8, 4, 2)
      px(ctx, "#6c7782", x + 2, y + 12, 6, 1)
      px(ctx, "#9aa6b0", x + 8, y + 6, 5, 6)
      px(ctx, "#cdd6dd", x + 9, y + 6, 3, 2)
      px(ctx, "#6c7782", x + 8, y + 11, 5, 1)
      px(ctx, "#6fa05a", x + 3, y + 7, 3, 1)
      break
    }
    case "feather": {
      px(ctx, "rgba(20,30,20,0.18)", x + 3, y + 13, 10, 2)
      px(ctx, "#ffffff", x + 4, y + 9, 8, 2)
      px(ctx, "#e6ecf0", x + 6, y + 7, 6, 2)
      px(ctx, "#cdd6dd", x + 8, y + 5, 4, 2)
      px(ctx, "#9aa6b0", x + 3, y + 11, 6, 1)
      px(ctx, "#6b7886", x + 2, y + 12, 3, 1)
      break
    }
    case "mushroom": {
      // a little cluster: tall one in front, two small behind
      px(ctx, "rgba(20,30,20,0.25)", x + 2, y + 14, 12, 2)
      const cap = dim ? "#c89aa8" : "#e0506a"
      const capLite = dim ? "#dcb4c0" : "#f08aa0"
      px(ctx, "#f3e6dc", x + 3, y + 10, 2, 4)
      px(ctx, cap, x + 1, y + 8, 6, 3)
      px(ctx, capLite, x + 2, y + 8, 2, 1)
      px(ctx, "#f3e6dc", x + 11, y + 11, 2, 3)
      px(ctx, cap, x + 9, y + 9, 6, 3)
      px(ctx, "#f3e6dc", x + 7, y + 7, 3, 7)
      px(ctx, "#d9c7ba", x + 9, y + 7, 1, 7)
      px(ctx, cap, x + 4, y + 3, 9, 5)
      px(ctx, capLite, x + 5, y + 3, 4, 1)
      px(ctx, "#b8324e", x + 4, y + 7, 9, 1)
      if (!dim) {
        px(ctx, "#ffffff", x + 6, y + 4, 2, 2)
        px(ctx, "#ffffff", x + 10, y + 5, 1, 1)
        px(ctx, "#ffffff", x + 9, y + 3, 1, 1)
      }
      break
    }
    case "shell": {
      px(ctx, "rgba(30,60,90,0.2)", x + 3, y + 13, 10, 2)
      px(ctx, "#f4e8f8", x + 3, y + 7, 10, 6)
      px(ctx, "#e2d0f0", x + 4, y + 5, 8, 4)
      for (const i of [5, 7, 9, 11]) px(ctx, "#b89ad8", x + i - 1, y + 6, 1, 6)
      px(ctx, "#ffffff", x + 4, y + 6, 2, 1)
      px(ctx, "#9a72e0", x + 6, y + 12, 4, 1)
      break
    }
    case "dig": {
      px(ctx, "rgba(20,10,20,0.2)", x + 2, y + 13, 12, 2)
      px(ctx, dim ? "#a98a6e" : "#8a6048", x + 2, y + 8, 12, 5)
      px(ctx, dim ? "#bd9e82" : "#a37860", x + 4, y + 6, 8, 4)
      if (!dim) {
        px(ctx, "#5f3f31", x + 5, y + 9, 2, 2)
        px(ctx, "#5f3f31", x + 10, y + 10, 1, 2)
        // a glint of something buried
        if (Math.sin(t * 3 + x) > 0.6) px(ctx, "#ffffff", x + 8, y + 7, 1, 1)
        px(ctx, "#cdd6dd", x + 8, y + 8, 2, 1)
      }
      break
    }
    case "fish": {
      // ripples and a quick fish shadow
      px(ctx, "rgba(255,255,255,0.35)", x + 2 + Math.floor(Math.sin(t * 2) * 1.4), y + 6, 10, 1)
      px(ctx, "rgba(255,255,255,0.25)", x + 4, y + 9, 7, 1)
      if (!dim) {
        const fx = x + 4 + Math.floor((Math.sin(t * 1.2 + x) + 1) * 3)
        px(ctx, "rgba(20,50,90,0.45)", fx, y + 7, 6, 3)
        px(ctx, "rgba(20,50,90,0.45)", fx + 6, y + 7, 2, 1)
        px(ctx, "rgba(20,50,90,0.45)", fx + 6, y + 9, 2, 1)
      }
      break
    }
  }
  if (ready && Math.sin(t * 4 + x) > 0.82) px(ctx, "#ffffff", x + 13, y + 2, 1, 1)
}

/** The campfire: ring of stones, crossed logs, three layers of flame, rising sparks. Drawn on the fire's tile. */
export function drawCampfire(ctx: Ctx, x: number, y: number, t: number) {
  px(ctx, "rgba(20,10,20,0.3)", x - 2, y + 13, 20, 3)
  // stones
  for (const [sx, sy, w] of [[1, 11, 4], [4, 13, 3], [8, 13, 3], [11, 11, 4], [0, 8, 3], [13, 8, 3]] as const) {
    px(ctx, "#6c7782", sx + x, sy + y, w, 3)
    px(ctx, "#9aa6b0", sx + x, sy + y, w, 1)
    px(ctx, "#4a5560", sx + x, sy + y + 2, w, 1)
  }
  // logs
  px(ctx, "#4e3224", x + 2, y + 11, 12, 3)
  px(ctx, "#8a5a44", x + 2, y + 10, 12, 2)
  px(ctx, "#6b4630", x + 4, y + 8, 9, 3)
  px(ctx, "#c48e74", x + 2, y + 10, 2, 2)
  px(ctx, "#c48e74", x + 12, y + 10, 2, 2)
  // flames: a flickering outer, a bright middle, and a pale core
  const f = (n: number) => Math.round(Math.sin(t * 9 + n * 2) * 1.5)
  const rise = 6 + Math.round(Math.abs(Math.sin(t * 5)) * 2)
  px(ctx, "#c8324e", x + 3, y + 5 - f(0), 3, 5)
  px(ctx, "#c8324e", x + 10, y + 6 - f(1), 3, 4)
  px(ctx, "#e04848", x + 4, y + 9 - rise, 8, rise + 1)
  px(ctx, "#ff7a50", x + 5, y + 7 - rise + 2 - f(2), 6, rise)
  px(ctx, "#ffa078", x + 6, y + 8 - rise + 3, 4, rise - 2)
  px(ctx, "#ffd9c0", x + 7, y + 9 - rise + 5, 2, Math.max(2, rise - 5))
  px(ctx, "#e04848", x + 7, y + 3 - rise + 4 - f(3), 2, 3)
  // sparks
  for (let i = 0; i < 4; i++) {
    const age = (t * 0.9 + i * 0.27) % 1
    ctx.globalAlpha = 1 - age
    px(ctx, i % 2 ? "#ffd9c0" : "#ff9a8a", x + 6 + Math.round(Math.sin(i * 3 + t) * 4), y + 2 - age * 18, 1, 1)
  }
  ctx.globalAlpha = 1
}

// ─── crops ────────────────────────────────────────────────────────────────

const CROP_ART: Record<string, { leaf: string; leaf2: string; fruit: string; fruit2: string; shape: "pod" | "round" | "tall" | "leafy" | "pearl" }> = {
  glowbean: { leaf: "#2a9a4a", leaf2: "#6fd27a", fruit: "#7fe09a", fruit2: "#d6ffd6", shape: "pod" },
  puffroot: { leaf: "#3d9a58", leaf2: "#8fdc92", fruit: "#9a72e0", fruit2: "#e2ceff", shape: "round" },
  moonmelon: { leaf: "#2f8248", leaf2: "#62bd78", fruit: "#30b8a8", fruit2: "#a8f4e6", shape: "round" },
  spiralkale: { leaf: "#2a7a45", leaf2: "#5fd27a", fruit: "#4fbf5a", fruit2: "#b6f0a4", shape: "leafy" },
  twinklegourd: { leaf: "#2f8248", leaf2: "#62bd78", fruit: "#e8506a", fruit2: "#ffb3d1", shape: "tall" },
  snowpearl: { leaf: "#3d8aa0", leaf2: "#9ad4e6", fruit: "#d6ecff", fruit2: "#ffffff", shape: "pearl" },
}

/** One plot: tilled soil with furrows, then the crop at its stage. `frac` is growth 0..1; ripe at 1. */
export function drawCrop(ctx: Ctx, id: string, x: number, y: number, frac: number, t: number) {
  const a = CROP_ART[id] ?? CROP_ART.glowbean!
  const sway = Math.round(Math.sin(t * 1.8 + x * 0.4) * 0.7)
  if (frac < 0.25) {
    px(ctx, "#5a3628", x + 7, y + 11, 2, 2)
    px(ctx, a.leaf2, x + 7, y + 9, 2, 2)
    px(ctx, a.leaf, x + 6, y + 8, 1, 1)
    px(ctx, a.leaf, x + 9, y + 8, 1, 1)
  } else if (frac < 0.6) {
    px(ctx, a.leaf, x + 7, y + 6, 2, 7)
    px(ctx, a.leaf2, x + 4 + sway, y + 6, 4, 2)
    px(ctx, a.leaf2, x + 8 + sway, y + 5, 4, 2)
    px(ctx, a.leaf, x + 5, y + 8, 3, 1)
    px(ctx, a.leaf, x + 8, y + 9, 3, 1)
  } else if (frac < 1) {
    px(ctx, a.leaf, x + 7, y + 4, 2, 9)
    px(ctx, a.leaf2, x + 3 + sway, y + 5, 5, 3)
    px(ctx, a.leaf2, x + 8 + sway, y + 4, 5, 3)
    px(ctx, a.leaf, x + 3, y + 8, 5, 2)
    px(ctx, a.leaf, x + 8, y + 9, 5, 2)
    px(ctx, a.leaf2, x + 5, y + 3 + sway, 6, 2)
    px(ctx, a.fruit, x + 7, y + 8, 2, 2)
  } else {
    const bob = Math.round(Math.sin(t * 4 + x) * 0.8)
    px(ctx, a.leaf, x + 3, y + 8, 10, 5)
    px(ctx, a.leaf2, x + 2, y + 6, 5, 4)
    px(ctx, a.leaf2, x + 9, y + 6, 5, 4)
    if (a.shape === "pod") {
      for (const [bx, by] of [[4, 4], [8, 2], [11, 5]] as const) {
        px(ctx, a.fruit, x + bx, y + by + bob, 2, 6)
        px(ctx, a.fruit2, x + bx, y + by + bob, 1, 3)
      }
    } else if (a.shape === "tall") {
      px(ctx, a.fruit, x + 5, y + 3 + bob, 6, 8)
      px(ctx, a.fruit2, x + 6, y + 4 + bob, 2, 3)
      px(ctx, "#2a7a45", x + 7, y + 1 + bob, 2, 3)
    } else if (a.shape === "leafy") {
      px(ctx, a.fruit, x + 3, y + 2 + bob, 10, 9)
      px(ctx, a.fruit2, x + 5, y + 3 + bob, 3, 2)
      px(ctx, a.leaf, x + 5, y + 6 + bob, 6, 1)
      px(ctx, a.leaf, x + 6, y + 8 + bob, 4, 1)
    } else if (a.shape === "pearl") {
      px(ctx, a.fruit, x + 4, y + 3 + bob, 8, 8)
      px(ctx, a.fruit2, x + 5, y + 4 + bob, 3, 2)
      px(ctx, "#9ad4e6", x + 4, y + 10 + bob, 8, 1)
    } else {
      px(ctx, a.fruit, x + 4, y + 3 + bob, 8, 8)
      px(ctx, a.fruit2, x + 5, y + 4 + bob, 3, 3)
      px(ctx, a.leaf, x + 4, y + 10 + bob, 8, 1)
    }
    if (Math.sin(t * 4 + x * 3) > 0.7) px(ctx, "#ffffff", x + 13, y + 2, 1, 1)
  }
}

// ─── rain ─────────────────────────────────────────────────────────────────

/** Slanted streaks in two depths, and little rings where they land. `w`/`h` are the view size. */
export function drawRain(ctx: Ctx, w: number, h: number, t: number) {
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? "rgba(225,238,255,0.75)" : "rgba(180,205,240,0.5)"
    const n = layer ? 60 : 90
    const speed = layer ? 210 : 150
    for (let i = 0; i < n; i++) {
      const rx = (i * 53 + layer * 17 + t * (layer ? 30 : 20)) % (w + 20) - 10
      const ry = (i * 37 + layer * 11 + t * speed) % (h + 20) - 10
      const len = layer ? 4 : 3
      for (let k = 0; k < len; k++) ctx.fillRect(Math.floor(rx - k * 0.6), Math.floor(ry + k), 1, 1)
    }
  }
  for (let i = 0; i < 14; i++) {
    const life = (t * 1.5 + i * 0.37) % 1
    const sx = (i * 97 + 13) % w
    const sy = (i * 61 + 31) % h
    ctx.globalAlpha = (1 - life) * 0.7
    ctx.fillStyle = "#e9f3ff"
    const r = 1 + Math.floor(life * 4)
    ctx.fillRect(sx - r, sy, r * 2, 1)
    ctx.fillRect(sx - r + 1, sy + 1, r * 2 - 2, 1)
    ctx.globalAlpha = 1
  }
}
