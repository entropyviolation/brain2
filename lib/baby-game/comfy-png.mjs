/**
 * lib/baby-game/comfy-png.mjs — Read the recipe a ComfyUI output PNG carries, and keep a verdict on it
 *
 * ComfyUI's Save Image node writes two text chunks into every PNG: `prompt` (the graph that ran, node id to
 * `{ class_type, inputs }`) and `workflow` (the canvas, with any Note nodes). `pngText` reads those chunks and
 * `recipeFromPrompt` boils the graph down to what decides a look: checkpoint, LoRAs and strengths, prompts, seed,
 * sampler, size. `withGenNote` is the one way a like, kind, tag or note changes.
 *
 * Plain `.mjs` with no imports, so `scripts/baby-gens-api.mjs` (Node) and the tests share it. Part of the Baby animal
 * game only; nothing outside `lib/baby-game/`, `components/BabyGame/` and the baby lab pages uses it.
 */

const SIG = [137, 80, 78, 71, 13, 10, 26, 10]

/** Every uncompressed `tEXt` and `iTXt` chunk before the image data, as `{ key: text }`. */
export function pngText(bytes) {
  const out = {}
  if (!bytes || bytes.length < 8 || SIG.some((b, i) => bytes[i] !== b)) return out
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const latin1 = new TextDecoder("latin1")
  const utf8 = new TextDecoder("utf-8")
  let i = 8
  while (i + 8 <= bytes.length) {
    const len = view.getUint32(i)
    const type = latin1.decode(bytes.subarray(i + 4, i + 8))
    const data = bytes.subarray(i + 8, Math.min(bytes.length, i + 8 + len))
    if (type === "IDAT" || type === "IEND") break
    if (type === "tEXt") {
      const z = data.indexOf(0)
      if (z > 0) out[latin1.decode(data.subarray(0, z))] = latin1.decode(data.subarray(z + 1))
    } else if (type === "iTXt") {
      const z = data.indexOf(0)
      // key \0 compressed method lang \0 translated \0 text; compressed text is skipped (Save Image never compresses)
      if (z > 0 && data[z + 1] === 0) {
        const lang = data.indexOf(0, z + 3)
        const trans = lang < 0 ? -1 : data.indexOf(0, lang + 1)
        if (trans >= 0) out[latin1.decode(data.subarray(0, z))] = utf8.decode(data.subarray(trans + 1))
      }
    }
    i += 12 + len
  }
  return out
}

const isLink = (v) => Array.isArray(v) && v.length === 2 && (typeof v[0] === "string" || typeof v[0] === "number")
const node = (graph, v) => (isLink(v) ? graph[String(v[0])] : undefined)

/** A widget value that may be typed in place or fed from a primitive node. */
function valueOf(graph, v, depth = 0) {
  if (!isLink(v)) return v
  const n = node(graph, v)
  if (!n || depth > 8) return undefined
  const ins = n.inputs || {}
  for (const k of ["value", "seed", "noise_seed", "int", "float", "number", "string", "text"]) {
    if (k in ins) return valueOf(graph, ins[k], depth + 1)
  }
  return undefined
}

/** The prompt text that reaches a conditioning input, through encoders, combiners and primitives. */
function textOf(graph, v, depth = 0) {
  if (typeof v === "string") return v
  const n = node(graph, v)
  if (!n || depth > 12) return ""
  const ins = n.inputs || {}
  for (const k of ["text", "text_g", "prompt", "string", "value"]) {
    if (k in ins) {
      const t = textOf(graph, ins[k], depth + 1)
      if (t) return t
    }
  }
  // combiners and conditioning edits: join what feeds them
  const parts = Object.entries(ins)
    .filter(([k, x]) => isLink(x) && /cond|conditioning/i.test(k))
    .map(([, x]) => textOf(graph, x, depth + 1))
    .filter(Boolean)
  return parts.join(" | ")
}

const SAMPLER = /^(KSampler|KSamplerAdvanced|SamplerCustom|SamplerCustomAdvanced)$/

/**
 * What decides a generation's look, from the `prompt` graph. Follows the first sampler's links: `model` back through
 * LoRA loaders to the checkpoint, `positive` and `negative` back to their text, `latent_image` to the size. Graphs
 * with no recognised sampler still give their checkpoint and LoRAs by a plain scan. Returns null for a non-graph.
 */
export function recipeFromPrompt(graph) {
  if (!graph || typeof graph !== "object") return null
  const nodes = Object.values(graph).filter((n) => n && typeof n === "object" && typeof n.class_type === "string")
  if (!nodes.length) return null
  const sampler = nodes.find((n) => SAMPLER.test(n.class_type))
  const s = sampler?.inputs || {}

  const loras = []
  let checkpoint = null
  const seen = new Set()
  let cur = isLink(s.model) ? s.model : null
  while (cur && !seen.has(String(cur[0]))) {
    seen.add(String(cur[0]))
    const n = node(graph, cur)
    if (!n) break
    const ins = n.inputs || {}
    if (typeof ins.lora_name === "string") loras.unshift({ name: ins.lora_name, model: num(ins.strength_model ?? ins.strength), clip: num(ins.strength_clip) })
    const ck = ins.ckpt_name ?? ins.unet_name ?? ins.model_name
    if (typeof ck === "string") {
      checkpoint = ck
      break
    }
    cur = isLink(ins.model) ? ins.model : null
  }
  if (!sampler || (!checkpoint && !loras.length)) {
    for (const n of nodes) {
      const ins = n.inputs || {}
      if (typeof ins.lora_name === "string" && !loras.some((l) => l.name === ins.lora_name)) loras.push({ name: ins.lora_name, model: num(ins.strength_model ?? ins.strength), clip: num(ins.strength_clip) })
      const ck = ins.ckpt_name ?? ins.unet_name
      if (!checkpoint && typeof ck === "string") checkpoint = ck
    }
  }

  let width = null
  let height = null
  let batch = null
  const latent = node(graph, s.latent_image)
  const sized = latent && num(latent.inputs?.width) ? latent : nodes.find((n) => /^Empty.*Latent/.test(n.class_type))
  if (sized) {
    width = num(valueOf(graph, sized.inputs?.width))
    height = num(valueOf(graph, sized.inputs?.height))
    batch = num(valueOf(graph, sized.inputs?.batch_size))
  }

  return {
    checkpoint,
    loras,
    positive: textOf(graph, s.positive).trim(),
    negative: textOf(graph, s.negative).trim(),
    seed: num(valueOf(graph, s.seed ?? s.noise_seed)),
    steps: num(valueOf(graph, s.steps)),
    cfg: num(valueOf(graph, s.cfg)),
    sampler: str(valueOf(graph, s.sampler_name)),
    scheduler: str(valueOf(graph, s.scheduler)),
    denoise: num(valueOf(graph, s.denoise)),
    width,
    height,
    batch,
    nodes: nodes.length,
  }
}

/** The text of every Note and Markdown Note on the `workflow` canvas: notes written before the run. */
export function workflowNotes(workflow) {
  const list = workflow && Array.isArray(workflow.nodes) ? workflow.nodes : []
  return list
    .filter((n) => n && /^(Note|MarkdownNote)$/.test(n.type) && Array.isArray(n.widgets_values))
    .map((n) => String(n.widgets_values[0] ?? "").trim())
    .filter(Boolean)
}

/** The recipe and canvas notes of one PNG's bytes. */
export function readGen(bytes) {
  const text = pngText(bytes)
  let recipe = null
  let notes = []
  try {
    recipe = text.prompt ? recipeFromPrompt(JSON.parse(text.prompt)) : null
  } catch {
    recipe = null
  }
  try {
    notes = text.workflow ? workflowNotes(JSON.parse(text.workflow)) : []
  } catch {
    notes = []
  }
  return { recipe, workflowNotes: notes }
}

export const GEN_VERDICTS = ["like", "nope"]
export const GEN_KINDS = ["character", "prop", "tile", "other"]

/**
 * A new notes object with one output's note changed. A patch field set to null clears it. Unknown verdicts and kinds
 * are dropped, tags are trimmed, lowercased and unique, text is capped at 2000 characters.
 */
export function withGenNote(notes, file, patch, now = Date.now()) {
  const old = notes[file] ?? { verdict: null, kind: null, text: "", tags: [], at: now }
  const next = { ...old, at: now }
  if ("verdict" in patch) next.verdict = GEN_VERDICTS.includes(patch.verdict) ? patch.verdict : null
  if ("kind" in patch) next.kind = GEN_KINDS.includes(patch.kind) ? patch.kind : null
  if ("text" in patch) next.text = String(patch.text ?? "").slice(0, 2000)
  if ("tags" in patch) {
    const raw = Array.isArray(patch.tags) ? patch.tags : []
    next.tags = [...new Set(raw.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 20)
  }
  return { ...notes, [file]: next }
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function str(v) {
  return typeof v === "string" ? v : null
}
