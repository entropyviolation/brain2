/**
 * lib/idea-swarm/book.ts — Run the chunk pipeline over a whole book, and the passes over everything it found
 *
 * `chunkText` cuts a book at paragraph breaks into pieces of about `size` characters. `processBook` takes each chunk
 * through a gate (a weak model answers yes/no: "any useful ideas here?", which keeps contents, indexes and
 * bibliographies out) and then through `runPipeline`, several chunks at once. Each chunk is handed back through `onChunk`
 * the moment its state changes, so a page can show and save it. `bookLevel` then pools every chunk's cards and gems and
 * optionally clusters them, pulls key phrases and writes a summary loop. Pure apart from the functions it is handed.
 */

import { extractKeyphrases } from "@/lib/keyphrase"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { Embedder } from "./embed"
import { runPipeline } from "./pipeline"
import type { BookAgg, ChunkRec, Config } from "./types"
import { cluster } from "./vec"

export function chunkText(text: string, size: number): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = []
  let from = 0
  while (from < text.length) {
    let to = Math.min(text.length, from + size)
    if (to < text.length) {
      const brk = text.lastIndexOf("\n\n", to)
      const sentence = text.lastIndexOf(". ", to)
      const cut = brk > from + size * 0.5 ? brk + 2 : sentence > from + size * 0.5 ? sentence + 2 : to
      to = cut
    }
    out.push({ from, to })
    from = to
  }
  return out
}

const GATE_SYSTEM =
  "You screen pages of a book. Answer useful=true if the text explains, argues or teaches something: claims, concepts, examples, reasoning. Answer useful=false for a table of contents, index, copyright page, acknowledgements, bibliography, references, lists of names or page numbers, blank or near-blank text, or pure headings."
const GATE_SCHEMA = { type: "object", properties: { useful: { type: "boolean" } }, required: ["useful"] }

export async function gateChunk(call: ModelCall, model: string, text: string): Promise<{ useful: boolean; raw: string }> {
  try {
    const raw = (await call({ model, system: GATE_SYSTEM, user: `Are there any useful ideas in this chunk of text?\n"""\n${text.slice(0, 3500)}\n"""`, schema: GATE_SCHEMA, maxTokens: 30, temperature: 0 })) as { useful?: unknown } | null
    if (typeof raw?.useful === "boolean") return { useful: raw.useful, raw: raw.useful ? "yes" : "no" }
    return { useful: true, raw: "unclear, kept" }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e
    return { useful: true, raw: "gate failed, kept" }
  }
}

export type BookDeps = {
  call: ModelCall
  embed: Embedder
  signal: AbortSignal
  text: string
  title: string
  config: Config
  gate: boolean
  parallel: number
  onChunk: (c: ChunkRec) => void
  /** Run just this chunk (by index). */
  only?: number
}

export async function processBook(chunks: ChunkRec[], deps: BookDeps): Promise<void> {
  const todo = chunks.filter((c) => (deps.only === undefined ? c.status !== "done" && c.status !== "skipped" : c.i === deps.only))
  let next = 0
  const worker = async () => {
    while (next < todo.length && !deps.signal.aborted) {
      let c = todo[next++]!
      const text = deps.text.slice(c.from, c.to)
      const t0 = Date.now()
      const set = (p: Partial<ChunkRec>) => { c = { ...c, ...p }; deps.onChunk(c) }
      try {
        if (deps.gate) {
          set({ status: "gating", error: undefined })
          const g = await gateChunk(deps.call, deps.config.agents.knob.model, text)
          set({ useful: g.useful, gateRaw: g.raw })
          if (!g.useful) { set({ status: "skipped", ms: Date.now() - t0 }); continue }
        }
        set({ status: "running" })
        const run = await runPipeline(deps.config, { id: c.id, title: `${deps.title} · ${c.i + 1}`, text }, { call: deps.call, embed: deps.embed, signal: deps.signal })
        if (deps.signal.aborted) { set({ status: "pending" }); continue }
        const bad = run.stages.agents?.status === "error"
        set({ status: bad ? "error" : "done", run, error: bad ? run.stages.agents?.error : undefined, ms: Date.now() - t0 })
      } catch (e) {
        set({ status: deps.signal.aborted ? "pending" : "error", error: e instanceof Error ? e.message : String(e) })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(deps.parallel, todo.length)) }, worker))
}

/** Every card and gem a finished chunk produced, tagged with its chunk. */
export function poolIdeas(chunks: ChunkRec[]): BookAgg["items"] {
  return chunks
    .filter((c) => c.run)
    .flatMap((c) => [
      ...(c.run!.stages.synth?.items ?? []).map((i) => ({ id: `${c.i}:${i.id}`, text: i.text, chunk: c.i, kind: "card" as const })),
      ...(c.run!.stages.lone?.items ?? []).map((i) => ({ id: `${c.i}:${i.id}`, text: i.text, chunk: c.i, kind: "gem" as const })),
    ])
}

const SUM_SCHEMA = { type: "object", properties: { summary: { type: "string", maxLength: 700 } }, required: ["summary"] }

export async function bookLevel(
  chunks: ChunkRec[],
  config: Config,
  opts: { cluster: boolean; keywords: boolean; summarize: boolean; threshold: number },
  deps: { call: ModelCall; embed: Embedder; signal: AbortSignal; progress?: (s: string) => void },
): Promise<BookAgg> {
  const items = poolIdeas(chunks)
  const agg: BookAgg = { at: new Date().toISOString(), clusters: [], keywords: [], summaries: [], items, note: `${items.length} ideas from ${chunks.filter((c) => c.run).length} chunks` }
  if (!items.length) return agg

  if (opts.keywords) {
    const all = items.map((i) => i.text).join(". ")
    agg.keywords = (["textrank", "yake"] as const).map((m) => ({ method: m, phrases: extractKeyphrases(m, all, { top: 25 }).map((p) => p.phrase) }))
  }

  if (opts.cluster) {
    deps.progress?.("embedding ideas")
    const vecs = await deps.embed(items.map((i) => i.text))
    const groups = cluster(vecs, opts.threshold)
    agg.clusters = groups.map((g, n) => ({ id: n, members: g.map((k) => items[k]!.id), chunks: [...new Set(g.map((k) => items[k]!.chunk))].sort((a, b) => a - b), lone: g.length < 2 }))
    const big = agg.clusters.filter((c) => !c.lone).sort((a, b) => b.members.length - a.members.length).slice(0, 40)
    let k = 0
    for (const c of big) {
      if (deps.signal.aborted) break
      deps.progress?.(`naming themes ${++k}/${big.length}`)
      try {
        const lines = c.members.slice(0, 14).map((id, j) => `${j + 1}. ${items.find((i) => i.id === id)?.text ?? ""}`).join("\n")
        const raw = (await deps.call({ model: config.synth.knob.model, system: "These ideas came from different parts of one book and are close in meaning. Write ONE theme card: name (short) and gist (two plain sentences) saying what the book keeps coming back to.", user: lines, schema: { type: "object", properties: { name: { type: "string", maxLength: 60 }, gist: { type: "string", maxLength: 420 } }, required: ["name", "gist"] }, maxTokens: config.synth.knob.maxTokens, temperature: config.synth.knob.temperature })) as { name?: string; gist?: string } | null
        if (raw?.name && raw.gist) { c.name = raw.name; c.gist = raw.gist }
      } catch { /* an unnamed theme is still a theme */ }
    }
  }

  if (opts.summarize) {
    let level = items.map((i) => i.text)
    while (level.length > 1 && agg.summaries.length < 5 && !deps.signal.aborted) {
      const out: string[] = []
      const batches = Array.from({ length: Math.ceil(level.length / 12) }, (_, b) => level.slice(b * 12, b * 12 + 12))
      for (const [b, batch] of batches.entries()) {
        deps.progress?.(`summary level ${agg.summaries.length + 1}: ${b + 1}/${batches.length}`)
        try {
          const raw = (await deps.call({ model: config.synth.knob.model, system: "Summarise these ideas from one book into a single short passage that keeps the specific terms and the main line of argument. Add nothing.", user: batch.map((t, j) => `${j + 1}. ${t}`).join("\n"), schema: SUM_SCHEMA, maxTokens: 400, temperature: 0.2 })) as { summary?: string } | null
          if (raw?.summary) out.push(raw.summary)
        } catch { /* skip a batch that failed */ }
      }
      if (!out.length) break
      agg.summaries.push(out)
      level = out
    }
  }
  return agg
}
