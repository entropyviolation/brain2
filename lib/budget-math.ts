/**
 * lib/budget-math.ts — Pure budget readings
 *
 * One row shape over both ledgers: spending on the Tracking log (read-only
 * mapping, never copied) and `budget-store` lines. Received money and expected
 * money stay apart: totals count received only. Used by the Budget tab and the
 * Budget widget. Plan: `docs/BUDGET_REDESIGN.md`.
 */
import type { BudgetLine } from "@/lib/budget-store"
import { isSpendEntry } from "@/lib/spend"
import type { TimeEntry } from "@/lib/time-entries"

export type BudgetRow = {
  id: string
  origin: "log" | "budget"
  date: string
  name: string
  cents: number
  kind: "earning" | "spend"
  source: string
  expected?: boolean
  certainty?: "sure" | "likely" | "maybe"
  notes?: string
  account?: string
  itemId?: string
  category?: string
}

export const UNCATEGORIZED = "Uncategorized"

export function budgetRows(entries: readonly TimeEntry[], lines: readonly BudgetLine[]): BudgetRow[] {
  const rows: BudgetRow[] = []
  for (const e of entries) {
    if (!isSpendEntry(e)) continue
    rows.push({ id: e.id, origin: "log", date: e.date, name: e.spendOn?.trim() || e.title?.trim() || "Untitled", cents: e.spendAmount ?? 0, kind: "spend", source: e.spendSource?.trim() || "Card", notes: e.notes })
  }
  for (const l of lines) rows.push({ ...l, origin: "budget", expected: l.status === "expected" })
  return rows
}

export function monthTotals(rows: readonly BudgetRow[], monthKey: string) {
  let earned = 0
  let spent = 0
  let aheadSure = 0
  let aheadAll = 0
  for (const r of rows) {
    if (!r.date.startsWith(monthKey)) continue
    const signed = r.kind === "earning" ? r.cents : -r.cents
    if (r.expected) {
      aheadAll += signed
      if (r.certainty === "sure") aheadSure += signed
    } else if (r.kind === "earning") earned += r.cents
    else spent += r.cents
  }
  return { earned, spent, net: earned - spent, aheadSure, aheadAll }
}

/** Received money by group, biggest first. `kind` picks spending or earnings. */
export function breakdown(rows: readonly BudgetRow[], kind: "earning" | "spend", by: "category" | "source"): { label: string; cents: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (r.expected || r.kind !== kind) continue
    const label = (by === "category" ? r.category?.trim() || UNCATEGORIZED : r.source) || UNCATEGORIZED
    map.set(label, (map.get(label) ?? 0) + r.cents)
  }
  return [...map.entries()].map(([label, cents]) => ({ label, cents })).sort((a, b) => b.cents - a.cents)
}
