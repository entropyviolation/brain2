/**
 * components/BabyGame/art.ts — Hand-painted scenery: the marble cottage, plants, the campfire, crops, and rain
 *
 * Everything here draws with plain rectangles at the game's native pixel size, so it stays crisp when the canvas is scaled.
 * The cottage is a Gaudí house: a wave of dragon-scale roof, a bulb tower, trencadís mosaic walls, a catenary door between
 * bone-shaped pillars, oval stained-glass windows and wrought-iron balconies.
 */

import { drawPropHi } from "./proparthi"
import { drawCropHi, drawNodeHi } from "./nodeart-hi"
import { ditherRect } from "./dither"
import { drawTasteProp, type PropEnv } from "./propart"

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

const M = { hi: "#fbfefc", lite: "#eaf4f0", mid: "#d0e4e0", shade: "#aecac8", deep: "#8aaaae", vein: "#c4dcd8", crack: "#7f9fa6" }
const TERRA = { hi: "#e8926a", mid: "#d0724e", deep: "#a8523a", rim: "#7e3a2c" }
const IVY = { hi: "#9fdc9a", mid: "#5fae6a", deep: "#3a8a58" }

/** Trencadís: the broken-tile mosaic Gaudí lined his roofs, benches and chimneys with. Pastel blues and greens, a little white, no yellow. */
const TILES = ["#6fc8b8", "#8fd8ec", "#7fb4e4", "#a8e4cc", "#5fa8cc", "#b8dcf4", "#8ad0a8", "#f4faf8"]
const PALE = ["#e6f3ee", "#dcecf4", "#f1f8f4", "#d2e8e4", "#e2eff8", "#d8f0e8"]
const GROUT = "#6e93a6"
const SILVER = { hi: "#f3f7fc", mid: "#cfd8e6", deep: "#8e9ab4" }

/** A filled ellipse of one colour, or of a colour chosen per pixel. */
function disc(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string | ((x: number, y: number) => string)) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) px(ctx, typeof color === "string" ? color : color(x, y), x, y)
    }
  }
}

/**
 * The whole cottage, painted on a 112×112 area whose top-left is (ox, oy): seven tiles wide and seven tall, four floors high.
 * It is a Gaudí house in pastel blue and green: a plinth and ground floor of blue-and-white diamond tile with a catenary
 * door and oval windows, a noble floor with a great bay of stained-glass discs between bone-shaped columns, an upper floor
 * of balconies, a roof of dragon scales rolling in a wave, a bulb tower with a silver star, and a whiplash vine. The door
 * is the bottom-centre tile (x 48..64) and opens into `casa.ts`.
 */
export function paintHouse(ctx: Ctx, ox: number, oy: number) {
  const P = (c: string, x: number, y: number, w = 1, h = 1) => px(ctx, c, ox + x, oy + y, w, h)
  const roofTop = (x: number) => 22 + Math.round(3 * Math.sin(x * 0.14 + 0.6))
  const eave = (x: number) => 42 + Math.round(1.6 * Math.sin(x * 0.27))
  const edgeL = (y: number) => 4 + Math.round(1.4 * Math.sin(y * 0.22))
  const edgeR = (y: number) => 108 - Math.round(1.4 * Math.sin(y * 0.22 + 1.3))
  const wave = (x: number, y: number, mid: number) => Math.abs(y - (mid + 3 * Math.sin(x * 0.13))) < 3.5

  // walls: pale mosaic above, a diamond-tiled ground floor, a bright wave through each storey
  for (let y = 40; y < 106; y++) {
    for (let x = edgeL(y); x < edgeR(y); x++) {
      if (y < eave(x)) continue
      const row = Math.floor(y / 3)
      const col = Math.floor((x + (row % 2) * 2) / 3)
      const seed = h2(col, row, 3)
      let c = wave(x, y, 55) || wave(x, y, 91) ? TILES[Math.floor(seed * TILES.length)]! : PALE[Math.floor(seed * PALE.length)]!
      if (y >= 74) {
        // diamonds, blue and white, as in the hall inside
        const d = (Math.floor((x + y) / 5) + Math.floor((x - y + 200) / 5)) % 2
        c = d ? "#9fcdee" : "#eef6fb"
        if ((x + y) % 5 === 0 || (x - y + 200) % 5 === 0) c = d ? "#7fb4e0" : "#cfe4f2"
      } else if (y % 3 === 0 || (x + (row % 2) * 2) % 3 === 0) c = GROUT
      else if (y % 3 === 1 && (x + (row % 2) * 2) % 3 === 1 && seed > 0.5) c = "#ffffff"
      P(c, x, y)
    }
  }

  // the roof: dragon scales in rolling rows
  const scales = [TILES[0]!, TILES[2]!, TILES[3]!, TILES[1]!, TILES[4]!]
  for (let y = 12; y < 46; y++) {
    for (let x = 5; x < 107; x++) {
      if (y < roofTop(x) || y >= eave(x) + 1) continue
      const r = Math.floor(y / 3)
      const sx = Math.floor((x + (r % 2) * 2.5) / 5)
      let c = scales[(sx * 3 + r * 2) % scales.length]!
      const dx = Math.floor(x + (r % 2) * 2.5) % 5
      const dy = y % 3
      if (dy === 2 || ((dx === 0 || dx === 4) && dy === 1)) c = "#4a7fa0"
      P(c, x, y)
      if (dy === 0 && dx > 0 && dx < 4) px(ctx, "rgba(255,255,255,0.45)", ox + x, oy + y)
    }
  }
  // the ridge: soft aqua fins like the spine of a sleeping dragon
  for (let x = 30; x < 106; x += 4) {
    const top = roofTop(x)
    P("#7fd0c0", x, top - 3, 2, 3)
    P("#c4f0e8", x + 1, top - 4, 1, 1)
    P("#4f9aa0", x, top, 2, 1)
  }
  // a marble ribbon under the eave that rolls with it
  for (let x = 5; x < 107; x++) {
    P(M.hi, x, eave(x) + 1)
    P(M.mid, x, eave(x) + 2)
    P(M.shade, x, eave(x) + 3)
  }

  // the bulb tower: a mosaic shaft spiralled in tile, an aqua bulb, a silver four-armed star
  for (let y = 12; y < 44; y++) {
    for (let x = 8; x < 24; x++) {
      const bulge = Math.round(1.4 * Math.sin((y - 12) * 0.4))
      if (x < 10 - bulge || x > 21 + bulge) continue
      let c = TILES[(Math.floor((x + y) / 2) + 2) % 7]!
      if ((x + y) % 6 === 0) c = GROUT
      P(c, x, y)
    }
  }
  disc(ctx, ox + 16, oy + 9, 8, 7.5, (x, y) => (y < oy + 7 && x < ox + 16 ? "#d8f6f0" : (x + y) % 5 === 0 ? "#5fa8b0" : "#8fdcd0"))
  P("#ffffff", 11, 4, 3, 1)
  P(SILVER.mid, 16, -2, 1, 6)
  P(SILVER.mid, 13, 0, 7, 1)
  P(SILVER.hi, 16, -2, 1, 1)
  P(SILVER.hi, 13, 0, 1, 1)

  // the dome tower on the right, with a window that opens onto the sky
  disc(ctx, ox + 92, oy + 20, 10, 10, (x, y) => (x < ox + 92 && y < oy + 15 ? "#d4f2f8" : ((x >> 1) + (y >> 1)) % 3 === 0 ? TILES[2]! : TILES[1]!))
  for (let y = 12; y < 28; y++) {
    const half = y < 18 ? Math.round(3.6 * Math.sqrt((y - 12) / 6)) : 4
    P("#b4e0f6", 92 - half, y, half * 2 + 1, 1)
    P(SILVER.mid, 92 - half - 1, y)
    P(SILVER.mid, 92 + half + 1, y)
  }
  P("#ffffff", 90, 15, 2, 1)
  P(SILVER.mid, 92, 6, 1, 4)
  P(SILVER.hi, 92, 6, 1, 1)

  // the noble floor: a great bay of stained-glass discs between two bone-shaped columns
  for (let y = 46; y < 68; y++) {
    const top = 46 + Math.round(2 * Math.sin(y * 0.2))
    P(M.mid, 26, y, 60, 1)
    void top
  }
  for (let x = 28; x < 84; x++) {
    const sag = Math.round(2.4 * Math.sin(x * 0.28))
    for (let y = 47 + sag; y < 66 + sag; y++) {
      const cx = Math.floor((x - 28) / 5)
      const cy = Math.floor((y - 47 - sag) / 5)
      const lx = (x - 28) % 5
      const ly = (y - 47 - sag) % 5
      if (lx === 0 || ly === 0) P("#58789a", x, y)
      else if ((lx - 2.5) ** 2 + (ly - 2.5) ** 2 < 9) {
        const r = h2(cx, cy, 11)
        P(r < 0.18 ? "#f4faf8" : r < 0.36 ? "#5fa8d8" : r < 0.54 ? "#8fd8ec" : r < 0.72 ? "#5fc2b0" : r < 0.88 ? "#a8e4c8" : "#b4b8f0", x, y)
      } else P("#58789a", x, y)
    }
  }
  P("#ffffff", 32, 49, 3, 1)
  for (const side of [-1, 1] as const) {
    const cx = 56 + side * 18
    for (let y = 44; y < 72; y++) {
      const hw = 2 + Math.round(1.8 * Math.cos(((y - 44) / 28) * Math.PI * 2))
      P(M.lite, cx - hw, y, hw * 2 + 1)
      P(M.hi, cx - hw, y, 2)
      P(M.shade, cx + hw, y)
      P(M.deep, cx + hw - 1, y)
    }
    disc(ctx, ox + cx, oy + 44, 4.5, 2.5, (x) => (x < ox + cx ? M.hi : M.lite))
  }
  // upper floor: three round-topped windows with a pale iron balcony each
  for (const wx of [30, 56, 82]) {
    disc(ctx, ox + wx, oy + 76, 7, 8, (x) => (x < ox + wx ? M.hi : M.shade))
    disc(ctx, ox + wx, oy + 76, 5, 6.5, (x, y) => (((x - ox - wx + 5) % 3 === 0 || (y - oy - 69) % 3 === 0) ? "#58789a" : TILES[Math.floor(h2(Math.floor((x - ox - wx + 5) / 3) + wx, Math.floor((y - oy - 69) / 3), 5) * 6)]!))
  }

  // the balcony ribbon at the foot of the noble floor, with round mask holes
  for (let x = 24; x < 88; x++) {
    const w = Math.round(Math.sin(x * 0.6))
    P(M.mid, x, 68 + w, 1, 4)
    P(M.hi, x, 68 + w)
    P(SILVER.mid, x, 65 + Math.round(1.4 * Math.sin(x * 0.7)))
  }
  for (const dx of [32, 44, 68, 80]) disc(ctx, ox + dx, oy + 70.5, 2, 1.5, "#4a6a8a")
  for (let i = 0; i < 12; i++) {
    P(i % 2 ? "#cfeaf8" : "#ffffff", 26 + i * 5, 64 + (i % 2), 2, 2)
    P("#5fae6a", 26 + i * 5, 66, 1, 2)
  }

  // the catenary doorway between two bone-shaped pillars
  for (const side of [-1, 1] as const) {
    const cx = 56 + side * 17
    for (let y = 76; y < 106; y++) {
      const hw = 2 + Math.round(1.6 * Math.cos(((y - 76) / 30) * Math.PI * 2))
      P(M.lite, cx - hw, y, hw * 2 + 1)
      P(M.hi, cx - hw, y, 2)
      P(M.shade, cx + hw, y)
      P(M.deep, cx + hw - 1, y)
    }
    disc(ctx, ox + cx, oy + 75, 3.5, 2, (x) => (x < ox + cx ? M.hi : M.lite))
  }
  for (let y = 80; y < 106; y++) {
    const half = y < 90 ? Math.round(9 * Math.sqrt((y - 80) / 10)) : 9
    P(M.hi, 56 - half - 1, y, half * 2 + 3)
    P(y < 87 ? "#4a6aa8" : "#2f6a78", 56 - half, y, half * 2 + 1)
  }
  for (let y = 80; y < 90; y++) {
    const half = Math.round(9 * Math.sqrt((y - 80) / 10))
    for (let x = 56 - half; x <= 56 + half; x++) {
      const a = Math.atan2(y - 90, x - 56)
      const ring = Math.hypot(x - 56, (y - 90) * 1.2)
      let c = TILES[Math.floor(((a + Math.PI) / Math.PI) * 4 + (ring > 5 ? 3 : 0)) % 7]!
      if (Math.abs(Math.sin(a * 4)) < 0.1) c = SILVER.mid
      P(c, x, y)
    }
  }
  for (let y = 90; y < 106; y++) {
    for (let x = 47; x < 66; x++) if (x % 3 === 0) P("#4f9aa8", x, y)
    const c = Math.round(4.2 * Math.sin((y - 90) * 0.55))
    P(SILVER.mid, 56 + c, y)
    P(SILVER.deep, 56 - c, y)
  }
  P(SILVER.hi, 60, 98, 2, 2)
  P(M.hi, 54, 76, 4, 3)
  P("#a8e4cc", 55, 77, 2, 1)

  // oval stained-glass windows flanking the door, in marble frames
  for (const wx of [16, 96]) {
    disc(ctx, ox + wx, oy + 90, 8, 9.5, (x) => (x < ox + wx ? M.hi : M.shade))
    disc(ctx, ox + wx, oy + 90, 6, 8, (x, y) => ((x - ox - wx + 8) % 3 === 0 || (y - oy - 80) % 3 === 0 ? "#58789a" : TILES[Math.floor(h2(Math.floor((x - ox - wx + 8) / 3) + wx, Math.floor((y - oy - 80) / 3), 5) * 6)]!))
    P("#ffffff", wx - 3, 85, 2, 1)
  }

  // a whiplash vine up the left edge, in flower
  for (let i = 0; i < 52; i++) {
    const y = 104 - i
    const x = 6 + Math.round(2.6 * Math.sin(i * 0.42))
    P(i % 3 ? IVY.mid : IVY.hi, x, y, 2, 1)
    if (i % 6 === 2) {
      P("#cfeaf8", x + 2, y, 2, 2)
      P("#ffffff", x + 2, y, 1, 1)
    }
  }

  // the plinth: a stone base with a wavy mosaic bench-ribbon on top, and three worn steps
  px(ctx, M.mid, ox, oy + 104, 112, 3)
  for (let x = 0; x < 112; x++) px(ctx, TILES[(Math.floor(x / 3) + Math.floor(x / 11)) % 7]!, ox + x, oy + 104 + Math.round(0.8 * Math.sin(x * 0.4)), 1, 1)
  px(ctx, M.shade, ox + 6, oy + 107, 100, 3)
  px(ctx, M.lite, ox + 40, oy + 107, 32, 3)
  px(ctx, M.shade, ox + 40, oy + 109, 32, 1)
  px(ctx, M.shade, ox + 36, oy + 110, 40, 2)
}

/** Painted over the whole map once, after the tiles: the cottage over its seven-by-seven tile block. */
export const HOUSE_TILES = { x: 16, y: 11, w: 7, h: 7 }

// ─── plants and ground things ──────────────────────────────────────────────

export function drawNodeArt(ctx: Ctx, kind: string, x: number, y: number, ready: boolean, t: number) {
  if (drawNodeHi(ctx, kind, x, y, ready, t)) return
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

export const CROP_ART: Record<string, { leaf: string; leaf2: string; fruit: string; fruit2: string; shape: "pod" | "round" | "tall" | "leafy" | "pearl" | "split" | "mandala" | "flicker" | "leek" | "quince" }> = {
  glowbean: { leaf: "#2a9a4a", leaf2: "#6fd27a", fruit: "#7fe09a", fruit2: "#d6ffd6", shape: "pod" },
  puffroot: { leaf: "#3d9a58", leaf2: "#8fdc92", fruit: "#9a72e0", fruit2: "#e2ceff", shape: "round" },
  moonmelon: { leaf: "#2f8248", leaf2: "#62bd78", fruit: "#30b8a8", fruit2: "#a8f4e6", shape: "round" },
  spiralkale: { leaf: "#2a7a45", leaf2: "#5fd27a", fruit: "#4fbf5a", fruit2: "#b6f0a4", shape: "leafy" },
  twinklegourd: { leaf: "#2f8248", leaf2: "#62bd78", fruit: "#e8506a", fruit2: "#ffb3d1", shape: "tall" },
  snowpearl: { leaf: "#3d8aa0", leaf2: "#9ad4e6", fruit: "#d6ecff", fruit2: "#ffffff", shape: "pearl" },
  shadowradish: { leaf: "#2a7a45", leaf2: "#5fd27a", fruit: "#4b4456", fruit2: "#9a92a6", shape: "split" },
  mandalichoke: { leaf: "#3d8a78", leaf2: "#8fdcc8", fruit: "#9a72e0", fruit2: "#e2ceff", shape: "mandala" },
  schrodinberry: { leaf: "#3a6aa8", leaf2: "#8fb4f0", fruit: "#7a56d8", fruit2: "#f3eef6", shape: "flicker" },
  parallaxpepper: { leaf: "#2f8248", leaf2: "#62bd78", fruit: "#e04848", fruit2: "#ff9a8a", shape: "tall" },
  fadeleek: { leaf: "#6aa890", leaf2: "#b6e0cc", fruit: "#e6eef0", fruit2: "#ffffff", shape: "leek" },
  quincidence: { leaf: "#3d8a58", leaf2: "#8fdc92", fruit: "#e8915a", fruit2: "#f6c9a0", shape: "quince" },
  hypnagogicpea: { leaf: "#3a6aa8", leaf2: "#8fb4f0", fruit: "#9a72e0", fruit2: "#b4e2ff", shape: "pod" },
  aurorasprout: { leaf: "#1a7068", leaf2: "#a8f4e6", fruit: "#4fbf5a", fruit2: "#b4e2ff", shape: "round" },
}

/** One plot: tilled soil with furrows, then the crop at its stage. `frac` is growth 0..1; ripe at 1. */
export function drawCrop(ctx: Ctx, id: string, x: number, y: number, frac: number, t: number) {
  if (drawCropHi(ctx, id, x, y, frac, t)) return
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
    } else if (a.shape === "split") {
      px(ctx, a.fruit, x + 5, y + 2 + bob, 6, 6)
      px(ctx, a.fruit2, x + 6, y + 3 + bob, 2, 2)
      px(ctx, "#2e2933", x + 7, y + 9, 2, 3)
    } else if (a.shape === "mandala") {
      px(ctx, a.fruit, x + 4, y + 3 + bob, 8, 8)
      px(ctx, a.fruit2, x + 5, y + 4 + bob, 6, 1)
      px(ctx, a.fruit2, x + 5, y + 9 + bob, 6, 1)
      px(ctx, a.fruit2, x + 5, y + 4 + bob, 1, 6)
      px(ctx, a.fruit2, x + 10, y + 4 + bob, 1, 6)
      px(ctx, a.leaf2, x + 7, y + 6 + bob, 2, 2)
    } else if (a.shape === "flicker") {
      // ripe and unripe at once: a checker that swaps while you watch
      px(ctx, a.fruit, x + 4, y + 3 + bob, 8, 8)
      const phase = Math.floor(t * 3)
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j + phase) % 2 === 0) px(ctx, a.fruit2, x + 4 + i * 2, y + 3 + j * 2 + bob, 2, 2)
    } else if (a.shape === "leek") {
      px(ctx, a.fruit, x + 6, y + 1 + bob, 4, 10)
      px(ctx, a.fruit2, x + 6, y + 2 + bob, 1, 6)
      px(ctx, a.leaf2, x + 5, y + bob, 6, 2)
    } else if (a.shape === "quince") {
      px(ctx, a.fruit, x + 4, y + 4 + bob, 8, 7)
      px(ctx, a.fruit, x + 6, y + 2 + bob, 4, 3)
      px(ctx, a.fruit2, x + 5, y + 5 + bob, 2, 2)
      px(ctx, a.leaf2, x + 7, y + 1 + bob, 2, 2)
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

/** Stable 0..1 hash so every drop and splash keeps its own place without state. */
function rainHash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Pixel rain in three depths (far, mid, near), slanted, with a crown of droplets and a flat ring where drops land
 * on the wet ground, plus a low drifting mist. `w`/`h` are the view size; `ground(worldX, worldY)` says whether a world pixel is open floor, `camX`/`camY` place the view in the world. Stateless: everything comes from `t`.
 */
export function drawRain(ctx: Ctx, w: number, h: number, t: number, ground?: (wx: number, wy: number) => boolean, camX = 0, camY = 0) {
  // far / mid / near: count, fall speed, streak length, colour, sideways lean per pixel fallen
  const layers = [
    { n: 70, speed: 120, len: 3, color: "rgba(150,180,225,0.45)", lean: 0.3 },
    { n: 50, speed: 170, len: 5, color: "rgba(190,214,245,0.7)", lean: 0.3 },
    { n: 28, speed: 240, len: 7, color: "rgba(240,248,255,0.92)", lean: 0.3 },
  ]
  layers.forEach((L, li) => {
    ctx.fillStyle = L.color
    const span = h + 24
    for (let i = 0; i < L.n; i++) {
      const seed = i + li * 100
      const fall = (rainHash(seed) * span + t * L.speed) % span
      const ry = fall - 12
      const rx = ((rainHash(seed + 0.5) * (w + 60) - fall * L.lean) % (w + 60) + (w + 60)) % (w + 60) - 30
      for (let k = 0; k < L.len; k++) ctx.fillRect(Math.floor(rx - k * L.lean), Math.floor(ry - k), 1, 1)
      // the head of a near drop is a touch brighter
      if (li === 2) {
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(Math.floor(rx), Math.floor(ry), 1, 1)
        ctx.fillStyle = L.color
      }
    }
  })

  // splashes: 4 frames over ~0.55s — impact dot, crown with droplets, droplets falling, wide fading ring.
  // They are anchored to the world (cells of 76×48 px, two slots each) and only drawn where `ground` says a drop
  // really lands on open floor, so nothing splashes on water, trees, roofs or walls.
  const CW = 76
  const CH = 48
  for (let cy = Math.floor(camY / CH); cy <= Math.floor((camY + h) / CH); cy++) {
    for (let cx = Math.floor(camX / CW); cx <= Math.floor((camX + w) / CW); cx++) {
      for (let slot = 0; slot < 2; slot++) {
        const id = cx * 7919 + cy * 104729 + slot * 31
        const period = 0.9 + rainHash(id + 7) * 0.8
        const cyc = t / period + rainHash(id + 3)
        const n = Math.floor(cyc)
        const life = cyc - n
        if (life > 0.55) continue
        const wx = Math.floor(cx * CW + rainHash(id * 1.3 + n * 17.7) * CW)
        const wy = Math.floor(cy * CH + rainHash(id * 1.7 + n * 9.1) * CH)
        if (ground && !ground(wx, wy)) continue
        const sx = wx - camX
        const sy = wy - camY
        if (sx < -4 || sx > w + 4 || sy < -4 || sy > h + 4) continue
        const f = Math.floor((life / 0.55) * 4)
        const c = "#eef6ff"
        const dim = "rgba(200,225,255,0.6)"
        if (f === 0) {
          px(ctx, c, sx, sy, 1, 1)
        } else if (f === 1) {
          px(ctx, c, sx - 1, sy, 3, 1)
          px(ctx, c, sx - 2, sy - 2, 1, 1)
          px(ctx, c, sx + 2, sy - 2, 1, 1)
          px(ctx, c, sx, sy - 1, 1, 1)
        } else if (f === 2) {
          px(ctx, c, sx - 3, sy - 2, 1, 1)
          px(ctx, c, sx + 3, sy - 2, 1, 1)
          px(ctx, c, sx - 1, sy - 3, 1, 1)
          px(ctx, c, sx + 1, sy - 3, 1, 1)
          px(ctx, dim, sx - 2, sy, 5, 1)
        } else {
          ctx.globalAlpha = 0.65
          px(ctx, dim, sx - 3, sy, 1, 1)
          px(ctx, dim, sx + 3, sy, 1, 1)
          px(ctx, dim, sx - 2, sy + 1, 5, 1)
          px(ctx, dim, sx - 2, sy - 1, 5, 1)
          ctx.globalAlpha = 1
        }
      }
    }
  }

  // floor mist: wide soft bands hugging the bottom edge, drifting slowly
  for (let i = 0; i < 6; i++) {
    const mx = ((i * 83 + t * (4 + i)) % (w + 120)) - 60
    const my = h - 10 - (i % 3) * 7
    const x = Math.round(mx)
    ditherRect(ctx, "#d7e6fa", x, my, 90, 6, 0.12)
    ditherRect(ctx, "#d7e6fa", x + 14, my - 3, 62, 12, 0.19)
  }
}

// ─── everyday props ────────────────────────────────────────────────────────

const WOOD = { hi: "#c48e74", mid: "#8a5a44", deep: "#6b4630", dark: "#4e3224" }
const STONE = { hi: "#cdd6dd", mid: "#9aa6b0", deep: "#6c7782", dark: "#4a5560" }
const STRAW = { hi: "#ecd6a0", mid: "#d9b87a", deep: "#b8965a" }

/** A prop on one tile whose top-left is (x, y). Tall props rise above the tile; `variant` picks a small variation. */
export function drawProp(ctx: Ctx, kind: string, x: number, y: number, t: number, variant = 0, env: PropEnv = { rain: false, night: false }) {
  if (drawPropHi(ctx, kind, x, y, t, variant, env)) return
  if (drawTasteProp(ctx, kind, x, y, t, env)) return
  const shadow = (sx = 1, sw = 14) => px(ctx, "rgba(20,30,20,0.25)", x + sx, y + 13, sw, 3)
  switch (kind) {
    case "well": {
      shadow()
      // tiled roof, a pyramid of terracotta
      for (let r = 0; r < 6; r++) {
        const w = 4 + r * 2
        px(ctx, r % 2 ? TERRA.mid : TERRA.hi, x + 8 - w / 2, y - 10 + r, w, 1)
      }
      px(ctx, TERRA.rim, x + 1, y - 5, 14, 1)
      px(ctx, TERRA.deep, x + 2, y - 4, 12, 1)
      // posts and the winding beam
      px(ctx, WOOD.mid, x + 2, y - 4, 2, 12)
      px(ctx, WOOD.mid, x + 12, y - 4, 2, 12)
      px(ctx, WOOD.hi, x + 2, y - 4, 1, 12)
      px(ctx, WOOD.deep, x + 3, y - 3, 10, 1)
      // rope and bucket
      px(ctx, "#d9c7ba", x + 8, y - 2, 1, 6)
      px(ctx, WOOD.mid, x + 7, y + 4, 3, 3)
      px(ctx, WOOD.dark, x + 7, y + 5, 3, 1)
      // the stone ring, with dark water inside
      px(ctx, STONE.mid, x + 2, y + 8, 12, 6)
      px(ctx, STONE.hi, x + 1, y + 6, 14, 2)
      px(ctx, "#2f5f8a", x + 3, y + 7, 10, 1)
      px(ctx, STONE.deep, x + 2, y + 13, 12, 1)
      for (const [bx, by, bw] of [[3, 9, 4], [8, 9, 5], [5, 11, 5], [11, 11, 2], [2, 11, 2]] as const) px(ctx, STONE.deep, x + bx, y + by, bw, 1)
      px(ctx, STONE.hi, x + 3, y + 8, 3, 1)
      px(ctx, "#4f9a4e", x + 12, y + 12, 2, 2)
      break
    }
    case "mailbox": {
      shadow(3, 10)
      px(ctx, WOOD.mid, x + 7, y + 7, 2, 8)
      px(ctx, WOOD.hi, x + 7, y + 7, 1, 8)
      px(ctx, WOOD.deep, x + 6, y + 14, 4, 1)
      px(ctx, "#3d6fb0", x + 3, y + 2, 10, 6)
      px(ctx, "#6a9ae0", x + 3, y + 1, 10, 2)
      px(ctx, "#2a4f86", x + 3, y + 7, 10, 1)
      px(ctx, "#2a4f86", x + 11, y + 3, 2, 4)
      px(ctx, "#ffb3d1", x + 6, y + 4, 2, 2)
      px(ctx, "#ffffff", x + 8, y + 5, 1, 1)
      // the flag: up when the day is fresh
      const up = Math.sin(t * 0.4) > -0.2
      px(ctx, "#e0506a", x + 4, up ? y - 3 : y + 0, 3, 2)
      px(ctx, STONE.deep, x + 4, up ? y - 3 : y + 0, 1, up ? 5 : 3)
      break
    }
    case "firewood": {
      shadow(0, 16)
      const log = (lx: number, ly: number) => {
        px(ctx, WOOD.deep, x + lx, y + ly, 4, 4)
        px(ctx, "#d9a97a", x + lx + 1, y + ly + 1, 2, 2)
        px(ctx, "#f0d0a0", x + lx + 1, y + ly + 1, 1, 1)
        px(ctx, WOOD.dark, x + lx, y + ly + 3, 4, 1)
      }
      for (const lx of [0, 4, 8, 12]) log(lx, 10)
      for (const lx of [2, 6, 10]) log(lx, 6)
      for (const lx of [4, 8]) log(lx, 2)
      px(ctx, "#4f9a4e", x + 4, y + 1, 4, 1)
      break
    }
    case "signpost": {
      shadow(4, 8)
      px(ctx, WOOD.deep, x + 7, y + 1, 2, 14)
      px(ctx, WOOD.hi, x + 7, y + 1, 1, 14)
      // two arrows pointing opposite ways
      px(ctx, WOOD.hi, x + 2, y + 2, 11, 4)
      px(ctx, WOOD.hi, x + 13, y + 3, 2, 2)
      px(ctx, WOOD.mid, x + 2, y + 5, 11, 1)
      px(ctx, WOOD.deep, x + 4, y + 3, 6, 1)
      px(ctx, WOOD.hi, x + 3, y + 8, 10, 4)
      px(ctx, WOOD.hi, x + 1, y + 9, 2, 2)
      px(ctx, WOOD.mid, x + 3, y + 11, 10, 1)
      px(ctx, WOOD.deep, x + 6, y + 9, 5, 1)
      px(ctx, "#4f9a4e", x + 5, y + 14, 6, 1)
      break
    }
    case "birdbath": {
      shadow(2, 12)
      px(ctx, STONE.deep, x + 4, y + 12, 8, 2)
      px(ctx, STONE.hi, x + 4, y + 12, 8, 1)
      px(ctx, STONE.mid, x + 6, y + 7, 4, 5)
      px(ctx, STONE.hi, x + 6, y + 7, 1, 5)
      px(ctx, STONE.mid, x + 2, y + 4, 12, 3)
      px(ctx, STONE.hi, x + 2, y + 4, 12, 1)
      px(ctx, STONE.deep, x + 3, y + 7, 10, 1)
      px(ctx, "#8fd0f0", x + 3, y + 5, 10, 1)
      if (Math.sin(t * 3 + x) > 0.7) px(ctx, "#ffffff", x + 5 + Math.floor(Math.abs(Math.sin(t)) * 4), y + 5, 1, 1)
      // a small blue bird that hops on the rim
      const hop = Math.sin(t * 2.4) > 0.8 ? 1 : 0
      px(ctx, "#4e86a8", x + 9, y + 2 - hop, 4, 2)
      px(ctx, "#8fc0e0", x + 11, y + 1 - hop, 2, 2)
      px(ctx, "#ffb03a", x + 13, y + 2 - hop, 1, 1)
      px(ctx, "#4e3224", x + 12, y + 1 - hop, 1, 1)
      px(ctx, "#2a4f86", x + 8, y + 3 - hop, 2, 1)
      break
    }
    case "blanket": {
      // a gingham picnic cloth with a basket and an apple, lying flat
      px(ctx, "#c04060", x, y + 2, 16, 12)
      px(ctx, "#f4c0cc", x + 1, y + 3, 14, 10)
      for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) if ((i + j) % 2 === 0) px(ctx, "#e8708a", x + 1 + i * 2, y + 3 + j * 2, 2, 2)
      px(ctx, WOOD.mid, x + 8, y + 6, 6, 5)
      px(ctx, WOOD.hi, x + 8, y + 6, 6, 1)
      px(ctx, WOOD.deep, x + 8, y + 8, 6, 1)
      px(ctx, WOOD.mid, x + 9, y + 4, 1, 2)
      px(ctx, WOOD.mid, x + 12, y + 4, 1, 2)
      px(ctx, WOOD.mid, x + 9, y + 4, 4, 1)
      px(ctx, "#e0506a", x + 4, y + 7, 3, 3)
      px(ctx, "#f08aa0", x + 4, y + 7, 1, 1)
      px(ctx, "#4fbf5a", x + 5, y + 6, 2, 1)
      break
    }
    case "scarecrow": {
      shadow(2, 12)
      px(ctx, WOOD.mid, x + 7, y, 2, 15)
      px(ctx, WOOD.hi, x + 7, y, 1, 15)
      // arms with straw for hands
      px(ctx, WOOD.mid, x, y + 1, 16, 2)
      px(ctx, STRAW.mid, x - 1, y, 2, 5)
      px(ctx, STRAW.mid, x + 15, y, 2, 5)
      px(ctx, STRAW.hi, x - 1, y, 1, 3)
      // a blue shirt with a pink patch, straw at the hem
      px(ctx, "#4a7ab8", x + 4, y + 1, 8, 7)
      px(ctx, "#6a9ae0", x + 4, y + 1, 3, 7)
      px(ctx, "#2a4f86", x + 11, y + 1, 1, 7)
      px(ctx, "#ff9db8", x + 9, y + 4, 2, 2)
      for (let i = 0; i < 4; i++) px(ctx, STRAW.mid, x + 4 + i * 2, y + 8, 1, 2 + (i % 2))
      // a sack head with a stitched smile
      px(ctx, "#e8d4a8", x + 4, y - 6, 8, 7)
      px(ctx, "#c8b088", x + 11, y - 6, 1, 7)
      px(ctx, WOOD.dark, x + 6, y - 4, 1, 1)
      px(ctx, WOOD.dark, x + 9, y - 4, 1, 1)
      px(ctx, WOOD.dark, x + 6, y - 2, 4, 1)
      px(ctx, WOOD.dark, x + 6, y - 3, 1, 1)
      px(ctx, WOOD.dark, x + 9, y - 3, 1, 1)
      // a floppy hat with a pink band
      px(ctx, WOOD.deep, x + 2, y - 8, 12, 2)
      px(ctx, WOOD.mid, x + 4, y - 13, 8, 5)
      px(ctx, WOOD.hi, x + 4, y - 13, 2, 5)
      px(ctx, "#ff9db8", x + 4, y - 9, 8, 1)
      // a crow that does not mind
      px(ctx, "#2a2a36", x + 12, y - 2, 4, 3)
      px(ctx, "#2a2a36", x + 14, y - 4, 2, 2)
      px(ctx, "#ffb03a", x + 16, y - 3, 1, 1)
      px(ctx, "#4a4a5a", x + 12, y - 2, 1, 1)
      break
    }
    case "wheelbarrow": {
      shadow(1, 15)
      // the soil it carries, and a seedling
      px(ctx, WOOD.deep, x + 6, y + 3, 8, 3)
      px(ctx, "#8a6048", x + 7, y + 3, 4, 1)
      px(ctx, "#4fbf5a", x + 9, y + 0, 1, 3)
      px(ctx, "#8fdc92", x + 10, y + 1, 2, 1)
      // the tub
      px(ctx, "#f0607a", x + 5, y + 5, 10, 1)
      px(ctx, "#c8324e", x + 5, y + 6, 10, 4)
      px(ctx, "#8a1f3a", x + 7, y + 10, 7, 1)
      px(ctx, "#f08aa0", x + 6, y + 6, 4, 1)
      // handles, a leg, and the front wheel
      px(ctx, WOOD.mid, x + 13, y + 10, 3, 1)
      px(ctx, WOOD.deep, x + 12, y + 10, 1, 5)
      px(ctx, "#2f3640", x + 0, y + 8, 6, 6)
      px(ctx, "#8e99a4", x + 1, y + 9, 4, 4)
      px(ctx, "#2f3640", x + 2, y + 10, 2, 2)
      px(ctx, "#cdd6dd", x + 1, y + 9, 1, 1)
      break
    }
    case "haybale": {
      shadow(0, 16)
      const bale = (bx: number, by: number, w: number, h: number) => {
        px(ctx, STRAW.mid, x + bx, y + by, w, h)
        px(ctx, STRAW.hi, x + bx, y + by, w, 1)
        px(ctx, STRAW.deep, x + bx, y + by + h - 1, w, 1)
        px(ctx, STRAW.deep, x + bx + w - 1, y + by, 1, h)
        for (let ly = 3; ly < h - 1; ly += 3) px(ctx, STRAW.deep, x + bx + 1, y + by + ly, w - 3, 1)
        px(ctx, WOOD.mid, x + bx + 3, y + by, 1, h)
        px(ctx, WOOD.mid, x + bx + w - 5, y + by, 1, h)
      }
      bale(1, 6, 14, 9)
      if (variant % 2 === 0) bale(3, -1, 11, 7)
      px(ctx, STRAW.hi, x + 0, y + 8, 2, 1)
      px(ctx, STRAW.hi, x + 14, y + 12, 2, 1)
      break
    }
    case "beehive": {
      shadow(1, 14)
      px(ctx, WOOD.deep, x + 3, y + 13, 2, 2)
      px(ctx, WOOD.deep, x + 11, y + 13, 2, 2)
      px(ctx, WOOD.mid, x + 1, y + 11, 14, 2)
      px(ctx, WOOD.hi, x + 1, y + 11, 14, 1)
      // a straw skep built of coils
      const rows = [[6, 4], [5, 6], [4, 8], [3, 10], [2, 12], [2, 12], [2, 12], [2, 12], [2, 12]] as const
      rows.forEach(([rx, rw], i) => {
        px(ctx, i % 2 ? STRAW.deep : STRAW.mid, x + rx, y + 2 + i, rw, 1)
        px(ctx, STRAW.hi, x + rx, y + 2 + i, 1, 1)
      })
      px(ctx, WOOD.dark, x + 7, y + 9, 3, 2)
      px(ctx, WOOD.dark, x + 8, y + 8, 1, 1)
      // flowers at the foot and two bees that circle it
      px(ctx, "#4f9a4e", x + 0, y + 13, 3, 2)
      px(ctx, "#ff9db8", x + 1, y + 12, 2, 2)
      px(ctx, "#c9a8ff", x + 13, y + 12, 2, 2)
      for (let i = 0; i < 2; i++) {
        const bx = x + 8 + Math.round(Math.cos(t * 3 + i * 3) * 7)
        const by = y + 4 + Math.round(Math.sin(t * 4 + i * 2) * 4)
        px(ctx, "#e8b04a", bx, by, 2, 1)
        px(ctx, "#2a2a36", bx + 1, by, 1, 1)
        px(ctx, "#ffffff", bx, by - 1, 1, 1)
      }
      break
    }
    case "rowboat": {
      // a little blue boat pulled up on the sand, an oar across it
      px(ctx, "rgba(60,40,20,0.25)", x + 0, y + 11, 16, 3)
      px(ctx, "#4a7ab8", x + 0, y + 5, 2, 3)
      px(ctx, "#4a7ab8", x + 14, y + 5, 2, 3)
      px(ctx, WOOD.deep, x + 2, y + 6, 12, 2)
      px(ctx, WOOD.hi, x + 0, y + 5, 16, 1)
      px(ctx, "#4a7ab8", x + 1, y + 8, 14, 2)
      px(ctx, "#ffffff", x + 1, y + 9, 14, 1)
      px(ctx, "#2a4f86", x + 3, y + 10, 10, 2)
      px(ctx, "#6a9ae0", x + 2, y + 8, 5, 1)
      px(ctx, WOOD.mid, x + 7, y + 6, 2, 1)
      px(ctx, WOOD.hi, x + 4, y + 2, 1, 5)
      px(ctx, WOOD.hi, x + 3, y + 1, 3, 2)
      px(ctx, "#d9c7ba", x + 11, y + 7, 2, 1)
      break
    }
  }
}
