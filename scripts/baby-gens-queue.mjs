#!/usr/bin/env node
/**
 * scripts/baby-gens-queue.mjs — Queue baby animal sprites in ComfyUI with the setup the generation log likes best
 *
 * The liked setup (`/lab/baby-gens`, 2026-11-02): SDXL base + pixel-art-xl at 1.2, cfg 7, euler, 22 steps, 768², and two
 * prompt shapes, "one single cute ..." and "character turnaround sheet of a cute ...". Each subject is queued as singles
 * (one per seed) and one turnaround sheet. Outputs land in the ComfyUI output folder as `sprite-<id>_NNNNN_.png`, so the log
 * shows them with their recipe and you can like or nope them there.
 *
 *   node scripts/baby-gens-queue.mjs                 # the default batch below
 *   node scripts/baby-gens-queue.mjs meerkat lizard  # only these ids
 *
 * `COMFY_URL` overrides `http://127.0.0.1:8188`.
 */

const COMFY = process.env.COMFY_URL || "http://127.0.0.1:8188"

/** id → what to draw. Detailed, baby-sized, one animal. */
export const SUBJECTS = {
  possum: "baby opossum joey with soft grey fur, white face, pink nose, pink round ears and a pink tail",
  meerkat: "baby meerkat pup with sandy tan fur, dark eye patches and a thin tail, standing up",
  "kitten-orange": "little orange tabby kitten with big green eyes",
  "kitten-black": "little black kitten with big yellow-green eyes and a pink nose",
  "kitten-calico": "little calico kitten with white, orange and black patches",
  "puppy-golden": "fluffy golden retriever puppy with floppy ears",
  "puppy-corgi": "corgi puppy with orange and white fur and big ears",
  squirrel: "baby red squirrel with a big bushy tail and tufted ears",
  lizard: "baby green gecko lizard with big round eyes and a curled tail",
  hedgehog: "baby hedgehog with soft brown spines and a pink face",
  "red-panda": "baby red panda with a striped ringed tail",
  fennec: "baby fennec fox with huge ears and cream fur",
  raccoon: "baby raccoon with a striped tail and black mask",
  // Second batch (2026-11-03): cute, obscure and realistic. Each prompt names the real markings so the model stays anatomical.
  otter: "baby sea otter pup with dark brown fur, a cream face, small round ears, whiskers and webbed feet",
  "giant-panda": "giant panda cub with black ears, black eye patches, black legs and a fluffy white body",
  "kitten-siamese": "little siamese kitten with cream fur, dark brown face mask, ears, paws and tail, and blue eyes",
  "kitten-grey": "little grey tabby kitten with darker stripes, white paws and pale green eyes",
  hyrax: "baby rock hyrax dassie pup with short round brown-grey fur, tiny rounded ears, no visible tail, stubby legs and a pale belly",
  quokka: "baby quokka with round brown-grey fur, a short rounded nose, small round ears and a smiling face",
  pika: "baby pika with a round fluffy body, tiny round ears, no visible tail and soft grey-brown fur",
  "dik-dik": "baby dik-dik antelope fawn with slender legs, a tan coat, large dark eyes and a long soft pointed nose",
  "sugar-glider": "baby sugar glider with soft blue-grey fur, a black stripe down its back, huge dark eyes, big pale ears and a bushy tail",
  pangolin: "baby pangolin with overlapping brown scales on its back, a pale pink belly, a small pointed face and a thick tail",
  dormouse: "baby hazel dormouse with golden orange fur, big black eyes, small round ears and a fluffy tail",
  tarsier: "baby tarsier with enormous round eyes, soft grey-brown fur, long thin fingers and a thin tail",
  // Redesign batch (2026-11-03): Pilgrim, Daria and Vonnegut. Short, round, chunky bodies so side and front match; no yellow.
  "redesign-bunny": "baby bunny kit with soft cream-white and light grey fur, long floppy ears with pink insides, a pink nose, small sleepy eyes, a round chubby body and a tiny round cotton tail",
  "redesign-fawn": "baby fawn with warm brown fur, a few small white spots, big round friendly dark eyes with white highlights, a small dark nose, short stubby legs, a short chubby body and small rounded ears",
  "redesign-wolf": "baby wolf pup with fluffy grey and cream fur, a big round head, small pointed ears, a short snout, big paws, a short chubby body and a small fluffy tail, gentle dark eyes",
}

/** Ids from the second batch: three singles and two sheets each, with the glitch guards. */
const SECOND = ["otter", "giant-panda", "kitten-siamese", "kitten-grey", "hyrax", "quokka", "pika", "dik-dik", "sugar-glider", "pangolin", "dormouse", "tarsier"]

/**
 * People (2026-11-02): village-sim villagers in the manner of Stardew Valley and Pacha. Same graph and LoRA as the animals;
 * the prompt asks for chibi proportions and real clothes. `person-*` ids use `human()` and `humanSheet()` below.
 */
export const PEOPLE = {
  "person-center": "pixie fairy girl, pale skin, brown eyes, strawberry blonde wavy hair, small pointed ears, a black corset over a black blouse, black layered skirt, black and grey scarves, a silver chain belt with silver o rings, white go-go boots",
  "person-baker": "friendly village baker woman, chestnut bun, white apron over a mustard blouse, long green skirt, brown shoes",
  "person-fisher": "old fisherman with a white beard, yellow rain hat, navy sweater, rolled grey trousers, tall rubber boots",
  "person-kid": "small village boy with messy blond hair, red striped t-shirt, green shorts, sneakers",
  "person-teacher": "young teacher with round glasses, black bob haircut, lavender cardigan over a white shirt, plum pleated skirt, flat shoes",
}

/** Glitch guards for the second batch: the usual SDXL failures in small animals. */
const GLITCH = "deformed, extra legs, extra limbs, extra tail, extra ears, extra eyes, asymmetrical face, cropped, cut off, floating parts, human hands, "

const NEGATIVE =
  "blurry, photo, realistic, 3d render, gradient, smooth shading, text, watermark, background scenery, multiple characters, sprite sheet, multiple views, collage, background, text"
const SHEET_NEGATIVE = "blurry, photo, realistic, 3d render, gradient, smooth shading, text, watermark, background scenery, multiple characters, collage"

const single = (what) => `pixel art, one single cute fluffy ${what}, detailed, full body, centered, flat colors, clean outline, plain white background`
const sheet = (what) =>
  `pixel art character turnaround sheet of a cute fluffy ${what}, detailed, four views: front, side, back, three-quarter, flat colors, clean outline, plain white background`

const human = (what) =>
  `pixel art, stardew valley style villager character sprite, ${what}, chibi proportions, big head, small body, full body, standing, facing the viewer, 16-bit farming game, detailed shading, dark outline, plain white background`
const humanSheet = (what) =>
  `pixel art, stardew valley style character sheet, ${what}, chibi proportions, three views in a row: front, side, back, full body, 16-bit farming game, dark outline, plain white background`
const HUMAN_NEGATIVE = `${NEGATIVE}, realistic, anime, 3d, blurry, extra limbs, cropped, text`

/** The liked graph (sprite_00032_.png), with the prompt, seed and file prefix filled in. */
export function graph(positive, negative, seed, prefix) {
  return {
    1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "sd_xl_base_1.0.safetensors" } },
    2: { class_type: "LoraLoader", inputs: { model: ["1", 0], clip: ["1", 1], lora_name: "pixel-art-xl.safetensors", strength_model: 1.2, strength_clip: 1.0 } },
    3: { class_type: "VAELoader", inputs: { vae_name: "sdxl.vae.safetensors" } },
    4: { class_type: "CLIPTextEncode", inputs: { clip: ["2", 1], text: positive } },
    5: { class_type: "CLIPTextEncode", inputs: { clip: ["2", 1], text: negative } },
    6: { class_type: "EmptyLatentImage", inputs: { width: 768, height: 768, batch_size: 1 } },
    7: {
      class_type: "KSampler",
      inputs: { model: ["2", 0], positive: ["4", 0], negative: ["5", 0], latent_image: ["6", 0], seed, steps: 22, cfg: 7.0, sampler_name: "euler", scheduler: "normal", denoise: 1.0 },
    },
    8: { class_type: "VAEDecode", inputs: { samples: ["7", 0], vae: ["3", 0] } },
    9: { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: prefix } },
  }
}

async function queue(prompt, front = false) {
  const res = await fetch(`${COMFY}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, front }) })
  if (!res.ok) throw new Error(`ComfyUI ${res.status}: ${await res.text()}`)
  return (await res.json()).prompt_id
}

/**
 * Chibi pass for people (2026-11-03): a 28-row sprite needs a big head to keep a face. `person-center-chibi` asks for Stardew
 * proportions from text alone and, from `center-a.png` in the ComfyUI input folder (the liked tall render), by img2img.
 */
const CHIBI_WHAT =
  "pixie fairy girl, big head and small body, pale skin, (big dark brown eyes:1.5), long wavy strawberry blonde hair, small pointed ears, black corset with straps, black layered short skirt, grey scarf tied at the waist, silver chain belt with silver o rings, white go-go boots"
const CHIBI_NEGATIVE = (extra) => `${extra}, green eyes, blue eyes, teal eyes, hazel eyes`
const chibi = (what) =>
  `pixel art, stardew valley villager sprite, ${what}, chibi proportions, head is a third of the height, big eyes, small hands, full body, standing, facing the viewer, 16-bit farming game, detailed shading, dark outline, plain white background`

function img2img(positive, negative, seed, prefix, denoise) {
  const g = graph(positive, negative, seed, prefix)
  g[10] = { class_type: "LoadImage", inputs: { image: "center-a.png" } }
  g[11] = { class_type: "ImageScale", inputs: { image: ["10", 0], upscale_method: "nearest-exact", width: 768, height: 768, crop: "center" } }
  g[12] = { class_type: "VAEEncode", inputs: { pixels: ["11", 0], vae: ["3", 0] } }
  g[7].inputs.latent_image = ["12", 0]
  g[7].inputs.denoise = denoise
  return g
}

async function chibiBatch() {
  for (const seed of [5, 11, 23, 42, 77, 91]) console.log(`chibi text seed ${seed}:`, await queue(graph(chibi(CHIBI_WHAT), CHIBI_NEGATIVE(HUMAN_NEGATIVE), seed, "sprite-person-chibi"), true))
  for (const [seed, d] of [[5, 0.6], [11, 0.6], [23, 0.72], [42, 0.72]]) console.log(`chibi img2img seed ${seed} denoise ${d}:`, await queue(img2img(chibi(CHIBI_WHAT), CHIBI_NEGATIVE(HUMAN_NEGATIVE), seed, "sprite-person-chibi-i2i", d), true))
}

const REDESIGN = ["redesign-bunny", "redesign-fawn", "redesign-wolf"]

/** Cuter batch (2026-11-03): the hand-drawn animals with no liked picture yet. Same redesign guards: short, round, chunky, big eyes. */
const CUTER_LOOK = "round chubby body, big round head, huge shiny dark eyes with white highlights, tiny nose, short stubby legs, soft fluffy fur"
Object.assign(SUBJECTS, {
  "cuter-fox": `baby red fox kit with orange fur, a white chest, white tipped ears and a fluffy tail, ${CUTER_LOOK}`,
  "cuter-cub": `baby brown bear cub with a tan muzzle, small round ears, ${CUTER_LOOK}`,
  "cuter-foal": `baby foal with a soft chestnut coat, a white blaze, a tufted mane and a short fluffy tail, ${CUTER_LOOK}`,
  "cuter-capybara": `baby capybara pup with brown fur, a blunt round nose and tiny round ears, ${CUTER_LOOK}`,
  "cuter-crow": `baby crow fledgling with soft dark grey feathers, a small beak, ${CUTER_LOOK}`,
  "cuter-gosling": `baby gosling with soft pale grey-white down and a small orange beak, ${CUTER_LOOK}`,
  "cuter-chick": `baby chick with fluffy cream down, a tiny orange beak and tiny feet, ${CUTER_LOOK}`,
  "cuter-owl": `baby owlet with fluffy white and tan down, a heart shaped face and huge round eyes, ${CUTER_LOOK}`,
  "cuter-mouse": `baby mouse with grey fur, big round pink ears, a pink nose and a thin pink tail, ${CUTER_LOOK}`,
  "cuter-seal": `baby harp seal pup with white fluffy fur, big dark eyes and a tiny black nose, ${CUTER_LOOK}`,
  "cuter-penguin": `baby penguin chick with grey fluffy down, a white face and a small dark beak, ${CUTER_LOOK}`,
  "cuter-skunk": `baby skunk kit with black fur, a white stripe down its back and a fluffy tail, ${CUTER_LOOK}`,
})
const CUTER = Object.keys(SUBJECTS).filter((k) => k.startsWith("cuter-"))
const REDESIGN_BAD = "creepy, scary, uncanny, long body, elongated body, long neck, long snout, stretched, yellow, golden, gold, "

async function main() {
  if (process.argv[2] === "person-center-chibi") return chibiBatch()
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SUBJECTS)
  if (ids[0] === "second") ids.splice(0, 1, ...SECOND)
  if (ids[0] === "cuter") ids.splice(0, 1, ...CUTER)
  if (ids[0] === "redesign") ids.splice(0, 1, ...REDESIGN)
  for (const id of ids) {
    if (PEOPLE[id]) {
      for (const seed of [5, 11, 23, 42]) console.log(`${id} single seed ${seed}:`, await queue(graph(human(PEOPLE[id]), HUMAN_NEGATIVE, seed, `sprite-${id}`)))
      for (const seed of [5, 11]) console.log(`${id} sheet seed ${seed}:`, await queue(graph(humanSheet(PEOPLE[id]), HUMAN_NEGATIVE.replace(", sprite sheet, multiple views", ""), seed, `sprite-${id}-sheet`)))
      continue
    }
    const what = SUBJECTS[id]
    if (!what) throw new Error(`no subject "${id}"; known: ${Object.keys(SUBJECTS).join(", ")}`)
    const redesign = REDESIGN.includes(id) || id.startsWith("cuter-")
    const second = SECOND.includes(id) || redesign
    const bad = redesign ? GLITCH + REDESIGN_BAD : second ? GLITCH : ""
    for (const seed of redesign ? [5, 11, 23, 42, 77] : second ? [5, 11, 23] : [5, 11]) console.log(`${id} single seed ${seed}:`, await queue(graph(single(what), bad + NEGATIVE, seed, `sprite-${id}`)))
    for (const seed of redesign ? [5, 11, 23] : second ? [5, 11] : [5]) console.log(`${id} sheet seed ${seed}:`, await queue(graph(sheet(what), bad + SHEET_NEGATIVE, seed, `sprite-${id}-sheet`)))
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => (console.error(e.message), process.exit(1)))
