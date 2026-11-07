#!/usr/bin/env node
/**
 * scripts/baby-flora-queue.mjs — Queue the Baby animal game's plants in ComfyUI, one plant per picture, round by round
 *
 * The ground of Valdivia grows small plants (`components/BabyGame/flora.ts`). Each kind is one entry here, drawn with the liked
 * setup (SDXL + pixel-art-xl at 1.2, `graph` from `baby-gens-queue.mjs`). Outputs land in the ComfyUI output folder as
 * `flora-<id>_NNNNN_.png`, or `flora-r<ROUND>-<id>_NNNNN_.png` when `ROUND` is set; `scripts/baby-flora-snap.mts` snaps the liked
 * ones (else the newest) into `lib/baby-game/flora-sprites.ts`.
 *
 * Iterating: like or nope the pictures in `/lab/baby-gens` (and say what is off in a note), then queue the next round. `TASTE` below is
 * what the likes so far taught (round 0 came from the liked `plantref-*` photographs: pom-pom flowers, cream and red calathea,
 * silver tufts, violet orchids); change it when a note says something else, and run the next round with `ROUND=2`.
 *
 *   node scripts/baby-flora-queue.mjs                       # every kind, 3 seeds
 *   ROUND=2 SEEDS=4,8 node scripts/baby-flora-queue.mjs daisy poppy
 *   FRONT=1 node scripts/baby-flora-queue.mjs               # jump ComfyUI's queue
 */

import { graph } from "./baby-gens-queue.mjs"

const COMFY = process.env.COMFY_URL || "http://127.0.0.1:8188"
/** Plants are snapped down to under 24 px, so a small canvas is plenty. */
const SIZE = Number(process.env.SIZE || 640)

/** id → [what to draw, zones it grows in (see `FLORA` in `lib/baby-game/flora.ts`)]. Names are the sprite ids. */
export const PLANTS = {
  // meadow and orchard
  daisy: "white daisy with a round buttery centre on a short green stem and two small leaves",
  poppy: "coral red poppy with a dark centre and two round petals, on a thin stem",
  tulip: "plump pink tulip bud with two curled green leaves",
  pompom: "round pink powder-puff flower, a fluffy ball of thin petals, on a short stem with feathery leaves",
  bluebell: "three nodding blue bell flowers on one arching stem",
  clover: "a little patch of three-leaf clover with one white clover flower",
  buttercup: "small cream buttercup with five round petals and green stem",
  lavender: "tuft of lavender with three soft violet flower spikes",
  // woods and shade
  fern: "curled green fern frond unfurling, soft pale green with a round fiddlehead",
  calathea: "prayer plant leaf, cream and bright green feathered stripes with red veins, round leaf",
  mushroom: "little red toadstool with white spots and a tiny second one beside it",
  moss: "round clump of soft green moss with tiny star flowers",
  foxglove: "short foxglove spike of lilac bell flowers with spotted throats",
  // water and marsh
  lilypad: "round green lily pad with one white lily flower with a pink tip",
  cattail: "two cattail reeds with brown fuzzy tops and long green leaves",
  iris: "blue marsh iris flower with three drooping petals and sword shaped leaves",
  glowshroom: "small glowing teal mushroom cluster with pale blue caps",
  // highlands, cove, stacks
  snowdrop: "two white snowdrop flowers hanging from thin green stems with round leaves",
  orchid: "violet moth orchid flower with a white and magenta throat on an arching stem",
  tillandsia: "silver air plant, a round tuft of thin curled silvery leaves",
  // dunes and farm
  cactus: "tiny round green cactus with a small pink flower on top",
  succulent: "grey blue echeveria rosette, plump rounded leaves, with a tiny orange flower",
  dunegrass: "tuft of golden-green dune grass with a few seed heads",
  sprout: "tiny seedling with two round bright leaves",
  berrybush: "small round green bush covered in red berries and a few leaves",
  monstera: "small monstera sapling, one heart shaped dark green leaf with split holes",
}

/** What the likes taught: every plant is rounder, plumper and softer, a few bright colors, a clear dark outline, one plant only. */
const TASTE =
  "cute kawaii chibi plant, round plump shapes, soft rounded leaves, lush and detailed, bright saturated colors with a lighter highlight and a darker shade, tiny sparkles"

const NEGATIVE =
  "blurry, photo, realistic, 3d render, gradient, smooth shading, text, watermark, scenery, landscape, multiple plants, many plants, pattern, tiled, repeating, seamless, wallpaper, grid, rows, collage, pot, flowerpot, pot, vase, person, hands, face, sad, wilted, dead, brown leaves, background pattern, border, frame"

const prompt = (what) => `pixel art icon of exactly one ${what}, alone, isolated, ${TASTE}, game sprite, front view, centered with empty margin all round, flat colors, clean dark outline, plain white background`

const FRONT = Boolean(process.env.FRONT)
const ROUND = process.env.ROUND ? `r${process.env.ROUND}-` : ""

async function queue(p) {
  const res = await fetch(`${COMFY}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p, ...(FRONT ? { front: true } : {}) }) })
  if (!res.ok) throw new Error(`ComfyUI ${res.status}: ${await res.text()}`)
  return (await res.json()).prompt_id
}

async function main() {
  let ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PLANTS)
  if (FRONT) ids = [...ids].reverse()
  const seeds = (process.env.SEEDS || "5,17,29").split(",").map(Number)
  for (const id of ids) {
    const what = PLANTS[id]
    if (!what) throw new Error(`no plant "${id}"; known: ${Object.keys(PLANTS).join(", ")}`)
    for (const seed of seeds) {
      const g = graph(prompt(what), NEGATIVE, seed, `flora-${ROUND}${id}`)
      g[6].inputs.width = g[6].inputs.height = SIZE
      console.log(`${id} seed ${seed}:`, await queue(g))
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => (console.error(e.message), process.exit(1)))
