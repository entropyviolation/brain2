/**
 * lib/report-bimby/types.ts — The shapes of a status report and what BIM proposes from it
 *
 * A report is one chat message that says several things at once ("started my period, took 1
 * adderall, only 3 left, been on youtube for hours"). The Report BIMBY turns it into a plan:
 * a thought trace and a list of effects. An effect is one proposed change with the reasons for
 * it, the evidence it rests on, and fields the person can edit. Nothing is written until the
 * person accepts an effect, and an accept reads the fields as they are then.
 */

export type EffectKind = "inventory" | "cycle" | "intake" | "timeblock"

export type EffectStatus = "pending" | "applied" | "rejected" | "failed"

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
  /** What happened on accept: the writer's reply, or why it failed. */
  result?: string
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
