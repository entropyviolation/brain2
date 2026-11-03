/**
 * lib/swarm-vote/bench.ts — Replay recorded ballots to find how many voters, and which mix, are worth it
 *
 * `collect` asks the live voters once per labelled line and keeps the ballots. `sweep` is pure: it replays those
 * ballots with 1, 3, 5, … voters, picked either in order ("copies") or round-robin across families ("mixed"),
 * and scores Borda against plurality (top-1). Cost is the voter count. `docs/BIMBY_IDEAS.md` §1 table.
 */

import { runSwarm, type SwarmVoter } from "./run"
import { tally } from "./tally"
import type { Ballot } from "./types"

export interface Case {
  line: string
  /** The action a person would say is right. */
  expected: string
}

export interface Recorded {
  case: Case
  ballots: Ballot[]
}

export type Pick = "copies" | "mixed"

export interface SweepRow {
  voters: number
  pick: Pick
  /** Borda winner equals expected, over cases. 0 to 1. */
  borda: number
  /** Plurality (most first places) winner equals expected. */
  plurality: number
  /** Share of cases the tally called `clear`. */
  clearRate: number
  /** Of the cases called `clear`, the share that were right: "right when confident". */
  rightWhenClear: number
}

/** Ask every voter once per case. Live and costly; the result is what `sweep` replays. */
export async function collect(voters: SwarmVoter[], cases: Case[], actions: readonly string[], system: string, timeoutMs = 20000): Promise<Recorded[]> {
  const out: Recorded[] = []
  for (const c of cases) {
    const r = await runSwarm(voters, { actions, system, line: c.line, timeoutMs })
    out.push({ case: c, ballots: r.ballots })
  }
  return out
}

/** The first `n` ballots: in the order voters answered (copies), or taking one per family in turn (mixed). */
export function subset(ballots: Ballot[], n: number, pick: Pick): Ballot[] {
  if (pick === "copies") return ballots.slice(0, n)
  const byFamily = new Map<string, Ballot[]>()
  for (const b of ballots) byFamily.set(b.voter.family, [...(byFamily.get(b.voter.family) ?? []), b])
  const lanes = [...byFamily.values()]
  const out: Ballot[] = []
  for (let i = 0; out.length < n && lanes.some((l) => i < l.length); i++) {
    for (const l of lanes) if (i < l.length && out.length < n) out.push(l[i]!)
  }
  return out
}

function pluralityWinner(ballots: Ballot[]): string | null {
  const firsts = new Map<string, number>()
  for (const b of ballots) if (b.ranking[0]) firsts.set(b.ranking[0], (firsts.get(b.ranking[0]) ?? 0) + 1)
  const best = [...firsts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  return best?.[0] ?? null
}

export function sweep(recorded: Recorded[], counts: number[], picks: Pick[] = ["copies", "mixed"]): SweepRow[] {
  const rows: SweepRow[] = []
  for (const pick of picks) {
    for (const n of counts) {
      let borda = 0
      let plural = 0
      let clear = 0
      let clearRight = 0
      for (const r of recorded) {
        const bs = subset(r.ballots, n, pick)
        const t = tally(bs)
        const right = t.standings[0]?.action === r.case.expected
        if (right) borda += 1
        if (pluralityWinner(bs) === r.case.expected) plural += 1
        if (t.verdict === "clear") {
          clear += 1
          if (right) clearRight += 1
        }
      }
      const k = recorded.length || 1
      rows.push({ voters: n, pick, borda: borda / k, plurality: plural / k, clearRate: clear / k, rightWhenClear: clear ? clearRight / clear : 0 })
    }
  }
  return rows
}
