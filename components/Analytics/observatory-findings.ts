/**
 * components/Analytics/observatory-findings.ts — Classical findings over aligned series
 *
 * Pure. Observatory sentences are Pearson-r + n, never a model. Thin overlap
 * is not a finding. Named apart from `Observatory.tsx` so macOS case-folding
 * cannot import the view as the math.
 */
import { correlate, type SeriesPoint } from "@/lib/metrics"

export const OBSERVATORY_FLOOR = 7

export interface ObservatoryFinding {
  id: string
  sentence: string
  n: number
  r: number
  thin: boolean
}

export interface ObservatoryPair {
  id: string
  aLabel: string
  bLabel: string
  a: SeriesPoint[]
  b: SeriesPoint[]
}

function describeR(r: number): string {
  const abs = Math.abs(r)
  if (abs < 0.15) return "almost no linear relationship"
  if (abs < 0.35) return r > 0 ? "a weak positive link" : "a weak inverse link"
  if (abs < 0.6) return r > 0 ? "a moderate positive link" : "a moderate inverse link"
  return r > 0 ? "a strong positive link" : "a strong inverse link"
}

export function findingFor(pair: ObservatoryPair, floor = OBSERVATORY_FLOOR): ObservatoryFinding | null {
  const result = correlate(pair.a, pair.b, { a: pair.aLabel, b: pair.bLabel })
  if (result.n < 2) return null
  const thin = result.n < floor
  const sentence = thin
    ? `${pair.aLabel} vs ${pair.bLabel}: n = ${result.n} overlapping days — too thin to treat as a finding (need ${floor}).`
    : `${pair.aLabel} and ${pair.bLabel} show ${describeR(result.r)} over ${result.n} overlapping days (r = ${result.r.toFixed(2)}).`
  return { id: pair.id, sentence, n: result.n, r: result.r, thin }
}

export function observatoryFindings(pairs: readonly ObservatoryPair[], floor = OBSERVATORY_FLOOR): ObservatoryFinding[] {
  const out: ObservatoryFinding[] = []
  for (const pair of pairs) {
    const finding = findingFor(pair, floor)
    if (finding) out.push(finding)
  }
  return out.sort((a, b) => Number(a.thin) - Number(b.thin) || Math.abs(b.r) - Math.abs(a.r))
}

export function dailySeries(dateKeys: readonly string[], values: Readonly<Record<string, number | null | undefined>>): SeriesPoint[] {
  return dateKeys
    .map((date) => {
      const value = values[date]
      if (value === null || value === undefined || !Number.isFinite(value)) return null
      return { date, value }
    })
    .filter((p): p is SeriesPoint => p !== null)
}
