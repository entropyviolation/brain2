/**
 * components/BabyGame/housegen.ts — One house builder for every friend (solarpunk retrofuturism)
 *
 * A house is a `HouseSpec`: a body (a `pod` in one of four shapes, or a `stack` of offset modules), a pale material, door and
 * window shapes, named palette ramps and a list of extras (roof gardens, solar petals, a wind turbine, saucer rings, bubble
 * domes with plants inside, tripod legs, a glass lift, ivy, a sweeping stair). `specFor(kind, id, tenants)` fills one in from
 * the home's kind (what the species keeps) and a hash of the friend's (or block's) id, so a friend that does not exist yet still
 * gets a home that belongs. Everything is drawn into one pixel buffer on the `HOUSE_W` grid by the same few part painters
 * (`part`: a mask, a shade, a contour in the part's own deepest tone; the light is top left, banded with a Bayer grain), so the
 * outline, light and palette agree across every house. `buildHouse` is pure; `homeart-hi.ts` turns the buffer into a canvas and
 * `scripts/baby-house-sheet.mts` into a contact sheet. One art pixel is one game pixel.
 */

import type { HomeKind } from "@/lib/baby-game/homes"

export const HOUSE_W = 128
const W = HOUSE_W
/** The ground line the house stands on, in art pixels from the top of the picture. */
export const HOUSE_GROUND = W - 7
const GY = HOUSE_GROUND
const INK = 0x1a1633

/** Five tones from lit to deep, as 0xRRGGBB. */
export type Ramp = [number, number, number, number, number]
const R = (...s: string[]) => s.map((h) => parseInt(h.slice(1), 16)) as Ramp

const WALLS: Record<string, Ramp> = {
  lilac: R("#ffffff", "#f1ecfb", "#d8cff0", "#aea2d8", "#7468ac"),
  mint: R("#ffffff", "#ecfbf5", "#c6eedf", "#93d2c0", "#5a9d9c"),
  sky: R("#ffffff", "#eef6ff", "#cfe3f8", "#a0c0e8", "#6482bc"),
  rose: R("#ffffff", "#fdeef5", "#f2cfe2", "#dba2c4", "#a7709c"),
  silver: R("#ffffff", "#f1f4f8", "#d6dde8", "#aab6c8", "#74829c"),
}
const GLASS = R("#e6fcff", "#9eeaf0", "#58bcd4", "#3a80be", "#27447f")
const GLOW = R("#ffffff", "#fff4ee", "#d4fff2", "#8ff0e0", "#4fb4cf")
const DOOR = R("#d8c2d0", "#b898b4", "#8e6a94", "#664670", "#41284e")
const MATERIALS: Record<string, Ramp> = {
  concrete: R("#ffffff", "#f7f3f9", "#e2dcec", "#bdb5d2", "#8c84ae"),
  shell: R("#ffffff", "#f0f6ff", "#d6e2f6", "#aabbe0", "#7585b8"),
  ice: R("#ffffff", "#eef8ff", "#d0e6f8", "#a0c2e6", "#6f90c4"),
  stone: R("#ffffff", "#ece9f6", "#cfcae4", "#a29cc4", "#6d6892"),
  turf: R("#c8ffd0", "#76e0a4", "#3cb68c", "#238275", "#14505a"),
  bark: R("#d9bccb", "#b08ca8", "#86628c", "#5e4070", "#3a2648"),
  metal: R("#ffffff", "#e6eef8", "#bccadc", "#8696b4", "#56668a"),
}
/** Little coloured tiles for the flowers and the odd mosaic. */
const BITS = [0x5ee6e0, 0xff8fc0, 0x9d7bff, 0xf4f4ff, 0x8ff0b0, 0x6fb4ff]

export type Body = "pod" | "stack"
export type Shape = "egg" | "saucer" | "capsule" | "cluster"
export type Material = "concrete" | "shell" | "ice" | "stone"
export type Extra =
  | "flowers" | "lantern" | "crystals" | "star" | "reeds" | "water" | "ivy" | "stair" | "pedestal"
  | "garden" | "solar" | "turbine" | "ring" | "fin" | "antenna" | "dome" | "legs" | "lift"

export type HouseSpec = {
  body: Body
  shape?: Shape
  material: Material
  /** The tint a shell drifts through. */
  wall: keyof typeof WALLS
  door: "arch" | "round" | "catenary"
  /** Half-width and height of a pod; for a stack, `hw` is the ground module's half-width and `h` the number of modules. */
  hw: number
  h: number
  extras: Extra[]
  /** Seeds every bit of texture. */
  seed: number
  /** A block of flats: how many friends share it. Each gets a front door two tiles apart on the ground module. */
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

/** The spec for a friend's home (or a block of flats, `id` the block's): what the kind fixes (body family, material, door), what the id picks (shape, tint, extras). */
export function specFor(kind: HomeKind, id: string, tenants = 0): HouseSpec {
  const seed = strHash(id)
  const r = (k: number) => hash(seed, k)
  const wall = pick(Object.keys(WALLS), r(1)) as keyof typeof WALLS
  /** Each extra in the pool shows with its own chance, so no two houses carry the same set. */
  const some = (pool: Array<[Extra, number]>) => pool.filter(([, p], i) => r(10 + i) < p).map(([e]) => e)
  const base = { wall, seed, door: "round" as const }
  const K = 1.12
  switch (kind) {
    case "hutch":
      return { ...base, body: "stack", material: "concrete", hw: Math.round((26 + Math.floor(r(6) * 8)) * K), h: 3 + Math.floor(r(7) * 2), extras: ["garden", "flowers", ...some([["solar", 0.6], ["lantern", 0.5], ["ivy", 0.4], ["turbine", 0.3], ["dome", 0.3], ["lift", 0.3]])] }
    case "stall":
      return { ...base, body: "pod", shape: pick(["saucer", "capsule"] as const, r(4)), material: "shell", hw: Math.round(40 * K), h: Math.round(36 * K), extras: ["pedestal", "flowers", ...some([["garden", 0.6], ["ring", 0.7], ["legs", 0.5], ["solar", 0.4], ["antenna", 0.4], ["lantern", 0.4]])] }
    case "nest":
      return { ...base, body: "pod", shape: pick(["egg", "cluster"] as const, r(4)), material: "concrete", hw: Math.round(32 * K), h: Math.round(58 * K), extras: ["flowers", "garden", ...some([["ivy", 0.4], ["solar", 0.5], ["turbine", 0.3], ["lantern", 0.4], ["star", 0.3], ["antenna", 0.3]])] }
    case "burrow":
      return { ...base, body: "pod", shape: pick(["egg", "cluster", "egg"] as const, r(4)), material: "concrete", hw: Math.round(38 * K), h: Math.round(52 * K), extras: ["ivy", "garden", "flowers", ...some([["crystals", 0.4], ["lantern", 0.4], ["solar", 0.4], ["dome", 0.3]])] }
    case "den":
      return { ...base, body: "pod", shape: pick(["egg", "cluster"] as const, r(4)), material: "stone", hw: Math.round(36 * K), h: Math.round(58 * K), extras: ["stair", "garden", ...some([["ivy", 0.6], ["flowers", 0.5], ["lantern", 0.4], ["turbine", 0.3], ["solar", 0.4]])] }
    case "hollow":
      return { ...base, body: "stack", material: "concrete", hw: Math.round(21 * K), h: 4 + Math.floor(r(7) * 2), extras: ["ivy", "garden", "lantern", ...some([["flowers", 0.5], ["star", 0.4], ["solar", 0.4], ["lift", 0.3], ["antenna", 0.3]])] }
    case "lodge":
      return { ...base, body: "pod", shape: pick(["capsule", "saucer"] as const, r(4)), material: "shell", hw: Math.round(42 * K), h: Math.round(44 * K), extras: ["pedestal", "water", "reeds", "garden", ...some([["ring", 0.6], ["legs", 0.6], ["lantern", 0.4], ["flowers", 0.4], ["turbine", 0.3]])] }
    case "igloo":
      return { ...base, body: "pod", shape: pick(["saucer", "egg"] as const, r(4)), material: "ice", hw: Math.round(38 * K), h: Math.round(50 * K), extras: ["crystals", "pedestal", ...some([["ring", 0.7], ["dome", 0.5], ["star", 0.4], ["lantern", 0.4], ["antenna", 0.3], ["legs", 0.4]])] }
    case "flat":
      return { ...base, body: "stack", material: pick(["concrete", "shell"] as const, r(4)), hw: 56, h: 3 + Math.floor(r(7) * 2), tenants: Math.max(1, tenants), extras: ["garden", "ivy", "flowers", ...some([["solar", 0.8], ["lift", 0.6], ["dome", 0.5], ["lantern", 0.5], ["turbine", 0.4], ["star", 0.3]])] }
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
    x = Math.round(x)
    y = Math.round(y)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
  }
  /** The first painted row in column `x`, or -1. */
  top(x: number) {
    for (let y = 0; y < W; y++) if (this.get(x, y) !== -1) return y
    return -1
  }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]! / 16 - 0.5

/** Pick a tone of a ramp for a light value `t` (0 lit, 1 deep), banded and grained like the rest of the game. */
const tone = (ramp: Ramp, t: number, x: number, y: number) => ramp[Math.max(0, Math.min(4, Math.round(t * 4 + bayer(x, y) * 0.9)))]!

type Box = { x0: number; y0: number; x1: number; y1: number }

/**
 * Paint one part: every pixel in `box` where `inside` holds gets `shade`'s colour; then its own edge goes `edge` (a part drawn
 * later covers the earlier one, so overlaps read as depth). Returns the mask for callers that want it.
 */
function part(b: Buf, box: Box, inside: (x: number, y: number) => boolean, shade: (x: number, y: number) => number, edge: number | null = INK, keepBottom = false): Set<number> {
  const mask = new Set<number>()
  for (let y = Math.max(0, Math.floor(box.y0)); y <= Math.min(W - 1, Math.ceil(box.y1)); y++) for (let x = Math.max(0, Math.floor(box.x0)); x <= Math.min(W - 1, Math.ceil(box.x1)); x++) if (inside(x, y)) mask.add(y * W + x)
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
  const ramp = MATERIALS[spec.material]!
  switch (spec.material) {
    case "concrete": {
      // cast concrete, white: soft mottling, a scatter of small round pits, a few rain streaks
      const pit = hash(Math.floor(x / 5) + s, Math.floor(y / 5)) > 0.84 && x % 5 === 2 && y % 5 === 2
      const streak = hash(x + s, 3) > 0.92 && hash(x, Math.floor(y / 9)) > 0.55
      return pit ? ramp[3]! : tone(ramp, t * 0.9 + (hash(x * 2 + s, y * 2) > 0.92 ? 0.1 : 0) + (streak ? 0.14 : 0), x, y)
    }
    case "shell": {
      // a pearl skin: the friend's own tint drifting through mint, lilac and sky as the surface turns
      const tint = [WALLS[spec.wall]!, WALLS.mint!, WALLS.sky!, WALLS.lilac!, WALLS.rose!]
      const k = Math.sin((x - box.x0) * 0.08 + (y - box.y0) * 0.15 + s * 0.001) * 0.5 + 0.5
      return tone(tint[Math.min(4, Math.floor(k * 5))]!, t * 0.8 + 0.02, x, y)
    }
    case "ice": {
      const row = Math.floor((y - box.y0) / 8)
      const off = (row % 2) * 7
      const mortar = (y - box.y0) % 8 === 7 || (x - box.x0 + off) % 14 === 13
      return mortar ? ramp[3]! : tone(ramp, t * 0.8, x, y)
    }
    case "stone": {
      const row = Math.floor((y - box.y0) / 7)
      const off = (row % 2) * 6
      const col = Math.floor((x - box.x0 + off) / 12)
      const mortar = (y - box.y0) % 7 === 6 || (x - box.x0 + off) % 12 === 11
      return mortar ? ramp[3]! : tone(ramp, t * 0.85 + (hash(row * 13 + col + s, 9) - 0.5) * 0.25, x, y)
    }
  }
}

const wallEdge = (spec: HouseSpec) => MATERIALS[spec.material]![4]!

// ---- doors, windows, small things ------------------------------------------------------------------------------

function doorTest(shape: HouseSpec["door"], cx: number, top: number, dw: number): (x: number, y: number) => boolean {
  const hw = dw / 2
  const dh = GY - top
  return (x, y) => {
    if (y > GY || y < top) return false
    const u = Math.abs(x - cx + 0.5)
    if (shape === "catenary") return u <= hw * Math.pow(Math.max(0, (y - top + 1) / dh), 0.42)
    return u <= hw && (y - top >= hw || u * u + (hw - (y - top)) ** 2 <= hw * hw)
  }
}

function door(b: Buf, spec: HouseSpec, cx: number, dw: number, dh: number, lit: boolean) {
  const top = GY - dh
  const box: Box = { x0: cx - dw / 2 - 3, y0: top - 3, x1: cx + dw / 2 + 3, y1: GY + 1 }
  const outer = doorTest(spec.door, cx, top - 2, dw + 4)
  const inner = doorTest(spec.door, cx, top, dw)
  const trim = MATERIALS.metal!
  part(b, box, outer, (x, y) => tone(trim, 0.05 + lightAt(x, y, box) * 0.4, x, y), trim[4]!)
  part(b, box, inner, (x, y) => tone(DOOR, lightAt(x, y, box, 1) * 0.8 + ((x - (cx - dw / 2)) % 4 === 0 ? 0.25 : 0), x, y), DOOR[4]!)
  const sy = top + Math.round(dh * 0.5)
  for (let x = cx - dw / 2 + 1; x < cx + dw / 2 - 1; x++) if (inner(x, sy)) b.set(x, sy, DOOR[4]!)
  b.set(cx + Math.floor(dw / 2) - 3, sy + 3, 0xd7e8ff)
  b.set(cx + Math.floor(dw / 2) - 3, sy + 4, 0x8fa8d8)
  if (lit) for (let x = cx - dw / 2 + 1; x < cx + dw / 2 - 1; x++) b.set(x, GY, GLOW[3]!)
  // two low steps
  const step = MATERIALS.concrete!
  for (let i = 0; i < 2; i++) {
    const half = dw / 2 + 3 + i * 3
    part(b, { x0: cx - half, y0: GY + 1 + i * 2, x1: cx + half, y1: GY + 2 + i * 2 }, (x, y) => y >= GY + 1 + i * 2 && y <= GY + 2 + i * 2 && Math.abs(x - cx + 0.5) <= half, (x, y) => tone(step, y === GY + 1 + i * 2 ? 0.05 : 0.5, x, y), step[4]!)
  }
}

/** A round window set in a thick white rim, deep glass with a sky reflection; `ladder` shows two rails inside, as in a hollow sphere. */
function porthole(b: Buf, cx: number, cy: number, r: number, lit: boolean, ladder = false) {
  const trim = MATERIALS.metal!
  const disc = (rr: number) => (x: number, y: number) => (x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2 <= rr * rr
  const box: Box = { x0: cx - r - 4, y0: cy - r - 4, x1: cx + r + 4, y1: cy + r + 4 }
  part(b, box, disc(r + 3.5), (x, y) => tone(trim, 0.02 + lightAt(x, y, box) * 0.4, x, y), trim[4]!)
  part(b, box, disc(r + 1.2), (x, y) => tone(trim, 0.7 + lightAt(x, y, box) * 0.2, x, y), trim[4]!)
  const ramp = lit ? GLOW : GLASS
  part(b, box, disc(r), (x, y) => {
    const v = (y - (cy - r)) / (2 * r)
    const glint = x - cx + 0.5 + (y - cy + 0.5) < -r * 0.55 && (x + y) % 5 < 2
    return tone(ramp, glint ? 0 : 0.3 + v * 0.55, x, y)
  }, GLASS[4]!)
  if (ladder) {
    const ink = lit ? GLASS[3]! : GLASS[4]!
    for (const lx of [cx - Math.round(r * 0.3), cx + Math.round(r * 0.1)]) for (let y = cy - r + 2; y < cy + r - 2; y++) if (disc(r - 1)(lx, y)) b.set(lx, y, y % 4 === 0 ? 0xf0e0d0 : ink)
  }
}

function flowers(b: Buf, spec: HouseSpec, x0: number, x1: number, y: number) {
  const leaf = MATERIALS.turf!
  for (let x = x0; x < x1; x += 2) {
    const r = hash(x, spec.seed + 4)
    const h = 2 + Math.floor(r * 4)
    b.rect(r > 0.5 ? leaf[2]! : leaf[3]!, x, y - h, 1, h + 1)
    if (r > 0.6) {
      const c = BITS[Math.floor(hash(x, spec.seed) * BITS.length)]!
      b.rect(c, x - 1, y - h - 2, 3, 2)
      b.set(x, y - h - 3, c)
      b.set(x, y - h - 1, 0xffffff)
    }
  }
}

function crystals(b: Buf, cx: number, y: number, n: number, seed: number) {
  const cols = [R("#f2ffff", "#b8f0ff", "#6fd0f4", "#3a96d6", "#26529a"), R("#fbf0ff", "#e2c4ff", "#b88af4", "#7a52c8", "#4a2f90"), R("#fff0f8", "#ffc4e2", "#f484bc", "#b04088", "#702060")]
  for (let i = 0; i < n; i++) {
    const ramp = cols[Math.floor(hash(seed, i + 3) * 3)]!
    const h = 8 + Math.floor(hash(seed, i + 9) * 9)
    const x = cx + i * 5 - (n * 5) / 2
    part(b, { x0: x - 3, y0: y - h, x1: x + 3, y1: y }, (px, py) => py <= y && py >= y - h && Math.abs(px - x + 0.5) <= (py - (y - h)) * 0.4 + 0.8 && Math.abs(px - x + 0.5) <= 3, (px, py) => tone(ramp, (px < x ? 0.1 : 0.55) + ((py - (y - h)) / h) * 0.2, px, py), ramp[4]!)
  }
}

function lantern(b: Buf, x: number, lit: boolean) {
  b.rect(0x585a80, x, GY - 24, 1, 24)
  b.rect(0x8a8cb0, x - 1, GY - 24, 3, 1)
  part(b, { x0: x - 3, y0: GY - 32, x1: x + 4, y1: GY - 25 }, (px, py) => py >= GY - 32 && py <= GY - 25 && Math.abs(px - x + 0.5) <= 3, (px, py) => tone(lit ? GLOW : GLASS, lit ? 0.1 : py < GY - 29 ? 0.1 : 0.4, px, py), 0x585a80)
  b.set(x, GY - 33, 0x8a8cb0)
  if (lit) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if ((dx + dy) % 2 === 0 && Math.hypot(dx, dy) > 3 && Math.hypot(dx, dy) < 5.4 && b.get(x + dx, GY - 29 + dy) === -1) b.set(x + dx, GY - 29 + dy, 0xb8f8ee)
}

function star(b: Buf, x: number, y: number) {
  b.rect(0xe8f0ff, x, y - 3, 1, 7)
  b.rect(0xe8f0ff, x - 3, y, 7, 1)
  b.rect(0xa8b8dc, x - 1, y - 1, 3, 3)
  b.set(x, y, 0xffffff)
}

/** Ivy hanging down a wall from `top` to `bottom`, with the odd flower. */
function vine(b: Buf, spec: HouseSpec, x: number, top: number, bottom: number) {
  const leaf = MATERIALS.turf!
  for (let y = top; y < bottom; y++) {
    const wob = Math.round(Math.sin(y * 0.5 + spec.seed) * 1.5)
    b.set(x + wob, y, leaf[3]!)
    if (hash(y, spec.seed + x) > 0.4) {
      const side = hash(y, spec.seed + 1 + x) > 0.5 ? 1 : -1
      b.rect(leaf[hash(y, 7) > 0.5 ? 1 : 2]!, x + wob + side, y, 2, 2)
      b.set(x + wob + side * 2, y + 1, leaf[4]!)
    }
    if (hash(y, spec.seed + 5 + x) > 0.93) b.rect(BITS[y % BITS.length]!, x + wob + 2, y, 2, 2)
  }
}

/** Overgrowth: ivy that gathers on the upper left of a surface in clumps, dithered. */
function overgrow(b: Buf, spec: HouseSpec, inside: (x: number, y: number) => boolean, box: Box) {
  const leaf = MATERIALS.turf!
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
    if (!inside(x, y)) continue
    const nx = (x - box.x0) / (box.x1 - box.x0)
    const ny = (y - box.y0) / (box.y1 - box.y0)
    const n = hash(Math.floor(x / 4) + spec.seed, Math.floor(y / 4)) * 0.4 + hash(Math.floor(x / 10), Math.floor(y / 10) + spec.seed) * 0.6
    if (n + bayer(x, y) * 0.12 < 0.78 - (1 - nx) * 0.3 - (1 - ny) * 0.1) continue
    const k = hash(x, y + spec.seed)
    b.set(x, y, k > 0.93 ? leaf[0]! : k > 0.55 ? leaf[1]! : k > 0.25 ? leaf[2]! : leaf[3]!)
  }
}

// ---- solarpunk and retrofuturist parts ------------------------------------------------------------------------

/** A bush: a lit half-disc of leaves with a dark rim, some flowers. */
function bush(b: Buf, x: number, y: number, r: number, seed: number) {
  const leaf = MATERIALS.turf!
  for (let dy = -r; dy <= 1; dy++) for (let dx = -r; dx <= r; dx++) {
    const d = Math.hypot(dx, dy * 1.2)
    if (d > r + 0.3) continue
    const edge = d > r - 0.7
    b.set(x + dx, y + dy, edge ? leaf[4]! : tone(leaf, 0.15 + (dx + r) / (r * 5) + (dy + r) / (r * 4) + (hash(x + dx, y + dy + seed) - 0.5) * 0.3, x + dx, y + dy))
  }
  if (hash(x, seed + 9) > 0.45) {
    b.set(x - 1, y - r, BITS[(x + seed) % BITS.length]!)
    b.set(x + 1, y - r + 1, 0xffffff)
  }
}

/** A little tree: a pale trunk and a round canopy in two greens with highlights. */
function tree(b: Buf, x: number, y: number, h: number, seed: number) {
  const leaf = MATERIALS.turf!
  const bark = MATERIALS.bark!
  b.rect(bark[2]!, x, y - h, 1, h + 1)
  b.rect(bark[4]!, x + 1, y - h + 1, 1, h)
  const r = 4 + Math.floor(hash(x, seed) * 3)
  const cy = y - h - 2
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d = Math.hypot(dx, dy)
    if (d > r + 0.3) continue
    b.set(x + dx, cy + dy, d > r - 0.8 ? leaf[4]! : tone(leaf, 0.1 + (dx + dy + 2 * r) / (r * 6) + (hash(x + dx, cy + dy) - 0.5) * 0.35, x + dx, cy + dy))
  }
  b.set(x - 1, cy - 2, leaf[0]!)
  if (hash(x, seed + 3) > 0.5) b.set(x + 2, cy, BITS[(x + seed) % BITS.length]!)
}

/** A roof garden along whatever top the buffer has between `x0` and `x1`: bushes, a few small trees, some hanging ivy at the ends. */
function garden(b: Buf, spec: HouseSpec, x0: number, x1: number, skip?: [number, number]) {
  for (let x = Math.round(x0); x <= x1; x += 3) {
    if (skip && x >= skip[0] && x <= skip[1]) continue
    const y = b.top(x)
    if (y < 0) continue
    const r = hash(x, spec.seed + 21)
    if (r < 0.22) continue
    if (r > 0.9) tree(b, x, y, 5 + Math.floor(hash(x, 5) * 4), spec.seed)
    else bush(b, x, y + 1, 2 + Math.floor(r * 3), spec.seed)
  }
  const ya = b.top(Math.round(x0))
  const yb = b.top(Math.round(x1))
  if (ya >= 0) vine(b, spec, Math.round(x0), ya, ya + 10 + Math.floor(hash(spec.seed, 5) * 12))
  if (yb >= 0) vine(b, spec, Math.round(x1), yb, yb + 8 + Math.floor(hash(spec.seed, 6) * 12))
}

/** Solar petals: two tilted panels on a short stand, dark blue with a bright grid and a silver frame. */
function solar(b: Buf, x: number, y: number) {
  for (let p = 0; p < 2; p++) {
    const px = x + p * 15
    b.rect(0x8696b4, px + 6, y - 2, 2, 5)
    for (let i = 0; i < 13; i++) for (let j = 0; j < 5; j++) {
      const yy = y - 5 - Math.floor(i * 0.3) + j
      const frame = i === 0 || i === 12 || j === 0 || j === 4
      b.set(px + i, yy, frame ? 0xe6eef8 : i % 3 === 0 || j === 2 ? 0x5f8ce0 : 0x243a86)
    }
    for (let i = 0; i < 13; i++) b.set(px + i, y - 6 - Math.floor(i * 0.3), INK)
  }
}

/** A wind turbine on a thin mast: three white blades, caught mid-turn. */
function turbine(b: Buf, x: number, y: number, seed: number) {
  for (let j = 0; j < 22; j++) b.set(x, y - j, j % 5 === 0 ? 0xbccadc : 0xe6eef8)
  const hy = y - 22
  const a0 = hash(seed, 8) * Math.PI
  for (let k = 0; k < 3; k++) {
    const a = a0 + (k * Math.PI * 2) / 3
    for (let s = 1; s <= 9; s++) {
      const bx = x + Math.cos(a) * s
      const by = hy + Math.sin(a) * s
      b.set(bx, by, s < 3 ? 0xbccadc : 0xffffff)
      if (s > 3) b.set(bx + 1, by + 1, 0x8696b4)
    }
  }
  b.rect(INK, x - 1, hy - 1, 3, 3)
  b.set(x, hy, 0xffffff)
}

function antenna(b: Buf, x: number, y: number, lit: boolean) {
  for (let j = 0; j < 14; j++) b.set(x, y - j, 0xbccadc)
  b.rect(0xe6eef8, x - 3, y - 8, 7, 1)
  part(b, { x0: x - 3, y0: y - 20, x1: x + 3, y1: y - 14 }, (px, py) => (px - x + 0.5) ** 2 + (py - (y - 17)) ** 2 <= 9, (px, py) => tone(lit ? GLOW : R("#ffe6f6", "#ffb0dc", "#f070b8", "#b03c88", "#702060"), 0.1 + (py - (y - 20)) / 12, px, py), 0x702060)
}

/** A saucer ring seen from the side: a thin silver ellipse round the body; `front` draws the near half, else the far half. */
function ring(b: Buf, cx: number, cy: number, rx: number, ry: number, front: boolean) {
  const m = MATERIALS.metal!
  const box: Box = { x0: cx - rx - 2, y0: cy - ry - 2, x1: cx + rx + 2, y1: cy + ry + 2 }
  const d = (x: number, y: number) => ((x - cx + 0.5) / rx) ** 2 + ((y - cy) / ry) ** 2
  part(b, box, (x, y) => d(x, y) <= 1 && d(x, y) >= 0.72 && (front ? y >= cy : y < cy), (x, y) => tone(m, 0.05 + ((x - box.x0) / (box.x1 - box.x0)) * 0.6 + (front ? 0.1 : 0.35), x, y), m[4]!)
}

/** A bubble dome: glass over a ribbed frame, with a little garden growing inside. */
function dome(b: Buf, spec: HouseSpec, cx: number, baseY: number, rx: number, ry: number, lit: boolean) {
  const box: Box = { x0: cx - rx, y0: baseY - ry, x1: cx + rx, y1: baseY }
  const inside = (x: number, y: number) => y <= baseY && ((x - cx + 0.5) / rx) ** 2 + ((y - baseY) / ry) ** 2 <= 1
  const ramp = lit ? GLOW : GLASS
  part(b, box, inside, (x, y) => tone(ramp, 0.12 + lightAt(x, y, box) * 0.5, x, y), MATERIALS.metal![3]!)
  const leaf = MATERIALS.turf!
  for (let x = cx - rx + 2; x < cx + rx - 1; x++) {
    const h = 3 + Math.floor(hash(x, spec.seed + 2) * 6)
    for (let j = 0; j < h; j++) if (inside(x, baseY - 1 - j) && hash(x + j, spec.seed) > 0.25) b.set(x, baseY - 1 - j, leaf[1 + ((x + j) % 3)]!)
    if (hash(x, spec.seed + 7) > 0.9) b.set(x, baseY - h - 1, BITS[x % BITS.length]!)
  }
  for (const f of [-0.55, 0, 0.55]) for (let y = baseY - ry + 1; y < baseY; y++) {
    const k = Math.sqrt(Math.max(0, 1 - ((y - baseY) / ry) ** 2))
    const x = Math.round(cx + rx * f * k)
    if (inside(x, y)) b.set(x, y, MATERIALS.metal![2]!)
  }
  for (let t = 0; t < 8; t++) b.set(cx - rx * 0.55 + t, baseY - ry * 0.72 + t * 0.5 - (t > 4 ? 1 : 0), 0xffffff)
  for (let x = cx - rx; x <= cx + rx; x++) b.set(x, baseY, MATERIALS.metal![2]!)
}

/** A glass lift: a tall tube with silver bands, a cap and a foot. */
function liftTube(b: Buf, x: number, top: number, lit: boolean) {
  const box: Box = { x0: x - 5, y0: top, x1: x + 5, y1: GY }
  part(b, box, (px, py) => py >= top && py <= GY && Math.abs(px - x + 0.5) <= 5, (px, py) => tone(lit ? GLOW : GLASS, 0.1 + (px - (x - 5)) / 14 + (hash(px, py >> 2) > 0.85 ? 0.12 : 0), px, py), MATERIALS.metal![4]!)
  for (let y = top + 6; y < GY - 2; y += 12) b.rect(MATERIALS.metal![2]!, x - 5, y, 11, 2)
  part(b, { x0: x - 6, y0: top - 3, x1: x + 6, y1: top }, (px, py) => py >= top - 3 && py <= top && Math.abs(px - x + 0.5) <= 6, (px, py) => tone(MATERIALS.metal!, (py - top + 3) / 5, px, py), MATERIALS.metal![4]!)
  part(b, { x0: x - 7, y0: GY - 2, x1: x + 7, y1: GY + 1 }, (px, py) => py >= GY - 2 && py <= GY + 1 && Math.abs(px - x + 0.5) <= 7, (px, py) => tone(MATERIALS.metal!, (py - GY + 2) / 4, px, py), MATERIALS.metal![4]!)
}

/** A sweeping stair: slab steps climbing from the ground at the left to a landing. */
function stair(b: Buf, x0: number, steps: number, rise: number) {
  const ramp = MATERIALS.concrete!
  for (let i = 0; i < steps; i++) {
    const top = GY - 3 - i * rise
    const x = x0 + i * 6
    part(b, { x0: x, y0: top, x1: x + 6, y1: top + 10 }, (px, py) => px >= x && px < x + 6 && py >= top && py <= top + 10, (px, py) => tone(ramp, py === top ? 0 : 0.25 + (py - top) / 22, px, py), ramp[4]!, true)
  }
  const landing = x0 + steps * 6
  const ly = GY - 3 - steps * rise
  part(b, { x0: landing, y0: ly, x1: landing + 12, y1: ly + 5 }, (px, py) => px >= landing && px < landing + 12 && py >= ly && py <= ly + 5, (px, py) => tone(ramp, py === ly ? 0 : 0.35, px, py), ramp[4]!)
}

// ---- pods -----------------------------------------------------------------------------------------------------

function podBody(b: Buf, spec: HouseSpec, cx: number, lit: boolean) {
  const has = (e: Extra) => spec.extras.includes(e)
  const shape = spec.shape ?? "egg"
  const lifted = shape === "saucer" || shape === "capsule" || has("pedestal")
  const lift = lifted ? 10 : 0
  const bottom = GY - lift + (has("ivy") && !lifted ? 3 : 0)
  const rx = Math.round(shape === "saucer" ? spec.hw * 1.12 : shape === "capsule" ? spec.hw * 1.12 : shape === "cluster" ? spec.hw * 0.74 : spec.hw)
  const ry = Math.round(shape === "saucer" ? spec.h * 0.3 : shape === "capsule" ? spec.h * 0.4 : spec.h / 2)
  const cy = bottom - ry
  const topBody = cy - ry
  const e = shape === "capsule" ? 2.8 : 2

  // the dish it stands on, and curved legs out to the sides when asked for
  if (lifted) {
    const m = MATERIALS.metal!
    if (has("legs")) {
      for (const side of [-1, 1]) for (let t = 0; t <= 1; t += 0.02) {
        const x = cx + side * (rx * 0.5 + rx * 0.38 * t)
        const y = bottom - 4 + (GY - bottom + 4) * (t * t * 0.6 + t * 0.4)
        b.rect(m[t > 0.5 ? 3 : 2]!, x - 1, y, 3, 2)
        b.rect(m[1]!, x - 1, y, 1, 2)
      }
      for (const side of [-1, 1]) part(b, { x0: cx + side * rx * 0.88 - 7, y0: GY - 1, x1: cx + side * rx * 0.88 + 7, y1: GY + 2 }, (x, y) => y >= GY - 1 && y <= GY + 2 && Math.abs(x - (cx + side * rx * 0.88)) <= 7, (x, y) => tone(m, y === GY - 1 ? 0 : 0.5, x, y), m[4]!)
    }
    const dishTop = bottom - 2
    part(b, { x0: cx - rx, y0: dishTop, x1: cx + rx, y1: GY }, (x, y) => y >= dishTop && y <= GY && Math.abs(x - cx + 0.5) <= rx * (0.42 + ((y - dishTop) / Math.max(1, GY - dishTop)) * 0.5), (x, y) => tone(m, 0.1 + ((y - dishTop) / Math.max(1, GY - dishTop)) * 0.5 + (x < cx ? 0 : 0.2), x, y), m[4]!)
  }

  // the far half of a ring, then any side lobes, then the body
  const ringY = cy + Math.round(ry * 0.2)
  if (has("ring")) ring(b, cx, ringY, rx + 14, 6, false)
  if (shape === "cluster") {
    for (const [ox, k] of [[-1.12, 0.62], [1.05, 0.5]] as const) {
      const lrx = Math.round(rx * k)
      const lry = Math.round(ry * k * 1.05)
      const lcx = cx + Math.round(ox * rx)
      const lcy = bottom - lry
      const lbox: Box = { x0: lcx - lrx, y0: lcy - lry, x1: lcx + lrx, y1: bottom }
      part(b, lbox, (x, y) => y <= bottom && ((x - lcx + 0.5) / lrx) ** 2 + ((y - lcy) / lry) ** 2 <= 1, (x, y) => materialColor(spec, x, y, Math.max(0, Math.min(1, Math.hypot((x - (lcx - lrx * 0.4)) / lrx, (y - (lcy - lry * 0.4)) / lry) * 0.85)), lbox), wallEdge(spec))
      porthole(b, lcx, lcy - Math.round(lry * 0.1), Math.max(3, Math.round(lrx * 0.36)), lit)
    }
  }
  const box: Box = { x0: cx - rx, y0: topBody, x1: cx + rx, y1: bottom }
  const inside = (x: number, y: number) => {
    const dx = Math.abs(x - cx + 0.5) / rx
    const dy = Math.abs(y - cy) / ry
    return y <= bottom && Math.pow(dx, e) + Math.pow(dy, e) <= 1
  }
  part(b, box, inside, (x, y) => materialColor(spec, x, y, Math.max(0, Math.min(1, Math.hypot((x - (cx - rx * 0.38)) / rx, (y - (topBody + ry * 0.56)) / (ry * 2)) * 0.95)), box), wallEdge(spec))

  // panel seams: meridians and a belt, following the curve
  const seam = MATERIALS[spec.material]![3]!
  for (let y = topBody + 2; y < bottom - 1; y++) {
    const dy = (y - cy) / ry
    const k = Math.sqrt(Math.max(0, 1 - dy * dy))
    for (const ph of [-0.52, 0.45]) {
      const x = Math.round(cx + rx * ph * k)
      if (inside(x, y) && inside(x + 1, y)) b.set(x, y, seam)
    }
  }
  for (let x = cx - rx + 3; x < cx + rx - 2; x++) {
    const dx = (x - cx) / rx
    const y = Math.round(cy + ry * 0.36 * Math.sqrt(Math.max(0, 1 - dx * dx)))
    if (inside(x, y) && (x + y) % 6 !== 0) b.set(x, y, seam)
  }
  if (has("ivy")) overgrow(b, spec, inside, box)

  // the roof garden, solar petals, turbine, antenna and dome, on whatever the top of the body is
  const domeW = shape === "saucer" || has("dome") ? Math.round(rx * 0.5) : 0
  if (has("garden")) garden(b, spec, cx - rx * 0.62, cx + rx * 0.62, domeW ? [cx - domeW - 1, cx + domeW + 1] : undefined)
  if (has("solar") && !domeW) {
    const sx = cx + Math.round(rx * 0.1)
    const sy = b.top(sx + 14)
    if (sy > 0) solar(b, sx, sy + 1)
  }
  if (has("turbine")) {
    const tx = cx - Math.round(rx * 0.55)
    const ty = b.top(tx)
    if (ty > 24) turbine(b, tx, ty + 1, spec.seed)
  }
  if (has("antenna")) {
    const ax = cx + Math.round(rx * 0.5)
    const ay = b.top(ax)
    if (ay > 22) antenna(b, ax, ay + 1, lit)
  }
  if (domeW) dome(b, spec, cx, topBody + Math.round(ry * 0.55), domeW + 2, Math.round(Math.max(10, ry * 0.9)), lit)

  // windows and the door
  if (shape === "saucer") {
    for (let i = -2; i <= 2; i++) porthole(b, cx + Math.round(i * rx * 0.36), cy - Math.round(ry * 0.1) + Math.abs(i), 3, lit)
  } else if (shape === "capsule") {
    for (let i = 0; i < 4; i++) porthole(b, cx - Math.round(rx * 0.62) + Math.round(i * rx * 0.34), cy - Math.round(ry * 0.12), 4, lit)
  } else {
    const big = Math.round(rx * (shape === "cluster" ? 0.4 : 0.34))
    porthole(b, cx - Math.round(rx * 0.1), cy - Math.round(ry * 0.22), big, lit, true)
    porthole(b, cx + Math.round(rx * 0.52), cy - Math.round(ry * 0.52), Math.max(3, Math.round(rx * 0.12)), lit)
    porthole(b, cx - Math.round(rx * 0.62), cy + Math.round(ry * 0.08), Math.max(2, Math.round(rx * 0.08)), lit)
  }
  door(b, spec, cx + (shape === "saucer" || shape === "capsule" ? 0 : Math.round(rx * 0.28)), 14, 19, lit)
  if (has("ring")) ring(b, cx, ringY, rx + 14, 6, true)
  if (has("stair")) stair(b, cx - rx - 8, 6, 4)
  if (has("lift")) liftTube(b, cx - rx - 10, topBody + 14, lit)
  return { top: topBody }
}

// ---- stacks --------------------------------------------------------------------------------------------------

function stackBody(b: Buf, spec: HouseSpec, cx: number, lit: boolean, litArr?: boolean[]) {
  const has = (e: Extra) => spec.extras.includes(e)
  const n = spec.h
  const tenants = spec.tenants ?? 0
  let prevTop = GY + 6
  let topW = spec.hw
  let topX = cx
  let topY = GY
  for (let i = 0; i < n; i++) {
    const flatBase = tenants > 0 && i === 0
    const ph = flatBase ? 28 : 22 + Math.floor(hash(spec.seed, i + 40) * 6)
    const w = flatBase ? spec.hw : Math.max(14, Math.round(spec.hw * (tenants ? 0.84 : 1.04) * Math.pow(0.86, i)) + (i % 2) * 3)
    const lim = Math.max(0, Math.min(14, W / 2 - 4 - w))
    const ox = i === 0 ? 0 : Math.round((hash(spec.seed, i) - 0.5) * 2 * lim)
    const pcx = cx + ox
    const bottom = i === 0 ? GY : prevTop + 6
    const top = bottom - ph
    prevTop = top
    topW = w
    topX = pcx
    topY = top
    const litM = litArr && tenants ? litArr[(i === 0 ? 0 : i - 1) % litArr.length]! : lit
    const e = 2.8 + hash(spec.seed, i + 60)
    const box: Box = { x0: pcx - w, y0: top, x1: pcx + w, y1: bottom }
    // a rounded octagon: a squared-off ellipse, flat on the bottom
    const inside = (x: number, y: number) => {
      const dx = Math.abs(x - pcx + 0.5) / w
      const dy = Math.abs(y - (top + bottom) / 2) / (ph / 2)
      return y <= bottom && Math.pow(dx, e) + Math.pow(dy, e) <= 1
    }
    part(b, box, inside, (x, y) => materialColor(spec, x, y, 0.1 + lightAt(x, y, box, 0.75) * 0.8, box), wallEdge(spec))
    if (i > 0) for (let x = pcx - w + 3; x < pcx + w - 3; x++) if (inside(x, bottom - 1)) b.set(x, bottom - 1, MATERIALS.concrete![3]!)
    if (!flatBase) {
      if (hash(spec.seed, i + 70) > 0.4) {
        // a ribbon window: dark glass in a white frame with mullions and a pale reflection
        const wy0 = top + 7
        const wh = 10
        const wx0 = pcx - w + 7
        const ww = w * 2 - 14
        const trim = MATERIALS.metal!
        part(b, { x0: wx0 - 2, y0: wy0 - 2, x1: wx0 + ww + 2, y1: wy0 + wh + 2 }, (x, y) => x >= wx0 - 2 && x <= wx0 + ww + 2 && y >= wy0 - 2 && y <= wy0 + wh + 2 && Math.abs(x - pcx + 0.5) < w - 4, (x, y) => tone(trim, 0.15, x, y), trim[4]!)
        part(b, { x0: wx0, y0: wy0, x1: wx0 + ww, y1: wy0 + wh }, (x, y) => x >= wx0 && x <= wx0 + ww && y >= wy0 && y <= wy0 + wh && Math.abs(x - pcx + 0.5) < w - 6, (x, y) => tone(litM ? GLOW : GLASS, 0.3 + (y - wy0) / (wh * 1.3) + (hash(x >> 2, i + spec.seed) > 0.8 ? -0.15 : 0), x, y), GLASS[4]!)
        for (let x = wx0 + 8; x < wx0 + ww - 3; x += 10) for (let y = wy0; y <= wy0 + wh; y++) if (b.get(x, y) !== -1) b.set(x, y, GLASS[4]!)
      } else {
        const k = Math.max(2, Math.floor(w / 9))
        for (let q = 0; q < k; q++) porthole(b, pcx - w + 9 + Math.round((q * (2 * w - 18)) / Math.max(1, k - 1)), top + 12, 4, litM)
      }
    }
    if (flatBase) {
      // one front door per tenant, two tiles (32 pixels) apart, with a porthole above that glows while they are home
      for (let k = 0; k < tenants; k++) {
        const off = Math.round((k - (tenants - 1) / 2) * 32)
        door(b, { ...spec, door: "round" }, pcx + off, 14, 18, litArr ? litArr[k]! : lit)
        porthole(b, pcx + off, top + 7, 3, litArr ? litArr[k]! : lit)
      }
    } else if (i === 0) {
      door(b, { ...spec, door: "round" }, pcx + Math.round(w * 0.45), 13, 17, lit)
      porthole(b, pcx - Math.round(w * 0.42), top + 13, 4, lit)
    }
    // a garden on this module's roof where the next one does not cover it
    if (has("garden") || has("ivy")) garden(b, { ...spec, seed: spec.seed + i * 17 }, pcx - w * 0.7, pcx + w * 0.7)
  }
  if (has("dome")) dome(b, spec, topX, topY + 3, Math.max(8, Math.round(topW * 0.5)), 12, lit)
  else if (has("solar")) {
    const sx = topX - 14
    const sy = b.top(sx + 14)
    if (sy > 18) solar(b, sx, sy + 1)
  }
  if (has("turbine")) {
    const tx = topX + Math.round(topW * 0.6)
    const ty = b.top(tx)
    if (ty > 26) turbine(b, tx, ty + 1, spec.seed)
  }
  if (has("lift")) liftTube(b, cx - spec.hw - 9, GY - 26 - (n - 1) * 17, lit)
  return { top: topY }
}

// ---- the whole house -------------------------------------------------------------------------------------------

/** Draw a house into a fresh buffer: `lit` turns the windows and lantern on, for when its friend is home after dark (an array lights a block's tenants one by one). */
export function buildHouse(spec: HouseSpec, litIn: boolean | boolean[]): Int32Array {
  const litArr = Array.isArray(litIn) ? litIn : undefined
  const lit: boolean = litArr ? litArr.some(Boolean) : (litIn as boolean)
  const b = new Buf()
  const cx = W / 2
  const e = new Set(spec.extras)
  const half = Math.round(spec.hw * (spec.shape === "saucer" || spec.shape === "capsule" ? 1.12 : 1))
  if (e.has("water")) {
    const wr = Math.min(60, half + 14)
    for (let y = GY - 2; y <= GY + 4; y++) for (let x = cx - wr; x <= cx + wr; x++) {
      const dx = (x - cx) / wr
      const dy = (y - (GY + 1)) / 5
      if (dx * dx + dy * dy <= 1) b.set(x, y, tone(GLASS, 0.1 + (y - GY) * 0.07 + (hash(x, y + (y % 2)) > 0.9 ? 0.25 : 0), x, y))
    }
  }
  if (e.has("crystals")) crystals(b, cx + half + 8, GY - 1, 2, spec.seed)
  if (e.has("reeds")) for (const rx of [cx - half - 8, cx - half - 4, cx + half + 4, cx + half + 8]) {
    b.rect(MATERIALS.turf![3]!, rx, GY - 20 - (rx % 4), 1, 21)
    b.rect(MATERIALS.turf![1]!, rx + 1, GY - 22 - (rx % 3), 1, 18)
    b.rect(0x8a5a80, rx - 1, GY - 28 - (rx % 4), 3, 6)
  }
  const { top } = spec.body === "pod" ? podBody(b, spec, cx, lit) : stackBody(b, spec, cx, lit, litArr)
  if (e.has("star")) star(b, cx, Math.max(5, top - 12))
  if (e.has("lantern")) lantern(b, Math.min(W - 6, cx + half + 12), lit)
  if (e.has("flowers")) {
    flowers(b, spec, cx - half - 8, cx - 12, GY + 1)
    flowers(b, spec, cx + 12, cx + half + 8, GY + 1)
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
  const sx = Math.min(W / 2 - 2, spec.hw * 1.12 + 10)
  for (let y = GY - 2; y <= GY + 6; y++) for (let x = Math.round(W / 2 - sx); x <= W / 2 + sx; x++) {
    const dx = (x - W / 2) / sx
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
