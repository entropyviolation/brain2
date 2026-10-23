/**
 * lib/person-time.ts — Time together with one person, from Tracking
 *
 * A minute is "with" a person when either:
 * - a Company block names them (its pen, extra pens, ticked details, or a
 *   group they belong to — `blockPeople` in `lib/company-headcount.ts`), or
 * - a block on a who pen (Social · "Who with?") ticks a detail that is them
 *   (`variantPerson` in `lib/people-sync.ts`).
 * Phone calls and texts are not company (`lib/person-contact.ts`).
 * Minutes are unioned per day, so the two never double count.
 *
 * Sessions are runs of those minutes, joining gaps of `SESSION_GAP_MIN` or
 * less. For each session and in total: where (Location pens over the same
 * minutes), doing what (Activity pens), and who else was there (other people
 * on the same Company minutes). Cadence is the median days between session
 * days. Pure; structural types only.
 */
import { blockPeople } from "@/lib/company-headcount"
import { COMPANY, variantPerson } from "@/lib/people-sync"

export const SESSION_GAP_MIN = 30

type PtPen = {
  id: string
  name: string
  color: string
  parentId?: string
  parentIds?: string[]
  levelId?: string
  variantLabel?: string
  variants?: { id: string; name: string; penId?: string; scopeId?: string }[]
}
type PtScope = { id: string; name: string; pens: PtPen[]; levels?: { id: string; name: string }[] }
type PtEntry = {
  date: string
  scopeId: string
  penId: string
  secondaryPenIds?: string[]
  variantIds?: string[]
  startMin: number
  endMin: number
  kind?: string
}

export type PenShare = { penId: string; name: string; color: string; minutes: number }

export type PersonSession = {
  date: string
  startMin: number
  endMin: number
  minutes: number
  places: string[]
  activities: string[]
  others: string[]
}

export type PersonTimeStats = {
  totalMinutes: number
  sessions: PersonSession[]
  days: number
  first: string | null
  last: string | null
  last30: number
  last90: number
  /** Mean minutes per week over the last 12 weeks. */
  perWeek: number
  /** Median days between days together; null under two days. */
  cadenceDays: number | null
  /** Days since the last session. */
  sinceLast: number | null
  longest: PersonSession | null
  weekday: number[]
  hour: number[]
  places: PenShare[]
  activities: PenShare[]
  others: PenShare[]
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number)
  const [by, bm, bd] = b.split("-").map(Number)
  return Math.round((Date.UTC(by!, bm! - 1, bd!) - Date.UTC(ay!, am! - 1, ad!)) / 86400000)
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y!, m! - 1, d!).getDay()
}

/** Minutes with this person, per day, as a 1440-minute mask. */
export function personMinuteMasks(entries: PtEntry[], scopes: PtScope[], penIds: string[]): Map<string, Uint8Array> {
  const wanted = new Set(penIds)
  const masks = new Map<string, Uint8Array>()
  if (!wanted.size) return masks
  const company = scopes.find((s) => s.id === COMPANY)
  const mark = (entry: PtEntry) => {
    const mask = masks.get(entry.date) ?? new Uint8Array(1440)
    for (let m = Math.max(0, entry.startMin); m < Math.min(1440, entry.endMin); m++) mask[m] = 1
    masks.set(entry.date, mask)
  }
  for (const entry of entries) {
    if (entry.kind === "instant" || entry.endMin <= entry.startMin) continue
    if (entry.scopeId === COMPANY) {
      if (!company) continue
      const said = blockPeople(company, entry)
      if ([...said.people].some((id) => wanted.has(id)) || wanted.has(entry.penId)) mark(entry)
      continue
    }
    if (!entry.variantIds?.length) continue
    const scope = scopes.find((s) => s.id === entry.scopeId)
    const pen = scope?.pens.find((p) => p.id === entry.penId)
    if (!pen?.variants?.length) continue
    const hit = pen.variants.some((v) => entry.variantIds!.includes(v.id) && wanted.has(variantPerson(scopes, entry.scopeId, pen, v) ?? ""))
    if (hit) mark(entry)
  }
  return masks
}

export function personTimeStats(entries: PtEntry[], scopes: PtScope[], penIds: string[], today: string): PersonTimeStats {
  const masks = personMinuteMasks(entries, scopes, penIds)
  const company = scopes.find((s) => s.id === COMPANY)
  const location = scopes.find((s) => s.id === "location")
  const activity = scopes.find((s) => s.id === "activity")
  const wanted = new Set(penIds)
  const stats: PersonTimeStats = {
    totalMinutes: 0,
    sessions: [],
    days: 0,
    first: null,
    last: null,
    last30: 0,
    last90: 0,
    perWeek: 0,
    cadenceDays: null,
    sinceLast: null,
    longest: null,
    weekday: new Array(7).fill(0),
    hour: new Array(24).fill(0),
    places: [],
    activities: [],
    others: [],
  }
  const tally = (map: Map<string, number>, id: string, n: number) => map.set(id, (map.get(id) ?? 0) + n)
  const placeTotals = new Map<string, number>()
  const activityTotals = new Map<string, number>()
  const otherTotals = new Map<string, number>()
  const byDate = new Map<string, PtEntry[]>()
  for (const entry of entries) {
    if (!masks.has(entry.date) || entry.kind === "instant") continue
    const list = byDate.get(entry.date)
    if (list) list.push(entry)
    else byDate.set(entry.date, [entry])
  }
  const dates = [...masks.keys()].sort()
  for (const date of dates) {
    const mask = masks.get(date)!
    let count = 0
    for (let m = 0; m < 1440; m++) if (mask[m]) count++
    if (!count) continue
    stats.days += 1
    stats.totalMinutes += count
    const ago = dayDiff(date, today)
    if (ago >= 0 && ago < 30) stats.last30 += count
    if (ago >= 0 && ago < 90) stats.last90 += count
    if (ago >= 0 && ago < 84) stats.perWeek += count
    stats.weekday[weekdayOf(date)] += count
    for (let m = 0; m < 1440; m++) if (mask[m]) stats.hour[Math.floor(m / 60)] += 1

    // Sessions: runs of minutes, bridging short gaps.
    const runs: { startMin: number; endMin: number }[] = []
    for (let m = 0; m < 1440; m++) {
      if (!mask[m]) continue
      const last = runs.at(-1)
      if (last && m - last.endMin <= SESSION_GAP_MIN) last.endMin = m + 1
      else runs.push({ startMin: m, endMin: m + 1 })
    }
    const dayEntries = byDate.get(date) ?? []
    for (const run of runs) {
      let minutes = 0
      for (let m = run.startMin; m < run.endMin; m++) if (mask[m]) minutes++
      const names = (scope: PtScope | undefined, totals: Map<string, number>, exclude?: Set<string>, people = false) => {
        const local = new Map<string, number>()
        for (const entry of dayEntries) {
          if (entry.scopeId !== scope?.id) continue
          const lo = Math.max(run.startMin, entry.startMin)
          const hi = Math.min(run.endMin, entry.endMin)
          if (hi <= lo) continue
          let overlap = 0
          for (let m = lo; m < hi; m++) if (mask[m]) overlap++
          if (!overlap) continue
          const ids = people && company ? [...blockPeople(company, entry).people] : [entry.penId]
          for (const id of ids) {
            if (exclude?.has(id)) continue
            tally(local, id, overlap)
            tally(totals, id, overlap)
          }
        }
        return [...local.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => scope?.pens.find((p) => p.id === id)?.name ?? id)
      }
      const session: PersonSession = {
        date,
        startMin: run.startMin,
        endMin: run.endMin,
        minutes,
        places: names(location, placeTotals),
        activities: names(activity, activityTotals),
        others: names(company, otherTotals, wanted, true),
      }
      stats.sessions.push(session)
      if (!stats.longest || session.minutes > stats.longest.minutes) stats.longest = session
    }
  }
  stats.sessions.sort((a, b) => b.date.localeCompare(a.date) || b.startMin - a.startMin)
  stats.first = dates.find((d) => masks.get(d)!.some((v) => v)) ?? null
  stats.last = stats.sessions[0]?.date ?? null
  stats.sinceLast = stats.last ? Math.max(0, dayDiff(stats.last, today)) : null
  stats.perWeek = Math.round(stats.perWeek / 12)
  const sessionDays = [...new Set(stats.sessions.map((s) => s.date))].sort()
  if (sessionDays.length >= 2) {
    const gaps = sessionDays.slice(1).map((d, i) => dayDiff(sessionDays[i]!, d)).sort((a, b) => a - b)
    stats.cadenceDays = gaps[Math.floor(gaps.length / 2)]!
  }
  const shares = (scope: PtScope | undefined, totals: Map<string, number>): PenShare[] =>
    [...totals.entries()]
      .map(([penId, minutes]) => {
        const pen = scope?.pens.find((p) => p.id === penId)
        return { penId, name: pen?.name ?? penId, color: pen?.color ?? "#888888", minutes }
      })
      .sort((a, b) => b.minutes - a.minutes)
  stats.places = shares(location, placeTotals)
  stats.activities = shares(activity, activityTotals)
  stats.others = shares(company, otherTotals)
  return stats
}

/** "about every 6 days" / "about weekly" / "about monthly". */
export function cadenceSentence(days: number | null): string {
  if (days === null) return "Not enough days together yet to see a rhythm."
  if (days <= 1) return "Most days."
  if (days <= 4) return `About every ${days} days.`
  if (days <= 9) return days === 7 ? "About weekly." : `About every ${days} days.`
  if (days <= 18) return "About every two weeks."
  if (days <= 45) return "About monthly."
  return `About every ${Math.round(days / 30)} months.`
}
