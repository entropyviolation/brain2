#!/usr/bin/env node
/**
 * scripts/baby-snap-person.mjs — a liked ComfyUI person into the game's 32×32 grids, with a palette of their own
 *
 *   node scripts/baby-snap-person.mjs --parts <png> [out.png]   number the figures on a sheet
 *   node scripts/baby-snap-person.mjs [preview.png]              snap every person in lib/baby-game/people/gen-people.json
 *
 * Animals snap onto the fixed `SPRITE_PALETTE`; a person's clothes and hair need their own colors, so this reads one palette
 * (k-means over every chosen figure) and writes it beside the grids in `lib/baby-game/people/gen-people.ts`. Letters come from
 * U+0200 up so they never meet the drawer's (U+00C0 up) or the animals'. The snapping is `lib/baby-game/snap.mjs`.
 */
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { figureMask, parts, place, snapPart } from "../lib/baby-game/snap.mjs"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const DIR = path.join(ROOT, "lib/baby-game/people")
const MANIFEST = path.join(DIR, "gen-people.json")
const OUT = path.join(DIR, "gen-people.ts")
const K = Number(process.env.K || 30)

async function load(file) {
  const { data, info } = await sharp(path.join(DIR, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const rgba = new Uint8Array(info.width * info.height * 4)
  for (let i = 0; i < info.width * info.height; i++) rgba.set([data[i * 3], data[i * 3 + 1], data[i * 3 + 2], 255], i * 4)
  return { rgba, w: info.width, h: info.height }
}

async function numberParts(file, out) {
  const { rgba, w, h } = await load(file)
  const found = parts(figureMask(rgba, w, h, 60, { shadow: true }), w, h)
  const boxes = found.map((p) => `<rect x="${p.x0}" y="${p.y0}" width="${p.x1 - p.x0}" height="${p.y1 - p.y0}" fill="none" stroke="red" stroke-width="3"/><text x="${p.x0 + 4}" y="${p.y0 + 28}" font-size="28" fill="red" font-family="sans-serif">${p.index}</text>`).join("")
  await sharp(path.join(DIR, file)).composite([{ input: Buffer.from(`<svg width="${w}" height="${h}">${boxes}</svg>`) }]).toFile(out)
  console.log(found.map((p) => `${p.index}: ${p.x1 - p.x0}×${p.y1 - p.y0} at ${p.x0},${p.y0}`).join("\n"))
}

/** hue 0..360, saturation and lightness 0..1 of an [r, g, b]. */
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

/**
 * The model drifts on eye color, and on a sprite a green eye is two pixels. `eyes` in the manifest is the color she must
 * have: any green or teal palette color (hue 70 to 200, clearly saturated) is replaced by that color at its own
 * lightness. Her outfit has no green or blue, so nothing else is touched; a person who wears green leaves this unset.
 */
function recolor(colors, eyes) {
  if (!eyes) return colors
  const n = parseInt(eyes.slice(1), 16)
  const [th, ts] = hsl([(n >> 16) & 255, (n >> 8) & 255, n & 255])
  return colors.map((c) => {
    const [h, s, l] = hsl(c)
    if (h < 70 || h > 200 || s < 0.18) return c
    const ls = Math.min(0.9, Math.max(0.08, l))
    const q = ls < 0.5 ? ls * (1 + ts) : ls + ts - ls * ts
    const p = 2 * ls - q
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p }
    const hh = th / 360
    return [f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255]
  })
}

const hexOf = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`
const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11

/** k-means over figure pixels, seeded from luminance quantiles so the same input always gives the same palette. */
function palette(samples, k) {
  const sorted = [...samples].sort((a, b) => lum(a) - lum(b))
  let cs = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)].slice())
  for (let it = 0; it < 14; it++) {
    const sum = cs.map(() => [0, 0, 0, 0])
    for (const p of samples) {
      let b = 0
      let bd = Infinity
      for (let i = 0; i < k; i++) {
        const d = (p[0] - cs[i][0]) ** 2 + (p[1] - cs[i][1]) ** 2 + (p[2] - cs[i][2]) ** 2
        if (d < bd) ((bd = d), (b = i))
      }
      sum[b][0] += p[0]; sum[b][1] += p[1]; sum[b][2] += p[2]; sum[b][3]++
    }
    cs = cs.map((c, i) => (sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : c))
  }
  return cs.sort((a, b) => lum(a) - lum(b))
}

async function snapAll(preview) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"))
  const out = {}
  for (const [id, entry] of Object.entries(manifest)) {
    const views = {}
    const samples = []
    for (const [view, src] of Object.entries(entry.views)) {
      const img = await load(src.file)
      const mask = figureMask(img.rgba, img.w, img.h, src.tol ?? 60, { shadow: !!src.shadow })
      const part = parts(mask, img.w, img.h)[src.part]
      if (!part) throw new Error(`${id} ${view}: ${src.file} has no figure #${src.part}`)
      views[view] = { img, part, src }
      for (let y = part.y0; y <= part.y1; y += 2) for (let x = part.x0; x <= part.x1; x += 2) if (part.label[y * img.w + x] === part.id) samples.push([img.rgba[(y * img.w + x) * 4], img.rgba[(y * img.w + x) * 4 + 1], img.rgba[(y * img.w + x) * 4 + 2]])
    }
    const colors = recolor(palette(samples, K), entry.eyes)
    const pal = {}
    colors.forEach((c, i) => (pal[String.fromCharCode(0x200 + i)] = hexOf(c)))
    const dark = Object.keys(pal).filter((l) => lum(colors[l.charCodeAt(0) - 0x200]) < 70).join("")
    const grids = {}
    for (const [view, v] of Object.entries(views)) {
      const rows = snapPart(v.img.rgba, v.img.w, v.part, pal, entry.height ?? 28, { dark, darkShare: v.src.darkShare ?? 0.35 })
      // `place` outlines in "k"; the game's plum outline is added to the palette below
      grids[view] = place(rows, { flip: !!v.src.flip })
    }
    out[id] = { from: entry.from, palette: { ...pal, k: "#2b1d2e" }, ...grids }
  }
  const body = Object.entries(out)
    .map(([id, e]) => {
      const g = (v) => `    ${v}: [\n${e[v].map((r) => `      ${JSON.stringify(r)},`).join("\n")}\n    ],`
      return `  ${JSON.stringify(id)}: {\n    palette: ${JSON.stringify(e.palette)},\n${["front", "side", "back"].map(g).join("\n")}\n  },`
    })
    .join("\n")
  const from = Object.entries(out).map(([id, e]) => ` * - ${id}: ${e.from}`).join("\n")
  fs.writeFileSync(OUT, `/**\n * lib/baby-game/people/gen-people.ts — GENERATED by scripts/baby-snap-person.mjs from gen-people.json. Do not edit.\n *\n * People drawn from liked ComfyUI generations, snapped to 32×32 letter grids with a palette of their own.\n${from}\n */\n\nexport type GenPerson = { palette: Record<string, string>; front: string[]; side: string[]; back: string[] }\n\nexport const GEN_PEOPLE: Record<string, GenPerson> = {\n${body}\n}\n`)
  console.log(`wrote ${path.relative(ROOT, OUT)} (${Object.keys(out).join(", ")})`)
  if (preview) {
    const Z = 8
    const ids = Object.keys(out)
    const W = 3 * 32 * Z
    const H = ids.length * 32 * Z
    const buf = Buffer.alloc(W * H * 3, 0xc8)
    ids.forEach((id, row) => ["front", "side", "back"].forEach((v, col) => out[id][v].forEach((line, y) => [...line].forEach((ch, x) => {
      const h = out[id].palette[ch]
      if (!h || ch === ".") return
      const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
      for (let dy = 0; dy < Z; dy++) for (let dx = 0; dx < Z; dx++) buf.set(c, (((row * 32 + y) * Z + dy) * W + (col * 32 + x) * Z + dx) * 3)
    }))))
    await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(preview)
    console.log(`preview ${preview}`)
  }
}

const args = process.argv.slice(2)
if (args[0] === "--parts") await numberParts(args[1], args[2] ?? "parts.png")
else await snapAll(args[0])
