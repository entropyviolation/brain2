/**
 * lib/plan-bimby/types.ts — Shapes for the Plan BIMBY (short-term plan execution)
 *
 * The person says a plan in one breath. The BIMBY splits it into ordered items (`PlanItem`), the person
 * confirms and edits them, and they become a run list (`RunItem`) of play / pause / done rows. A link says
 * what finishing an item also does: log an intake, ask for a flight confirmation, or log time on a task.
 * Plan: `lib/plan-bimby/README.md`.
 */

import type { Critique } from "@/lib/critic-bimby/types"
import type { IntakeClass } from "@/lib/time-entries"

export type PlanLink =
  /** Finishing logs this intake row (source: Plan BIMBY). */
  | { kind: "intake"; label: string; intakeClass: IntakeClass }
  /** Finishing asks for the booking confirmation and files a Flight item. */
  | { kind: "flight" }
  /** Time on this item is logged on an existing task. `confirmed` is the person's yes to the match. */
  | { kind: "task"; taskId: string; title: string; confirmed: boolean }

export type PlanPace = "urgent" | "steady" | "relaxed"

export interface PlanSub {
  id: string
  title: string
  /** The words that gave a time, such as "by 8am". Shown as written. */
  due?: string
  done?: boolean
}

/** One detected task, before the person confirms it. */
export interface PlanItem {
  id: string
  title: string
  subtasks: PlanSub[]
  pace: PlanPace
  /** Free words about speed or a deadline: "as quickly as possible", "by 9am (10 latest)". */
  paceNote?: string
  /** Minutes the person said ("clean space for 15 min"). */
  minutes?: number
  link?: PlanLink
}

export interface PlanDraft {
  items: PlanItem[]
  /** Text the BIMBY heard but did not make a task of (a mood, a remark). Shown so nothing is silently dropped. */
  remarks: string[]
  /** The sentence the draft was read from. */
  source: string
  /** Which stage read it: the model, or the plain rules. */
  by: "model" | "rules"
  model?: string
  /** Why the rules answered instead of a model. */
  fallback?: string
  /** The second look (`lib/critic-bimby/`), set by the panel after the read. Never written to a run. */
  critique?: Critique
}

export type RunState = "todo" | "running" | "paused" | "done" | "skipped"

export interface RunItem extends PlanItem {
  state: RunState
  /** ISO time of the current play. Set only while `running`. */
  playedAt?: string
  /** Milliseconds from earlier plays. */
  accumMs: number
  doneAt?: string
  /** What finishing did, in plain words: "Logged intake: coffee", "Logged 42 min on Finish CDs". */
  effects: string[]
  /** Flight items wait here until a confirmation is pasted. */
  needsConfirmation?: boolean
}

export interface Run {
  id: string
  startedAt: string
  items: RunItem[]
  remarks: string[]
  source: string
}
