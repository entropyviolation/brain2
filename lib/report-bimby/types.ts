/**
 * lib/report-bimby/types.ts — The shapes of a status report and what BIM proposes from it
 *
 * A report is one chat message that says several things at once ("started my period, took 1
 * adderall, only 3 left, been on youtube for hours"). The Report BIMBY turns it into a plan:
 * a thought trace and a list of effects. An effect is one proposed change with the reasons for
 * it, the evidence it rests on, and fields the person can edit. Nothing is written until the
 * person accepts an effect, and an accept reads the fields as they are then.
 */

import type { AcceptGrade } from "@/lib/accept-grade"

/** `line`: one command the executor already runs (Stream BIMBY). Accept sends the field to the executor. */
/** `verdict` and `feeling`: a plan-to-outcome link and a feeling on its scales (`lib/follow-through/`). Accept confirms the record. */
/** `person`, `person-note`, `birthday`, `reminder`, `plan-entry`, `intention`: the Social BIMBY (`lib/social-bimby/`). */
/** `amend`: a change to an open task a brain dump names again; `pattern`: a thought pattern to confirm (`lib/dump-bimby/`). */
/** `day`: a change to the live day plan (`lib/plan-bimby/day/update.ts`); `op` says which, `ref` is the plan id. */
export type EffectKind =
  | "inventory"
  | "cycle"
  | "intake"
  | "timeblock"
  | "sleep"
  | "line"
  | "verdict"
  | "feeling"
  | "person"
  | "person-note"
  | "birthday"
  | "reminder"
  | "plan-entry"
  | "intention"
  | "day"
  | "amend"
  | "pattern"

export type EffectStatus = "pending" | "working" | "applied" | "rejected" | "failed"

export interface EffectField {
  key: string
  label: string
  type: "text" | "number" | "datetime" | "select"
  /** Always a string, so an input can hold it. `datetime` is `YYYY-MM-DDTHH:mm` local. */
  value: string
  options?: string[]
}

export interface Effect {
  id: string
  kind: EffectKind
  /** One line, as the proposal reads before any edit. */
  title: string
  /** Why BIM proposes this, step by step. */
  reasoning: string[]
  /** Facts it rests on: tracked time, Chrome visits, the current inventory count. */
  evidence: string[]
  fields: EffectField[]
  status: EffectStatus
  /** For a `day` effect: `add`, `done`, `feel` or `first`. */
  op?: string
  /** The record this effect confirms (a step or feeling id in the follow-through ledger). */
  ref?: string
  /** What happened on accept: the writer's reply, or why it failed. */
  result?: string
  /** `ok`: accepted with the Neutral key (`lib/accept-grade.ts`). Applied the same, never a good example. */
  grade?: AcceptGrade
}

export interface ReportPlan {
  id: string
  /** The message as sent. */
  text: string
  /** ISO. When it was sent; "now" for every relative phrase in it. */
  at: string
  /** The reading, in order: what was found in the message and what was looked up. */
  trace: string[]
  effects: Effect[]
}

export const fieldValue = (effect: Effect, key: string): string => effect.fields.find((f) => f.key === key)?.value ?? ""
