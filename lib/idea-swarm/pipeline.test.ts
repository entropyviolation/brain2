import { describe, expect, it } from "vitest"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { Embedder } from "./embed"
import { defaultConfig, pickModels } from "./lenses"
import { runPipeline } from "./pipeline"
import { goldFromRun, hits, scoreRun, scoreTexts, targetsOf } from "./score"
import { allOf, dropOne, putOne } from "./store"

const PASSAGE = "A rhizome has no centre; it connects any point to any other point. A tree has roots and a trunk, but a rhizome spreads sideways. Becoming-animal is not imitation of an animal. A plateau is a continuous region of intensity."
const TOPICS = ["rhizome connects any point", "tree has roots and a trunk", "becoming-animal is not imitation", "plateau is a region of intensity"]

/** A bag-of-words embedder: texts that share words are close. */
const VOCAB = ["rhizome", "connect", "tree", "root", "animal", "imitation", "plateau", "intensity", "centre"]
const embed: Embedder = async (texts) => texts.map((t) => [...VOCAB.map((w): number => (t.toLowerCase().includes(w) ? 1 : 0)), 0.01])

const lensOf = (system: string) => /Lens: ([^.]+)\./.exec(system)?.[1] ?? ""
const call: ModelCall = async ({ system, schema }) => {
  const p = (schema as { properties: Record<string, unknown> }).properties
  if ("gems" in p) return { gems: [{ index: 0, why: "specific", name: "Gem", gist: "A plateau is intensity." }] }
  if ("insights" in p) return { insights: [{ topic: "rhizome", insight: "It has no centre." }] }
  if ("ideas" in p) {
    const k = lensOf(system).length % 4
    const quote = k === 0 ? "A rhizome has no centre" : "invented words not in the text"
    return { ideas: [{ name: TOPICS[k]!.split(" ")[0]!, gist: TOPICS[k]!, quote }, { name: "extra", gist: TOPICS[(k + 1) % 4]!, quote: "" }] }
  }
  return { name: "Card", gist: "rhizome connects any point and has no centre", quote: "it connects any point to any other point" }
}

describe("idea swarm pipeline", () => {
  it("runs every node, records each, and maps the points", async () => {
    const config = defaultConfig(["qwen2.5:3b-instruct", "qwen2.5:14b-instruct", "qwen3:30b-a3b", "nomic-embed-text"])
    config.lone.on = true
    config.topicInsight.on = true
    const seen: string[] = []
    const run = await runPipeline(config, { id: "p", title: "T", text: PASSAGE }, { call, embed, onStage: (s) => seen.push(s.id) })
    expect(seen).toEqual(["keyphrases", "topicInsight", "agents", "cluster", "synth", "lone", "baseline"])
    expect(run.stages.agents!.items.length).toBeGreaterThan(12)
    expect(run.stages.agents!.items.some((i) => i.grounded)).toBe(true)
    expect(run.stages.agents!.items.some((i) => i.grounded === false)).toBe(true)
    expect(run.clusters.length).toBeGreaterThan(0)
    expect(run.stages.synth!.items[0]!.name).toBe("Card")
    expect(run.clusters.find((c) => c.synth)!.synth!.fidelity).toBeGreaterThan(-1)
    expect(run.points.filter((p) => p.kind === "idea")).toHaveLength(run.stages.agents!.items.length)
    expect(run.points.some((p) => p.kind === "synth")).toBe(true)
    expect(run.stages.baseline!.items.length).toBeGreaterThan(0)
    expect(run.calls).toBeGreaterThanOrEqual(12 + 1 + 1)
    expect(run.config.agents.knob.model).toBe("qwen2.5:3b-instruct")
    expect(run.config.synth.knob.model).toBe("qwen3:30b-a3b")
  })

  it("passes each node's own temperature and model", async () => {
    const config = defaultConfig(["a:3b", "b:30b"])
    config.agents.lenses = config.agents.lenses.map((l, i) => (i === 0 ? { ...l, model: "special:7b", temperature: 1.1 } : { ...l, on: i < 3 }))
    const asked: Array<{ model?: string; temperature?: number }> = []
    const spy: ModelCall = async (r) => { asked.push({ model: r.model, temperature: r.temperature }); return call(r) }
    await runPipeline({ ...config, synth: { ...config.synth, on: false }, baseline: { ...config.baseline, on: false } }, { id: "p", title: "T", text: PASSAGE }, { call: spy, embed })
    expect(asked.some((a) => a.model === "special:7b" && a.temperature === 1.1)).toBe(true)
    expect(asked.some((a) => a.model === "a:3b" && a.temperature === 0.7)).toBe(true)
  })

  it("survives readers that fail, and says so when all do", async () => {
    let n = 0
    const flaky: ModelCall = async (r) => { if (++n % 2) throw new Error("x"); return call(r) }
    const config = defaultConfig(["a:3b", "b:30b"])
    const ok = await runPipeline(config, { id: "p", title: "T", text: PASSAGE }, { call: flaky, embed })
    expect(ok.stages.agents!.status).toBe("done")
    expect(ok.stages.agents!.note).toMatch(/failed/)
    const dead: ModelCall = async () => { throw new Error("down") }
    const bad = await runPipeline(config, { id: "p", title: "T", text: PASSAGE }, { call: dead, embed })
    expect(bad.stages.agents!.status).toBe("error")
    expect(bad.stages.keyphrases!.status).toBe("done")
    expect(bad.stages.cluster!.status).toBe("skipped")
  })

  it("reuses the readers' output so only the later nodes run", async () => {
    const config = defaultConfig(["a:3b", "b:30b"])
    const first = await runPipeline(config, { id: "p", title: "T", text: PASSAGE }, { call, embed })
    let n = 0
    const counting: ModelCall = async (r) => { n++; return call(r) }
    const again = await runPipeline({ ...config, cluster: { ...config.cluster, threshold: 1.01 } }, { id: "p", title: "T", text: PASSAGE }, { call: counting, embed, reuseAgents: first.stages.agents })
    expect(again.stages.agents!.items).toEqual(first.stages.agents!.items)
    expect(again.stages.agents!.note).toMatch(/^reused/)
    expect(again.clusters.length).toBeGreaterThan(first.clusters.length)
    expect(n).toBeLessThan(first.calls)
  })

  it("picks weak, mid and strong models by size and skips embedders", () => {
    expect(pickModels(["nomic-embed-text:latest", "qwen3:30b-a3b", "qwen2.5:3b-instruct", "qwen2.5:14b-instruct"])).toEqual({ weak: "qwen2.5:3b-instruct", mid: "qwen2.5:14b-instruct", strong: "qwen3:30b-a3b" })
  })
})

describe("gold scoring", () => {
  it("scores coverage and precision per version and keeps the best", async () => {
    const outs = ["rhizome connects any point", "tree has roots"]
    const s = await scoreTexts(embed, outs, [
      { id: "1", label: "Wrong", keyphrases: [], insights: [], ideas: ["plateau intensity"], gems: [] },
      { id: "2", label: "Right", keyphrases: [], insights: [], ideas: ["rhizome connects any point", "tree has roots"], gems: [] },
    ], "ideas")
    expect(s!.version).toBe("Right")
    expect(s!.coverage).toBeGreaterThan(0.9)
    expect(s!.f).toBeGreaterThan(0.9)
    expect(hits(s!, 0.95)).toEqual({ covered: 2, useful: 2 })
    expect(hits(s!, 1.01)).toEqual({ covered: 0, useful: 0 })
    expect(await scoreTexts(embed, [], [], "ideas")).toBeNull()
  })

  it("scores every node of a run, and builds a gold start from the run", async () => {
    const config = defaultConfig(["a:3b", "b:30b"])
    const run = await runPipeline(config, { id: "p", title: "T", text: PASSAGE }, { call, embed })
    const keys = targetsOf(run).map((t) => t.key)
    expect(keys).toEqual(expect.arrayContaining(["keyphrases:yake", "agents:all", "agents:claims", "cluster:medoids", "synth", "final", "baseline"]))
    const gold = { id: "g", passageId: "p", at: "", versions: [goldFromRun(run, "mine")] }
    const scores = await scoreRun(run, gold, embed)
    expect(scores.synth!.f).toBeCloseTo(1, 1)
    expect(scores["keyphrases:yake"]).not.toBeNull()
  })

  it("stores and lists things (in memory here)", async () => {
    await putOne("golds", { id: "a", n: 1 })
    expect((await allOf<{ id: string }>("golds")).map((x) => x.id)).toContain("a")
    await dropOne("golds", "a")
    expect((await allOf<{ id: string }>("golds")).map((x) => x.id)).not.toContain("a")
  })
})
