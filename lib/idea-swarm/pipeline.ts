/**
 * lib/idea-swarm/pipeline.ts — Run the idea-extraction pipeline on one passage and record every node
 *
 *   passage ─┬─ keyphrases (no model) ──┬─ topicInsight (optional)
 *            ├─ agents: one weak reader per lens, in parallel ─ embed ─ cluster ─┬─ synth: one card per cluster
 *            │                                                                   └─ lone: hidden gems among singletons
 *            └─ baseline: one careful call, for comparison
 *
 * Each node writes a `StageOut` as it finishes (`onStage`), so a page can show the run building. A failed call is
 * counted and noted, never fatal; a node with nothing to work on is `skipped`. The cluster node also records how close
 * each written card sits to its cluster's centre next to the medoid (the nearest real answer), which is the experiment
 * "can a strong model write the point nobody wrote?". Pure apart from the two functions it is handed.
 */

import { extractKeyphrases } from "@/lib/keyphrase"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { Embedder } from "./embed"
import type { ClusterOut, Config, Item, Knob, MapPoint, Run, StageId, StageOut } from "./types"
import { centroid, cluster, cosine, medoid, pca2 } from "./vec"

export type Deps = {
  call: ModelCall
  embed: Embedder
  signal?: AbortSignal
  onStage?: (s: StageOut) => void
  now?: () => number
  /** Reuse an earlier run's readers (skips those calls) to tune clustering, the cards or the gems cheaply. */
  reuseAgents?: StageOut
  reuseTopic?: StageOut
  /** Reader answers already finished (key `lens#sample`), and a hook that hears each new one. */
  readers?: Record<string, Item[]>
  onReader?: (key: string, items: Item[]) => void
  runId?: string
  /** A node with many calls says how far along it is. */
  onProgress?: (stage: StageId, done: number, total: number) => void
}

const IDEA_SCHEMA = (n: number) => ({
  type: "object",
  properties: {
    ideas: { type: "array", maxItems: n, items: { type: "object", properties: { name: { type: "string", maxLength: 60 }, gist: { type: "string", maxLength: 260 }, quote: { type: "string", maxLength: 220 } }, required: ["name", "gist", "quote"] } },
  },
  required: ["ideas"],
})
const CARD_SCHEMA = { type: "object", properties: { name: { type: "string", maxLength: 60 }, gist: { type: "string", maxLength: 420 }, quote: { type: "string", maxLength: 220 } }, required: ["name", "gist", "quote"] }
const LONE_SCHEMA = { type: "object", properties: { gems: { type: "array", maxItems: 5, items: { type: "object", properties: { index: { type: "integer" }, why: { type: "string", maxLength: 200 }, name: { type: "string", maxLength: 60 }, gist: { type: "string", maxLength: 260 } }, required: ["index", "why", "name", "gist"] } } }, required: ["gems"] }
const INSIGHT_SCHEMA = { type: "object", properties: { insights: { type: "array", maxItems: 8, items: { type: "object", properties: { topic: { type: "string", maxLength: 60 }, insight: { type: "string", maxLength: 300 } }, required: ["topic", "insight"] } } }, required: ["insights"] }

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
const grounded = (quote: string | undefined, passage: string) => !!quote && norm(quote).length >= 8 && norm(passage).includes(norm(quote))
const textOf = (name?: string, gist?: string) => [name?.trim(), gist?.trim()].filter(Boolean).join(": ")

type Raw = Record<string, unknown> | null
const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "")

function ideasFrom(raw: Raw, passage: string, lens: string, idBase: string, n: number): Item[] {
  const list = Array.isArray(raw?.ideas) ? (raw!.ideas as Array<Record<string, unknown>>) : []
  return list
    .map((i, k) => ({ name: str(i.name, 60), gist: str(i.gist, 260), quote: str(i.quote, 220) }))
    .filter((i) => i.name && i.gist)
    .slice(0, n)
    .map((i, k) => ({ id: `${idBase}.${k}`, text: textOf(i.name, i.gist), name: i.name, gist: i.gist, quote: i.quote || undefined, grounded: grounded(i.quote, passage), lens }))
}

/** Run `jobs` with at most `limit` in flight, in order of completion safe for index results. */
async function pool<T>(jobs: Array<() => Promise<T>>, limit: number, signal?: AbortSignal): Promise<T[]> {
  const out: T[] = new Array(jobs.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, jobs.length)) }, async () => {
      while (next < jobs.length && !signal?.aborted) {
        const i = next++
        out[i] = await jobs[i]!()
      }
    }),
  )
  return out
}

export async function runPipeline(config: Config, passage: { id: string; title: string; text: string }, deps: Deps): Promise<Run> {
  const now = deps.now ?? (() => performance.now())
  const t0 = now()
  const text = passage.text
  const stages: Partial<Record<StageId, StageOut>> = {}
  let calls = 0
  const put = (s: StageOut) => {
    stages[s.id as StageId] = s
    deps.onStage?.(s)
  }
  const ask = async (k: Knob, system: string, user: string, schema: Record<string, unknown>, overrides: Partial<Knob> = {}): Promise<Raw> => {
    calls++
    return (await deps.call({ model: overrides.model ?? k.model, system, user, schema, maxTokens: overrides.maxTokens ?? k.maxTokens, temperature: overrides.temperature ?? k.temperature })) as Raw
  }
  const skip = (id: StageId, note: string) => put({ id, status: "skipped", ms: 0, calls: 0, items: [], note })
  const timed = async (id: StageId, fn: () => Promise<Pick<StageOut, "items"> & Partial<Pick<StageOut, "prompt" | "note">>>) => {
    const t = now()
    const c0 = calls
    try {
      const r = await fn()
      put({ id, status: "done", ...r, ms: Math.round(now() - t), calls: calls - c0 })
    } catch (e) {
      put({ id, status: "error", ms: Math.round(now() - t), calls: calls - c0, items: [], error: e instanceof Error ? e.message : String(e) })
    }
  }

  // 1. keyphrases — free
  let topics: string[] = []
  if (config.keyphrases.on && config.keyphrases.methods.length) {
    await timed("keyphrases", async () => {
      const items: Item[] = config.keyphrases.methods.flatMap((m) => extractKeyphrases(m, text, { top: config.keyphrases.top }).map((p, k) => ({ id: `kp.${m}.${k}`, text: p.phrase, method: m, note: p.score.toFixed(2) })))
      topics = [...new Set(items.filter((i) => i.method === config.keyphrases.methods[0]).map((i) => i.text))]
      return { items, note: `${config.keyphrases.methods.length} method${config.keyphrases.methods.length === 1 ? "" : "s"}, no model` }
    })
  } else skip("keyphrases", "off")

  // 2. topic insight — keyphrases → what does the passage say about them
  if (deps.reuseTopic?.status === "done" && config.topicInsight.on) {
    put({ ...deps.reuseTopic, ms: 0, calls: 0 })
  } else if (config.topicInsight.on && topics.length) {
    await timed("topicInsight", async () => {
      const system = `${config.topicInsight.prompt}\nTopics: ${topics.join("; ")}`
      const raw = await ask(config.topicInsight.knob, system, `The passage:\n"""\n${text}\n"""`, INSIGHT_SCHEMA)
      const list = Array.isArray(raw?.insights) ? (raw!.insights as Array<Record<string, unknown>>) : []
      const items = list.filter((i) => str(i.topic, 60) && str(i.insight, 300)).map((i, k) => ({ id: `ti.${k}`, text: textOf(str(i.topic, 60), str(i.insight, 300)), name: str(i.topic, 60), gist: str(i.insight, 300) }))
      return { items, prompt: system }
    })
  } else skip("topicInsight", config.topicInsight.on ? "needs keyphrases" : "off")

  // 3. agents — one reader per lens (× samples), in parallel
  const lenses = config.agents.lenses.filter((l) => l.on)
  let ideas: Item[] = []
  if (deps.reuseAgents?.items.length) {
    ideas = deps.reuseAgents.items
    put({ ...deps.reuseAgents, ms: 0, calls: 0, note: `reused: ${deps.reuseAgents.note ?? `${ideas.length} ideas`}` })
  } else if (lenses.length) {
    await timed("agents", async () => {
      let firstPrompt = ""
      let finished = 0
      const total = lenses.length * Math.max(1, config.agents.samples)
      deps.onProgress?.("agents", 0, total)
      const jobs = lenses.flatMap((lens) =>
        Array.from({ length: Math.max(1, config.agents.samples) }, (_, s) => async () => {
          const key = `${lens.id}#${s}`
          const kept = deps.readers?.[key]
          if (kept) { deps.onProgress?.("agents", ++finished, total); return { items: kept, failed: false } }
          const system = [
            "You read a passage and report its ideas through ONE lens.",
            `Lens: ${lens.label}. ${lens.prompt}`,
            config.keyphrases.feed && topics.length ? `Keyword analysis found these topics: ${topics.slice(0, 10).join("; ")}.` : "",
            `Report up to ${config.agents.perAgent} ideas. For each: name (at most six words, the author's own term if there is one), gist (one plain sentence saying what is claimed or shown), quote (copied exactly from the passage, or empty).`,
            "Only what is really in the passage. No filler. If the lens finds nothing, report fewer.",
          ].filter(Boolean).join("\n")
          if (!firstPrompt) firstPrompt = system
          try {
            const raw = await ask(config.agents.knob, system, `The passage:\n"""\n${text}\n"""`, IDEA_SCHEMA(config.agents.perAgent), { model: lens.model, temperature: lens.temperature })
            const got = ideasFrom(raw, text, lens.id, `${lens.id}${s ? `~${s + 1}` : ""}`, config.agents.perAgent)
            if (!deps.signal?.aborted) deps.onReader?.(key, got)
            return { items: got, failed: false }
          } catch {
            return { items: [] as Item[], failed: true }
          } finally {
            deps.onProgress?.("agents", ++finished, total)
          }
        }),
      )
      const results = await pool(jobs, config.agents.parallel, deps.signal)
      ideas = results.flatMap((r) => r?.items ?? [])
      const failed = results.filter((r) => r?.failed).length
      if (!ideas.length) throw new Error(failed ? `All ${failed} readers failed. Is ${config.agents.knob.model} installed?` : "The readers found nothing")
      return { items: ideas, prompt: firstPrompt, note: `${ideas.length} ideas from ${results.length - failed} readers${failed ? `, ${failed} failed` : ""}; ${ideas.filter((i) => i.grounded).length} quote the passage` }
    })
  } else skip("agents", "no lenses on")

  // 4. embed + cluster
  let clusters: ClusterOut[] = []
  const points: MapPoint[] = []
  let vecs: number[][] = []
  if (ideas.length) {
    await timed("cluster", async () => {
      vecs = await deps.embed(ideas.map((i) => i.text))
      const groups = cluster(vecs, config.cluster.threshold)
      clusters = groups.map((g, n) => {
        const m = medoid(g.map((i) => vecs[i]!))
        return { id: n, members: g.map((i) => ideas[i]!.id), medoid: ideas[g[m]!]!.id, lenses: [...new Set(g.map((i) => ideas[i]!.lens!))], lone: g.length < config.cluster.minSize }
      })
      const items = clusters.filter((c) => !c.lone).map((c) => ({ ...ideas.find((i) => i.id === c.medoid)!, note: `medoid of ${c.members.length} · ${c.lenses.length} lens${c.lenses.length === 1 ? "" : "es"}` }))
      return { items, note: `${clusters.filter((c) => !c.lone).length} clusters, ${clusters.filter((c) => c.lone).length} lone ideas at similarity ≥ ${config.cluster.threshold}` }
    })
  } else skip("cluster", "no ideas to group")

  // 5. synth — one card per real cluster, written by the strong model from every member
  const synthVecs: Array<{ cluster: number; vec: number[] }> = []
  if (config.synth.on && clusters.some((c) => !c.lone)) {
    await timed("synth", async () => {
      const cards: Item[] = []
      let firstPrompt = ""
      let written = 0
      const totalCards = clusters.filter((c) => !c.lone).length
      deps.onProgress?.("synth", 0, totalCards)
      const jobs = clusters.filter((c) => !c.lone).map((c) => async () => {
        const members = c.members.map((id) => ideas.find((i) => i.id === id)!)
        const system = `${config.synth.prompt}\n\nThe passage (for checking quotes):\n"""\n${text.slice(0, 3000)}\n"""`
        const user = `${members.length} readers reported:\n${members.map((m, k) => `${k + 1}. [${m.lens}] ${m.text}`).join("\n")}`
        if (!firstPrompt) firstPrompt = `${system}\n\n${user}`
        try {
          const raw = await ask(config.synth.knob, system, user, CARD_SCHEMA)
          deps.onProgress?.("synth", ++written, totalCards)
          const name = str(raw?.name, 60)
          const gist = str(raw?.gist, 420)
          if (!name || !gist) return null
          return { c, item: { id: `card.${c.id}`, text: textOf(name, gist), name, gist, quote: str(raw?.quote, 220) || undefined, grounded: grounded(str(raw?.quote, 220), text), note: `from ${members.length} readers` } as Item }
        } catch {
          return null
        }
      })
      const done = (await pool(jobs, 2, deps.signal)).filter((x): x is { c: ClusterOut; item: Item } => !!x)
      if (!done.length) throw new Error("No cluster could be written up")
      const cardVecs = await deps.embed(done.map((d) => d.item.text))
      done.forEach((d, k) => {
        const centre = centroid(d.c.members.map((id) => vecs[ideas.findIndex((i) => i.id === id)]!))
        const med = vecs[ideas.findIndex((i) => i.id === d.c.medoid)]!
        d.c.synth = { item: d.item, fidelity: cosine(cardVecs[k]!, centre), medoidFidelity: cosine(med, centre) }
        cards.push(d.item)
        synthVecs.push({ cluster: d.c.id, vec: cardVecs[k]! })
      })
      return { items: cards, prompt: firstPrompt, note: `${cards.length} cards; closer to its centre than the medoid in ${done.filter((d) => d.c.synth!.fidelity > d.c.synth!.medoidFidelity).length}` }
    })
  } else skip("synth", config.synth.on ? "no clusters" : "off")

  // 6. lone — hidden gems among the ideas nobody else had
  const gems: Item[] = []
  if (config.lone.on) {
    const loneItems = clusters.filter((c) => c.lone).map((c) => ideas.find((i) => i.id === c.members[0])!).filter((i) => !config.lone.groundedOnly || i.grounded)
    if (loneItems.length) {
      await timed("lone", async () => {
        const system = `${config.lone.prompt}\n\nThe passage:\n"""\n${text.slice(0, 3000)}\n"""`
        const user = loneItems.map((m, k) => `${k}. [${m.lens}] ${m.text}`).join("\n")
        const raw = await ask(config.lone.knob, system, user, LONE_SCHEMA)
        const list = Array.isArray(raw?.gems) ? (raw!.gems as Array<Record<string, unknown>>) : []
        for (const [k, g] of list.entries()) {
          const src = loneItems[Number(g.index)]
          const name = str(g.name, 60)
          const gist = str(g.gist, 260)
          if (src && name && gist && !gems.some((x) => x.note?.startsWith(src.id))) gems.push({ id: `gem.${k}`, text: textOf(name, gist), name, gist, quote: src.quote, grounded: src.grounded, lens: src.lens, note: `${src.id}: ${str(g.why, 200)}` })
        }
        return { items: gems, prompt: `${system}\n\n${user}`, note: `${gems.length} gem${gems.length === 1 ? "" : "s"} of ${loneItems.length} lone ideas` }
      })
    } else skip("lone", "no lone ideas" + (config.lone.groundedOnly ? " that quote the passage" : ""))
  } else skip("lone", "off")

  // 7. baseline — one careful call
  if (config.baseline.on) {
    await timed("baseline", async () => {
      const system = `${config.baseline.prompt}\nReport up to ${Math.max(6, config.agents.perAgent * 2)} ideas. For each: name, gist (one plain sentence), quote (copied exactly, or empty).`
      const raw = await ask(config.baseline.knob, system, `The passage:\n"""\n${text}\n"""`, IDEA_SCHEMA(Math.max(6, config.agents.perAgent * 2)))
      return { items: ideasFrom(raw, text, "baseline", "base", 12), prompt: system }
    })
  } else skip("baseline", "off")

  // 7b. nodes the player added: each reads one earlier output and reports ideas
  const extras: Record<string, StageOut> = {}
  for (const x of config.extra ?? []) {
    if (!x.on) { const s: StageOut = { id: x.id, status: "skipped", ms: 0, calls: 0, items: [], note: "off" }; extras[x.id] = s; deps.onStage?.(s); continue }
    const t = now()
    const c0 = calls
    let out: StageOut
    try {
      const src = x.from === "passage" ? text : (x.from === "result" ? [...(stages.synth?.items ?? []), ...(stages.lone?.items ?? [])] : extras[x.from]?.items ?? stages[x.from as StageId]?.items ?? []).map((i) => (typeof i === "string" ? i : `- ${i.text}`)).join("\n")
      if (!src.trim()) throw new Error(`${x.from} gave this node nothing to read`)
      const system = `${x.prompt}\nReport up to 6 ideas. For each: name (at most six words), gist (one plain sentence), quote (copied exactly from the passage, or empty).`
      const raw = await ask(x.knob, system, `${x.from === "passage" ? "The passage" : `Output of "${x.from}"`}:\n\"\"\"\n${src}\n\"\"\"\n\nThe passage (for quotes):\n\"\"\"\n${text.slice(0, 3000)}\n\"\"\"`, IDEA_SCHEMA(6))
      out = { id: x.id, status: "done", items: ideasFrom(raw, text, x.id, x.id, 6), prompt: system, ms: Math.round(now() - t), calls: calls - c0 }
    } catch (e) {
      out = { id: x.id, status: "error", ms: Math.round(now() - t), calls: calls - c0, items: [], error: e instanceof Error ? e.message : String(e) }
    }
    extras[x.id] = out
    deps.onStage?.(out)
  }

  // 8. the map: items, centres, cards and gems in one PCA so they share axes
  if (ideas.length && vecs.length) {
    try {
      const centres = clusters.filter((c) => !c.lone).map((c) => ({ c, v: centroid(c.members.map((id) => vecs[ideas.findIndex((i) => i.id === id)]!)) }))
      const gemVecs = gems.length ? await deps.embed(gems.map((g) => g.text)) : []
      const all = [...vecs, ...centres.map((x) => x.v), ...synthVecs.map((x) => x.vec), ...gemVecs]
      const xy = pca2(all)
      const clusterOf = new Map<string, number>()
      for (const c of clusters) for (const id of c.members) clusterOf.set(id, c.id)
      let k = 0
      ideas.forEach((i) => { const [x, y] = xy[k++]!; points.push({ id: i.id, kind: "idea", x, y, cluster: clusterOf.get(i.id) ?? -1 }) })
      centres.forEach((x) => { const [px, py] = xy[k++]!; points.push({ id: `centre.${x.c.id}`, kind: "centre", x: px, y: py, cluster: x.c.id }) })
      synthVecs.forEach((x) => { const [px, py] = xy[k++]!; points.push({ id: `card.${x.cluster}`, kind: "synth", x: px, y: py, cluster: x.cluster }) })
      gems.forEach((g) => { const [px, py] = xy[k++]!; points.push({ id: g.id, kind: "gem", x: px, y: py, cluster: -1 }) })
    } catch {
      // the map is a picture; a failed embed here costs only the picture
    }
  }

  return { id: deps.runId ?? `run-${Date.now().toString(36)}`, extras, status: "done", at: new Date().toISOString(), title: passage.title, passageId: passage.id, config: structuredClone(config), stages, clusters, points, ms: Math.round(now() - t0), calls, note: "" }
}
