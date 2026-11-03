/**
 * lib/critic-bimby/types.ts — Shapes for the Critic BIMBY (the second look)
 *
 * A critic reads the person's words and a finished plan and says what does not match. It never edits and never writes.
 * Plan: `docs/CRITIC_BIMBY_PLAN.md`.
 */

export type FindingKind = "invented" | "dropped" | "misordered" | "wrong-link" | "too-broad" | "ambiguous"

export interface Finding {
  kind: FindingKind
  /** The host's id for the row this is about, or "plan" for the whole thing. */
  where: string
  /** Copied from the line. A model finding must carry one; code checks it. */
  quote?: string
  /** One plain sentence, at most 140 characters. */
  reason: string
  by: "code" | "model"
  /** certain: the line contradicts the plan. hint: probably wrong, a person should look. */
  strength: "certain" | "hint"
}

export type Verdict = "pass" | "warn" | "fail"

export interface Critique {
  verdict: Verdict
  findings: Finding[]
  /** code-only: no model ran. full: a model on another model than the planner. same-model: a hint at most. */
  trust: "code-only" | "full" | "same-model"
  model?: string
  hops: { model: string; ms: number; why?: string }[]
  ms: number
  /** Why the model layer did not run, when it did not. */
  skipped?: string
}

/** What a key does to the draft. Run by code on the person's pick, never by the critic. */
export type KeyAction =
  | { kind: "add-row"; title: string }
  | { kind: "remove-row"; rowId: string }
  | { kind: "clear-link"; rowId: string }

export interface CriticKey {
  label: string
  action: KeyAction
}

/** What the person changed between the first read and the confirmed plan. */
export interface PlanEdit {
  kind: "added" | "removed" | "retitled" | "relinked"
  rowId: string
}

export type Outcome = "accepted" | "edited" | "key" | "kept-over-critic" | "cancelled"

export interface CriticRecord {
  id: string
  at: string
  host: "plan"
  line: string
  planHash: string
  critique: Critique
  outcome: Outcome
  edits: PlanEdit[]
}
