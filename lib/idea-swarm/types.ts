/**
 * lib/idea-swarm/types.ts — The shapes of the idea-extraction lab: a pipeline config, a run, a passage, a gold set
 *
 * A `Config` is the whole experiment, one knob block per node (model, temperature, tokens, prompt). A `Run` is that
 * config as it was, plus what every node produced, so any run can be read, scored and compared long after the config
 * moved on. Nothing here talks to a model.
 */

import type { KeyphraseMethod } from "@/lib/keyphrase"

export type Knob = { model: string; temperature: number; maxTokens: number }

export type Lens = {
  id: string
  label: string
  /** What this reader looks for. */
  prompt: string
  on: boolean
  /** Overrides the agents' knob for this reader only. */
  model?: string
  temperature?: number
}

export type Config = {
  id: string
  name: string
  keyphrases: { on: boolean; methods: KeyphraseMethod[]; top: number; /** Tell each reader the topics found. */ feed: boolean }
  topicInsight: { on: boolean; knob: Knob; prompt: string }
  agents: { knob: Knob; lenses: Lens[]; perAgent: number; /** Readers per lens (same lens, fresh sample). */ samples: number; parallel: number }
  embed: { model: string }
  cluster: { threshold: number; minSize: number }
  synth: { on: boolean; knob: Knob; prompt: string }
  lone: { on: boolean; knob: Knob; prompt: string; groundedOnly: boolean }
  baseline: { on: boolean; knob: Knob; prompt: string }
  /** Nodes the player added: each reads one earlier node's output (or the passage) and reports ideas. */
  extra?: ExtraNode[]
}

export type ExtraNode = { id: string; label: string; /** A node id, `passage`, `result` or another extra. */ from: string; knob: Knob; prompt: string; on: boolean }

export const STAGES = ["keyphrases", "topicInsight", "agents", "cluster", "synth", "lone", "baseline"] as const
export type StageId = (typeof STAGES)[number]

export type Item = {
  id: string
  text: string
  name?: string
  gist?: string
  quote?: string
  /** The quote is really in the passage. */
  grounded?: boolean
  lens?: string
  method?: KeyphraseMethod
  /** Keyphrase score, or a lone gem's reason. */
  note?: string
}

export type StageOut = {
  id: string
  status: "done" | "skipped" | "error"
  ms: number
  calls: number
  items: Item[]
  /** The first prompt sent, so the node can show what it was asked. */
  prompt?: string
  note?: string
  error?: string
}

export type ClusterOut = {
  id: number
  members: string[]
  /** The member nearest the centre. */
  medoid: string
  lenses: string[]
  lone: boolean
  synth?: { item: Item; /** Cosine of the written card to the cluster centre. */ fidelity: number; /** Same for the medoid, to beat. */ medoidFidelity: number }
}

export type MapPoint = { id: string; kind: "idea" | "centre" | "synth" | "gem"; x: number; y: number; cluster: number }

export type Run = {
  id: string
  at: string
  title: string
  passageId: string
  config: Config
  stages: Partial<Record<StageId, StageOut>>
  clusters: ClusterOut[]
  points: MapPoint[]
  ms: number
  calls: number
  note: string
  error?: string
  /** `running` is saved at the start and after every node, so a refresh can pick the run up; `stopped` keeps what finished. */
  status?: "running" | "stopped" | "done"
  /** Each finished reader call, keyed `lens#sample`, so a resumed run skips them. */
  readers?: Record<string, Item[]>
  extras?: Record<string, StageOut>
}

export type Passage = { id: string; title: string; text: string; at: string }

/** One acceptable answer, step by step. A passage may have several. */
export type GoldVersion = { id: string; label: string; keyphrases: string[]; insights: string[]; ideas: string[]; gems: string[] }
export type Gold = { id: string; passageId: string; versions: GoldVersion[]; at: string }

/** A whole book: split into chunks, each gated by a weak model ("any useful ideas here?") then run through the chunk pipeline. */
export type Book = {
  id: string
  title: string
  at: string
  text: string
  chunkSize: number
  /** Chunks in flight at once. */
  parallel: number
  gate: boolean
  /** The setup frozen when processing began, so a resumed book finishes the way it started. */
  config?: Config
  status: "idle" | "running" | "stopped" | "done"
  agg?: BookAgg
}

export type ChunkRec = {
  id: string
  bookId: string
  i: number
  from: number
  to: number
  status: "pending" | "gating" | "skipped" | "running" | "done" | "error"
  /** The gate's answer: were there useful ideas here. */
  useful?: boolean
  gateRaw?: string
  error?: string
  run?: Run
  ms?: number
}

/** Book-level passes over every chunk's cards and gems. */
export type BookAgg = {
  at: string
  clusters: Array<{ id: number; members: string[]; chunks: number[]; lone: boolean; name?: string; gist?: string }>
  keywords: Array<{ method: string; phrases: string[] }>
  /** Summary loop: level 0 summarises batches of ideas, each next level summarises the level below, ending in one. */
  summaries: string[][]
  items: Array<{ id: string; text: string; chunk: number; kind: "card" | "gem" }>
  note: string
}
