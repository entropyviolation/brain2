/**
 * lib/bim-scorecard/card.ts — The dated scorecard: totals, per lane, per stage, and what changed since the last one
 *
 * `summarize` turns a `ReplayRun` into the record kept in `data/bim-scorecards/` (gitignored): the three bench
 * scorecards whole (so `compareCards` can line two runs up case by case), a table per expected lane, and the
 * stage times. `diffRuns` names the lines gained and lost on each check. `formatCard` prints it. Pure.
 */

import { compareCards, type Comparison, type Scorecard } from "@/lib/agents/bench"
import type { ReplayRow, ReplayRun } from "./replay"
import type { SocialScore, Stages } from "./score"

export interface LaneStat {
  n: number
  lane: number
  action: number
  clean: number
  /** Observed lanes for the misses, most common first: where these lines went instead. */
  wentTo: Record<string, number>
}

const STAGE_KEYS = ["turnMs", "lanesMs", "crewMs", "routerMs", "askMs", "chatMs", "executorMs", "followMs", "cuesMs", "modelMs", "loadMs"] as const
export type StageKey = (typeof STAGE_KEYS)[number]

export interface SavedCard {
  version: 1
  variant: string
  at: string
  /** Where the lines came from ("fixture" or the data file) and how many there were. */
  source: string
  llm: boolean
  n: number
  skipped: number
  totals: { lane: number; action: number; clean: number }
  byLane: Record<string, LaneStat>
  stages: Record<StageKey, { p50: number; p95: number; max: number }>
  modelCalls: { total: number; perTurn: number; byStage: Record<string, number> }
  /** The bench scorecards, whole. */
  cards: { lane: Scorecard; action: Scorecard; clean: Scorecard }
  /** One line per case: what was said, meant and done. */
  rows: { id: string; text: string; expected: string; observed: string; laneRight: boolean; actionRight: boolean; invented: string[]; route?: string; reply: string; ms: number; stages: Stages; priority?: boolean; social?: SocialScore }[]
}

function pct(values: number[], p: number): number {
  if (!values.length) return 0
  const v = [...values].sort((a, b) => a - b)
  const k = (v.length - 1) * p
  const f = Math.floor(k)
  const c = Math.min(f + 1, v.length - 1)
  return Math.round(v[f]! + (v[c]! - v[f]!) * (k - f))
}

export function laneTable(rows: ReplayRow[]): Record<string, LaneStat> {
  const out: Record<string, LaneStat> = {}
  for (const r of rows) {
    const s = (out[r.line.expectedLane] ??= { n: 0, lane: 0, action: 0, clean: 0, wentTo: {} })
    s.n++
    if (r.score.laneRight) s.lane++
    else s.wentTo[r.score.lane] = (s.wentTo[r.score.lane] ?? 0) + 1
    if (r.score.actionRight) s.action++
    if (!r.score.invented.length) s.clean++
  }
  return out
}

export function summarize(run: ReplayRun, source: string, llm: boolean): SavedCard {
  const stages = Object.fromEntries(
    STAGE_KEYS.map((k) => {
      const v = run.rows.map((r) => r.stages[k])
      return [k, { p50: pct(v, 0.5), p95: pct(v, 0.95), max: v.length ? Math.max(...v) : 0 }]
    }),
  ) as SavedCard["stages"]
  const byStage: Record<string, number> = {}
  let calls = 0
  for (const r of run.rows) {
    calls += r.stages.modelCalls
    for (const [k, n] of Object.entries(r.stages.callsBy)) byStage[k] = (byStage[k] ?? 0) + n
  }
  const n = run.rows.length
  return {
    version: 1,
    variant: run.variant,
    at: run.at,
    source,
    llm,
    n,
    skipped: run.skipped,
    totals: { lane: run.lane.passed, action: run.action.passed, clean: run.clean.passed },
    byLane: laneTable(run.rows),
    stages,
    modelCalls: { total: calls, perTurn: n ? Math.round((calls / n) * 100) / 100 : 0, byStage },
    cards: { lane: run.lane, action: run.action, clean: run.clean },
    rows: run.rows.map((r) => ({
      id: r.id,
      text: r.line.text,
      expected: r.line.expectedLane,
      observed: r.score.lane,
      laneRight: r.score.laneRight,
      actionRight: r.score.actionRight,
      invented: r.score.invented,
      ...(r.observed.route ? { route: r.observed.route } : {}),
      reply: r.observed.text.slice(0, 200),
      ms: r.observed.ms,
      stages: r.stages,
      ...(r.line.priority ? { priority: true } : {}),
      ...(r.social ? { social: r.social } : {}),
    })),
  }
}

export interface RunDiff {
  lane: Comparison
  action: Comparison
  clean: Comparison
}

/** What changed from `before` to `after`, check by check, over the cases both ran. */
export function diffRuns(before: SavedCard, after: SavedCard): RunDiff {
  return {
    lane: compareCards(before.cards.lane, after.cards.lane),
    action: compareCards(before.cards.action, after.cards.action),
    clean: compareCards(before.cards.clean, after.cards.clean),
  }
}

const share = (a: number, n: number) => (n ? `${a}/${n} (${Math.round((100 * a) / n)}%)` : "0/0")
const sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`

/** The printed scorecard: totals, the lane table, stage times, and the gained / lost lines when there is a last run. */
export function formatCard(card: SavedCard, diff?: RunDiff | null, last?: SavedCard | null): string {
  const out: string[] = []
  out.push(`BIM scorecard · ${card.variant} · ${card.at.slice(0, 16)} · ${card.source}`)
  out.push(`lines ${card.n} (photo lines left out: ${card.skipped}) · LLM ${card.llm ? "on" : "off"}`)
  out.push(`lane right   ${share(card.totals.lane, card.n)}`)
  out.push(`action right ${share(card.totals.action, card.n)}`)
  out.push(`no invented  ${share(card.totals.clean, card.n)}`)
  const social = card.rows.filter((r) => r.social)
  if (social.length) {
    out.push("")
    out.push("social lines (many people in one line):")
    for (const r of social) {
      const s = r.social!
      const yn = (b: boolean | null) => (b === null ? "–" : b ? "yes" : "no")
      out.push(`${r.priority ? "  ★ " : "    "}${s.passed}/${s.of} · people ${s.named}/${s.namedOf} · new ${s.newPeople}/${s.newOf} · birthday ${yn(s.birthday)} · event ${yn(s.event)} · place ${yn(s.place)} · asks back ${yn(s.followUp)} · ${r.text.slice(0, 40)}…`)
    }
  }
  out.push("")
  out.push("lane          n   lane  action  clean  misses went to")
  for (const [lane, s] of Object.entries(card.byLane).sort((a, b) => b[1].n - a[1].n)) {
    const went = Object.entries(s.wentTo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")
    out.push(`${lane.padEnd(12)} ${String(s.n).padStart(3)}  ${String(s.lane).padStart(4)}  ${String(s.action).padStart(6)}  ${String(s.clean).padStart(5)}  ${went}`)
  }
  out.push("")
  out.push("stage        p50     p95     max")
  for (const [k, v] of Object.entries(card.stages)) if (v.max) out.push(`${k.replace(/Ms$/, "").padEnd(10)} ${sec(v.p50).padStart(6)}  ${sec(v.p95).padStart(6)}  ${sec(v.max).padStart(6)}`)
  out.push(`model calls ${card.modelCalls.total} (${card.modelCalls.perTurn} a turn)${Object.keys(card.modelCalls.byStage).length ? ` · ${Object.entries(card.modelCalls.byStage).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}`)
  if (diff && last) {
    out.push("")
    out.push(`since ${last.at.slice(0, 16)} (${last.variant}):`)
    const text = new Map(card.rows.map((r) => [r.id, r.text]))
    for (const [name, c] of Object.entries(diff) as [string, Comparison][]) {
      out.push(`  ${name.padEnd(6)} ${c.delta >= 0 ? "+" : ""}${Math.round(c.delta * 1000) / 10} pts over ${c.shared} · gained ${c.gained.length} · lost ${c.lost.length}`)
      for (const id of c.lost.slice(0, 8)) out.push(`    lost: ${(text.get(id) ?? id).slice(0, 70)}`)
    }
  }
  return out.join("\n")
}
