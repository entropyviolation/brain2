/**
 * lib/swarm-vote/tally.ts — Merge ranked ballots (pure, no model)
 *
 * Borda count over rankings, with plurality (top-1) kept beside it so the lab can compare. Agreement and margin
 * are the confidence read from the spread (`docs/BIMBY_IDEAS.md` §2). Nothing here writes.
 */

import type { Ballot, Standing, Tally } from "./types"

export interface TallyOptions {
  /** Agreement at or above this, with the margin below, goes straight to the plan. */
  clearAgreement?: number
  clearMargin?: number
}

/** Keep only actions on the closed list, once each, in the order given. */
export function cleanBallot(ranking: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(ranking)) return []
  const ok = new Set(allowed)
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of ranking) {
    if (typeof r !== "string" || !ok.has(r) || seen.has(r)) continue
    seen.add(r)
    out.push(r)
  }
  return out
}

export function tally(ballots: Ballot[], opts: TallyOptions = {}): Tally {
  const { clearAgreement = 0.7, clearMargin = 0.3 } = opts
  const rows = new Map<string, Standing>()
  const live = ballots.filter((b) => b.ranking.length > 0)
  for (const b of live) {
    const w = b.voter.weight ?? 1
    const n = b.ranking.length
    b.ranking.forEach((action, i) => {
      const s = rows.get(action) ?? { action, score: 0, listedBy: 0, firstBy: 0 }
      s.score += (n - i) * w
      s.listedBy += 1
      if (i === 0) s.firstBy += 1
      rows.set(action, s)
    })
  }
  const standings = [...rows.values()].sort(
    (a, b) => b.score - a.score || b.firstBy - a.firstBy || a.action.localeCompare(b.action),
  )
  const families = new Set(live.map((b) => b.voter.family)).size
  if (!standings.length) return { standings, voters: live.length, families, agreement: 0, margin: 0, verdict: "empty" }
  const top = standings[0]!
  const next = standings[1]
  const agreement = top.firstBy / live.length
  const margin = next ? (top.score - next.score) / top.score : 1
  const verdict = agreement >= clearAgreement && margin >= clearMargin ? "clear" : "split"
  return { standings, voters: live.length, families, agreement, margin, verdict }
}

/** The actions most of the swarm had in common: listed by at least `share` of voters. These go to the reword. */
export function survivors(t: Tally, share = 0.5): string[] {
  return t.standings.filter((s) => s.listedBy / t.voters >= share).map((s) => s.action)
}

/**
 * True once the voters still out cannot change the winner: the lead in first-place votes is larger than the
 * number of ballots left. A cheap stop, in the spirit of early-stopping majority voting (EMS, arXiv 2604.02863).
 */
export function earlyStop(ballots: Ballot[], total: number): boolean {
  const firsts = new Map<string, number>()
  for (const b of ballots) if (b.ranking[0]) firsts.set(b.ranking[0], (firsts.get(b.ranking[0]) ?? 0) + 1)
  const counts = [...firsts.values()].sort((a, b) => b - a)
  const lead = (counts[0] ?? 0) - (counts[1] ?? 0)
  return lead > total - ballots.length
}
