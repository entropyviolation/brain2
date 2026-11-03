import { describe, expect, it } from "vitest"
import { applyOverrides, pngText, rawPromptOf, readGen, recipeFromPrompt, withGenNote, workflowNotes } from "./comfy-png.mjs"

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
    expect(a["a.png"]).toEqual({ verdict: "like", kind: "character", text: "", tags: [], issues: [], at: 5 })
    const b = withGenNote(a, "a.png", { verdict: "great", tags: [" Cute", "cute", "", "Clean outline"] }, 6)
    expect(b["a.png"]).toEqual({ verdict: null, kind: "character", text: "", tags: ["cute", "clean outline"], issues: [], at: 6 })
    expect(withGenNote(b, "b.png", { kind: "tree" }, 7)["b.png"].kind).toBeNull()
  })

  it("keeps issues clean and unique", () => {
    const a = withGenNote({}, "a.png", { issues: ["Extra limbs", "extra limbs", " ", "background"] }, 1)
    expect(a["a.png"].issues).toEqual(["extra limbs", "background"])
  })

  const graph = {
    1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "m.safetensors" } },
    2: { class_type: "LoraLoader", inputs: { model: ["1", 0], clip: ["1", 1], lora_name: "l.safetensors", strength_model: 1.2, strength_clip: 1 } },
    4: { class_type: "CLIPTextEncode", inputs: { clip: ["2", 1], text: "old" } },
    5: { class_type: "CLIPTextEncode", inputs: { clip: ["2", 1], text: "neg" } },
    6: { class_type: "EmptyLatentImage", inputs: { width: 768, height: 768, batch_size: 1 } },
    7: { class_type: "KSampler", inputs: { model: ["2", 0], positive: ["4", 0], negative: ["5", 0], latent_image: ["6", 0], seed: 5, steps: 22, cfg: 7, sampler_name: "euler", scheduler: "normal", denoise: 1 } },
    9: { class_type: "SaveImage", inputs: { images: ["7", 0], filename_prefix: "sprite" } },
  }

  it("changes only the asked knobs on a copy of the graph", () => {
    const g = applyOverrides(graph, { positive: "new", seed: 9, width: 512, loraStrength: 0.8, prefix: "try me" })
    expect(recipeFromPrompt(g)).toMatchObject({ positive: "new", negative: "neg", seed: 9, steps: 22, width: 512, height: 768 })
    expect(g[2].inputs.strength_model).toBe(0.8)
    expect(g[9].inputs.filename_prefix).toBe("try-me")
    expect(graph[4].inputs.text).toBe("old")
  })

  it("says so when a prompt is wired from another node", () => {
    const wired = { ...graph, 4: { class_type: "CLIPTextEncode", inputs: { clip: ["2", 1], text: ["8", 0] } } }
    expect(() => applyOverrides(wired, { positive: "x" })).toThrow(/wired/)
    expect(rawPromptOf(png({ prompt: JSON.stringify(graph) }))?.[7].class_type).toBe("KSampler")
  })
})
