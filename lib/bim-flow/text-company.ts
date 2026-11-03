/**
 * lib/bim-flow/text-company.ts — Who the person is probably with, from who they are texting
 *
 * Learned on the person's own tracked Company blocks. For a contact, count how
 * often the person texts them in hours they marked as together versus apart.
 * On real data (Sept–Oct 2026) texts to Elijah ran 0.10 an hour when together
 * and 1.54 apart, and 85% of hours with any text between them were apart. So
 * a live back-and-forth is good evidence of "not in the same room". Silence is
 * weak evidence of together (43% vs a 32% base), so it is never reported as
 * company on its own. Pure; no model.
 */

import type { TextRow } from "./texts"
import type { HistoryEntry } from "./vault-search"

export interface CompanyRates {
  person: string
  togetherHours: number
  apartHours: number
  /** Texts with this person per hour while together / apart. */
  togetherPerHour: number
  apartPerHour: number
  /** Share of apart hours that had any text with them. */
  apartTextShare: number
  /** Share of together hours that had any text with them. */
  togetherTextShare: number
}

const day = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Hour buckets "YYYY-MM-DD@H" holding the number of texts with `who` (either direction). */
function hourCounts(rows: TextRow[], who: (r: TextRow) => boolean): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) {
    if (!who(r) || r.group) continue
    const k = `${day(r.at)}@${new Date(r.at).getHours()}`
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

/**
 * `company` entries are the person's own Company blocks (pen = a name or "Alone").
 * Waking hours only (8–23). Needs 20+ hours each way to say anything.
 */
export function companyRates(rows: TextRow[], company: HistoryEntry[], person: string, matches: (r: TextRow) => boolean): CompanyRates | null {
  const counts = hourCounts(rows, matches)
  const together = new Set<string>()
  const apart = new Set<string>()
  const lower = person.toLowerCase()
  for (const e of company) {
    if (e.scope !== "company" || e.confirmed === false || e.instant) continue
    const pen = e.pen.toLowerCase()
    const target = pen === "alone" ? apart : pen.includes(lower) || lower.includes(pen) ? together : null
    if (!target) continue
    for (let h = Math.floor(e.startMin / 60); h <= Math.floor((e.endMin - 1) / 60); h++) if (h >= 8 && h <= 23) target.add(`${e.date}@${h}`)
  }
  if (together.size < 20 || apart.size < 20) return null
  const sum = (s: Set<string>) => [...s].reduce((a, k) => a + (counts.get(k) ?? 0), 0)
  const some = (s: Set<string>) => [...s].filter((k) => (counts.get(k) ?? 0) > 0).length
  return {
    person,
    togetherHours: together.size,
    apartHours: apart.size,
    togetherPerHour: sum(together) / together.size,
    apartPerHour: sum(apart) / apart.size,
    apartTextShare: some(apart) / apart.size,
    togetherTextShare: some(together) / together.size,
  }
}

/**
 * Hours of one day with a real exchange (two or more texts, at least one from
 * each side) with `person`, as runs. Said only when the person's own history shows
 * texting them mostly happens apart.
 */
export function apartRuns(rows: TextRow[], matches: (r: TextRow) => boolean, rates: CompanyRates | null): string[] {
  if (!rates || rates.apartPerHour < rates.togetherPerHour * 3) return []
  const per = new Map<number, { out: number; in: number }>()
  for (const r of rows) {
    if (!matches(r) || r.group) continue
    const h = new Date(r.at).getHours()
    const p = per.get(h) ?? { out: 0, in: 0 }
    p[r.dir]++
    per.set(h, p)
  }
  const hours = [...per.entries()].filter(([, p]) => p.out + p.in >= 2 && p.out > 0 && p.in > 0).map(([h]) => h).sort((a, b) => a - b)
  const runs: [number, number][] = []
  for (const h of hours) {
    const last = runs.at(-1)
    if (last && h === last[1] + 1) last[1] = h
    else runs.push([h, h])
  }
  const pad = (h: number) => `${String(h).padStart(2, "0")}:00`
  return runs.map(([a, b]) => `Company: trading texts with ${rates.person} ${pad(a)}–${pad(b + 1)}, so probably not in the same room (together you text them ${rates.togetherPerHour.toFixed(1)} an hour, apart ${rates.apartPerHour.toFixed(1)}).`)
}
