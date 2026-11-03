import { describe, expect, it } from "vitest"
import { filterGens, likeScore, loraBoard, parseTags, setupBoard, setupKey, type Gen, type GenNotes, type GenRecipe } from "./gens"

const recipe = (loras: [string, number][], cfg = 7): GenRecipe => ({
  checkpoint: "sd_xl_base_1.0.safetensors",
  loras: loras.map(([name, model]) => ({ name: `${name}.safetensors`, model, clip: 1 })),
  positive: "otter",
  negative: "",
  seed: 1,
  steps: 25,
  cfg,
  sampler: "euler",
  scheduler: "normal",
  denoise: 1,
  width: 1024,
  height: 1024,
  batch: 1,
  nodes: 9,
})
const gen = (file: string, r: GenRecipe | null): Gen => ({ file, at: 0, bytes: 0, recipe: r, workflowNotes: [] })

const GENS = [gen("a.png", recipe([["pixel-art-xl", 1.2]])), gen("b.png", recipe([["pixel-art-xl", 1.2]])), gen("c.png", recipe([["pixel-art-xl", 0.8], ["pixel-icon", 0.5]])), gen("d.png", null)]
const note = (verdict: "like" | "nope" | null, kind: "character" | null = null) => ({ verdict, kind, text: "", tags: [], at: 0 })
const NOTES: GenNotes = { "a.png": note("like", "character"), "b.png": note("nope"), "c.png": note("like") }

describe("generation boards", () => {
  it("names a setup by its fixed knobs, not prompt or seed", () => {
    expect(setupKey(recipe([["pixel-art-xl", 1.2]]))).toBe("sd_xl_base_1.0 · pixel-art-xl 1.2 · cfg 7 · euler · 25 steps")
    expect(setupKey(null)).toBe("no recipe")
  })

  it("scores with a prior, so one like does not beat a long record", () => {
    expect(likeScore({ liked: 1, rated: 1 })).toBeCloseTo(2 / 3)
    expect(likeScore({ liked: 9, rated: 10 })).toBeGreaterThan(likeScore({ liked: 1, rated: 1 }))
    expect(likeScore({ liked: 0, rated: 0 })).toBe(0.5)
  })

  it("counts per setup and per LoRA at strength", () => {
    const s = setupBoard(GENS, NOTES)
    expect(s[0]).toMatchObject({ liked: 1, rated: 1, total: 1 })
    expect(s.find((r) => r.key.includes("pixel-art-xl 1.2 ·"))).toMatchObject({ total: 2, liked: 1, nope: 1 })
    const l = loraBoard(GENS, NOTES)
    expect(l.map((r) => r.key).sort()).toEqual(["no LoRA", "pixel-art-xl 0.8", "pixel-art-xl 1.2", "pixel-icon 0.5"])
  })

  it("filters by verdict, kind and setup", () => {
    expect(filterGens(GENS, NOTES, "like", "any", null).map((g) => g.file)).toEqual(["a.png", "c.png"])
    expect(filterGens(GENS, NOTES, "unrated", "any", null).map((g) => g.file)).toEqual(["d.png"])
    expect(filterGens(GENS, NOTES, "all", "character", null).map((g) => g.file)).toEqual(["a.png"])
    expect(filterGens(GENS, NOTES, "all", "any", setupKey(GENS[0].recipe)).map((g) => g.file)).toEqual(["a.png", "b.png"])
    expect(parseTags(" Cute, , clean outline")).toEqual(["cute", "clean outline"])
  })
})
