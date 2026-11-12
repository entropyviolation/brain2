/**
 * lib/plan-bimby/day/types.ts — Shapes for the Plan BIMBY's Today pipeline (a day plan made in BIM chat)
 *
 * One message ("what I have to do for the rest of the day: …") becomes a `DayPlan`: ordered items, each with
 * a tier (must / important / if time), an estimate that says where it came from, and the reasons behind it
 * (why, what happens if not, resistance). Everything is editable on the card. Nothing is written until the
 * person files it. Plan: `lib/plan-bimby/README.md`.
 */

/** `must`: said as non-negotiable. `important`: said as important. `rest`: on the list, no weight given. */
export type DayTier = "must" | "important" | "rest"

export const TIER_LABEL: Record<DayTier, string> = { must: "must", important: "important", rest: "if time" }

/**
 * Where an estimate came from, strongest first: `you` typed it on the card, `said` in the message,
 * `history` from your own similar past tasks, `model` a local model's guess, `rule` a rule of thumb,
 * `default` nothing known.
 */
export type EstimateSource = "you" | "said" | "history" | "model" | "rule" | "default"

export interface DayEstimate {
  minutes: number
  source: EstimateSource
  /** One plain sentence: what the number rests on. */
  basis: string
}

/** A model's guess at the reasons. Shown as a guess; kept only when the person takes it. */
export interface DayGuess {
  why?: string
  ifNot?: string
}

export interface DayItem {
  id: string
  title: string
  /** The words it was read from. */
  said: string
  tier: DayTier
  /** "asap", "right away": goes to the front. */
  urgent: boolean
  subtasks: string[]
  /** An aside in brackets that is not a step ("tights comes to mind"). */
  note?: string
  estimate: DayEstimate
  /** Why the person wants it done, in their words. */
  why: string
  /** What happens if it is not done, in their words. */
  ifNot: string
  /** Push away from it, 0 none … 4 very high. Undefined is unknown, never zero. */
  resistance?: number
  /** What is in the way, in their words. */
  blocker: string
  /** The item this one waits on (its id). */
  after?: string
  /** Why BIM gave it this tier and place. */
  reasons: string[]
  guess?: DayGuess
  /** An open task with the same name. With `useTask`, filing updates it instead of making a new one. */
  taskId?: string
  taskTitle?: string
  useTask?: boolean
  /** Set by filing. */
  filedTaskId?: string
  stepId?: string
  /** Set when its run row is finished. */
  actualMin?: number
  doneAt?: string
}

export type AskKey = "why" | "resistance" | "blocker" | "ifNot"

export interface DayPlan {
  id: string
  /** The message as sent. */
  text: string
  /** ISO. When it was sent. */
  at: string
  /** Local `HH:mm` the day ends at. Editable. */
  until: string
  items: DayItem[]
  /** Heard but not a task. */
  remarks: string[]
  trace: string[]
  /** A model is still working out estimates and reasons. */
  thinking?: boolean
  model?: string
  /** The question BIM is waiting on. */
  asking?: { itemId: string; key: AskKey }
  /** `itemId:key` already answered or skipped. */
  asked: string[]
  /** "stop asking". */
  quiet?: boolean
  filed?: { at: string; tasks: number }
  /** The Plan BIMBY run started from this plan. */
  runId?: string
  rejected?: boolean
  revisions: number
}

let seq = 0
export const dayItemId = (): string => `day-${Date.now().toString(36)}-${(seq++).toString(36)}`
