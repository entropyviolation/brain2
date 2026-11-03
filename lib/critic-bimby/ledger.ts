/**
 * lib/critic-bimby/ledger.ts — What the critic said against what the person did (this device only)
 *
 * One record per second look, kept in `localStorage` and appended to the disk archive (`critic-verdict`). The
 * person's action is the oracle; a model's score is only a hint. `classify` reads a record as a catch, a miss, a
 * false alarm or neither, and `rates` sums them. Reads and writes never throw.
 */

import { archive } from "@/lib/bim-flow/archive"
import type { PlanItem } from "@/lib/plan-bimby/types"
import { diffPlan } from "./diff"
import type { CriticRecord, Critique, Finding, Outcome, PlanEdit } from "./types"

export const LEDGER_KEY = "critic-ledger-v1"
const MAX_RECORDS = 500

export type Reading = "catch" | "miss" | "false-alarm" | "unchanged" | "none"

/** Did this edit land on what the finding was about? */
const touches = (x: Finding, e: PlanEdit) => e.rowId === x.where || (x.kind === "dropped" && e.kind === "added")

export function outcomeOf(critique: Critique, edits: PlanEdit[], how: { keyUsed: boolean; cancelled: boolean }): Outcome {
  if (how.cancelled) return "cancelled"
  if (how.keyUsed) return "key"
  if (edits.length) return "edited"
  return critique.verdict === "fail" ? "kept-over-critic" : "accepted"
}

/** A fail the person used a key on, or edited the flagged row of, is a catch. Edits elsewhere are a miss. */
export function classify(r: Pick<CriticRecord, "critique" | "outcome" | "edits">): Reading {
  if (r.outcome === "cancelled") return "none"
  if (r.outcome === "key") return "catch"
  if (r.edits.some((e) => r.critique.findings.some((x) => touches(x, e)))) return "catch"
  if (r.edits.length) return "miss"
  return r.critique.verdict === "fail" ? "false-alarm" : "unchanged"
}

export interface Rates {
  total: number
  catches: number
  misses: number
  falseAlarms: number
  unchanged: number
  /** False alarms per fail verdict. */
  falseAlarmRate: number | null
  /** Catches per plan the person changed (a catch or a miss). */
  catchRate: number | null
}

export function rates(records: readonly Pick<CriticRecord, "critique" | "outcome" | "edits">[]): Rates {
  const by = { catch: 0, miss: 0, "false-alarm": 0, unchanged: 0, none: 0 } as Record<Reading, number>
  let fails = 0
  for (const r of records) {
    by[classify(r)]++
    if (r.critique.verdict === "fail" && r.outcome !== "cancelled") fails++
  }
  const changed = by.catch + by.miss
  return {
    total: records.length - by.none,
    catches: by.catch,
    misses: by.miss,
    falseAlarms: by["false-alarm"],
    unchanged: by.unchanged,
    falseAlarmRate: fails ? by["false-alarm"] / fails : null,
    catchRate: changed ? by.catch / changed : null,
  }
}

/** A short stable hash of the plan's row titles, to tell two plans from one line apart. */
export function planHash(items: readonly PlanItem[]): string {
  let h = 5381
  for (const ch of items.map((i) => i.title.trim().toLowerCase()).join("|")) h = ((h << 5) + h + ch.charCodeAt(0)) | 0
  return (h >>> 0).toString(36)
}

export function makeRecord(input: {
  line: string
  first: readonly PlanItem[]
  confirmed: readonly PlanItem[]
  critique: Critique
  keyUsed: boolean
  cancelled: boolean
  now?: Date
}): CriticRecord {
  const edits = input.cancelled ? [] : diffPlan(input.first, input.confirmed)
  const at = (input.now ?? new Date()).toISOString()
  return {
    id: `cr-${at}-${planHash(input.first)}`,
    at,
    host: "plan",
    line: input.line,
    planHash: planHash(input.first),
    critique: input.critique,
    outcome: outcomeOf(input.critique, edits, input),
    edits,
  }
}

function safe(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage
  } catch {
    return undefined
  }
}

export function loadLedger(storage: Pick<Storage, "getItem"> | undefined = safe()): CriticRecord[] {
  try {
    const rows = JSON.parse(storage?.getItem(LEDGER_KEY) ?? "[]") as CriticRecord[]
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

export function appendRecord(record: CriticRecord, storage: Pick<Storage, "getItem" | "setItem"> | undefined = safe()): void {
  try {
    if (storage) storage.setItem(LEDGER_KEY, JSON.stringify([...loadLedger(storage), record].slice(-MAX_RECORDS)))
  } catch {
    // Quota or a private window: the plan still goes ahead.
  }
  archive("critic-verdict", record)
}
