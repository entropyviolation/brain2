#!/usr/bin/env node
/**
 * scripts/baby-furniture-queue.mjs — Queue the cottage's furniture in ComfyUI, one object per picture
 *
 * The inside of the cottage is furnished from `homedesignref/` (a Pinterest board, "future home"): curved sage sofas, chrome and
 * glass, black lacquer cabinets, mushroom lamps, bead curtains, sculpted plaster. Each entry is one object to draw, the same
 * setup the animals use (SDXL + pixel-art-xl at 1.2, `graph` from `baby-gens-queue.mjs`). Outputs land in the ComfyUI output
 * folder as `furn-<id>_NNNNN_.png`; `scripts/baby-furniture-snap.mts` turns the chosen ones into `lib/baby-game/furniture-sprites.ts`.
 *
 *   node scripts/baby-furniture-queue.mjs                    # every item, one seed
 *   node scripts/baby-furniture-queue.mjs sofa-sage lamp-mushroom
 *   SEEDS=3,9,27 node scripts/baby-furniture-queue.mjs sofa-sage
 */

import { graph } from "./baby-gens-queue.mjs"

const COMFY = process.env.COMFY_URL || "http://127.0.0.1:8188"
/** Objects are snapped down to under 64 px, so a smaller canvas than the animals' 768² is plenty (and ~2× faster). */
const SIZE = Number(process.env.SIZE || 576)

/** id → [what to draw, which view]. `side` objects stand on the floor, `front` ones hang on a wall or face you. */
export const FURNITURE = {
  "sofa-sage": ["curved sage green velvet sofa with round arms and soft cushions", "front"],
  "sofa-cloud": ["cloud shaped white boucle fluffy modular sofa", "front"],
  "sofa-leather": ["low chunky brown leather sofa with two plump cushions", "front"],
  "sofa-black": ["black tufted leather corner armchair on a polished steel base", "front"],
  "pouf-chrome": ["silver quilted chrome pouf, a puffy metallic cushion", "front"],
  "table-glass": ["round glass coffee table with a curled chrome wire base", "front"],
  "table-hand": ["sculpted white plaster table shaped like an open hand holding a glass top", "front"],
  "table-marble": ["round marble pedestal side table with a candle and a small black box on top", "front"],
  "table-dining": ["round smoked glass dining table with cream curved chairs around it", "front"],
  "chair-chrome": ["chrome tubular armchair with a cream cushion seat", "front"],
  "chair-heart": ["victorian chair with a heart shaped back in red velvet and a white wooden frame", "front"],
  "chair-green": ["round back tufted green velvet chair with dark wooden legs", "front"],
  "cabinet-lacquer": ["tall black lacquer chinese cabinet painted with flowers and birds, two doors", "front"],
  "screen-silver": ["four panel folding screen of silver leaf painted with branches", "front"],
  "screen-mirror": ["three panel folding screen with carved wooden frame and mirrors", "front"],
  "vanity-round": ["cream vanity table with a round mirror, two drawers and a pink cushion stool", "front"],
  "vanity-swirl": ["white sculpted swirl vanity with an oval mirror reflecting clouds and rounded drawers", "front"],
  "lamp-mushroom": ["brown mushroom dome table lamp on a brass stem, glowing", "front"],
  "lamp-dome": ["tall cream dome floor lamp with a thin black arched stem", "front"],
  "lamp-saturn": ["white glass globe table lamp with a ring like planet saturn on a black base", "front"],
  "lamp-spheres": ["tall floor lamp made of stacked silver chrome spheres and white glowing globes", "front"],
  "lamp-fringe": ["victorian table lamp with a black beaded fringe shade and carved stem", "front"],
  "lamp-nouveau": ["art nouveau bronze lady table lamp holding a glowing pearly seashell", "front"],
  "lamp-tulip": ["tiffany table lamp with two blue glass tulip shades on twisting dark stems", "front"],
  "lamp-lava": ["lava lamp with white glowing blobs in clear glass", "front"],
  "pendant-opal": ["opalescent blue white glass jellyfish pendant lamp hanging from a cord", "front"],
  "chandelier-green": ["round chandelier of green glass discs around a frosted glass bowl, hanging from a chain", "front"],
  "curtain-beads": ["hanging curtain of colourful stained glass beads on chains, red blue green orange", "front"],
  "curtain-capiz": ["hanging curtain of white mother of pearl capiz shells on strings", "front"],
  "curtain-plum": ["pair of plum purple sheer curtains tied back, long drapes", "front"],
  "bed-canopy": ["canopy bed with pale pink gauze mosquito net and cream linen", "front"],
  "bed-iron": ["wrought iron bed with a patchwork quilt and many pillows", "front"],
  "bed-sage": ["bed with a crown canopy and sage green silk drapes", "front"],
  "shelf-organic": ["tall wooden bookcase with curving organic oval cut shelves in honey wood, filled with books", "front"],
  "shelf-green": ["floating curved green shelf with books, a mug and two small plants", "front"],
  "shelf-ladder": ["tall white ladder shaped bookshelf leaning on a wall with books", "front"],
  "record-player": ["retro round turntable record player with a smoked glass dome lid", "front"],
  "trolley": ["cream plastic rolling trolley cart with magazines and a drink", "front"],
  "dice-tables": ["two white dice shaped cube side tables with black dots", "front"],
  "dresser-chrome": ["black art deco dresser with chrome drawer fronts", "front"],
  "cabinet-steel": ["steel office filing cabinet with five drawers and chrome handles", "front"],
  "mirror-orchid": ["small wall mirror shaped like an orchid flower, silver", "front"],
  "vase-lily": ["clear glass vase with green stems and white lily of the valley glass flowers", "front"],
  "candles-carved": ["two carved cream wax pillar candles with scrollwork, flames lit", "front"],
  "hammock-net": ["green knotted net hammock hung from the ceiling with a sleeping figure", "front"],
  "plant-kentia": ["tall kentia palm in a big terracotta pot", "front"],
  "plant-ivy": ["hanging pot with long trailing ivy vines", "front"],
  "fireplace-egg": ["sculpted white plaster egg shaped fireplace with a dark opening and a wavy shelf", "front"],
  "sink-checker": ["stone sink basin sunk into a counter with a black and white checkerboard bottom and a silver tap", "front"],
  "bath-tub": ["curvy sculpted plaster bathtub with a silver tap, full of water", "front"],
  "speakers-orb": ["two black orb speakers on slim chrome stands", "front"],
  "daybed-red": ["red velvet daybed sofa with many cushions and a sheer curtain canopy", "front"],
  "chest-iron": ["small round dressing case, orange leather lid open to a mirror, full of perfume bottles", "front"],
  "statue-angel": ["pale stone angel statue lamp with two glowing tulip shades", "front"],
}

const NEGATIVE =
  "blurry, photo, realistic, 3d render, gradient, smooth shading, text, watermark, room, interior, floor, scenery, multiple objects, collage, background, people, hands, text"

const prompt = (what, view) => `pixel art, one single ${what}, game furniture sprite, ${view} view, centered, detailed, flat colors, clean dark outline, plain white background`

/** `FRONT=1` puts each job at the front of ComfyUI's queue (the log's other batches wait); ids are walked backwards so they still run in order. */
const FRONT = Boolean(process.env.FRONT)

async function queue(p) {
  const res = await fetch(`${COMFY}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p, ...(FRONT ? { front: true } : {}) }) })
  if (!res.ok) throw new Error(`ComfyUI ${res.status}: ${await res.text()}`)
  return (await res.json()).prompt_id
}

async function main() {
  let ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FURNITURE)
  if (FRONT) ids = [...ids].reverse()
  const seeds = (process.env.SEEDS || "5").split(",").map(Number)
  for (const id of ids) {
    const spec = FURNITURE[id]
    if (!spec) throw new Error(`no item "${id}"; known: ${Object.keys(FURNITURE).join(", ")}`)
    for (const seed of seeds) {
      const g = graph(prompt(spec[0], spec[1]), NEGATIVE, seed, `furn-${id}`)
      g[6].inputs.width = g[6].inputs.height = SIZE
      console.log(`${id} seed ${seed}:`, await queue(g))
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => (console.error(e.message), process.exit(1)))
