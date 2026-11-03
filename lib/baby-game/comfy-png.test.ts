import { describe, expect, it } from "vitest"
import { pngText, readGen, recipeFromPrompt, withGenNote, workflowNotes } from "./comfy-png.mjs"

/** A tiny PNG: signature, tEXt chunks, then an IDAT the reader must stop at. CRCs are not checked. */
function png(chunks: Record<string, string>): Uint8Array {
  const parts: number[] = [137, 80, 78, 71, 13, 10, 26, 10]
  const push = (type: string, data: number[]) => {
    const len = data.length
    parts.push((len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0)
  }
  for (const [k, v] of Object.entries(chunks)) push("tEXt", [...[...k].map((c) => c.charCodeAt(0)), 0, ...[...v].map((c) => c.charCodeAt(0))])
  push("IDAT", [1, 2, 3])
  push("tEXt", [...[..."late"].map((c) => c.charCodeAt(0)), 0, 65])
  return new Uint8Array(parts)
}

// the graph ComfyUI saved into ~/ComfyUI-Shared/output/sprite_00001_.png, trimmed to its links
const GRAPH = {
  "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "sd_xl_base_1.0.safetensors" } },
  "10": { class_type: "LoraLoader", inputs: { model: ["4", 0], clip: ["4", 1], lora_name: "pixel-art-xl.safetensors", strength_model: 1.2, strength_clip: 1.0 } },
  "11": { class_type: "LoraLoader", inputs: { model: ["10", 0], clip: ["10", 1], lora_name: "pixel-icon-lizozom.safetensors", strength_model: 0.5, strength_clip: 0.5 } },
  "6": { class_type: "CLIPTextEncode", inputs: { clip: ["11", 1], text: "pixel art, single cute baby otter sprite" } },
  "7": { class_type: "CLIPTextEncode", inputs: { clip: ["11", 1], text: ["20", 0] } },
  "20": { class_type: "PrimitiveString", inputs: { value: "blurry, photo" } },
  "21": { class_type: "PrimitiveInt", inputs: { value: 42 } },
  "5": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
  "3": { class_type: "KSampler", inputs: { model: ["11", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0], seed: ["21", 0], steps: 25, cfg: 7, sampler_name: "euler", scheduler: "normal", denoise: 1 } },
  "9": { class_type: "SaveImage", inputs: { filename_prefix: "sprite" } },
}

describe("ComfyUI PNG recipes", () => {
  it("reads text chunks up to the image data", () => {
    expect(pngText(png({ prompt: "{}", workflow: "{\"nodes\":[]}" }))).toEqual({ prompt: "{}", workflow: "{\"nodes\":[]}" })
    expect(pngText(new Uint8Array([1, 2, 3]))).toEqual({})
  })

  it("follows the sampler's links to checkpoint, LoRAs in order, prompts, seed and size", () => {
    const r = recipeFromPrompt(GRAPH)!
    expect(r.checkpoint).toBe("sd_xl_base_1.0.safetensors")
    expect(r.loras).toEqual([
      { name: "pixel-art-xl.safetensors", model: 1.2, clip: 1 },
      { name: "pixel-icon-lizozom.safetensors", model: 0.5, clip: 0.5 },
    ])
    expect(r.positive).toBe("pixel art, single cute baby otter sprite")
    expect(r.negative).toBe("blurry, photo")
    expect(r).toMatchObject({ seed: 42, steps: 25, cfg: 7, sampler: "euler", scheduler: "normal", width: 1024, height: 1024, batch: 1 })
  })

  it("still finds the checkpoint and LoRAs with no sampler, and refuses a non-graph", () => {
    const { "3": _sampler, ...rest } = GRAPH
    const r = recipeFromPrompt(rest)!
    expect(r.checkpoint).toBe("sd_xl_base_1.0.safetensors")
    expect(r.loras.map((l) => l.name)).toEqual(["pixel-art-xl.safetensors", "pixel-icon-lizozom.safetensors"])
    expect(recipeFromPrompt(null)).toBeNull()
    expect(recipeFromPrompt({ a: 1 })).toBeNull()
  })

  it("collects Note nodes from the canvas, and reads a whole file", () => {
    const wf = { nodes: [{ type: "Note", widgets_values: ["LoRA above 1.2 gets noisy"] }, { type: "KSampler", widgets_values: [1] }, { type: "MarkdownNote", widgets_values: [""] }] }
    expect(workflowNotes(wf)).toEqual(["LoRA above 1.2 gets noisy"])
    const g = readGen(png({ prompt: JSON.stringify(GRAPH), workflow: JSON.stringify(wf) }))
    expect(g.recipe?.seed).toBe(42)
    expect(g.workflowNotes).toHaveLength(1)
    expect(readGen(png({ prompt: "not json" }))).toEqual({ recipe: null, workflowNotes: [] })
  })

  it("changes one note, drops bad values, cleans tags", () => {
    const a = withGenNote({}, "a.png", { verdict: "like", kind: "character" }, 5)
    expect(a["a.png"]).toEqual({ verdict: "like", kind: "character", text: "", tags: [], at: 5 })
    const b = withGenNote(a, "a.png", { verdict: "great", tags: [" Cute", "cute", "", "Clean outline"] }, 6)
    expect(b["a.png"]).toEqual({ verdict: null, kind: "character", text: "", tags: ["cute", "clean outline"], at: 6 })
    expect(withGenNote(b, "b.png", { kind: "tree" }, 7)["b.png"].kind).toBeNull()
  })
})
