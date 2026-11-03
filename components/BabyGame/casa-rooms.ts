/**
 * components/BabyGame/casa-rooms.ts — paints the rooms off the three floors: Sunken Lounge, Glasshouse, Boudoir
 *
 * The shells only (walls, windows, floors, built-ins); the furniture is `lib/baby-game/casa-furniture.ts`, drawn from the
 * ComfyUI sprites. Each has an arched door in the middle of the back wall that leads back to the room it opens off. The lounge
 * is sage and round-windowed (after the green lounges on the board), the glasshouse is a conservatory of green iron lattice over
 * black-and-white stone, the boudoir is lilac with a glass-block window wall and an emerald-tiled bath alcove.
 */

import { CEIL, CT } from "@/lib/baby-game/casa"
import { archDoor, archRing, disc, glassAt, glassDisc, h2, LEAD, mix, parquet, PLASTER, plaster, px, SILVER, view, wallLight, type Ctx } from "./casa-kit"

const SAGE = ["#86ad92", "#9fc6a8", "#bbdcbd", "#d5ebcf", "#eaf5e1"]
const LILAC = ["#b9a6c6", "#cebddb", "#e0d3e8", "#efe7f2", "#faf6fb"]
const IRON = "#3f6b50"

/** A ring of plaster round a window, lit on its upper left. */
function rim(ctx: Ctx, cx: number, cy: number, r0: number, r1: number) {
  for (let y = Math.floor(cy - r1); y <= Math.ceil(cy + r1); y++) {
    for (let x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d >= r0 && d <= r1) px(ctx, x + y < cx + cy ? PLASTER[4]! : x + y > cx + cy + 8 ? PLASTER[1]! : PLASTER[3]!, x, y)
    }
  }
}

/** A round window onto the meadow: plaster rim, a lead cross, a spark. */
function roundWindow(ctx: Ctx, cx: number, cy: number, r: number) {
  rim(ctx, cx, cy, r, r + 5)
  disc(ctx, cx, cy, r, r, (x, y) => view(x, y))
  for (let a = -r; a <= r; a++) {
    px(ctx, LEAD, cx + a, cy, 1, 1)
    px(ctx, LEAD, cx, cy + a, 1, 1)
  }
  for (let k = 0; k < 3; k++) glassDisc(ctx, cx - r * 0.45 + k * 5, cy - r * 0.55, 2.4, glassAt(k, cx, 3))
}

function doorway(ctx: Ctx, seed: number) {
  archRing(ctx, 256, 66, 40, 48, 128)
  archDoor(ctx, 232, 58, 48, 70, seed)
}

/** The Sunken Lounge: sage plaster, round windows, a ledge of cushions, a pit of wool in the floor. */
export function paintLounge(ctx: Ctx, W: number, H: number) {
  plaster(ctx, 0, -CEIL * CT, W, 128, wallLight(256, 12, W), SAGE)
  for (let k = 0; k < 4; k++) archRing(ctx, 96 + k * 108, 134, 74 + k * 4, 80 + k * 4, 40 + k * 3)
  roundWindow(ctx, 70, 66, 28)
  roundWindow(ctx, 442, 66, 28)
  doorway(ctx, 11)
  // a built-in ledge of deep green cushions along the whole back wall
  for (let x = 0; x < W; x++) {
    const top = 108 + Math.round(2.4 * Math.sin(x * 0.07))
    for (let y = top; y < 128; y++) px(ctx, y === top ? "#a7d3a6" : y < top + 5 ? "#6fae7c" : "#4f8f64", x, y)
    if (x % 40 < 22 && (x % 40) > 2) {
      const c = Math.floor(x / 40) % 2 ? "#e8c9d6" : "#cfe6f0"
      for (let y = top - 7; y < top + 2; y++) if (((x % 40) - 12) ** 2 / 100 + (y - top + 3) ** 2 / 20 < 1) px(ctx, y < top - 4 ? mix(c, "#ffffff", 0.4) : c, x, y)
    }
  }
  // the floor: oat-coloured stone with flecks, and a pit sunk in the middle with wool in it
  for (let y = 128; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const e = Math.hypot((x - 256) / 168, (y - 238) / 58)
      let c = (Math.floor(x / 24) + Math.floor(y / 24)) % 2 ? "#e3dcc4" : "#dbd4bb"
      if (h2(x, y, 5) > 0.95) c = "#bfb89f"
      if (e < 1) {
        const ring = e > 0.9 ? "#f7f4e6" : e > 0.84 ? "#a79f86" : null
        c = ring ?? (e > 0.45 ? ((x + y) % 4 === 0 ? "#a9cf9c" : "#b9d9ac") : (x + y) % 3 === 0 ? "#cfe6c0" : "#dcefcc")
      }
      px(ctx, c, x, y)
    }
  }
  disc(ctx, 256, 238, 34, 11, (x, y) => (Math.floor(Math.hypot((x - 256) / 34, (y - 238) / 11) * 4) % 2 ? "#e8c9d6" : "#f8f1ee"))
}

/** The Glasshouse: a conservatory of lattice and sky, checkerboard stone, a round table's worth of floor. */
export function paintGlasshouse(ctx: Ctx, W: number, H: number) {
  plaster(ctx, 0, -CEIL * CT, W, 128, wallLight(256, 10, W), PLASTER)
  // the glass: sky, trees, and a lattice of iron
  for (let y = -CEIL * CT; y < 100; y++) for (let x = 12; x < W - 12; x++) px(ctx, view(x, Math.max(y, 40)), x, y)
  for (let y = -CEIL * CT; y < 100; y++) {
    for (let x = 12; x < W - 12; x++) {
      const vault = Math.abs(((x - 256) / 244) ** 2 * 60)
      if (y < -20 + vault) px(ctx, PLASTER[2]!, x, y)
      else if ((x - 12) % 24 < 2 || (y + 48) % 22 < 2) px(ctx, IRON, x, y)
      else if ((x - 12) % 24 === 2 || (y + 48) % 22 === 2) px(ctx, "#8cc09e", x, y)
    }
  }
  // arches of lattice over the door
  for (let a = 0; a < 4; a++) archRing(ctx, 256, 70, 58 + a * 0, 62, 128)
  doorway(ctx, 12)
  // emerald tile to shoulder height, a cream cap, and a strip of black
  for (let y = 100; y < 128; y++) {
    for (let x = 0; x < W; x++) {
      const t = (Math.floor(x / 8) + Math.floor(y / 8)) % 2
      let c = y < 102 ? "#f6f0e2" : t ? "#2f8a68" : "#3a9a74"
      if (y > 102 && (x % 8 === 0 || y % 8 === 0)) c = "#256f54"
      if (y > 102 && h2(x, y, 4) > 0.97) c = "#8fd0a8"
      px(ctx, c, x, y)
    }
  }
  // floor: black and white stone in a diamond lay, pale at the glass, warm at the foot
  for (let y = 128; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = (Math.floor((x + y) / 16) + Math.floor((x - y + 1024) / 16)) % 2
      let c = d ? "#f1ede2" : "#2f3a36"
      if (d && h2(x >> 1, y >> 1, 7) > 0.9) c = "#d9d4c6"
      if (!d && h2(x >> 1, y >> 1, 8) > 0.9) c = "#46524c"
      px(ctx, c, x, y)
    }
  }
  disc(ctx, 256, 232, 120, 44, (x, y) => (Math.floor(Math.hypot((x - 256) / 120, (y - 232) / 44) * 6) % 2 ? "#a64a56" : "#d98a92"))
  disc(ctx, 256, 232, 76, 28, "#f3e4d0")
  for (let a = 0; a < 16; a++) px(ctx, "#a64a56", 256 + Math.cos(a * 0.39) * 100, 232 + Math.sin(a * 0.39) * 36, 3, 2)
}

/** The Boudoir: lilac plaster, a wall of glass blocks, an emerald bath alcove, honey parquet and a lilac rug. */
export function paintBoudoir(ctx: Ctx, W: number, H: number) {
  plaster(ctx, 0, -CEIL * CT, W, 128, wallLight(256, 12, W), LILAC)
  for (let k = 0; k < 4; k++) archRing(ctx, 96 + k * 108, 134, 74 + k * 4, 80 + k * 4, 40 + k * 3)
  // the glass-block wall on the left: pale blocks over a dim view, each with a bright corner
  const bx0 = 24
  const bx1 = 200
  for (let y = 22; y < 112; y++) {
    for (let x = bx0; x < bx1; x++) {
      const gx = (x - bx0) % 11
      const gy = (y - 22) % 11
      const cell = Math.floor((x - bx0) / 11) + Math.floor((y - 22) / 11) * 17
      let c = mix("#cfe4ee", view(x, y), 0.35 + 0.15 * h2(cell, 1))
      if (gx === 0 || gy === 0) c = "#9fb6c2"
      else if (gx < 3 && gy < 3) c = "#ffffff"
      else if (gx === 10 || gy === 10) c = mix(c, "#7f98a8", 0.3)
      px(ctx, c, x, y)
    }
  }
  px(ctx, SILVER.mid, bx0 - 2, 20, bx1 - bx0 + 4, 2)
  px(ctx, SILVER.deep, bx0 - 2, 112, bx1 - bx0 + 4, 2)
  doorway(ctx, 13)
  // the bath alcove on the right: an arch of emerald tile, a lamp on each side
  const ax = 400
  for (let y = 36; y < 128; y++) {
    const half = y < 66 ? Math.round(88 * Math.sqrt((y - 36) / 30)) : 88
    for (let x = ax - half; x <= ax + half; x++) {
      const t = (Math.floor(x / 8) + Math.floor(y / 8)) % 2
      let c = t ? "#2f8a68" : "#3a9a74"
      if (x % 8 === 0 || y % 8 === 0) c = "#256f54"
      if (h2(x, y, 6) > 0.96) c = "#9fe0b8"
      if (Math.abs(x - (ax - half)) < 3 || Math.abs(x - (ax + half)) < 3) c = "#f6f0e2"
      px(ctx, c, x, y)
    }
  }
  for (let x = ax - 88; x <= ax + 88; x++) px(ctx, "#f6f0e2", x, 36 + Math.round(30 * (1 - Math.sqrt(Math.max(0, 1 - ((x - ax) / 88) ** 2)))) - 2, 1, 3)
  px(ctx, "#f6f0e2", ax - 88, 66, 177, 1)
  parquet(ctx, 0, 128, W, H)
  // bath mat of honey, lilac rug by the vanity
  disc(ctx, 120, 244, 84, 30, (x, y) => (Math.floor(Math.hypot((x - 120) / 84, (y - 244) / 30) * 7) % 2 ? "#cfbadb" : "#ece0ef"))
  disc(ctx, 120, 244, 20, 7, "#faf4fb")
  disc(ctx, 400, 190, 52, 12, (x, y) => (Math.floor(Math.hypot((x - 400) / 52, (y - 190) / 12) * 5) % 2 ? "#8fd0b0" : "#e4f4ea"))
}
