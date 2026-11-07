/**
 * lib/wire-bimby/types.ts — The shapes of a wiring plan
 *
 * The Wire BIMBY turns a sentence like "connect the speed reader to my daily reading habit" into a
 * plan of small steps. Each step is plain data (a feed row or a detail-view panel for one habit)
 * with the checks it passed or failed. Nothing is written until the person accepts a step.
 */
export type WireStepKind = "feed" | "breakdown" | "entry" | "track"
export type WireStatus = "pending" | "applied" | "rejected" | "failed"

export interface WireField {
  key: "habit" | "module" | "measure" | "subjectType" | "pen" | "parentPen"
  label: string
  value: string
  /** Allowed values, as `[value, label]`. Empty for a free text field. */
  options: [string, string][]
  /** A typed name (a pen) rather than a pick. */
  free?: boolean
}

export interface WireCheck {
  ok: boolean
  /** One line either way: what was checked and what was found. */
  text: string
}

export interface WireStep {
  id: string
  kind: WireStepKind
  title: string
  reasoning: string[]
  fields: WireField[]
  status: WireStatus
  result?: string
}

export interface WirePlan {
  id: string
  /** The sentence as sent, plus each tweak on a new line. */
  text: string
  at: string
  trace: string[]
  steps: WireStep[]
  /** How many times the person asked for a change and the plan was rebuilt. */
  revisions: number
}

export const wireField = (step: WireStep, key: WireField["key"]): string => step.fields.find((f) => f.key === key)?.value ?? ""
