/**
 * lib/overcome-bimby/types.ts — Shapes for the Overcome executive dysfunction pipeline
 */

export type Barrier = "dread" | "boring" | "overwhelm" | "vague" | "perfectionism" | "choices" | "cost" | "unknown"

/** What the READ stage heard in one message. Everything is the person's own words where it can be. */
export interface Reading {
  task: string
  /** How they said the resistance feels, as spoken. */
  resistance: string
  barrier: Barrier
  /** Days past due; 0 when no lateness was said. */
  overdueDays: number
  /** Why it matters to them, quoted. */
  motivation: string[]
  /** What happens if it stays undone, quoted or plainly implied. */
  consequences: string[]
}

export type TacticKind = "friction" | "dopamine" | "scaffold" | "block" | "reframe" | "consequence" | "reward" | "decide" | "prep" | "message" | "restart"

export interface Tactic {
  id: string
  name: string
  kind: TacticKind
  /** One instruction, second person, small enough to do in the next minute. */
  do: string
  /** Barriers it is known to help. Empty means any. */
  helps: Barrier[]
  /** Needs a second person or an outside service. */
  external?: boolean
}

export type Outcome = "started" | "stuck"

export interface ResistanceEntry {
  id: string
  at: string
  said: string
  reading: Reading
  /** Tactics offered, best first. */
  offered: string[]
  /** The tactic put in the push only to test it. */
  experiment?: string
  /** Where it was said. Default `lab`. */
  source?: "lab" | "chat"
  /** The tactic the person says they tried, and how it went. */
  tried?: { tacticId: string; outcome: Outcome; at: string }
}

export interface Push {
  message: string
  tactics: Tactic[]
  by: "model" | "rules"
}
