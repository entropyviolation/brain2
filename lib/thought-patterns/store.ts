/**
 * lib/thought-patterns/store.ts — The thought-pattern ledger
 *
 * Every hit BIM reads is kept here as `proposed`, with the words and the message it came from.
 * Accept on its card row marks it `confirmed`, Reject marks it `rejected`, so the ledger learns
 * which reads were right. Kept in the vault (`brain2-thought-patterns`), so it syncs and backs up.
 * `summarize` is what "what are my thought patterns?" answers from.
 */
"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { PATTERNS, type PatternHit, type PatternId } from "./patterns"

export interface PatternObservation extends PatternHit {
  id: string
  /** ISO, when the message was sent. */
  at: string
  /** Where it was read: `bim-dump` for the Dump BIMBY. */
  source: string
  /** The plan (card) it was proposed on, when there is one. */
  planId?: string
  status: "proposed" | "confirmed" | "rejected"
}

interface PatternState {
  observations: PatternObservation[]
  add: (obs: PatternObservation[]) => void
  setStatus: (id: string, status: PatternObservation["status"]) => void
}

/** The newest this many are kept. */
const KEEP = 2000

export const useThoughtPatternStore = create<PatternState>()(
  persist(
    (set) => ({
      observations: [],
      add: (obs) => set((s) => ({ observations: [...s.observations.filter((o) => !obs.some((n) => n.id === o.id)), ...obs].slice(-KEEP) })),
      setStatus: (id, status) => set((s) => ({ observations: s.observations.map((o) => (o.id === id ? { ...o, status } : o)) })),
    }),
    { name: "brain2-thought-patterns", storage: createJSONStorage(() => localStorage) },
  ),
)

export interface PatternCount {
  pattern: PatternId
  name: string
  means: string
  count: number
  confirmed: number
  lastAt: string
  lastQuote: string
}

/** Counts per pattern over the last `days`, rejected reads left out, most frequent first. */
export function summarize(observations: PatternObservation[], now: Date, days = 30): PatternCount[] {
  const from = now.getTime() - days * 86_400_000
  const by = new Map<PatternId, PatternCount>()
  for (const o of observations) {
    if (o.status === "rejected" || Date.parse(o.at) < from) continue
    const def = PATTERNS[o.pattern]
    if (!def) continue
    const c = by.get(o.pattern) ?? { pattern: o.pattern, name: def.name, means: def.means, count: 0, confirmed: 0, lastAt: o.at, lastQuote: o.quote }
    c.count += 1
    if (o.status === "confirmed") c.confirmed += 1
    if (o.at >= c.lastAt) {
      c.lastAt = o.at
      c.lastQuote = o.quote
    }
    by.set(o.pattern, c)
  }
  return [...by.values()].sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))
}

/** "what are my thought patterns?", "my patterns this week", "thought patterns". */
export function parsePatternAsk(text: string): { days: number } | null {
  const t = text.trim().toLowerCase()
  if (!/\b(?:thought patterns?|thinking patterns?|my patterns?)\b/.test(t)) return null
  if (!/\?|^(?:what|show|list|which|how)\b|^(?:my )?thought patterns?\.?$|^patterns?\.?$/.test(t)) return null
  const days = /\btoday\b/.test(t) ? 1 : /\bweek\b/.test(t) ? 7 : /\byear\b/.test(t) ? 365 : 30
  return { days }
}

export function patternSummaryText(counts: PatternCount[], days: number): string {
  const span = days === 1 ? "today" : days === 7 ? "this week" : days === 365 ? "this year" : `in the last ${days} days`
  if (!counts.length) return `No thought patterns read ${span} yet. They come from longer messages (a brain dump), and each one waits on its card for you to confirm.`
  const rows = counts.map((c) => `${c.name} · ${c.count}×${c.confirmed ? ` (${c.confirmed} confirmed)` : ""}\n  ${c.means} Last: “${c.lastQuote}”`)
  return `Thought patterns ${span}:\n${rows.join("\n")}`
}
