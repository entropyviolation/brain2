/**
 * components/BabyGame/housegen.ts — One house builder for every friend
 *
 * A house is a `HouseSpec`: a body (cottage, tower, dome, bulb), a material for its walls, a roof profile with dragon-scale
 * shingles, a door and window shape, named palette ramps and a few extras. `specFor(kind, id)` fills one in from the home's
 * kind (what the species keeps) and a hash of the friend's id (which colours, which shapes, which extras), so a friend that
 * does not exist yet still gets a home that looks like it belongs. Everything is drawn into one pixel buffer on the 96 grid
 * by the same few part painters (`part`: a mask, a shade, a contour in the part's own deepest tone), so the outline, the
 * light (top left, banded with a Bayer grain) and the palette agree across every house. `buildHouse` is pure; `homeart-hi.ts`
 * turns the buffer into a canvas and `scripts/baby-house-sheet.mts` into a contact sheet.
 */

import type { HomeKind } from "@/lib/baby-game/homes"

export const HOUSE_W = 96
const W = HOUSE_W
/** The ground line the house stands on (bottom-centre of the picture is the home tile's foot). */
const GY = 89
const INK = 0x1a1633

/** Five tones from lit to deep, as 0xRRGGBB. */
export type Ramp = [number, number, number, number, number]
const R = (...s: string[]) => s.map((h) => parseInt(h.slice(1), 16)) as Ramp

const WALLS: Record<string, Ramp> = {
  lilac: R("#f4eefc", "#dcd2f2", "#b8aadd", "#8d80bd", "#5f5596"),
  mint: R("#eefcf6", "#cdf0e2", "#9bd8c6", "#68b3a8", "#3f8085"),
  sky: R("#f1f8ff", "#d3e6fa", "#a8c8ee", "#7a9fd2", "#4d6aa8"),
  rose: R("#fff1f6", "#f6d3e2", "#e3a8c6", "#be7fa8", "#8a5282"),
  silver: R("#eef2f6", "#cdd5df", "#a2aebd", "#76849a", "#4c5a74"),
}
const ROOFS: Record<string, Ramp> = {
  teal: R("#9ff5e0", "#4fd6c0", "#26a6a8", "#17727f", "#0f4560"),
  cobalt: R("#b7d0ff", "#6f9cf5", "#4372d6", "#2d4aa0", "#1d2f6c"),
  violet: R("#e2c8ff", "#b18af0", "#8056d0", "#5a38a0", "#3a2370"),
  coral: R("#ffd0d8", "#f59fb4", "#d46a92", "#9d3f72", "#6a2552"),
  jade: R("#c8f6b8", "#7fdc98", "#3fb27a", "#25825f", "#175a4a"),
  steel: R("#f0f6ff", "#c7d6ee", "#98acd0", "#6a7fa8", "#444f7c"),
  orchid: R("#f6c8f2", "#e08ee0", "#b85ec4", "#8a3c9a", "#5c2470"),
}
const WOOD = R("#c9a2a0", "#a9798a", "#7e5671", "#5a3b57", "#3a2641")
const GLASS = R("#d9fbff", "#8fe3ea", "#4fb4cf", "#3a78b8", "#27407f")
const GLOW = R("#ffffff", "#fff4ee", "#d4fff2", "#8ff0e0", "#4fb4cf")
const MATERIALS: Record<string, Ramp> = {
  stone: R("#d6d4ec", "#aaa8d0", "#807ea8", "#58577f", "#38375a"),
  ice: R("#ffffff", "#e8f6ff", "#c4def5", "#95b8e0", "#6b8cc0"),
  log: R("#c9a6c0", "#a07fa0", "#795a86", "#553e68", "#372848"),
  wicker: R("#f2ecf8", "#d9d0e6", "#b4a6cc", "#8c7ca8", "#615280"),
  turf: R("#a8f0b8", "#5fd09a", "#34a384", "#20736e", "#134a55"),
  bark: R("#b89ab0", "#8f6f94", "#6a4e7a", "#4a3560", "#2e2145"),
  concrete: R("#f4f0f2", "#ddd8e0", "#bab4c6", "#8e88a6", "#5e5a7e"),
  shell: R("#ffffff", "#e8f0ff", "#c8d4ee", "#98a8d0", "#6070a8"),
}
/** Little coloured tiles for the trencadís band and the flowers. */
const BITS = [0x5ee6e0, 0xff8fc0, 0x9d7bff, 0xf4f4ff, 0x8ff0b0, 0x6fb4ff]

export type Body = "cottage" | "tower" | "dome" | "bulb" | "pod" | "stack"
export type RoofShape = "gable" | "cone" | "onion" | "cap" | "none"
export type Material = "plaster" | keyof typeof MATERIALS
export type Extra = "chimney" | "vine" | "lantern" | "flowers" | "crystals" | "star" | "fins" | "reeds" | "water" | "spots" | "ivy" | "stair" | "pedestal"

export type HouseSpec = {
  body: Body
  material: Material
  /** Wall ramp name for plaster; ignored by other materials. */
  wall: keyof typeof WALLS
  roof: RoofShape
  roofRamp: keyof typeof ROOFS
  door: "arch" | "round" | "catenary"
  window: "round" | "arch" | "quatrefoil"
  /** Half-width and height of the walls (the dome and bulb use them for their own size). */
  hw: number
  h: number
  extras: Extra[]
  /** Seeds every bit of texture. */
  seed: number
  /** A block of flats: how many friends share it. Each gets a front door two tiles apart on the ground module and a module of windows above. */
  tenants?: number
}

const hash = (a: number, b: number) => {
  let t = (a * 374761393 + b * 668265263) >>> 0
  t = (t ^ (t >>> 13)) * 1274126177
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}
const strHash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
const pick = <T,>(list: readonly T[], r: number): T => list[Math.min(list.length - 1, Math.floor(r * list.length))]!

/** The spec for a friend's home: what the kind fixes (body, material, door), and what the id picks (colours, shapes, extras). */
export function specFor(kind: HomeKind, id: string, tenants = 0): HouseSpec {
  const seed = strHash(id)
  const r = (k: number) => hash(seed, k)
  const wall = pick(Object.keys(WALLS), r(1)) as keyof typeof WALLS
  const roofRamp = pick(Object.keys(ROOFS), r(2)) as keyof typeof ROOFS
  const win = pick(["round", "arch", "quatrefoil"] as const, r(3))
  const sprinkle = (pool: Extra[], n: number) => pool.filter((_, i) => r(10 + i) < n)
  const base = { wall, roofRamp, window: win, seed }
  /** One art pixel is one game pixel now (the picture is shown 2× nearest), so the shapes are drawn smaller than before to stand about four tiles wide. */
  const K = 0.8
  switch (kind) {
    case "hutch":
      return { ...base, body: "stack", material: "concrete", roof: "none", door: "round", hw: Math.round((26 + Math.floor(r(6) * 6)) * K), h: 3, extras: ["flowers", ...sprinkle(["lantern", "ivy"], 0.5)] }
    case "stall":
      return { ...base, body: "pod", material: "shell", roof: "none", door: "round", hw: Math.round(42 * K), h: Math.round(34 * K), extras: ["pedestal", "flowers", ...sprinkle(["lantern", "crystals"], 0.5)] }
    case "nest":
      return { ...base, body: "pod", material: "concrete", roof: "none", door: "round", hw: Math.round(32 * K), h: Math.round(58 * K), extras: ["flowers", ...sprinkle(["ivy", "lantern", "star"], 0.5)] }
    case "burrow":
      return { ...base, body: "pod", material: "concrete", roof: "none", door: "round", hw: Math.round(38 * K), h: Math.round(54 * K), extras: ["ivy", "flowers", ...sprinkle(["crystals", "lantern"], 0.5)] }
    case "den":
      return { ...base, body: "pod", material: "concrete", roof: "none", door: "round", hw: Math.round(36 * K), h: Math.round(60 * K), extras: ["stair", ...sprinkle(["ivy", "flowers", "lantern"], 0.5)] }
    case "hollow":
      return { ...base, body: "stack", material: "concrete", roof: "none", door: "round", hw: Math.round(20 * K), h: 4, extras: ["ivy", "lantern", ...sprinkle(["flowers", "star"], 0.5)] }
    case "lodge":
      return { ...base, body: "pod", material: "shell", roof: "none", door: "round", hw: Math.round(40 * K), h: Math.round(46 * K), extras: ["pedestal", "water", "reeds", ...sprinkle(["lantern", "flowers"], 0.5)] }
    case "flat":
      return { ...base, body: "stack", material: "concrete", roof: "none", door: "round", hw: 44, h: 4, tenants: Math.max(1, tenants), extras: ["flowers", "ivy", ...sprinkle(["lantern", "star"], 0.6)] }
    case "igloo":
      return { ...base, body: "pod", material: "shell", roof: "none", door: "round", hw: Math.round(38 * K), h: Math.round(50 * K), extras: ["crystals", ...sprinkle(["star", "lantern", "flowers"], 0.6)] }
  }
}

// ---- the buffer and its painters -------------------------------------------------------------------------------

class Buf {
  px = new Int32Array(W * W).fill(-1)
  set(x: number, y: number, c: number) {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && y >= 0 && x < W && y < W) this.px[y * W + x] = c
  }
  get(x: number, y: number) {
    return x < 0 || y < 0 || x >= W || y >= W ? -1 : this.px[y * W + x]!
  }
  rect(c: number, x: number, y: number, w: number, h: number) {
    x = Math.round(x); y = Math.round(y)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
  }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]! / 16 - 0.5

/** Pick a tone of a ramp for a light value `t` (0 lit, 1 deep), banded and grained like the rest of the game. */
const tone = (ramp: Ramp, t: number, x: number, y: number) => ramp[Math.max(0, Math.min(4, Math.round(t * 4 + bayer(x, y) * 0.9)))]!

type Box = { x0: number; y0: number; x1: number; y1: number }

/**
 * Paint one part: every pixel in `box` where `inside` holds gets `shade`'s colour; then its own edge goes the deepest tone of
 * `edge` (a part drawn later covers the earlier one, so overlaps read as depth). Returns the mask for callers that want it.
 */
function part(b: Buf, box: Box, inside: (x: number, y: number) => boolean, shade: (x: number, y: number) => number, edge: number | null = INK, keepBottom = false): Set<number> {
  const mask = new Set<number>()
  for (let y = Math.floor(box.y0); y <= Math.ceil(box.y1); y++) for (let x = Math.floor(box.x0); x <= Math.ceil(box.x1); x++) if (inside(x, y)) mask.add(y * W + x)
  for (const k of mask) {
    const x = k % W
    const y = (k - x) / W
    b.set(x, y, shade(x, y))
  }
  if (edge !== null) {
    for (const k of mask) {
      const x = k % W
      const y = (k - x) / W
      const open = !mask.has(k - 1) || !mask.has(k + 1) || !mask.has(k - W) || (!mask.has(k + W) && !keepBottom)
      if (open) b.set(x, y, edge)
    }
  }
  return mask
}

/** A light value from where a pixel sits in its part: lit on the top left, deep on the bottom right. */
const lightAt = (x: number, y: number, box: Box, spread = 0.75) => {
  const u = (x - box.x0) / Math.max(1, box.x1 - box.x0)
  const v = (y - box.y0) / Math.max(1, box.y1 - box.y0)
  return Math.max(0, Math.min(1, (u * 0.6 + v * 0.4) * spread + 0.08))
}

// ---- materials ---------------------------------------------------------------------------------------------------

function materialColor(spec: HouseSpec, x: number, y: number, t: number, box: Box): number {
  const s = spec.seed
  const m = spec.material
  if (m === "plaster") {
    const w = WALLS[spec.wall]!
    // a soft crackle of speckle, a few darker flecks
    const sp = hash(x * 3 + s, y * 5)
    return tone(w, t + (sp > 0.93 ? 0.2 : sp < 0.04 ? -0.15 : 0), x, y)
  }
  const ramp = MATERIALS[m]!
  switch (m) {
    case "stone": {
      // blocks of uneven height with a mortar line in the next deeper tone
      const row = Math.floor((y - box.y0) / 7)
      const off = (row % 2) * 6
      const col = Math.floor((x - box.x0 + off) / 12)
      const mortar = (y - box.y0) % 7 === 6 || (x - box.x0 + off) % 12 === 11
      if (mortar) return ramp[3]!
      return tone(ramp, t + (hash(row * 13 + col + s, 9) - 0.5) * 0.35, x, y)
    }
    case "ice": {
      const row = Math.floor((y - box.y0) / 8)
      const off = (row % 2) * 7
      const mortar = (y - box.y0) % 8 === 7 || (x - box.x0 + off) % 14 === 13
      if (mortar) return ramp[3]!
      return tone(ramp, t * 0.8, x, y)
    }
    case "log": {
      const row = (y - box.y0) % 6
      if (row === 5) return ramp[4]!
      const end = (x + Math.floor((y - box.y0) / 6) * 5 + s) % 17 === 0
      if (end) return ramp[1]!
      return tone(ramp, t + (row === 0 ? -0.2 : row > 3 ? 0.15 : 0) + (hash(Math.floor((y - box.y0) / 6), s) - 0.5) * 0.3, x, y)
    }
    case "wicker": {
      // a basket weave: 3×3 cells that alternate over and under
      const cx = Math.floor((x - box.x0) / 3)
      const cy = Math.floor((y - box.y0) / 3)
      const over = (cx + cy) % 2 === 0
      const edge = (over ? (x - box.x0) % 3 === 2 : (y - box.y0) % 3 === 2)
      return tone(ramp, t + (edge ? 0.3 : over ? -0.1 : 0.1), x, y)
    }
    case "turf": {
      const k = hash(x + s, y * 3)
      const blade = k > 0.82
      return tone(ramp, t + (blade ? -0.35 : k < 0.15 ? 0.2 : 0), x, y)
    }
    case "concrete": {
      // cast concrete: soft mottling, a scatter of small round pits, a few rain streaks
      const pit = hash(Math.floor(x / 5) + s, Math.floor(y / 5)) > 0.8 && (x % 5 === 2) && (y % 5 === 2)
      const streak = hash(x + s, 3) > 0.9 && hash(x, Math.floor(y / 9)) > 0.5
      return pit ? ramp[4]! : tone(ramp, t + (hash(x * 2 + s, y * 2) > 0.9 ? 0.12 : 0) + (streak ? 0.16 : 0), x, y)
    }
    case "shell": {
      // a pearl skin: the friend's own wall tint drifting through mint, lilac and sky as the surface turns
      const tint = [WALLS[spec.wall]!, WALLS.mint!, WALLS.sky!, WALLS.lilac!]
      const k = Math.sin((x - box.x0) * 0.09 + (y - box.y0) * 0.16 + s * 0.001) * 0.5 + 0.5
      return tone(tint[Math.min(3, Math.floor(k * 4))]!, t * 0.8 + 0.04, x, y)
    }
    case "bark": {
      const ridge = (x * 7 + Math.floor(hash(Math.floor(x / 3), s) * 9)) % 5
      const knot = hash(Math.floor(x / 4), Math.floor(y / 6) + s) > 0.93
      return tone(ramp, t + (ridge === 0 ? 0.3 : ridge === 3 ? -0.2 : 0) + (knot ? 0.3 : 0), x, y)
    }
  }
  return ramp[2]!
}

const wallEdge = (spec: HouseSpec) => (spec.material === "plaster" ? WALLS[spec.wall]![4]! : MATERIALS[spec.material]![4]!)

// ---- roofs -------------------------------------------------------------------------------------------------------

/** Half-width of a roof at `t` (0 at the peak, 1 at the eave) for a given eave half-width. */
function roofHalf(shape: RoofShape, t: number, eave: number): number {
  switch (shape) {
    case "gable": return 2 + (eave - 2) * Math.pow(t, 0.92)
    case "cone": return 1.5 + (eave - 1.5) * Math.pow(t, 1.35)
    case "onion": {
      // a bulb: it swells to the widest at six tenths and draws in to the eave
      const k = t < 0.62 ? Math.sin((t / 0.62) * (Math.PI / 2)) ** 0.8 : 1 - 0.14 * ((t - 0.62) / 0.38)
      return 1 + (eave - 1) * k
    }
    case "cap": return 2 + (eave - 2) * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)))
    default: return 0
  }
}

/** A roof: its silhouette from `profile`, then rows of overlapping scales laid from the eave up, each lit on its upper left. */
function roof(b: Buf, spec: HouseSpec, cx: number, peak: number, eaveY: number, eaveHalf: number) {
  if (spec.roof === "none") return
  const ramp = ROOFS[spec.roofRamp]!
  const box: Box = { x0: cx - eaveHalf - 1, y0: peak, x1: cx + eaveHalf + 1, y1: eaveY }
  const hwAt = (y: number) => roofHalf(spec.roof, (y - peak) / Math.max(1, eaveY - peak), eaveHalf)
  const inRoof = (x: number, y: number) => y >= peak && y <= eaveY && Math.abs(x - cx + 0.5) <= hwAt(y)
  // the silhouette in the deep tone, so the gaps between scales read as shade
  part(b, box, inRoof, () => ramp[3]!, ramp[4]!)
  const rowH = 5
  const sw = 7
  for (let ry = eaveY - 2; ry > peak - 3; ry -= rowH) {
    const rowIdx = Math.round((eaveY - ry) / rowH)
    const off = (rowIdx % 2) * (sw / 2)
    for (let sx = cx - eaveHalf - sw + off; sx <= cx + eaveHalf + sw; sx += sw) {
      const scx = Math.round(sx)
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = scx + dx
        const y = ry + dy
        if (!inRoof(x, y)) continue
        const d = Math.hypot(dx, dy * 1.0)
        if (d > 3.4 || dy < -1 && d > 3.1) continue
        // the lower arc is the scale's edge; inside it, lit from the top left
        if (dy > 0 && d > 2.5) b.set(x, y, ramp[4]!)
        else b.set(x, y, tone(ramp, 0.12 + (dx + 3) / 14 + (dy + 3) / 12 + (hash(scx, ry + spec.seed) - 0.5) * 0.15, x, y))
      }
    }
  }
  // the roof's own contour again, since the scales overpainted it, and a shadow line under the eave
  part(b, box, inRoof, (x, y) => b.get(x, y), ramp[4]!, true)
  for (let x = cx - Math.round(hwAt(eaveY)); x <= cx + Math.round(hwAt(eaveY)); x++) b.set(x, eaveY + 1, ramp[4]!)
}

// ---- doors, windows, extras -----------------------------------------------------------------------------------

function doorTest(shape: HouseSpec["door"], cx: number, top: number, dw: number): (x: number, y: number) => boolean {
  const hw = dw / 2
  const dh = GY - top
  return (x, y) => {
    if (y > GY || y < top) return false
    const u = Math.abs(x - cx + 0.5)
    if (shape === "catenary") return u <= hw * Math.pow(Math.max(0, (y - top + 1) / dh), 0.42)
    if (shape === "round") return u <= hw && ((y - top) >= hw || u * u + (hw - (y - top)) ** 2 <= hw * hw)
    return u <= hw && ((y - top) >= hw || u * u + (hw - (y - top)) ** 2 <= hw * hw)
  }
}

function door(b: Buf, spec: HouseSpec, cx: number, dw: number, dh: number, lit: boolean) {
  const top = GY - dh
  const box: Box = { x0: cx - dw / 2 - 3, y0: top - 3, x1: cx + dw / 2 + 3, y1: GY + 1 }
  const outer = doorTest(spec.door, cx, top - 2, dw + 4)
  const inner = doorTest(spec.door, cx, top, dw)
  const trim = spec.material === "plaster" ? WALLS[spec.wall]! : MATERIALS[spec.material]!
  // a frame in a lighter tone of the wall, a threshold stone, then planks
  part(b, box, outer, (x, y) => tone(trim, 0.05 + lightAt(x, y, box) * 0.3, x, y), wallEdge(spec))
  part(b, box, inner, (x, y) => {
    const plank = (x - (cx - dw / 2)) % 4 === 0
    const t = lightAt(x, y, box, 1) * 0.8 + (plank ? 0.25 : 0)
    return tone(WOOD, t, x, y)
  }, WOOD[4]!)
  // an iron strap and a round knob
  const sy = top + Math.round(dh * 0.5)
  for (let x = cx - dw / 2 + 1; x < cx + dw / 2 - 1; x++) if (inner(x, sy)) b.set(x, sy, WOOD[4]!)
  b.set(cx + Math.floor(dw / 2) - 3, sy + 3, 0xd7e8ff)
  b.set(cx + Math.floor(dw / 2) - 3, sy + 4, 0x8fa8d8)
  if (lit) {
    // a seam of light under the door and a glow on the step
    for (let x = cx - dw / 2 + 1; x < cx + dw / 2 - 1; x++) b.set(x, GY, GLOW[3]!)
  }
  // two stone steps
  const step = MATERIALS.stone
  for (let i = 0; i < 2; i++) {
    const half = dw / 2 + 3 + i * 3
    part(b, { x0: cx - half, y0: GY + 1 + i * 2, x1: cx + half, y1: GY + 2 + i * 2 }, (x, y) => y >= GY + 1 + i * 2 && y <= GY + 2 + i * 2 && Math.abs(x - cx + 0.5) <= half, (x, y) => tone(step, y === GY + 1 + i * 2 ? 0.1 : 0.55, x, y), step[4]!)
  }
}

function windowAt(b: Buf, spec: HouseSpec, cx: number, cy: number, size: number, lit: boolean, shape = spec.window) {
  const r = size / 2
  const box: Box = { x0: cx - r - 2, y0: cy - r - 2, x1: cx + r + 2, y1: cy + r + 3 }
  const test = (rr: number) => (x: number, y: number) => {
    const dx = x - cx + 0.5
    const dy = y - cy + 0.5
    if (shape === "round") return dx * dx + dy * dy <= rr * rr
    if (shape === "arch") return Math.abs(dx) <= rr * 0.8 && (dy >= 0 ? dy <= rr * 1.1 : dx * dx + dy * dy <= rr * rr * 0.8)
    // four lobes round a middle
    const lobe = (ox: number, oy: number) => (dx - ox) ** 2 + (dy - oy) ** 2 <= (rr * 0.56) ** 2
    return lobe(-rr * 0.5, 0) || lobe(rr * 0.5, 0) || lobe(0, -rr * 0.5) || lobe(0, rr * 0.5) || Math.abs(dx) + Math.abs(dy) <= rr * 0.7
  }
  const trim = spec.material === "plaster" ? WALLS[spec.wall]! : MATERIALS[spec.material]!
  part(b, box, test(r + 2), (x, y) => tone(trim, 0.05 + lightAt(x, y, box) * 0.3, x, y), wallEdge(spec))
  const ramp = lit ? GLOW : GLASS
  part(b, box, test(r), (x, y) => {
    // sky above, deeper below, and a diagonal glint
    const v = (y - (cy - r)) / (size + 1)
    const glint = (x - cx + (y - cy)) % 7 === 0 && x < cx + 1 && y < cy + 1
    return tone(ramp, glint ? 0 : 0.15 + v * 0.75, x, y)
  }, GLASS[4]!)
  // muntins
  const ink = lit ? GLASS[3]! : GLASS[4]!
  const t = test(r)
  for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) {
    if (t(cx + i, cy)) b.set(cx + i, cy, ink)
    if (t(cx, cy + i)) b.set(cx, cy + i, ink)
  }
  // a sill
  b.rect(trim[1]!, cx - r - 1, cy + Math.ceil(r) + 1, size + 2, 1)
  b.rect(trim[3]!, cx - r - 1, cy + Math.ceil(r) + 2, size + 2, 1)
}

function flowers(b: Buf, spec: HouseSpec, x0: number, x1: number, y: number) {
  for (let x = x0; x < x1; x += 2) {
    const r = hash(x, spec.seed + 4)
    const h = 2 + Math.floor(r * 4)
    const leaf = MATERIALS.turf
    b.rect(r > 0.5 ? leaf[2]! : leaf[3]!, x, y - h, 1, h + 1)
    if (r > 0.62) {
      const c = BITS[Math.floor(hash(x, spec.seed) * BITS.length)]!
      b.rect(c, x - 1, y - h - 2, 3, 2)
      b.set(x, y - h - 3, c)
      b.set(x, y - h - 1, 0xffffff)
    }
  }
}

function crystals(b: Buf, cx: number, y: number, n: number, seed: number) {
  const cols = [R("#e9fbff", "#a8ecff", "#5fc8f0", "#3a8ed0", "#26529a"), R("#f6e6ff", "#d9b0ff", "#b080f0", "#7a52c8", "#4a2f90"), R("#ffe6f2", "#ffb0d6", "#f070b0", "#b04088", "#702060")]
  for (let i = 0; i < n; i++) {
    const ramp = cols[Math.floor(hash(seed, i + 3) * 3)]!
    const h = 7 + Math.floor(hash(seed, i + 9) * 8)
    const x = cx + i * 4 - (n * 4) / 2
    const w = 3
    part(b, { x0: x - w, y0: y - h, x1: x + w, y1: y }, (px, py) => py <= y && py >= y - h && Math.abs(px - x + 0.5) <= (py - (y - h)) * 0.4 + 0.8 && Math.abs(px - x + 0.5) <= w, (px, py) => tone(ramp, (px < x ? 0.1 : 0.55) + (py - (y - h)) / h * 0.2, px, py), ramp[4]!)
  }
}

function lantern(b: Buf, x: number, lit: boolean) {
  b.rect(0x383a5a, x, GY - 22, 1, 22)
  b.rect(0x585a80, x - 1, GY - 22, 3, 1)
  part(b, { x0: x - 3, y0: GY - 30, x1: x + 4, y1: GY - 23 }, (px, py) => py >= GY - 30 && py <= GY - 23 && Math.abs(px - x + 0.5) <= 3, (px, py) => tone(lit ? GLOW : GLASS, lit ? 0.1 : py < GY - 27 ? 0.1 : 0.4, px, py), 0x383a5a)
  b.set(x, GY - 31, 0x585a80)
  if (lit) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if ((dx + dy) % 2 === 0 && Math.hypot(dx, dy) > 3 && Math.hypot(dx, dy) < 5.2 && b.get(x + dx, GY - 27 + dy) === -1) b.set(x + dx, GY - 27 + dy, 0xb8f8ee)
}

function star(b: Buf, x: number, y: number) {
  const s = 0xe8f0ff
  b.rect(s, x, y - 3, 1, 7)
  b.rect(s, x - 3, y, 7, 1)
  b.rect(0xa8b8dc, x - 1, y - 1, 3, 3)
  b.set(x, y, 0xffffff)
}

function vine(b: Buf, spec: HouseSpec, x: number, top: number, bottom: number) {
  const leaf = MATERIALS.turf
  for (let y = top; y < bottom; y++) {
    const wob = Math.round(Math.sin(y * 0.5 + spec.seed) * 1.5)
    b.set(x + wob, y, leaf[3]!)
    if (hash(y, spec.seed) > 0.45) {
      const side = hash(y, spec.seed + 1) > 0.5 ? 1 : -1
      b.rect(leaf[hash(y, 7) > 0.5 ? 1 : 2]!, x + wob + side, y, 2, 2)
      b.set(x + wob + side * 2, y + 1, leaf[4]!)
    }
    if (hash(y, spec.seed + 5) > 0.93) b.rect(BITS[y % BITS.length]!, x + wob + 2, y, 2, 2)
  }
}

// ---- bodies --------------------------------------------------------------------------------------------------------

function cottageBody(b: Buf, spec: HouseSpec, cx: number, lit: boolean) {
  const { hw, h } = spec
  const top = GY - h
  const box: Box = { x0: cx - hw, y0: top, x1: cx + hw, y1: GY }
  // a wall with a gentle lean at the top corners (a little soft, like moulded plaster)
  const inWall = (x: number, y: number) => y >= top && y <= GY && Math.abs(x - cx + 0.5) <= hw - (y < top + 3 ? 1 : 0)
  part(b, box, inWall, (x, y) => materialColor(spec, x, y, lightAt(x, y, box, 0.9) * 0.85, box), wallEdge(spec))
  // the trencadís band: mosaic tiles in the bright accents, grouted in the wall's deepest tone
  if (spec.material === "plaster") {
    for (let y = GY - 8; y <= GY; y++) for (let x = cx - hw + 1; x < cx + hw; x++) {
      const gx = Math.floor((x + (Math.floor(y / 3) % 2) * 2) / 4)
      const gy = Math.floor(y / 3)
      if ((x + (Math.floor(y / 3) % 2) * 2) % 4 === 3 || y % 3 === 2) b.set(x, y, WALLS[spec.wall]![3]!)
      else b.set(x, y, BITS[Math.floor(hash(gx + spec.seed, gy) * BITS.length)]!)
    }
    b.rect(WALLS[spec.wall]![4]!, cx - hw, GY - 9, hw * 2 + 1, 1)
  }
  // the door in the middle, windows either side
  const dw = Math.min(18, Math.round(hw * 0.7))
  const dh = Math.round(h * 0.62)
  door(b, spec, cx, dw, dh, lit)
  const wx = Math.round((hw + dw / 2) / 2) + 1
  const wy = top + Math.round(h * 0.34)
  if (hw >= 22) {
    windowAt(b, spec, cx - wx, wy, 9, lit)
    windowAt(b, spec, cx + wx, wy, 9, lit)
  }
  return { top, eave: top + 1 }
}

function towerBody(b: Buf, spec: HouseSpec, cx: number, lit: boolean) {
  const { hw, h } = spec
  const top = GY - h
  // a trunk or tower: it flares at the foot and is banded as it rises
  const half = (y: number) => hw + (y > GY - 9 ? Math.round((y - (GY - 9)) * 0.55) : 0) + (y < top + 6 ? 0 : 0)
  const box: Box = { x0: cx - hw - 6, y0: top, x1: cx + hw + 6, y1: GY }
  part(b, box, (x, y) => y >= top && y <= GY && Math.abs(x - cx + 0.5) <= half(y), (x, y) => materialColor(spec, x, y, lightAt(x, y, { x0: cx - hw, y0: top, x1: cx + hw, y1: GY }, 0.9) * 0.9, box), wallEdge(spec))
  door(b, spec, cx, 12, 22, lit)
  windowAt(b, spec, cx, top + 14, 8, lit)
  return { top, eave: top + 2 }
}

function domeBody(b: Buf, spec: HouseSpec, cx: number, lit: boolean) {
  const { hw, h } = spec
  const top = GY - h
  const box: Box = { x0: cx - hw, y0: top, x1: cx + hw, y1: GY }
  const half = (y: number) => roofHalf("cap", (y - top) / h, hw)
  const t = (x: number, y: number) => {
    // a curved light: the lit crown on the upper left, the foot in shade
    const dx = (x - (cx - hw * 0.3)) / hw
    const dy = (y - (top + h * 0.2)) / h
    return Math.max(0, Math.min(1, Math.hypot(dx * 0.9, dy) * 0.78))
  }
  part(b, box, (x, y) => y >= top && y <= GY && Math.abs(x - cx + 0.5) <= half(y), (x, y) => materialColor(spec, x, y, t(x, y), { x0: cx - hw, y0: top, x1: cx + hw, y1: GY }), wallEdge(spec))
  const dw = spec.door === "catenary" ? 20 : 16
  door(b, spec, cx, dw, 24, lit)
  windowAt(b, spec, cx - Math.round(hw * 0.52), top + Math.round(h * 0.52), 7, lit, "round")
  windowAt(b, spec, cx + Math.round(hw * 0.52), top + Math.round(h * 0.52), 7, lit, "round")
  return { top, eave: top }
}

function bulbBody(b: Buf, spec: HouseSpec, cx: number, lit: boolean) {
  const { hw, h } = spec
  const top = GY - h
  const cyc = top + h * 0.5
  const box: Box = { x0: cx - hw, y0: top, x1: cx + hw, y1: GY }
  // an egg: wider low than high, flat where it sits
  const inside = (x: number, y: number) => {
    const dx = (x - cx + 0.5) / hw
    const dy = (y - cyc) / (h * 0.5)
    const squash = dy > 0 ? 1 : 1 + dy * 0.18
    return y <= GY && (dx / squash) ** 2 + dy * dy <= 1
  }
  part(b, box, inside, (x, y) => materialColor(spec, x, y, Math.max(0, Math.min(1, Math.hypot((x - (cx - hw * 0.35)) / hw, (y - (top + h * 0.3)) / h) * 0.85)), box), wallEdge(spec))
  door(b, spec, cx, 15, 20, lit)
  windowAt(b, spec, cx, top + Math.round(h * 0.3), 9, lit, "round")
  // the rim: a twisted wreath of twigs where the roof would be, with two eggs peeking over
  const w = MATERIALS.bark
  for (let x = cx - 18; x <= cx + 18; x++) {
    const y = top + 1 + Math.round(Math.abs(x - cx) * 0.18) + (x % 3 === 0 ? 1 : 0)
    b.rect(x % 4 < 2 ? w[1]! : w[2]!, x, y, 1, 2)
    b.set(x, y + 2, w[4]!)
  }
  for (const [ex, ey] of [[cx - 7, top - 5], [cx + 4, top - 7]] as const) {
    part(b, { x0: ex - 4, y0: ey - 5, x1: ex + 4, y1: ey + 5 }, (x, y) => ((x - ex + 0.5) / 4) ** 2 + ((y - ey) / 5.3) ** 2 <= 1, (x, y) => tone(WALLS.sky!, (x - ex + 4) / 12 + (y - ey + 5) / 20, x, y), WALLS.sky![4]!)
  }
  return { top, eave: top }
}


// ---- pods ------------------------------------------------------------------------------------------------------

/** A round window set in a thick rim, deep glass with a sky reflection; `ladder` shows two rungs-rails inside, as in a hollow sphere. */
function porthole(b: Buf, spec: HouseSpec, cx: number, cy: number, r: number, lit: boolean, ladder = false) {
  const trim = MATERIALS[spec.material === "plaster" ? "concrete" : spec.material]!
  const disc = (rr: number) => (x: number, y: number) => (x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2 <= rr * rr
  const box: Box = { x0: cx - r - 4, y0: cy - r - 4, x1: cx + r + 4, y1: cy + r + 4 }
  part(b, box, disc(r + 3.5), (x, y) => tone(trim, 0.05 + lightAt(x, y, box) * 0.45, x, y), trim[4]!)
  part(b, box, disc(r + 1.2), (x, y) => tone(trim, 0.75 + lightAt(x, y, box) * 0.2, x, y), trim[4]!)
  const ramp = lit ? GLOW : GLASS
  part(b, box, disc(r), (x, y) => {
    const v = (y - (cy - r)) / (2 * r)
    const glint = (x - cx + 0.5) + (y - cy + 0.5) < -r * 0.55 && (x + y) % 5 < 2
    return tone(ramp, glint ? 0 : 0.35 + v * 0.55, x, y)
  }, GLASS[4]!)
  if (ladder) {
    const ink = lit ? GLASS[3]! : GLASS[4]!
    for (const lx of [cx - Math.round(r * 0.3), cx + Math.round(r * 0.1)]) for (let y = cy - r + 2; y < cy + r - 2; y++) if (disc(r - 1)(lx, y)) b.set(lx, y, y % 4 === 0 ? 0xd8c0a8 : ink)
  }
}

/** Overgrowth: ivy that gathers on the upper left of a surface in clumps, dithered, with the odd flower. */
function overgrow(b: Buf, spec: HouseSpec, inside: (x: number, y: number) => boolean, box: Box) {
  const leaf = MATERIALS.turf
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
    if (!inside(x, y)) continue
    const nx = (x - box.x0) / (box.x1 - box.x0)
    const ny = (y - box.y0) / (box.y1 - box.y0)
    const n = hash(Math.floor(x / 4) + spec.seed, Math.floor(y / 4)) * 0.4 + hash(Math.floor(x / 10), Math.floor(y / 10) + spec.seed) * 0.6
    const bias = 0.74 - (1 - nx) * 0.3 - (1 - ny) * 0.1
    if (n + bayer(x, y) * 0.12 < bias) continue
    const k = hash(x, y + spec.seed)
    b.set(x, y, k > 0.93 ? leaf[0]! : k > 0.55 ? leaf[1]! : k > 0.25 ? leaf[2]! : leaf[3]!)
    if (k < 0.03) b.set(x, y, BITS[(x + y) % BITS.length]!)
  }
}

/** A sweeping stair: slab steps climbing from the ground at the left to a landing, the underside a plain diagonal. */
function stair(b: Buf, spec: HouseSpec, x0: number, steps: number, rise: number) {
  const ramp = MATERIALS.concrete
  for (let i = 0; i < steps; i++) {
    const top = GY - 3 - i * rise
    const x = x0 + i * 5
    part(b, { x0: x, y0: top, x1: x + 5, y1: top + 9 }, (px, py) => px >= x && px < x + 5 && py >= top && py <= top + 9, (px, py) => tone(ramp, py === top ? 0.0 : 0.3 + (py - top) / 20, px, py), ramp[4]!, true)
  }
  const landing = x0 + steps * 5
  part(b, { x0: landing, y0: GY - 3 - steps * rise, x1: landing + 10, y1: GY - 3 - steps * rise + 5 }, (px, py) => px >= landing && px < landing + 10 && py >= GY - 3 - steps * rise && py <= GY - 3 - steps * rise + 5, (px, py) => tone(ramp, py === GY - 3 - steps * rise ? 0 : 0.4, px, py), ramp[4]!)
  void spec
}

function podBody(b: Buf, spec: HouseSpec, cx: number, lit: boolean) {
  const { hw, h } = spec
  const lift = spec.extras.includes("pedestal") ? 7 : 0
  const sink = spec.extras.includes("ivy") ? 3 : 0
  const bottom = GY - lift + sink
  const top = bottom - h
  const cy = top + h / 2
  if (lift) {
    // a low silver dish the pod sits on
    const base: Box = { x0: cx - hw, y0: GY - 8, x1: cx + hw, y1: GY }
    const dish = (x: number, y: number) => y >= GY - 8 && y <= GY && Math.abs(x - cx + 0.5) <= hw * (0.55 + (y - (GY - 8)) / 8 * 0.42)
    part(b, base, dish, (x, y) => tone(MATERIALS.shell, 0.15 + (y - (GY - 8)) / 10 + (x < cx ? 0 : 0.2), x, y), MATERIALS.shell[4]!)
  }
  const box: Box = { x0: cx - hw, y0: top, x1: cx + hw, y1: bottom }
  // a squashed sphere: its widest a little below the middle, flattened where it sits
  const inside = (x: number, y: number) => {
    const dx = (x - cx + 0.5) / hw
    const dy = (y - cy) / (h / 2)
    return y <= bottom && dx * dx + dy * dy <= 1
  }
  const shade = (x: number, y: number) => materialColor(spec, x, y, Math.max(0, Math.min(1, Math.hypot((x - (cx - hw * 0.38)) / hw, (y - (top + h * 0.28)) / h) * 0.95)), box)
  part(b, box, inside, shade, wallEdge(spec))
  // panel seams: two meridians and a belt, following the curve
  const ink = MATERIALS[spec.material === "plaster" ? "concrete" : spec.material]![3]!
  for (let y = top + 2; y < bottom - 1; y++) {
    const dy = (y - cy) / (h / 2)
    const k = Math.sqrt(Math.max(0, 1 - dy * dy))
    for (const ph of [-0.52, 0.45]) {
      const x = Math.round(cx + hw * ph * k)
      if (inside(x, y) && inside(x + 1, y)) b.set(x, y, ink)
    }
  }
  for (let x = cx - hw + 3; x < cx + hw - 2; x++) {
    const dx = (x - cx) / hw
    const y = Math.round(cy + h * 0.5 * -0.46 * Math.sqrt(Math.max(0, 1 - dx * dx)) * 0 + (cy - top) * 0.36 * Math.sqrt(Math.max(0, 1 - dx * dx)))
    if (inside(x, y) && (x + y) % 6 !== 0) b.set(x, y, ink)
  }
  if (spec.extras.includes("ivy")) overgrow(b, spec, inside, box)
  // windows: one big round one with the ladder showing, a smaller beside it, a porthole door at the base
  const big = Math.round(hw * 0.34)
  porthole(b, spec, cx - Math.round(hw * 0.1), cy - Math.round(h * 0.1), big, lit, true)
  porthole(b, spec, cx + Math.round(hw * 0.52), cy - Math.round(h * 0.26), Math.max(3, Math.round(hw * 0.12)), lit)
  porthole(b, spec, cx - Math.round(hw * 0.62), cy + Math.round(h * 0.04), Math.max(2, Math.round(hw * 0.08)), lit)
  const dx = cx + Math.round(hw * 0.28)
  const doorSpec = { ...spec, door: "round" as const }
  door(b, doorSpec, dx, 12, 17, lit)
  if (spec.extras.includes("stair")) stair(b, spec, cx - hw - 6, 5, 4)
  return { top, eave: top }
}

function stackBody(b: Buf, spec: HouseSpec, cx: number, lit: boolean, litArr?: boolean[]) {
  const n = spec.h
  const tenants = spec.tenants ?? 0
  const planter = MATERIALS.turf
  let topY = GY
  let prevTop = GY + 5
  for (let i = 0; i < n; i++) {
    const flatBase = tenants > 0 && i === 0
    const ph = flatBase ? 24 : 21
    const w = flatBase ? spec.hw : Math.round(spec.hw * (tenants ? 0.82 : 1.05) - (tenants ? (i - 1) * 7 : i * 0.13 * spec.hw)) + (i % 2) * 3
    const ox = i === 0 ? 0 : Math.round(((hash(spec.seed, i) - 0.5) * 2) * Math.min(12, 46 - w - 2))
    const pcx = cx + ox
    const bottom = i === 0 ? GY : prevTop + 5
    const top = bottom - ph
    prevTop = top
    const litM = litArr && tenants ? litArr[(i === 0 ? 0 : i - 1) % litArr.length]! : lit
    const box: Box = { x0: pcx - w, y0: top, x1: pcx + w, y1: bottom }
    // a rounded octagon: a squared-off ellipse, flat on the bottom
    const inside = (x: number, y: number) => {
      const dx = Math.abs(x - pcx + 0.5) / w
      const dy = Math.abs(y - (top + bottom) / 2) / (ph / 2)
      return y <= bottom && Math.pow(dx, 3.2) + Math.pow(dy, 3.2) <= 1
    }
    part(b, box, inside, (x, y) => materialColor(spec, x, y, 0.12 + lightAt(x, y, box, 0.75) * 0.85, box), wallEdge(spec))
    // a shadowed underside where it hangs over the pod below
    for (let x = pcx - w + 3; x < pcx + w - 3; x++) if (inside(x, bottom - 1) && i > 0) b.set(x, bottom - 1, MATERIALS.concrete[3]!)
    if (!flatBase) {
      // a ribbon window: dark glass in a frame, mullions, a pale reflection
      const wy0 = top + 6
      const wh = 9
      const wx0 = pcx - w + 6
      const ww = w * 2 - 12
      const trim = MATERIALS.concrete
      part(b, { x0: wx0 - 2, y0: wy0 - 2, x1: wx0 + ww + 2, y1: wy0 + wh + 2 }, (x, y) => x >= wx0 - 2 && x <= wx0 + ww + 2 && y >= wy0 - 2 && y <= wy0 + wh + 2 && (Math.abs(x - pcx + 0.5) < w - 3), (x, y) => tone(trim, 0.2, x, y), trim[4]!)
      const ramp = litM ? GLOW : GLASS
      part(b, { x0: wx0, y0: wy0, x1: wx0 + ww, y1: wy0 + wh }, (x, y) => x >= wx0 && x <= wx0 + ww && y >= wy0 && y <= wy0 + wh && Math.abs(x - pcx + 0.5) < w - 5, (x, y) => tone(ramp, 0.3 + (y - wy0) / (wh * 1.3) + (hash(x >> 2, i + spec.seed) > 0.8 ? -0.15 : 0), x, y), GLASS[4]!)
      for (let x = wx0 + 7; x < wx0 + ww - 3; x += 9) for (let y = wy0; y <= wy0 + wh; y++) if (b.get(x, y) !== -1) b.set(x, y, GLASS[4]!)
    }
    // a roof garden on whatever of the top is not covered: a little hedge and flowers
    for (let x = pcx - w + 4; x < pcx + w - 3; x += 3) {
      if (!inside(x, top + 1) || hash(x, spec.seed + i * 31) < 0.35) continue
      const hh = 3 + Math.floor(hash(x, i + 7) * 4)
      b.rect(planter[hash(x, 1) > 0.5 ? 2 : 3]!, x, top - hh, 3, hh + 1)
      b.rect(planter[1]!, x, top - hh, 2, 1)
      if (hash(x, i + 11) > 0.6) b.rect(BITS[x % BITS.length]!, x + 1, top - hh - 1, 2, 2)
    }
    if (flatBase) {
      // one front door per tenant, two tiles (32 pixels) apart, with a porthole above that glows while they are home
      for (let k = 0; k < tenants; k++) {
        const off = Math.round((k - (tenants - 1) / 2) * 32)
        door(b, { ...spec, door: "round" }, pcx + off, 12, 16, litArr ? litArr[k]! : lit)
        porthole(b, spec, pcx + off, top + 6, 3, litArr ? litArr[k]! : lit)
      }
    } else if (i === 0) {
      door(b, { ...spec, door: "round" }, pcx + Math.round(w * 0.45), 11, 15, lit)
      porthole(b, spec, pcx - Math.round(w * 0.42), top + 12, 3, lit)
    }
    topY = top
  }
  return { top: topY, eave: topY }
}

// ---- the whole house -------------------------------------------------------------------------------------------

/** Draw a house into a fresh buffer: `lit` turns the windows and lantern on, for when its friend is home after dark. */
export function buildHouse(spec: HouseSpec, litIn: boolean | boolean[]): Int32Array {
  const litArr = Array.isArray(litIn) ? litIn : undefined
  const lit: boolean = litArr ? litArr.some(Boolean) : (litIn as boolean)
  const b = new Buf()
  const cx = 48
  const e = new Set(spec.extras)
  if (e.has("water")) {
    for (let y = GY - 2; y <= GY + 4; y++) for (let x = cx - 46; x <= cx + 46; x++) {
      const dx = (x - cx) / 46
      const dy = (y - (GY + 1)) / 5
      if (dx * dx + dy * dy <= 1) b.set(x, y, tone(GLASS, 0.1 + (y - GY) * 0.07 + (hash(x, y + (y % 2)) > 0.9 ? 0.25 : 0), x, y))
    }
  }
  if (e.has("crystals")) crystals(b, cx - spec.hw - 4, GY - 1, 2, spec.seed)
  if (e.has("reeds")) for (const rx of [cx - spec.hw - 6, cx - spec.hw - 3, cx + spec.hw + 3, cx + spec.hw + 6]) {
    b.rect(MATERIALS.turf[3]!, rx, GY - 20 - (rx % 4), 1, 21)
    b.rect(MATERIALS.turf[1]!, rx + 1, GY - 22 - (rx % 3), 1, 18)
    b.rect(0x8a5a80, rx - 1, GY - 28 - (rx % 4), 3, 6)
  }
  let top = GY - spec.h
  let roofBase = top
  switch (spec.body) {
    case "cottage": ({ top, eave: roofBase } = cottageBody(b, spec, cx, lit)); break
    case "tower": ({ top, eave: roofBase } = towerBody(b, spec, cx, lit)); break
    case "dome": ({ top, eave: roofBase } = domeBody(b, spec, cx, lit)); break
    case "bulb": ({ top, eave: roofBase } = bulbBody(b, spec, cx, lit)); break
    case "pod": ({ top, eave: roofBase } = podBody(b, spec, cx, lit)); break
    case "stack": ({ top, eave: roofBase } = stackBody(b, spec, cx, lit, litArr)); break
  }
  if (spec.roof !== "none") {
    const over = spec.body === "tower" ? 8 : 6
    const eaveHalf = spec.hw + over
    const rh = spec.roof === "gable" ? Math.round(eaveHalf * 0.78) : spec.roof === "cap" ? Math.round(eaveHalf * 0.9) : Math.round(eaveHalf * 1.15)
    const eaveY = roofBase + 4
    const peak = Math.max(6, eaveY - rh)
    if (e.has("chimney") && spec.roof === "gable") {
      const chx = cx + Math.round(spec.hw * 0.5)
      const chBox: Box = { x0: chx - 4, y0: peak + 2, x1: chx + 4, y1: peak + 24 }
      part(b, chBox, (x, y) => y >= peak + 2 && y <= peak + 24 && Math.abs(x - chx) <= 4, (x, y) => materialColor({ ...spec, material: "stone" }, x, y, (x - chBox.x0) / 12, chBox), MATERIALS.stone[4]!)
      b.rect(MATERIALS.stone[1]!, chx - 5, peak, 11, 3)
      b.rect(MATERIALS.stone[4]!, chx - 5, peak + 3, 11, 1)
      for (const [dx, dy, r] of [[1, -3, 2], [3, -7, 3], [1, -12, 3]] as const) {
        for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) b.set(chx + dx + xx, peak + dy + yy, tone(WALLS.lilac!, 0.15 + (xx + yy) * 0.05 + 0.25, xx, yy))
      }
    }
    roof(b, spec, cx, peak, eaveY, eaveHalf)
    if (e.has("fins")) {
      const ramp = ROOFS.teal
      for (let i = -2; i <= 2; i++) {
        const x = cx + i * 5
        const y = peak + Math.round(Math.abs(i) * 4)
        part(b, { x0: x - 2, y0: y - 8, x1: x + 2, y1: y + 1 }, (px, py) => py >= y - 8 && py <= y && Math.abs(px - x) <= (py - (y - 8)) * 0.3, (px, py) => tone(ramp, (py - y + 8) / 9 + 0.1, px, py), ramp[4]!)
      }
    }
    if (e.has("star")) star(b, cx, peak - 6)
    if (spec.roof === "onion" && !e.has("star")) {
      b.rect(ROOFS[spec.roofRamp]![4]!, cx, peak - 8, 1, 9)
      b.rect(0xe8f0ff, cx - 1, peak - 10, 3, 3)
    }
    if (e.has("spots") || spec.roof === "cap") {
      for (let i = 0; i < 5; i++) {
        const sx = cx + Math.round((hash(spec.seed, i) - 0.5) * eaveHalf * 1.2)
        const sy = peak + 6 + Math.round(hash(spec.seed, i + 20) * (eaveY - peak - 12))
        b.rect(0xf4f4ff, sx, sy, 3, 2)
        b.set(sx + 1, sy + 2, ROOFS[spec.roofRamp]![4]!)
      }
    }
  } else {
    // a finial or a crown on the dome and the bulb
    if (e.has("star")) star(b, cx, Math.max(5, top - 5))
    if (e.has("spots") && spec.body === "dome") for (let i = 0; i < 6; i++) {
      const sx = cx + Math.round((hash(spec.seed, i) - 0.5) * spec.hw * 1.1)
      const sy = top + 6 + Math.round(hash(spec.seed, i + 20) * 12)
      b.rect(BITS[i % BITS.length]!, sx, sy, 2, 2)
    }
  }
  if (e.has("vine")) vine(b, spec, cx + spec.hw - 4, spec.body === "stack" ? top + 8 : GY - spec.h + 6, GY - 3)
  if (e.has("lantern")) lantern(b, cx + Math.min(spec.hw + 6, 40), lit)
  if (e.has("flowers")) {
    flowers(b, spec, cx - spec.hw - 6, cx - 12, GY + 1)
    flowers(b, spec, cx + 12, cx + spec.hw + 6, GY + 1)
  }
  // one contour round everything, in the ink
  const out = new Int32Array(b.px)
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    if (b.px[y * W + x] !== -1) continue
    if (b.get(x - 1, y) !== -1 || b.get(x + 1, y) !== -1 || b.get(x, y - 1) !== -1 || b.get(x, y + 1) !== -1) out[y * W + x] = INK
  }
  return out
}

/** The house as RGBA bytes (`HOUSE_W` squared), a soft cool shadow under it. */
export function houseRgba(spec: HouseSpec, lit: boolean | boolean[]): Uint8ClampedArray {
  const px = buildHouse(spec, lit)
  const data = new Uint8ClampedArray(W * W * 4)
  // a flattened ellipse of shadow: translucent, the same blue-violet the trees cast
  const sx = Math.min(46, spec.hw + 8)
  for (let y = GY - 2; y <= GY + 6; y++) for (let x = 48 - sx; x <= 48 + sx; x++) {
    const dx = (x - 48) / sx
    const dy = (y - (GY + 2)) / 4.5
    if (dx * dx + dy * dy <= 1) {
      const o = (y * W + x) * 4
      data[o] = 24
      data[o + 1] = 20
      data[o + 2] = 70
      data[o + 3] = 84
    }
  }
  for (let i = 0; i < W * W; i++) {
    const c = px[i]!
    if (c === -1) continue
    data[i * 4] = (c >> 16) & 255
    data[i * 4 + 1] = (c >> 8) & 255
    data[i * 4 + 2] = c & 255
    data[i * 4 + 3] = 255
  }
  return data
}
