/**
 * lib/bim-flow/types.ts — A routed graph of small model questions over one BIM message
 *
 * A flow is nodes and edges. Each message enters at the `message` node and
 * walks every edge it is allowed down. A `gate` asks one yes/no question and
 * takes its `yes` or `no` edge. Everything else leaves by `out`. Nodes never
 * write the vault: a `propose` node only collects what would be written.
 */

export type FlowNodeKind = "message" | "gate" | "search" | "choose" | "extract" | "propose" | "blocks" | "related" | "retrieve" | "answer" | "route" | "handoff" | "link" | "compute" | "clarify" | "guard" | "fallback"

/** `r:<key>` is one output of a `route` node. */
export type FlowPort = "out" | "yes" | "no" | `r:${string}`

/** Where a `search` node looks. */
export type SearchSource = "items" | "lists" | "habits" | "pens" | "people"

export type ExtractFieldType = "string" | "number" | "boolean" | "clock" | "enum"

export interface ExtractField {
  name: string
  type: ExtractFieldType
  /** One line telling the model what goes here. */
  hint?: string
  /** For `enum`. */
  options?: string[]
}

export type ProposeAction =
  | "add-to-list"
  | "habit-done"
  | "intake"
  | "mood"
  | "person-mention"
  | "idea"
  | "todo"
  | "dream"
  | "body"
  | "location"
  | "company"
  /** A feeling about a task: resistance or excitement, how strong, why. Kept in the drive log (`drive.ts`). */
  | "drive"

/** A labelled case the person taught a gate from a run. */
export interface GateExample {
  text: string
  answer: "yes" | "no"
}

/**
 * Which Ollama model runs which kind of step. A step uses its own `config.model` first, then its
 * tier's model here, then the run's main model. `gates` covers gate, route and choose (short
 * yes/no or pick-one calls); `prose` covers every answer node (SAY, summarize, check, insight).
 * Extract and related steps stay on the main model.
 */
export interface ModelPlan {
  gates?: string
  prose?: string
}

export interface FlowNodeConfig {
  /** Any model step: an Ollama model for this node alone. Beats the run's `ModelPlan`. */
  model?: string
  /** gate / choose: the question. extract: what to pull out. */
  question?: string
  /** gate: taught cases, shown to the model as few-shot lines. */
  examples?: GateExample[]
  /** search */
  source?: SearchSource
  /** link: which entities to keep. `topic` = lists, habits, pens, items. */
  linkKind?: "person" | "topic" | "any"
  /** search: `all` lists everything in the source (pens are few). */
  all?: boolean
  /** search: Activity, Location, Mood… which tracking view's pens. */
  scopeId?: string
  limit?: number
  /** choose: the search node whose hits are the options. */
  fromNodeId?: string
  /** choose: most picks. */
  max?: number
  /** extract */
  fields?: ExtractField[]
  /** propose */
  action?: ProposeAction
  /** message (a start node): which part of the app feeds it. See `entries.ts`. */
  entry?: string
  /** route: the outputs. A route sends a message to the best one (or to none), instead of asking every lane in parallel. */
  routes?: RouteDef[]
  /** route: most outputs followed. Keep at 1; a model asked to pick several pads the list. */
  maxRoutes?: number
  /** handoff: the flow that takes the message from here. */
  flowId?: string
  /** extract / answer / related: replaces the built-in system instructions for this node. */
  system?: string
  /** answer: added after the built-in instructions, so a prompt fix there still reaches this node. */
  extra?: string
  /** compute: a counting function over tracked entries, no model. */
  compute?: ComputeConfig
  /** clarify: which entities may be ambiguous. Default `any`. */
  clarifyKind?: "person" | "topic" | "any"
  /** retrieve: which part of the app to read, with no model. */
  retrieve?: RetrieveConfig
  /** answer: what kind of reply. `check` re-reads the draft against the evidence. */
  mode?: AnswerMode
  /** insight: what to look for, in the analysis's own words. */
  lens?: string
  /** insight: which kinds it may return. */
  insightKinds?: InsightKind[]
  /** insight: fewer rows than this and it says so instead of guessing. */
  minRows?: number
  /** insight: most insights per run. */
  maxInsights?: number
  /** answer: retrieve nodes whose evidence it may use. */
  fromNodeIds?: string[]
}

/** What a `compute` node counts, in code. */
export type ComputeFn = "count" | "minutes" | "by-day" | "streak" | "days-since" | "longest-gap" | "top-pens" | "compare"

export interface ComputeConfig {
  fn: ComputeFn
  /** Tracking views to read. Empty = the person-facing ones. */
  scopeIds?: string[]
  /** Window in days back from the message. A time word in the message ("yesterday", "last week") wins over this. */
  days?: number
  /** Most rows shown as evidence. */
  limit?: number
  /** Count only entries the person confirmed (default true). */
  confirmedOnly?: boolean
}

export interface RouteDef {
  key: string
  label: string
  /** One line telling the model when to choose it. */
  hint?: string
  /** A regular expression. When one matches, code picks this route and no model is asked. */
  pattern?: string
}

export type AnswerMode = "answer" | "summarize" | "check" | "insight"

export type RetrieveKind =
  /** Tracked entries (Activity, Location, Company, Mood, calls, texts) matching the terms. */
  | "entries"
  /** BIM messages, log items, day notes and item titles matching the terms. */
  | "text"
  /** Days a named person was around, then rows on those days matching the subject. */
  | "overlap"
  /** Everything on one day: entries, messages, logs, notes. */
  | "day"
  /** A named table from the Data screens (miss reasons, ritual answers, pushed tasks…). */
  | "dataset"
  /** Recent phone texts (14 days by default, never more than 60): counted in code, newest rows shown. */
  | "texts"

export interface RetrieveConfig {
  kind: RetrieveKind
  /** entries / overlap: tracking views to read. Empty = the person-facing ones. */
  scopeIds?: string[]
  /** Only this many days back from the message. Empty = all. */
  days?: number
  limit?: number
  /** dataset: which table (`miss-reasons`, `ritual-answers`, `pushed-tasks`, `thoughts`, `moods`, `insight-log`). */
  datasetId?: string
  /** dataset: keep only rows containing any of these words. */
  focus?: string
  /** dataset: keep only rows whose source is one of these. */
  sources?: string[]
  /** Rank by meaning (Ollama embeddings) when an embedding model is installed. */
  semantic?: boolean
}

export interface FlowNode {
  id: string
  kind: FlowNodeKind
  label: string
  x: number
  y: number
  config: FlowNodeConfig
}

export interface FlowEdge {
  id: string
  from: string
  to: string
  port: FlowPort
}

export interface Flow {
  version: 1
  nodes: FlowNode[]
  edges: FlowEdge[]
}

/** One message going in. `prior` is the few messages just before it, oldest first. */
export interface FlowMessage {
  id: string
  /** Which start node this came in through (see `entries.ts`). Empty = the first start node. */
  entry?: string
  text: string
  /** Extra lines an input step attached (related past messages, related terms). Shown to every node. */
  context?: string
  /** Send time, ISO. */
  at: string
  prior: { text: string; at: string }[]
}

/** One hit from a `search` node. `lists` is where that item already lives. */
export interface SearchHit {
  id: string
  title: string
  source: SearchSource
  lists?: string[]
  /** How many of the message's words it matched. */
  matched: number
  words: string[]
}

export interface SearchOutput {
  terms: string[]
  hits: SearchHit[]
  /** Distinct names a `choose` node may pick from (list names for items). */
  options: string[]
  /** link: how each mention was read (`linked`, `ambiguous`, `nil`). */
  links?: { text: string; status: "linked" | "ambiguous" | "nil"; labels: string[] }[]
  /** link: true when no mention linked and the word search answered instead. */
  fellBack?: boolean
}

export interface Proposal {
  messageId: string
  nodeId: string
  action: ProposeAction
  /** What would be written, in words. */
  summary: string
  data: Record<string, unknown>
}

/** What a `blocks` node hands the batch step. */
export interface ActivitySignal {
  messageId: string
  at: string
  activity: string
  relation: "starting" | "doing_now" | "finished" | "did_earlier"
  /** The clock exactly as the message said it ("4:46"); code places it. */
  since?: string
  minutesLeft?: number
}

export interface TraceStep {
  nodeId: string
  ms: number
  /** The model this step asked, when it was not the run's main one. */
  model?: string
  port: FlowPort
  /** A route can follow more than one output. */
  ports?: FlowPort[]
  output: unknown
  error?: string
  /** The prompt the model saw, for the inspector. */
  prompt?: string
}

/** One row of evidence a retrieve node found. */
export interface EvidenceRow {
  when: string
  source: string
  text: string
}

export interface Evidence {
  kind: RetrieveKind
  terms: string[]
  rows: EvidenceRow[]
  /** Rows found before the cap. */
  total: number
  /** Facts counted by code (first, last, how many, tally), so the model never has to count. */
  facts: string[]
  note?: string
}

export interface RelatedOutput {
  terms: string[]
}

export type InsightKind = "pattern" | "thought_pattern" | "question" | "idea"

/** One thing BIM noticed, asked, or suggests. Every one cites evidence lines; code drops any that do not. */
export interface Insight {
  kind: InsightKind
  text: string
  strength: "strong" | "likely" | "weak"
  /** 1-based numbers of the evidence lines it rests on. */
  cites: number[]
}

export interface Answer {
  nodeId: string
  mode: AnswerMode
  text: string
  confidence: "high" | "medium" | "low" | "none"
  /** The evidence lines the model was shown. */
  evidence: EvidenceRow[]
  /** 1-based numbers of the lines the model says it used. */
  used: number[]
  /** For a `check`: the draft it started from. */
  draft?: string
  /** For `insight`: what survived the citation check. */
  insights?: Insight[]
  /** For `insight`: how many the model gave that code dropped (no valid citation, or a repeat). */
  dropped?: number
  facts: string[]
}

export interface MessageRun {
  message: FlowMessage
  steps: TraceStep[]
  proposals: Proposal[]
  signals: ActivitySignal[]
  answers: Answer[]
}

export interface TimeBlock {
  activity: string
  start: string
  end: string
  estimated: boolean
  why: string
  evidence: string[]
}

export interface FlowRun {
  model: string
  startedAt: string
  ms: number
  messages: MessageRun[]
  blocks: TimeBlock[]
}
