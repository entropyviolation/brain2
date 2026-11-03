/**
 * scripts/baby-furniture-snap.mts — The cottage's furniture from ComfyUI pictures into little sprites
 *
 *   npx tsx scripts/baby-furniture-snap.mts [preview.png]
 *
 * For each id in `FURNITURE` (`scripts/baby-furniture-queue.mjs`) it takes the newest `furn-<id>_*.png` in the ComfyUI output
 * folder (or the file `lib/baby-game/furniture.json` picks for it), cuts the object out of its white background
 * (`objectMask` here, `parts` from `snap.mjs`), area-averages it down to `HEIGHT[id]` pixels tall, cuts it to a shared small palette
 * (median cut, `COLORS` per sprite), and lays a fresh 1px dark outline round it. Output is `lib/baby-game/furniture-sprites.ts`
 * (palette plus rows of palette characters, painted synchronously by `components/BabyGame/casa-paint.ts`) and, if you pass a
 * path, a contact sheet to look at.
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import { parts } from "../lib/baby-game/snap.mjs"
import { FURNITURE } from "./baby-furniture-queue.mjs"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const DIR = process.env.BABY_GENS_DIR || path.join(os.homedir(), "ComfyUI-Shared", "output")
const PICKS = path.join(ROOT, "lib/baby-game/furniture.json")
const OUT = path.join(ROOT, "lib/baby-game/furniture-sprites.ts")
const COLORS = 14
const OUTLINE = "#2e2a3a"
const CHARS = "0123456789abcdefghijklmnopqrstuvwxyz"

/** Pixel height of each object in the room (the room is 16px tiles, the walker about 26px tall). */
export const HEIGHT: Record<string, number> = {
  "sofa-sage": 36, "sofa-cloud": 36, "sofa-leather": 34, "sofa-black": 36, "pouf-chrome": 20,
  "table-glass": 26, "table-hand": 30, "table-marble": 30, "table-dining": 46,
  "chair-chrome": 32, "chair-heart": 34, "chair-green": 32,
  "cabinet-lacquer": 66, "screen-silver": 64, "screen-mirror": 64, "vanity-round": 54, "vanity-swirl": 58,
  "lamp-mushroom": 26, "lamp-dome": 62, "lamp-saturn": 28, "lamp-spheres": 64, "lamp-fringe": 32, "lamp-nouveau": 36, "lamp-tulip": 34, "lamp-lava": 30,
  "pendant-opal": 34, "chandelier-green": 40,
  "curtain-beads": 76, "curtain-capiz": 76, "curtain-plum": 80,
  "bed-canopy": 84, "bed-iron": 70, "bed-sage": 84,
  "shelf-organic": 72, "shelf-green": 22, "shelf-ladder": 72,
  "record-player": 24, "trolley": 34, "dice-tables": 28, "dresser-chrome": 38, "cabinet-steel": 42,
  "mirror-orchid": 22, "vase-lily": 22, "candles-carved": 22, "hammock-net": 64,
  "plant-kentia": 68, "plant-ivy": 42, "fireplace-egg": 56, "sink-checker": 32, "bath-tub": 36,
  "speakers-orb": 56, "daybed-red": 42, "chest-iron": 24, "statue-angel": 62,
}

type Rgb = [number, number, number]

/**
 * The object as everything not flooded in from the border: the plain background (within `tol` of the border's commonest
 * color) and the soft grey ground shadow under the object (flat grey, mid-light). Narrower than `figureMask`'s shadow rule, so a
 * white or lilac object with a pale outline is not eaten with it.
 */
function objectMask(rgba: Uint8Array, w: number, h: number, tol = 48, wide = false): Uint8Array {
  const counts = new Map<number, number>()
  const at = (i: number): Rgb => [rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!]
  const border: number[] = []
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1)
  for (const i of border) {
    const [r, g, b] = at(i)
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0]
  const bg: Rgb = [((top >> 10) & 31) * 8 + 4, ((top >> 5) & 31) * 8 + 4, (top & 31) * 8 + 4]
  const isBg = (c: Rgb) => {
    const flat = Math.max(...c) - Math.min(...c) < 14
    const l = luma(c)
    return Math.hypot(c[0] - bg[0], c[1] - bg[1], c[2] - bg[2]) < tol || (flat && l > 118 && l < 212)
  }
  const mask = new Uint8Array(w * h).fill(1)
  // `wide`: the picture has a floor strip or wall panel the object stands on, so the flood starts from every border pixel and also
  // spreads across flat color (a step under 12 between neighbours), which the object's dark outline stops
  const flat = (i: number, j: number) => Math.hypot(rgba[i * 4]! - rgba[j * 4]!, rgba[i * 4 + 1]! - rgba[j * 4 + 1]!, rgba[i * 4 + 2]! - rgba[j * 4 + 2]!) < 12
  const from = new Int32Array(w * h).fill(-1)
  const stack = (wide ? border : border.filter((i) => isBg(at(i)))).slice()
  for (const i of stack) from[i] = i
  while (stack.length) {
    const i = stack.pop()!
    if (!mask[i]) continue
    mask[i] = 0
    const x = i % w
    const y = (i / w) | 0
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]
    for (const j of next) if (j >= 0 && mask[j] && (isBg(at(j)) || (wide && flat(i, j)))) stack.push(j)
  }
  return mask
}
const hex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`
const unhex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const luma = (c: Rgb) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]

/** Objects that run off the picture's edge on purpose (curtains, a hammock), so the floor-strip rule leaves them be. */
const EDGE_OK = new Set(['curtain-beads', 'curtain-capiz', 'curtain-plum', 'hammock-net', 'plant-ivy', 'chandelier-green', 'pendant-opal'])

function newest(id: string): string | null {
  const picks = fs.existsSync(PICKS) ? (JSON.parse(fs.readFileSync(PICKS, "utf8")) as Record<string, string>) : {}
  if (picks[id]) return picks[id]
  // the image-to-image redraws from the board's own photo (`furnref-`) win over the words-only ones (`furn-`)
  for (const prefix of EDGE_OK.has(id) ? ["furn-"] : ["furnref-", "furn-"]) {
    const files = fs.readdirSync(DIR).filter((f) => f.startsWith(`${prefix}${id}_`) && f.endsWith(".png")).sort()
    if (files.length) return files.at(-1)!
  }
  return null
}

/** Median cut: split the box with the widest channel at its median until there are `n` boxes; each box's mean is a color. */
function medianCut(px: Rgb[], n: number): Rgb[] {
  const boxes: Rgb[][] = [px]
  while (boxes.length < n) {
    let bi = -1
    let bestRange = 12
    let ch = 0
    boxes.forEach((b, i) => {
      if (b.length < 2) return
      for (let c = 0; c < 3; c++) {
        const vs = b.map((p) => p[c]!)
        const r = (Math.max(...vs) - Math.min(...vs)) * Math.sqrt(b.length)
        if (r > bestRange) ((bestRange = r), (bi = i), (ch = c))
      }
    })
    if (bi < 0) break
    const b = boxes[bi]!.sort((p, q) => p[ch]! - q[ch]!)
    const mid = b.length >> 1
    boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid))
  }
  return boxes.map((b) => [0, 1, 2].map((c) => b.reduce((s, p) => s + p[c]!, 0) / b.length) as Rgb)
}

export type Snapped = { w: number; h: number; pal: string[]; rows: string[] }


async function snap(id: string, file: string, height: number): Promise<Snapped | null> {
  const { data, info } = await sharp(path.join(DIR, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) rgba.set([data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!, 255], i * 4)
  const area = (m: Uint8Array) => m.reduce((n, v) => n + v, 0)
  let mask = objectMask(rgba, w, h, 48, file.startsWith("furnref-"))
  let found = parts(mask, w, h, Math.round(w * h * 0.0015))
  if (!found.length) return null
  // the object's blob reaches the picture's edge: it is standing on a strip of floor, so flood through flat color as well
  if (!EDGE_OK.has(id) && found.every((b: { x0: number; y0: number; x1: number; y1: number }) => b.x0 <= 1 || b.y0 <= 1 || b.x1 >= w - 2 || b.y1 >= h - 2)) {
    const wide = objectMask(rgba, w, h, 48, true)
    if (area(wide) > area(mask) * 0.25) {
      mask = wide
      found = parts(mask, w, h, Math.round(w * h * 0.0015))
      if (!found.length) return null
    }
  }
  // keep the object: blobs that touch the picture's edge are floor strips and wall panels the model drew, so go; of the rest keep
  // the big ones (a table and its chairs, two dice) and drop specks
  type Blob = { id: number; x0: number; y0: number; x1: number; y1: number; area: number }
  const touches = (b: Blob) => b.x0 <= 1 || b.y0 <= 1 || b.x1 >= w - 2 || b.y1 >= h - 2
  const inside = (found as Blob[]).filter((b) => !touches(b))
  const pool = inside.length ? inside : (found as Blob[])
  const biggest = Math.max(...pool.map((p) => p.area))
  const keep = new Set(pool.filter((p) => p.area > biggest * 0.08).map((p) => p.id))
  const label = found[0].label as Int32Array
  let x0 = w, y0 = h, x1 = 0, y1 = 0
  for (let i = 0; i < w * h; i++) {
    if (label[i]! >= 0 && keep.has(label[i]!)) {
      const x = i % w, y = (i / w) | 0
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    } else mask[i] = 0
  }
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  const inner = height - 2
  const scale = bh / inner
  const ow = Math.max(2, Math.min(96, Math.round(bw / scale)))
  const cells: Array<Rgb | null> = []
  for (let gy = 0; gy < inner; gy++) {
    for (let gx = 0; gx < ow; gx++) {
      const sx0 = x0 + (gx * bw) / ow, sx1 = x0 + ((gx + 1) * bw) / ow
      const sy0 = y0 + gy * scale, sy1 = y0 + (gy + 1) * scale
      let n = 0, on = 0
      const sum: Rgb = [0, 0, 0]
      const dk: Rgb = [0, 0, 0]
      let nd = 0
      for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
        for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue
          n++
          if (!mask[y * w + x]) continue
          on++
          const c: Rgb = [rgba[(y * w + x) * 4]!, rgba[(y * w + x) * 4 + 1]!, rgba[(y * w + x) * 4 + 2]!]
          for (let k = 0; k < 3; k++) sum[k] += c[k]!
          if (luma(c) < 70) {
            nd++
            for (let k = 0; k < 3; k++) dk[k] += c[k]!
          }
        }
      }
      if (!n || on / n < 0.5) cells.push(null)
      else if (nd / on > 0.38) cells.push([dk[0]! / nd, dk[1]! / nd, dk[2]! / nd])
      else cells.push([sum[0]! / on, sum[1]! / on, sum[2]! / on])
    }
  }
  const solid = cells.filter((c): c is Rgb => !!c)
  if (solid.length < 12) return null
  // a touch more punch: the pixel-art-xl pictures are a little washed out once averaged
  const punch = (c: Rgb): Rgb => {
    const l = luma(c)
    return c.map((v) => Math.max(0, Math.min(255, l + (v - l) * 1.12))) as Rgb
  }
  const pal = medianCut(solid.map(punch), COLORS).sort((a, b) => luma(a) - luma(b))
  const nearest = (c: Rgb) => {
    let best = 0, bd = Infinity
    for (let i = 0; i < pal.length; i++) {
      const d = (c[0] - pal[i]![0]) ** 2 * 0.3 + (c[1] - pal[i]![1]) ** 2 * 0.59 + (c[2] - pal[i]![2]) ** 2 * 0.11
      if (d < bd) ((bd = d), (best = i))
    }
    return best
  }
  const W = ow + 2
  const H = inner + 2
  const grid: number[] = new Array(W * H).fill(-1)
  cells.forEach((c, i) => {
    if (c) grid[((i / ow) | 0) * W + (i % ow) + W + 1] = nearest(punch(c))
  })
  const outline = pal.length
  const edge = grid.slice()
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y * W + x]! >= 0) continue
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[(y + dy!) * W + x + dx!]! >= 0 && x + dx! >= 0 && x + dx! < W && y + dy! >= 0 && y + dy! < H)
      if (nb) edge[y * W + x] = outline
    }
  }
  const palette = [...pal.map(hex), OUTLINE]
  const rows: string[] = []
  for (let y = 0; y < H; y++) rows.push(Array.from({ length: W }, (_, x) => (edge[y * W + x]! < 0 ? "." : CHARS[edge[y * W + x]!]!)).join(""))
  // trim empty rows from the top and bottom, then empty columns
  while (rows.length && /^\.+$/.test(rows[0]!)) rows.shift()
  while (rows.length && /^\.+$/.test(rows.at(-1)!)) rows.pop()
  let lo = W, hi = 0
  for (const r of rows) {
    const a = r.search(/[^.]/)
    const b = r.length - 1 - [...r].reverse().findIndex((ch) => ch !== ".")
    if (a >= 0) ((lo = Math.min(lo, a)), (hi = Math.max(hi, b)))
  }
  const trimmed = rows.map((r) => r.slice(lo, hi + 1))
  return { w: hi - lo + 1, h: trimmed.length, pal: palette, rows: trimmed }
}

async function main() {
  const out: Record<string, Snapped> = {}
  const missing: string[] = []
  for (const id of Object.keys(FURNITURE)) {
    const file = newest(id)
    const snapped = file ? await snap(id, file, HEIGHT[id] ?? 40) : null
    if (snapped) out[id] = snapped
    else missing.push(id)
  }
  const body = Object.entries(out)
    .map(([id, s]) => `  ${JSON.stringify(id)}: {\n    w: ${s.w},\n    h: ${s.h},\n    pal: ${JSON.stringify(s.pal)},\n    rows: [\n${s.rows.map((r) => `      "${r}",`).join("\n")}\n    ],\n  },`)
    .join("\n")
  fs.writeFileSync(
    OUT,
    `/**
 * lib/baby-game/furniture-sprites.ts — GENERATED by scripts/baby-furniture-snap.mts. Do not edit.
 *
 * The cottage's furniture, drawn in ComfyUI from the "future home" board (\`homedesignref/\`) and snapped down: each is a palette
 * (the last color is the outline) and rows of palette characters, "." empty. \`components/BabyGame/casa-paint.ts\` paints them.
 */

export type FurnitureSprite = { w: number; h: number; pal: string[]; rows: string[] }

export const FURNITURE_SPRITES: Record<string, FurnitureSprite> = {
${body}
}
`,
  )
  console.log(`${Object.keys(out).length} sprites written; missing: ${missing.join(", ") || "none"}`)
  const preview = process.argv[2]
  if (preview) {
    const cols = 8, cell = 120, sc = 2
    const tiles = Object.entries(out)
    const comps = await Promise.all(
      tiles.map(async ([id, s], i) => {
        const buf = Buffer.alloc(s.w * s.h * 4)
        s.rows.forEach((r, y) => [...r].forEach((ch, x) => {
          if (ch === ".") return
          const c = unhex(s.pal[CHARS.indexOf(ch)]!)
          buf.set([c[0], c[1], c[2], 255], (y * s.w + x) * 4)
        }))
        const img = await sharp(buf, { raw: { width: s.w, height: s.h, channels: 4 } }).resize(Math.min(cell, s.w * sc), Math.min(cell - 14, s.h * sc), { kernel: "nearest", fit: "inside" }).png().toBuffer()
        return [
          { input: img, left: (i % cols) * cell + 4, top: Math.floor(i / cols) * cell + 14 },
          { input: Buffer.from(`<svg width="${cell}" height="14"><text x="2" y="11" font-size="10" font-family="Arial" fill="#222">${id}</text></svg>`), left: (i % cols) * cell, top: Math.floor(i / cols) * cell },
        ]
      }),
    )
    await sharp({ create: { width: cols * cell, height: Math.ceil(tiles.length / cols) * cell, channels: 3, background: "#c9d6dc" } }).composite(comps.flat()).png().toFile(preview)
  }
}

main().catch((e) => (console.error(e), process.exit(1)))
