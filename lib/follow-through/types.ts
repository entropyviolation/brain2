/**
 * lib/follow-through/types.ts — The four linked records a stream line becomes
 *
 * Intention (future tense, split into ordered steps with a hedge), prospective feeling (pull and
 * push before doing it, two separate scales), action (what happened, at its minute), retroactive
 * feeling (how one action sits afterwards). A step carries its verdict: the link from plan to
 * outcome. Every scale is 0–4 so one tap answers it. A blank is unknown, never zero.
 */

/** How firmly a step was said. "need to" is `must`, "gonna" is `will`, "maybe" and "try to" are `maybe`. */
export type Hedge = "must" | "will" | "maybe"

/** 0 none … 4 very high. For satisfaction: 0 awful, 1 bad, 2 fine, 3 good, 4 great. */
export type Scale = 0 | 1 | 2 | 3 | 4

export const LEVEL_WORDS = ["none", "low", "medium", "high", "very high"] as const
export const AFTER_WORDS = ["awful", "bad", "fine", "good", "great"] as const

export const VERDICTS = ["done", "late", "displaced", "dropped", "open"] as const
export type Verdict = (typeof VERDICTS)[number]

export const VERDICT_LABEL: Record<Verdict, string> = {
  done: "done as planned",
  late: "done late",
  displaced: "displaced",
  dropped: "dropped",
  open: "still open",
}

/** Who stands behind a link or a feeling. Findings count `confirmed` and `asked` only. */
export type Standing = "proposed" | "confirmed" | "rejected"

export type RecordSource = "stream" | "chat" | "report" | "mined" | "tracking"

export interface Step {
  id: string
  intentionId: string
  order: number
  /** The step in the person's words, hedge words removed. */
  what: string
  hedge: Hedge
  verdict: Verdict
  standing: Standing
  /** The action that fulfilled it. */
  actionId?: string
  /** Minutes from the plan to the action's start. */
  delayMin?: number
  /** What was done instead, in the person's words. */
  displacedBy?: string
  /** The answer to "what pulled you away?". */
  awayReason?: string
  /** The answer to "what's in the way?". */
  blocker?: string
  /** Actions the person said did not fulfil this step; the linker never proposes them again. */
  refused?: string[]
  /** Earlier undone steps this one repeats (ids), oldest first. */
  repeats: string[]
  /** Question kinds already answered or skipped, so nothing is asked twice. */
  asked: string[]
}

export interface Intention {
  id: string
  /** ISO minute the plan was said. */
  at: string
  day: string
  /** The sentence as said. */
  said: string
  steps: Step[]
  source: RecordSource
}

export type ActionKind = "activity" | "count" | "food" | "drink" | "wake" | "other"

export interface Action {
  id: string
  day: string
  /** ISO start. */
  at: string
  /** ISO end, for a block. */
  end?: string
  what: string
  kind: ActionKind
  said: string
  /** The step this fulfilled, when one did. */
  stepId?: string
  source: RecordSource
  asked: string[]
}

export interface Feeling {
  id: string
  at: string
  day: string
  /** `before`: prospective, about a step. `after`: retroactive, about an action. */
  phase: "before" | "after"
  stepId?: string
  actionId?: string
  /** What it is about, in the person's words, when no record matched ("I woke up early"). */
  aboutWords?: string
  /** Pull toward it. */
  excitement?: Scale
  /** Push away from it. Not the opposite of excitement: both can be high. */
  resistance?: Scale
  importance?: Scale
  /** After only. */
  satisfaction?: Scale
  /** The words it was read from; empty when it was a tap. */
  words: string
  /** `said`: read from words by rules. `model`: read by the model. `asked`: a one-tap answer. */
  by: "said" | "model" | "asked"
  standing: Standing
}

export interface Ledger {
  intentions: Intention[]
  actions: Action[]
  feelings: Feeling[]
}

export const emptyLedger = (): Ledger => ({ intentions: [], actions: [], feelings: [] })

export const allSteps = (l: Ledger): Step[] => l.intentions.flatMap((i) => i.steps)

export const asScale = (n: unknown): Scale | undefined => {
  const v = typeof n === "string" && n.trim() !== "" ? Number(n) : n
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 4 ? (v as Scale) : undefined
}

/** Small stable id from text, so reading the same stream twice lands on the same records. */
export function hashId(prefix: string, ...parts: string[]): string {
  let h = 5381
  for (const ch of parts.join("\u0001")) h = ((h << 5) + h + ch.charCodeAt(0)) | 0
  return `${prefix}_${(h >>> 0).toString(36)}`
}
