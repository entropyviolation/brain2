/**
 * lib/bim-flow/types.ts — A routed graph of small model questions over one BIM message
 *
 * A flow is nodes and edges. Each message enters at the `message` node and
 * walks every edge it is allowed down. A `gate` asks one yes/no question and
 * takes its `yes` or `no` edge. Everything else leaves by `out`. Nodes never
 * write the vault: a `propose` node only collects what would be written.
 */

export type FlowNodeKind = "message" | "gate" | "search" | "choose" | "extract" | "propose" | "blocks"

export type FlowPort = "out" | "yes" | "no"

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

/** A labelled case the person taught a gate from a run. */
export interface GateExample {
  text: string
  answer: "yes" | "no"
}

export interface FlowNodeConfig {
  /** gate / choose: the question. extract: what to pull out. */
  question?: string
  /** gate: taught cases, shown to the model as few-shot lines. */
  examples?: GateExample[]
  /** search */
  source?: SearchSource
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
  text: string
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
  port: FlowPort
  output: unknown
  error?: string
  /** The prompt the model saw, for the inspector. */
  prompt?: string
}

export interface MessageRun {
  message: FlowMessage
  steps: TraceStep[]
  proposals: Proposal[]
  signals: ActivitySignal[]
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
