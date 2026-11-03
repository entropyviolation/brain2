/**
 * lib/overcome-bimby/experiment.ts — Test different tactics, and read the scoreboard (pure)
 *
 * `pick.ts` exploits what worked. This swaps the last slot of a push for the tactic offered least often that still fits the
 * barrier, so every tactic gets tried and the person's Started / Still stuck marks can say which ones work for them.
 */
import { TACTICS } from "./tactics"
import type { Reading, ResistanceEntry, Tactic } from "./types"

export const offeredCount = (log: ResistanceEntry[], id: string): number => log.filter((e) => e.offered.includes(id)).length

/** Keep the first two picks; the third is the least-tried tactic of a different kind that fits the barrier. */
export function withExperiment(picked: Tactic[], reading: Reading, log: ResistanceEntry[]): { tactics: Tactic[]; experiment?: string } {
  if (picked.length < 3) return { tactics: picked }
  const kept = picked.slice(0, 2)
  const kinds = new Set(kept.map((t) => t.kind))
  const fits = (t: Tactic) => !t.helps.length || t.helps.includes(reading.barrier)
  const pool = TACTICS.filter((t) => t.kind !== "restart" && !picked.includes(t) && !kinds.has(t.kind) && fits(t))
  if (!pool.length) return { tactics: picked }
  const pickOne = [...pool].sort((a, b) => offeredCount(log, a.id) - offeredCount(log, b.id) || TACTICS.indexOf(a) - TACTICS.indexOf(b))[0]!
  return { tactics: [...kept, pickOne], experiment: pickOne.id }
}

export interface TacticRow {
  id: string
  name: string
  offered: number
  started: number
  stuck: number
  /** started / (started + stuck); null until something is marked. */
  rate: number | null
}

export function tacticScoreboard(log: ResistanceEntry[]): TacticRow[] {
  return TACTICS.map((t) => {
    const started = log.filter((e) => e.tried?.tacticId === t.id && e.tried.outcome === "started").length
    const stuck = log.filter((e) => e.tried?.tacticId === t.id && e.tried.outcome === "stuck").length
    return { id: t.id, name: t.name, offered: offeredCount(log, t.id), started, stuck, rate: started + stuck ? started / (started + stuck) : null }
  })
    .filter((r) => r.offered > 0)
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.offered - a.offered)
}
