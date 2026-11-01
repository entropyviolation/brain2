/**
 * lib/graph/feedback.ts — Usage feedback for suggestions (KNOWLEDGE_GRAPH_PLAN
 * §5.11 KG-F, law 9).
 *
 * Pure. Counts what the person accepted and dismissed, per suggestion source
 * and per relation, and smooths each rate with Beta(1, 1): (accepted + 1) /
 * (n + 2). `reweightSuggestions` multiplies a score by that rate, shrunk
 * toward 1 while `n` is under the floor, so a source with few decisions is
 * left alone. It only ever lowers a score; it never writes or hides a row.
 */
import { GRAPH_SAMPLE_FLOOR } from "@/lib/graph/insights"

export type FeedbackOutcome = "accepted" | "dismissed"

export interface FeedbackDecision {
  source: string
  relation?: string
  outcome: FeedbackOutcome
  /** ISO time or local `YYYY-MM-DD`. */
  at?: string
}

/** The fields of a `GraphProposal` this module reads. */
export interface ProposalLike {
  origin: string
  relation?: string
  status: "open" | "accepted" | "dismissed"
  createdAt?: string
}

export type FeedbackInput = FeedbackDecision | ProposalLike

/** `densify:triad` → `triad`; `model:x` → `model`; `import:x` → `import`. */
export function sourceOfOrigin(origin: string): string {
  const [head, rest] = origin.split(":", 2)
  return head === "densify" && rest ? rest : head
}

export function toDecisions(rows: readonly FeedbackInput[]): FeedbackDecision[] {
  const out: FeedbackDecision[] = []
  for (const row of rows) {
    if ("outcome" in row) out.push(row)
    else if (row.status !== "open") out.push({ source: sourceOfOrigin(row.origin), relation: row.relation, outcome: row.status, at: row.createdAt })
  }
  return out
}

export interface AcceptanceRow {
  key: string
  accepted: number
  dismissed: number
  n: number
  /** Beta(1, 1) smoothed: (accepted + 1) / (n + 2). */
  rate: number
  range: { from: string; to: string } | null
}

export interface AcceptanceStats {
  sources: AcceptanceRow[]
  relations: AcceptanceRow[]
}

function tally(rows: FeedbackDecision[], keyOf: (d: FeedbackDecision) => string | undefined): AcceptanceRow[] {
  const map = new Map<string, AcceptanceRow>()
  for (const d of rows) {
    const key = keyOf(d)
    if (!key) continue
    const row = map.get(key) ?? { key, accepted: 0, dismissed: 0, n: 0, rate: 0.5, range: null }
    if (d.outcome === "accepted") row.accepted++
    else row.dismissed++
    row.n++
    if (d.at) {
      const day = d.at.slice(0, 10)
      row.range = !row.range ? { from: day, to: day } : { from: day < row.range.from ? day : row.range.from, to: day > row.range.to ? day : row.range.to }
    }
    map.set(key, row)
  }
  return [...map.values()].map((r) => ({ ...r, rate: (r.accepted + 1) / (r.n + 2) })).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

/** Accepted and dismissed counts per source and per relation. Open proposals are not counted. */
export function sourceAcceptance(rows: readonly FeedbackInput[]): AcceptanceStats {
  const decisions = toDecisions(rows)
  return { sources: tally(decisions, (d) => d.source), relations: tally(decisions, (d) => d.relation) }
}

/** The factor one row contributes: its rate, shrunk toward 1 by n / floor while under the floor. */
export function shrunkFactor(row: AcceptanceRow | undefined, floor = GRAPH_SAMPLE_FLOOR): number {
  if (!row || row.n === 0) return 1
  const w = Math.min(1, row.n / floor)
  return 1 + w * (row.rate - 1)
}

function countText(row: AcceptanceRow): string {
  return `${row.accepted} accepted, ${row.dismissed} dismissed (n=${row.n})`
}

/**
 * Each row's score times the source and relation factors. Input order is
 * kept; sort or merge afterwards (`mergeSuggestions` orders by score).
 * `baseScore` keeps the score before, and `why` says where the factor came from.
 */
export function reweightSuggestions<T extends { source: string; relation: string; score: number }>(
  rows: readonly T[],
  stats: AcceptanceStats,
  opts: { floor?: number; bySource?: boolean; byRelation?: boolean } = {},
): (T & { baseScore: number; why: string })[] {
  const floor = opts.floor ?? GRAPH_SAMPLE_FLOOR
  const sources = new Map(stats.sources.map((r) => [r.key, r]))
  const relations = new Map(stats.relations.map((r) => [r.key, r]))
  return rows.map((row) => {
    const parts: string[] = []
    let factor = 1
    if (opts.bySource !== false) {
      const s = sources.get(row.source)
      factor *= shrunkFactor(s, floor)
      parts.push(s ? `${row.source}: ${countText(s)}` : `${row.source}: no decisions yet`)
    }
    if (opts.byRelation !== false) {
      const r = relations.get(row.relation)
      factor *= shrunkFactor(r, floor)
      parts.push(r ? `${row.relation}: ${countText(r)}` : `${row.relation}: no decisions yet`)
    }
    const score = Math.max(0, Math.min(1, row.score * factor))
    return { ...row, baseScore: row.score, score, why: `${parts.join(" · ")} · ×${factor.toFixed(2)}` }
  })
}

/** Neutral lines for the weekly review. Rows under the floor say so. */
export function feedbackSentences(stats: AcceptanceStats, opts: { floor?: number } = {}): string[] {
  const floor = opts.floor ?? GRAPH_SAMPLE_FLOOR
  const line = (prefix: string, r: AcceptanceRow) => {
    const extra = [r.range ? (r.range.from === r.range.to ? r.range.from : `${r.range.from} – ${r.range.to}`) : null, r.n < floor ? `under the floor of ${floor}` : null].filter(Boolean)
    return `${prefix}${r.key}: ${r.accepted} accepted, ${r.dismissed} dismissed (n=${r.n}${extra.length ? `, ${extra.join(", ")}` : ""}).`
  }
  return [...stats.sources.map((r) => line("", r)), ...stats.relations.map((r) => line("relation ", r))]
}

/**
 * Exponentially decayed visit count: each visit weighs 0.5^(age / halfLife).
 * Visits are epoch milliseconds. A visit in the future counts as 1.
 */
export function usageWeight(visits: readonly number[], now: number, halfLifeDays = 14): number {
  const half = halfLifeDays * 86_400_000
  let sum = 0
  for (const t of visits) sum += Math.pow(0.5, Math.max(0, now - t) / half)
  return sum
}
