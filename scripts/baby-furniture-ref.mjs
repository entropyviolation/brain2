#!/usr/bin/env node
/**
 * scripts/baby-furniture-ref.mjs — Redraw each piece of furniture from its own reference picture (image to image)
 *
 * `baby-furniture-queue.mjs` draws from words alone. This one hands ComfyUI the actual photo from `homedesignref/images/` that
 * the piece comes from (`REFS`: furniture id → picture number), encodes it, and denoises it ~72% into pixel art with the same
 * prompt, so shape, colour and trim follow the board. Outputs are `furnref-<id>_NNNNN_.png`; `baby-furniture-snap.mts` prefers
 * them over the text-only `furn-` ones.
 *
 *   FRONT=1 node scripts/baby-furniture-ref.mjs [ids...]     DENOISE=0.65 to stay closer to the photo
 */

import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { graph } from "./baby-gens-queue.mjs"
import { FURNITURE } from "./baby-furniture-queue.mjs"

const COMFY = process.env.COMFY_URL || "http://127.0.0.1:8188"
const DENOISE = Number(process.env.DENOISE || 0.72)
const FRONT = Boolean(process.env.FRONT)
const IMAGES = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../homedesignref/images")

export const REFS = {
  "sofa-sage": 47, "sofa-cloud": 77, "sofa-leather": 70, "sofa-black": 107, "pouf-chrome": 109, "table-glass": 167, "table-hand": 84,
  "table-marble": 21, "table-dining": 73, "chair-chrome": 103, "chair-heart": 260, "chair-green": 260, "cabinet-lacquer": 116,
  "screen-silver": 26, "screen-mirror": 120, "vanity-round": 51, "vanity-swirl": 148, "lamp-mushroom": 82, "lamp-dome": 79,
  "lamp-saturn": 189, "lamp-spheres": 94, "lamp-fringe": 96, "lamp-nouveau": 146, "lamp-tulip": 40, "lamp-lava": 169,
  "pendant-opal": 134, "chandelier-green": 81, "curtain-beads": 39, "curtain-capiz": 112, "curtain-plum": 95, "bed-canopy": 159,
  "shelf-organic": 196, "shelf-ladder": 75, "record-player": 190, "trolley": 202, "dice-tables": 199, "dresser-chrome": 144,
  "mirror-orchid": 141, "vase-lily": 208, "candles-carved": 91, "hammock-net": 55, "plant-kentia": 233, "plant-ivy": 43,
  "fireplace-egg": 50, "sink-checker": 52, "bath-tub": 53, "speakers-orb": 128, "daybed-red": 231, "chest-iron": 66, "statue-angel": 192,
}

const NEGATIVE = "blurry, photo, realistic, 3d render, gradient, smooth shading, text, watermark, room, interior, scenery, multiple objects, collage, people, hands, text"

async function upload(id, n) {
  const file = fs.readdirSync(IMAGES).find((f) => f.startsWith(String(n).padStart(4, "0") + "-"))
  const buf = await sharp(path.join(IMAGES, file)).resize(576, 576, { fit: "contain", background: "#ffffff" }).png().toBuffer()
  const form = new FormData()
  form.append("image", new Blob([buf], { type: "image/png" }), `furnref-${id}.png`)
  form.append("overwrite", "true")
  const res = await fetch(`${COMFY}/upload/image`, { method: "POST", body: form })
  if (!res.ok) throw new Error(`upload ${res.status}`)
  return (await res.json()).name
}

async function main() {
  let ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(REFS)
  if (FRONT) ids = [...ids].reverse()
  for (const id of ids) {
    const [what, view] = FURNITURE[id]
    const name = await upload(id, REFS[id])
    const g = graph(`pixel art, one single ${what}, game furniture sprite, ${view} view, centered, detailed, flat colors, clean dark outline, plain white background`, NEGATIVE, 7, `furnref-${id}`)
    g[10] = { class_type: "LoadImage", inputs: { image: name } }
    g[11] = { class_type: "VAEEncode", inputs: { pixels: ["10", 0], vae: ["3", 0] } }
    g[7].inputs.latent_image = ["11", 0]
    g[7].inputs.denoise = DENOISE
    const res = await fetch(`${COMFY}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: g, ...(FRONT ? { front: true } : {}) }) })
    if (!res.ok) throw new Error(`ComfyUI ${res.status}: ${(await res.text()).slice(0, 300)}`)
    console.log(id, "ref", REFS[id], (await res.json()).prompt_id)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => (console.error(e.message), process.exit(1)))
