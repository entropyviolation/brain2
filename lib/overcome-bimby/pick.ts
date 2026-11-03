/**
 * lib/overcome-bimby/pick.ts — GATHER + PICK: rank tactics for this barrier and this person's history (pure, no model)
 *
 * Score = fits the barrier, + what worked for them before, - what already failed on this same task, - external help when
 * it was just refused. Past words (motivation, consequences) from earlier entries on the same task are carried forward.
 */

import { TACTICS } from "./tactics"
import type { Reading, ResistanceEntry, Tactic } from "./types"

const FILLER = new Set(["the", "those", "my", "a", "an", "still", "not", "doing", "finish", "finishing", "start", "starting", "do", "to", "and", "of", "for", "it"])
const words = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !FILLER.has(w))

/** Same task if they share a meaningful word ("cds" in "finish those cds" and "still not doing the cds"). */
export const sameTask = (a: string, b: string): boolean => {
  const y = new Set(words(b))
  return words(a).some((w) => y.has(w))
}

export interface History {
  /** Earlier entries on this task, oldest first. */
  before: ResistanceEntry[]
  /** Their own reasons and costs, deduplicated, this message's first. */
  motivation: string[]
  consequences: string[]
}

export function gather(reading: Reading, log: ResistanceEntry[]): History {
  const before = log.filter((e) => sameTask(e.reading.task, reading.task))
  const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))]
  return {
    before,
    motivation: uniq([...reading.motivation, ...before.flatMap((e) => e.reading.motivation).reverse()]),
    consequences: uniq([...reading.consequences, ...before.flatMap((e) => e.reading.consequences).reverse()]),
  }
}

export function pickTactics(reading: Reading, history: History, log: ResistanceEntry[], count = 3): Tactic[] {
  const worked = (id: string) => log.filter((e) => e.tried?.tacticId === id && e.tried.outcome === "started").length
  const failedHere = (id: string) => history.before.filter((e) => e.tried?.tacticId === id && e.tried.outcome === "stuck").length
  const overdue = reading.overdueDays > 0
  const scored = TACTICS.filter((t) => t.kind !== "restart").map((t) => {
    let s = 0
    if (!t.helps.length) s += 1
    else if (t.helps.includes(reading.barrier)) s += 3
    s += worked(t.id) * 2 - failedHere(t.id) * 3
    if (t.kind === "friction") s += 1
    if (t.kind === "decide" || t.kind === "prep") s += 1
    if (t.kind === "message") s += overdue ? 1 : -2
    if (t.kind === "consequence") s += history.consequences.length || overdue ? 2 : -2
    if (t.kind === "reframe" && history.motivation.length) s += 1
    if (t.kind === "reward") s -= 1
    return { t, s }
  })
  scored.sort((a, b) => b.s - a.s || TACTICS.indexOf(a.t) - TACTICS.indexOf(b.t))
  const out: Tactic[] = []
  for (const { t } of scored) {
    if (out.length >= count) break
    // Mix kinds: never two of the same kind in a push.
    if (out.some((o) => o.kind === t.kind)) continue
    out.push(t)
  }
  return out
}
