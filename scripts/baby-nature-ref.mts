/**
 * scripts/baby-nature-ref.mts — Shells and plants for the Baby animal game, redrawn from real photographs (image to image)
 *
 *   npx tsx scripts/baby-nature-ref.mts [shells|orbs|items|plants] [ids...]     COMFY_URL, DENOISE, FRONT=1 like `baby-furniture-ref.mjs`
 *
 * The photographs are in `naturerefs/images/`, each with its Wikimedia Commons page and licence in `naturerefs/sources.json`.
 * Three kinds of job, all with the liked SDXL + pixel-art-xl graph from `baby-gens-queue.mjs`:
 *   shells  the photo, denoised ~70% into a pixel art shell          → `shellref-<id>_NNNNN_.png`
 *   orbs    the game's own 8×8 orb trinket icon (`SHAPES`, in the shell's tones) blown up as the starting image, with the
 *           shell named in the prompt, so the shell keeps the glossy orb silhouette the friend panel already shows
 *                                                                      → `shellorb-<id>_NNNNN_.png`

 *   items   every material, trinket and crop in `items.ts`, each from its own 8×8 icon in its own tones, named and described
 *           in the prompt (one seed) → `itemorb-<id>_NNNNN_.png`
 *   plants  the photo, denoised ~70% into a pixel art plant            → `plantref-<id>_NNNNN_.png`
 * Like or nope the results in `/lab/baby-gens`.
 */

import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { graph } from "./baby-gens-queue.mjs"
import { ITEMS, SHAPES } from "../lib/baby-game/items"
import { SPRITE_PALETTE } from "../lib/baby-game/sprites"

const COMFY = process.env.COMFY_URL || "http://127.0.0.1:8188"
const DENOISE = Number(process.env.DENOISE || 0.7)
const FRONT = Boolean(process.env.FRONT)
const IMAGES = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../naturerefs/images")

/** A crop of the photo as fractions (x, y, w, h), for photos that hold several views. */
type Ref = { what: string; crop?: [number, number, number, number] }

export const SHELLS: Record<string, Ref> = {
  "shell-abalone": { what: "abalone shell, iridescent mother of pearl in teal, violet and rose, with a row of round holes" },
  "shell-cone": { what: "cone shell with a tan and cream net pattern of small patches" },
  "shell-cowrie": { what: "tiger cowrie shell, glossy, cream with dark brown spots and a narrow toothed opening" },
  "shell-nautilus": { what: "nautilus shell, a smooth spiral with brown and cream stripes" },
  "shell-turbo": { what: "turban snail shell with a green and brown speckled spire and a pearly opening" },
  "shell-wentletrap": { what: "wentletrap shell, white and cream, tall with raised rib rings" },
  "shell-scallop": { what: "scallop shell, a fan with ridges, cream and pale peach", crop: [0.02, 0.08, 0.31, 0.64] },
  "shell-spondylus": { what: "spiny oyster shell with coral pink and white spines", crop: [0.03, 0.09, 0.27, 0.65] },
}

export const PLANTS: Record<string, Ref> = {
  "plant-calathea": { what: "prayer plant leaf with bright green and cream feathered stripes and a deep red stem" },
  "plant-echeveria": { what: "grey-blue echeveria succulent rosette with orange bell flowers on a stalk" },
  "plant-fern": { what: "maidenhair fern, tiny round leaflets on wiry black stems, soft green" },
  "plant-mimosa": { what: "sensitive plant with two round pink powder-puff flowers and fine feathery leaves" },
  "plant-monstera": { what: "monstera leaf, deep green, split and holed, with pale veins" },
  "plant-orchid": { what: "violet moth orchid flower with a white and magenta throat, on a stem" },
  "plant-tillandsia": { what: "silver air plant, a tuft of thin curled silvery leaves" },
  "plant-waterlily": { what: "white water lily flower with pointed petals, a pink one beside it, floating on round green pads" },
}

/** Orb trinkets from `items.ts` to start from, with light, main and dark tones to match the shell. */
const ORBS: Record<string, { shape: string; tones: [string, string, string] }> = {
  "shell-abalone": { shape: "swirl", tones: ["v", "V", "x"] },
  "shell-cone": { shape: "gem", tones: ["t", "T", "u"] },
  "shell-cowrie": { shape: "bulb", tones: ["w", "s", "S"] },
  "shell-nautilus": { shape: "swirl", tones: ["o", "O", "Q"] },
  "shell-turbo": { shape: "round", tones: ["g", "G", "h"] },
  "shell-wentletrap": { shape: "mandala", tones: ["w", "s", "S"] },
  "shell-scallop": { shape: "flicker", tones: ["o", "O", "Q"] },
  "shell-spondylus": { shape: "gem", tones: ["p", "P", "q"] },
}

const NEGATIVE =
  "blurry, photo, realistic, 3d render, gradient, smooth shading, text, watermark, label, table, hands, people, multiple objects, collage, background scenery, yellow, golden, extra parts, cropped"

const shellPrompt = (what: string) =>
  `pixel art, one single ${what}, game item sprite, detailed shading, glossy highlights, centered, clean dark outline, plain white background`
const orbPrompt = (what: string) =>
  `pixel art, one single glossy round orb trinket shaped like a ${what}, game item sprite, bright highlight, centered, clean dark outline, plain white background`
const itemPrompt = (name: string, blurb: string) =>
  `pixel art, one single ${name} (${blurb}), glossy orb-like game item sprite, round shape, bright highlight, detailed shading, centered, clean dark outline, plain white background`
const plantPrompt = (what: string) =>
  `pixel art, one single ${what}, beautiful detailed garden plant sprite, layered shading, crisp leaves, centered, clean dark outline, plain white background`

async function upload(name: string, buf: Buffer): Promise<string> {
  const form = new FormData()
  form.append("image", new Blob([buf], { type: "image/png" }), `${name}.png`)
  form.append("overwrite", "true")
  const res = await fetch(`${COMFY}/upload/image`, { method: "POST", body: form })
  if (!res.ok) throw new Error(`upload ${res.status}`)
  return ((await res.json()) as { name: string }).name
}

async function photo(id: string, ref: Ref) {
  let img = sharp(path.join(IMAGES, `${id}.jpg`))
  if (ref.crop) {
    const { width = 0, height = 0 } = await img.metadata()
    const [x, y, w, h] = ref.crop
    img = img.extract({ left: Math.round(x * width), top: Math.round(y * height), width: Math.round(w * width), height: Math.round(h * height) })
  }
  return img.resize(576, 576, { fit: "contain", background: "#ffffff" }).png().toBuffer()
}

/** The 8×8 trinket icon as a big flat image: no antialiasing, so the 8×8 grid survives the encoder. */
async function orbIcon(shape: string, tones: readonly [string, string, string]) {
  const rows = SHAPES[shape]!.map((r) => r.replace(/L/g, tones[0]).replace(/M/g, tones[1]).replace(/D/g, tones[2]))
  const px = Buffer.alloc(8 * 8 * 3, 255)
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const hex = SPRITE_PALETTE[ch]
      if (hex) [1, 3, 5].forEach((i, c) => (px[(y * 8 + x) * 3 + c] = parseInt(hex.slice(i, i + 2), 16)))
    }),
  )
  return sharp(px, { raw: { width: 8, height: 8, channels: 3 } }).resize(576, 576, { kernel: "nearest", fit: "contain", background: "#ffffff" }).png().toBuffer()
}

async function job(prefix: string, imageName: string, positive: string, seed: number, denoise: number) {
  const g = graph(positive, NEGATIVE, seed, prefix) as Record<string, { class_type: string; inputs: Record<string, unknown> }>
  g[10] = { class_type: "LoadImage", inputs: { image: imageName } }
  g[11] = { class_type: "VAEEncode", inputs: { pixels: ["10", 0], vae: ["3", 0] } }
  g[7]!.inputs.latent_image = ["11", 0]
  g[7]!.inputs.denoise = denoise
  const res = await fetch(`${COMFY}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: g, ...(FRONT ? { front: true } : {}) }) })
  if (!res.ok) throw new Error(`ComfyUI ${res.status}: ${(await res.text()).slice(0, 300)}`)
  console.log(prefix, "seed", seed, (await res.json() as { prompt_id: string }).prompt_id)
}

async function main() {
  const [kind = "all", ...only] = process.argv.slice(2)
  const want = (id: string) => !only.length || only.includes(id)
  if (kind === "all" || kind === "shells")
    for (const [id, ref] of Object.entries(SHELLS).filter(([id]) => want(id))) {
      const name = await upload(`natref-${id}`, await photo(id, ref))
      for (const seed of [7, 19]) await job(`shellref-${id.slice(6)}`, name, shellPrompt(ref.what), seed, DENOISE)
    }
  if (kind === "all" || kind === "orbs")
    for (const [id, ref] of Object.entries(SHELLS).filter(([id]) => want(id))) {
      const name = await upload(`natorb-${id}`, await orbIcon(ORBS[id]!.shape, ORBS[id]!.tones))
      for (const seed of [7, 19]) await job(`shellorb-${id.slice(6)}`, name, orbPrompt(ref.what), seed, 0.82)
    }
  if (kind === "items")
    for (const def of Object.values(ITEMS).filter((d) => d.kind !== "seed" && want(d.id))) {
      const name = await upload(`natitem-${def.id}`, await orbIcon(def.shape, def.tones))
      await job(`itemorb-${def.id}`, name, itemPrompt(def.name, def.blurb), 7, 0.8)
    }
  if (kind === "all" || kind === "plants")
    for (const [id, ref] of Object.entries(PLANTS).filter(([id]) => want(id))) {
      const name = await upload(`natref-${id}`, await photo(id, ref))
      for (const seed of [7, 19, 31]) await job(`plantref-${id.slice(6)}`, name, plantPrompt(ref.what), seed, DENOISE)
    }
}

main().catch((e) => (console.error(e.message), process.exit(1)))
