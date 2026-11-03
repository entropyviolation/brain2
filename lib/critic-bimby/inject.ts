/**
 * lib/critic-bimby/inject.ts — Break a good plan in one known way (pure)
 *
 * Fault injection gives the critic a test set before any person's data exists. Each fault returns the broken draft and
 * what a critic should say about it. A generated fault is a hint about the critic; the ledger's real corrections stay
 * the oracle (`docs/CRITIC_BIMBY_PLAN.md` §5.2).
 */

import { nameWords } from "@/lib/plan-bimby/links"
import { cleanPlan } from "@/lib/plan-bimby/parse"
import type { PlanDraft, PlanItem } from "@/lib/plan-bimby/types"
import type { FindingKind } from "./types"

export type FaultKind = "drop-row" | "invent-row" | "swap-order" | "change-minutes" | "change-due" | "bad-intake-link" | "wrong-object"

export interface Fault {
  fault: FaultKind
  draft: PlanDraft
  expect: { kind: FindingKind; where?: string }
}

export interface Gold {
  name: string
  line: string
  draft: PlanDraft
}

/** Build a gold case from the line and the rows a good reader would write. */
export function gold(name: string, line: string, rows: { title: string; minutes?: number; pace?: PlanItem["pace"]; paceNote?: string; subtasks?: { title: string; due: string }[] }[], remarks: string[] = []): Gold {
  const read = cleanPlan({ items: rows.map((r) => ({ minutes: 0, pace: "steady", paceNote: "", subtasks: [], ...r })), remarks })
  return { name, line, draft: { items: read.items, remarks: read.remarks, source: line, by: "model" } }
}

const POOL = ["call the dentist", "renew the passport", "water the plants", "email the landlord"]

const withItems = (g: Gold, items: PlanItem[]): PlanDraft => ({ ...g.draft, items })

/** Every fault that applies to this gold plan, each one on its own. */
export function faultsFor(g: Gold): Fault[] {
  const items = g.draft.items
  const out: Fault[] = []
  if (items.length >= 3) {
    // Drop a middle row that has no subtasks and a name no other row shares.
    const at = items.findIndex((r, i) => i > 0 && i < items.length - 1 && !r.subtasks.length)
    if (at > 0) out.push({ fault: "drop-row", draft: withItems(g, items.filter((_, i) => i !== at)), expect: { kind: "dropped" } })
    const swap = items.length - 2
    out.push({
      fault: "swap-order",
      draft: withItems(g, items.map((r, i) => (i === swap ? items[swap + 1]! : i === swap + 1 ? items[swap]! : r))),
      expect: { kind: "misordered" },
    })
  }
  // A made-up task shares no word with the line, or it would not be made up.
  const lineWords = new Set(g.line.toLowerCase().split(/[^a-z]+/))
  const pick = POOL.find((p) => !p.split(" ").some((w) => w.length > 3 && lineWords.has(w))) ?? POOL[0]!
  out.push({ fault: "invent-row", draft: withItems(g, [...items.slice(0, 1), { id: "fault-row", title: pick, subtasks: [], pace: "steady" }, ...items.slice(1)]), expect: { kind: "invented", where: "fault-row" } })
  const timed = items.find((r) => r.minutes)
  const target = timed ?? items[0]
  if (target) {
    out.push({ fault: "change-minutes", draft: withItems(g, items.map((r) => (r.id === target.id ? { ...r, minutes: 47 } : r))), expect: { kind: "invented", where: target.id } })
  }
  const withDue = items.find((r) => r.subtasks.some((s) => s.due))
  if (withDue) {
    out.push({
      fault: "change-due",
      draft: withItems(g, items.map((r) => (r.id === withDue.id ? { ...r, subtasks: r.subtasks.map((s, i) => (i === 0 ? { ...s, due: "by midnight friday" } : s)) } : r))),
      expect: { kind: "invented", where: withDue.id },
    })
  }
  const plain = items.find((r) => !r.link)
  if (plain) {
    out.push({
      fault: "bad-intake-link",
      draft: withItems(g, items.map((r) => (r.id === plain.id ? { ...r, link: { kind: "intake" as const, label: "melatonin", intakeClass: "drug" as const } } : r))),
      expect: { kind: "wrong-link", where: plain.id },
    })
  }
  // Keep a word the person said and swap the thing it was done to. The free checks see an overlap, so only a model can tell.
  for (const r of items) {
    const token = r.title.toLowerCase().split(/\s+/).find((t) => t.length > 3 && nameWords(t).length)
    if (token && !r.link && !r.subtasks.length && !r.minutes) {
      out.push({
        fault: "wrong-object",
        draft: withItems(g, items.map((x) => (x.id === r.id ? { ...x, title: `${token} garage` } : x))),
        expect: { kind: "invented", where: r.id },
      })
      break
    }
  }
  return out
}
