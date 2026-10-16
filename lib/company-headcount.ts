/**
 * lib/company-headcount.ts — Alone, or with how many people, minute by minute
 *
 * Reads the Company view only. For each minute a Company block covers, the
 * people are the person pens it states: primary and extra pens, plus the pens
 * behind its ticked details. Alone (or a pen on the broadest Company level
 * named Alone) is zero. Together / In conversation with no one named is "with
 * someone, count unknown" — not one person, not alone. A group pen with no one
 * ticked counts its members (the pens that count as it). Minutes with no
 * Company block are "not recorded": unknown company is neither alone nor with
 * anyone (docs/time-context-vision.md).
 *
 * Several Company blocks over the same minute union their people. Instants
 * never count. Pure; structural types only.
 */
import { childrenOf } from "@/lib/pen-tree"
import { penLevelId, type ScopeLevel } from "@/lib/pen-levels"

export type HeadcountBucket = "alone" | "1" | "2" | "3" | "4+" | "someone"

export const HEADCOUNT_BUCKETS: { id: HeadcountBucket; label: string; color: string }[] = [
  { id: "alone", label: "Alone", color: "#64748b" },
  { id: "1", label: "With 1 person", color: "#f59e0b" },
  { id: "2", label: "With 2 people", color: "#ef6c2f" },
  { id: "3", label: "With 3 people", color: "#d9466f" },
  { id: "4+", label: "With 4 or more", color: "#8b5cf6" },
  { id: "someone", label: "With someone, count unknown", color: "#c9a77a" },
]

type HcPen = {
  id: string
  name: string
  color: string
  parentId?: string
  parentIds?: string[]
  levelId?: string
  variants?: { id: string; penId?: string; scopeId?: string }[]
}
type HcScope = { id: string; pens: HcPen[]; levels?: ScopeLevel[] }
type HcEntry = {
  date: string
  scopeId: string
  penId: string
  secondaryPenIds?: string[]
  variantIds?: string[]
  startMin: number
  endMin: number
  kind?: string
}

export type HeadcountResult = {
  /** Minutes per bucket over the dates asked for. */
  minutes: Record<HeadcountBucket, number>
  /** Minutes some Company block covered. */
  recorded: number
  /** Minutes any other view painted that Company left blank. */
  notRecorded: number
  /** Top activity pens per bucket (`activityScopeId` blocks over the same minutes). */
  activities: Record<HeadcountBucket, { penId: string; minutes: number }[]>
  /** Minutes per person pen, for "most time with". */
  people: { penId: string; minutes: number }[]
  /** Mean people per minute when the count is known and not alone. */
  meanCompany: number
}

function isAlonePen(scope: HcScope, pen: HcPen | undefined): boolean {
  if (!pen) return false
  if (pen.id === "co-alone") return true
  return pen.name.trim().toLowerCase() === "alone" && penLevelId(scope, pen) !== "lvl-company-person"
}

function isKindPen(scope: HcScope, pen: HcPen | undefined): boolean {
  if (!pen) return false
  return penLevelId(scope, pen) === "lvl-company-kind" || pen.id === "co-together" || pen.id === "co-talking"
}

/** People a Company block states, or "alone", or "someone" (with no one named). */
export function blockPeople(scope: HcScope, entry: HcEntry): { alone: boolean; someone: boolean; people: Set<string> } {
  const people = new Set<string>()
  let alone = false
  let someone = false
  const pen = scope.pens.find((p) => p.id === entry.penId)
  const ticked = (pen?.variants ?? [])
    .filter((v) => (entry.variantIds ?? []).includes(v.id) && v.penId && !v.scopeId)
    .map((v) => v.penId!)
  const stated = [entry.penId, ...(entry.secondaryPenIds ?? []), ...ticked]
  for (const id of stated) {
    const p = scope.pens.find((x) => x.id === id)
    if (!p) continue
    if (isAlonePen(scope, p)) {
      alone = true
      continue
    }
    if (isKindPen(scope, p)) {
      someone = true
      continue
    }
    const members = childrenOf(scope.pens, p.id)
    // A group with no one ticked counts its members; a ticked member is already in `ticked`.
    if (members.length && !ticked.length) for (const m of members) people.add(m.id)
    else if (!members.length || !ticked.length) people.add(p.id)
  }
  return { alone: alone && people.size === 0, someone: !alone && people.size === 0 && someone, people }
}

function bucketFor(count: number): HeadcountBucket {
  if (count <= 0) return "alone"
  if (count >= 4) return "4+"
  return String(count) as HeadcountBucket
}

export function companyHeadcount(
  entries: HcEntry[],
  scopes: HcScope[],
  dateKeys: string[],
  options: { companyScopeId?: string; activityScopeId?: string; activityPenFor?: (penId: string) => string } = {},
): HeadcountResult {
  const companyId = options.companyScopeId ?? "company"
  const activityId = options.activityScopeId ?? "activity"
  const scope = scopes.find((s) => s.id === companyId)
  const empty = (): Record<HeadcountBucket, number> => ({ alone: 0, "1": 0, "2": 0, "3": 0, "4+": 0, someone: 0 })
  const result: HeadcountResult = {
    minutes: empty(),
    recorded: 0,
    notRecorded: 0,
    activities: { alone: [], "1": [], "2": [], "3": [], "4+": [], someone: [] },
    people: [],
    meanCompany: 0,
  }
  if (!scope) return result
  const wanted = new Set(dateKeys)
  const byDate = new Map<string, HcEntry[]>()
  for (const entry of entries) {
    if (!wanted.has(entry.date) || entry.kind === "instant" || entry.endMin <= entry.startMin) continue
    const list = byDate.get(entry.date)
    if (list) list.push(entry)
    else byDate.set(entry.date, [entry])
  }
  const activity = new Map<string, Map<string, number>>()
  const people = new Map<string, number>()
  let knownPeopleMinutes = 0
  let knownWithMinutes = 0
  for (const [, dayEntries] of byDate) {
    const state: ({ alone: boolean; someone: boolean; people: Set<string> } | null)[] = new Array(1440).fill(null)
    const painted = new Uint8Array(1440)
    const act: (string | null)[] = new Array(1440).fill(null)
    for (const entry of dayEntries) {
      if (entry.scopeId === activityId) {
        const pen = options.activityPenFor ? options.activityPenFor(entry.penId) : entry.penId
        for (let m = Math.max(0, entry.startMin); m < Math.min(1440, entry.endMin); m++) act[m] = pen
      }
      if (entry.scopeId !== companyId) {
        for (let m = Math.max(0, entry.startMin); m < Math.min(1440, entry.endMin); m++) painted[m] = 1
        continue
      }
      const said = blockPeople(scope, entry)
      for (let m = Math.max(0, entry.startMin); m < Math.min(1440, entry.endMin); m++) {
        const prev = state[m]
        if (!prev) state[m] = { alone: said.alone, someone: said.someone, people: new Set(said.people) }
        else {
          for (const id of said.people) prev.people.add(id)
          prev.someone = prev.someone || said.someone
          prev.alone = prev.alone && said.alone
        }
      }
    }
    for (let m = 0; m < 1440; m++) {
      const s = state[m]
      if (!s) {
        if (painted[m]) result.notRecorded += 1
        continue
      }
      result.recorded += 1
      const bucket: HeadcountBucket = s.people.size > 0 ? bucketFor(s.people.size) : s.alone && !s.someone ? "alone" : "someone"
      result.minutes[bucket] += 1
      if (s.people.size > 0) {
        knownPeopleMinutes += s.people.size
        knownWithMinutes += 1
        for (const id of s.people) people.set(id, (people.get(id) ?? 0) + 1)
      }
      const a = act[m]
      if (a) {
        const map = activity.get(bucket) ?? new Map<string, number>()
        map.set(a, (map.get(a) ?? 0) + 1)
        activity.set(bucket, map)
      }
    }
  }
  for (const bucket of HEADCOUNT_BUCKETS) {
    result.activities[bucket.id] = [...(activity.get(bucket.id) ?? new Map()).entries()]
      .map(([penId, minutes]) => ({ penId, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 3)
  }
  result.people = [...people.entries()].map(([penId, minutes]) => ({ penId, minutes })).sort((a, b) => b.minutes - a.minutes)
  result.meanCompany = knownWithMinutes ? Math.round((knownPeopleMinutes / knownWithMinutes) * 10) / 10 : 0
  return result
}
