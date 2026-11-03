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
}

const NEGATIVE =
  "blurry, photo, realistic, 3d render, gradient, smooth shading, text, watermark, background scenery, multiple characters, sprite sheet, multiple views, collage, background, text"
const SHEET_NEGATIVE = "blurry, photo, realistic, 3d render, gradient, smooth shading, text, watermark, background scenery, multiple characters, collage"

const single = (what) => `pixel art, one single cute fluffy ${what}, detailed, full body, centered, flat colors, clean outline, plain white background`
const sheet = (what) =>
  `pixel art character turnaround sheet of a cute fluffy ${what}, detailed, four views: front, side, back, three-quarter, flat colors, clean outline, plain white background`

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

async function queue(prompt) {
  const res = await fetch(`${COMFY}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) })
  if (!res.ok) throw new Error(`ComfyUI ${res.status}: ${await res.text()}`)
  return (await res.json()).prompt_id
}

async function main() {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SUBJECTS)
  for (const id of ids) {
    const what = SUBJECTS[id]
    if (!what) throw new Error(`no subject "${id}"; known: ${Object.keys(SUBJECTS).join(", ")}`)
    for (const seed of [5, 11]) console.log(`${id} single seed ${seed}:`, await queue(graph(single(what), NEGATIVE, seed, `sprite-${id}`)))
    console.log(`${id} sheet:`, await queue(graph(sheet(what), SHEET_NEGATIVE, 5, `sprite-${id}-sheet`)))
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => (console.error(e.message), process.exit(1)))
