/**
 * lib/agents/bench.ts — Score variants of one BIMBY on the same cases (pure, no model inside)
 *
 * A **Case** is an input and the answer a person says is right. A **Variant** is one way to answer: a code
 * baseline, one small model, a swarm of ten, a new prompt. `runSuite` asks a variant every case and keeps a
 * **Scorecard**. `compareCards` lines two scorecards up and names the cases that flipped. This is `EV-1` to `EV-4`
 * of `docs/AGENT_LAB_PLAN.md`, cut down to the BIMBY shape: one input, one answer from a closed list.
 *
 * Honest numbers (`EV-8`): every rate carries its sample size, and a case that threw is counted as a miss and
 * named, never dropped.
 */

export interface BenchCase {
  id: string
  /** What the person typed. */
  input: string
  /** The answer a person says is right. */
  expect: string
  tags?: string[]
}

/** The variant's answer, plus anything worth showing next to it (agreement, margin, the voters' picks). */
export interface Answer {
  /** `null` means it declined: no pick, ask the person. A decline is never a pass. */
  pick: string | null
  /** A number from 0 to 1 the variant stands behind, when it has one. */
  confidence?: number
  note?: string
}

export interface Variant {
  id: string
  label: string
  /** A short line saying what is different about this variant. */
  about?: string
  run: (input: string) => Promise<Answer>
}

export interface Row {
  caseId: string
  input: string
  expect: string
  pick: string | null
  pass: boolean
  ms: number
  confidence?: number
  note?: string
  error?: string
  tags: string[]
}

export interface Scorecard {
  variantId: string
  label: string
  /** ISO time the suite started. */
  at: string
  rows: Row[]
  n: number
  passed: number
  /** `passed / n`, 0 when n is 0. */
  passRate: number
  /** Cases the variant declined. */
  declined: number
  errors: number
  totalMs: number
  /** Of the answers that gave a confidence at or above 0.7, the share that were right. `null` when none did. */
  rightWhenSure: number | null
  sure: number
  /** Pass rate per tag, with the count behind it. */
  byTag: Record<string, { n: number; passed: number }>
}

export const SURE = 0.7

export async function runSuite(variant: Variant, cases: BenchCase[], opts: { now?: () => number; onRow?: (row: Row, done: number) => void; signal?: AbortSignal } = {}): Promise<Scorecard> {
  const now = opts.now ?? Date.now
  const at = new Date().toISOString()
  const rows: Row[] = []
  for (const c of cases) {
    if (opts.signal?.aborted) break
    const t0 = now()
    let row: Row
    try {
      const a = await variant.run(c.input)
      row = { caseId: c.id, input: c.input, expect: c.expect, pick: a.pick, pass: a.pick === c.expect, ms: now() - t0, confidence: a.confidence, note: a.note, tags: c.tags ?? [] }
    } catch (e) {
      row = { caseId: c.id, input: c.input, expect: c.expect, pick: null, pass: false, ms: now() - t0, error: e instanceof Error ? e.message : String(e), tags: c.tags ?? [] }
    }
    rows.push(row)
    opts.onRow?.(row, rows.length)
  }
  return scorecardOf(variant, at, rows)
}

export function scorecardOf(variant: Pick<Variant, "id" | "label">, at: string, rows: Row[]): Scorecard {
  const passed = rows.filter((r) => r.pass).length
  const sure = rows.filter((r) => (r.confidence ?? 0) >= SURE)
  const byTag: Scorecard["byTag"] = {}
  for (const r of rows)
    for (const t of r.tags) {
      const s = (byTag[t] ??= { n: 0, passed: 0 })
      s.n++
      if (r.pass) s.passed++
    }
  return {
    variantId: variant.id,
    label: variant.label,
    at,
    rows,
    n: rows.length,
    passed,
    passRate: rows.length ? passed / rows.length : 0,
    declined: rows.filter((r) => r.pick === null && !r.error).length,
    errors: rows.filter((r) => r.error).length,
    totalMs: rows.reduce((a, r) => a + r.ms, 0),
    rightWhenSure: sure.length ? sure.filter((r) => r.pass).length / sure.length : null,
    sure: sure.length,
    byTag,
  }
}

export interface Comparison {
  /** Cases both scorecards ran. */
  shared: number
  /** Failed in `a`, pass in `b`. */
  gained: string[]
  /** Passed in `a`, fail in `b`: the regressions. */
  lost: string[]
  /** Failed in both. */
  stuck: string[]
  /** Passed in both. */
  held: string[]
  /** `b.passRate - a.passRate` over the shared cases only, so differing suites do not skew it. */
  delta: number
  /** `b` total ms minus `a` total ms over the shared cases. */
  deltaMs: number
}

export function compareCards(a: Scorecard, b: Scorecard): Comparison {
  const bBy = new Map(b.rows.map((r) => [r.caseId, r]))
  const out: Comparison = { shared: 0, gained: [], lost: [], stuck: [], held: [], delta: 0, deltaMs: 0 }
  let aPass = 0
  let bPass = 0
  for (const ra of a.rows) {
    const rb = bBy.get(ra.caseId)
    if (!rb) continue
    out.shared++
    out.deltaMs += rb.ms - ra.ms
    if (ra.pass) aPass++
    if (rb.pass) bPass++
    if (ra.pass && rb.pass) out.held.push(ra.caseId)
    else if (ra.pass) out.lost.push(ra.caseId)
    else if (rb.pass) out.gained.push(ra.caseId)
    else out.stuck.push(ra.caseId)
  }
  out.delta = out.shared ? (bPass - aPass) / out.shared : 0
  return out
}

/** Which wrong answers a variant gives for which expected ones: `expect → pick → count`, wrong answers only. */
export function confusions(card: Scorecard): { expect: string; pick: string; count: number }[] {
  const m = new Map<string, number>()
  for (const r of card.rows) if (!r.pass) m.set(`${r.expect}\u0000${r.pick ?? "(declined)"}`, (m.get(`${r.expect}\u0000${r.pick ?? "(declined)"}`) ?? 0) + 1)
  return [...m.entries()]
    .map(([k, count]) => {
      const [expect, pick] = k.split("\u0000")
      return { expect: expect!, pick: pick!, count }
    })
    .sort((x, y) => y.count - x.count || x.expect.localeCompare(y.expect))
}

/** Keep the newest `keep` cards per variant, newest first. Storage stays small. */
export function trimHistory(cards: Scorecard[], keep = 5): Scorecard[] {
  const seen = new Map<string, number>()
  return [...cards]
    .sort((x, y) => y.at.localeCompare(x.at))
    .filter((c) => {
      const n = (seen.get(c.variantId) ?? 0) + 1
      seen.set(c.variantId, n)
      return n <= keep
    })
}
