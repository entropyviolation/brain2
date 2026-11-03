/**
 * lib/graph/vault-graph.ts — Day spine (KG-D1, KG-D2, KG-C1, E1)
 *
 * A read-only projection. Dated facts already in the stores become triples
 * on `day:` and period addresses. Nothing is written. Derived edges
 * (period nesting, rule membership, implied actions) are marked `derived`.
 *
 * Season boundaries are the house calendar quarters in `lib/seasons.ts`
 * (Q1 Spring … Q4 Winter), keyed `season:YYYY-Qn`. Week keys are
 * `getWeekString` (`YYYY-MM-DD_YYYY-MM-DD`), not ISO week numbers.
 *
 * Not projected (no clean dated reader, or a second store we will not invent):
 * - habit cells
 * - the GPS cluster name file (`lib/ingest/gps-places.ts`) — visits are the
 *   Location pens already on the time grid
 * - screen time and sleep as their own stores — only the blocks they already
 *   wrote (`generatedBy.kind` `screentime` or `sleep`)
 * - Telegram text as "messaged a person" — applied ingest events are
 *   `message:` nodes that `produced` items; person messages are iPhone
 *   Texts and iPhone Calls blocks
 */
import { blockPeople } from "@/lib/company-headcount"
import { formatLocalDateKey, getWeekString, parseLocalDate, parseWeekString } from "@/lib/date-utils"
import { COMPANY, isPersonPen, isWhoPen, variantPerson } from "@/lib/people-sync"
import { parseQuarterKey, quarterKey } from "@/lib/seasons"

export type EdgeOrder = "observed" | "recorded" | "derived" | "inferred"

/** Trust of an observation address inside belief strength. It is a fact, not a source score. */
export const OBSERVATION_TRUST = 1

const OBSERVATION_PREFIX = /^(block|habit|message|place|day|week|month|season|year):/

/** True for a day-spine address a formulation may point at. Not an item id. */
export function isObservationAddress(id: string): boolean {
  return OBSERVATION_PREFIX.test(id)
}

export interface VaultTriple {
  s: string
  p: string
  o: string
  graph: string
  order: EdgeOrder
  /** Valid time, local `YYYY-MM-DD`, when the fact has a day. */
  at?: string
  startMin?: number
  endMin?: number
}

export interface SpineGraph {
  triples: VaultTriple[]
  labels: Record<string, string>
}

export interface SpineEntry {
  id: string
  date: string
  scopeId: string
  penId: string
  secondaryPenIds?: string[]
  variantIds?: string[]
  startMin: number
  endMin: number
  kind?: string
  generatedBy?: { kind: string; id: string }
  title?: string
}

export interface SpinePen {
  id: string
  name: string
  color: string
  parentId?: string
  parentIds?: string[]
  levelId?: string
  variantLabel?: string
  variants?: { id: string; name: string; penId?: string; scopeId?: string }[]
  personId?: string
}

export interface SpineScope {
  id: string
  name?: string
  pens: SpinePen[]
  levels?: { id: string; name: string }[]
}

export interface SpineItem {
  id: string
  title?: string
  description?: string
  type?: string
  completed?: boolean
  completedDate?: Date | string
  createdAt?: Date | string
  scheduledDate?: Date | string
  deadline?: Date | string
  links?: readonly { relation: string; targetId: string }[]
  lists?: readonly string[]
  listRuleAddedIds?: readonly string[]
  captureOrigin?: { kind?: string } | null
  loggedAction?: boolean
  personPipelines?: readonly { kind: string; penId?: string }[]
}

export interface SpineReview {
  period: string
  periodKey: string
}

export interface SpineEvent {
  id: string
  at: string
  status: string
  itemIds?: readonly string[]
}

export interface SpineVault {
  entries?: readonly SpineEntry[]
  scopes?: readonly SpineScope[]
  items?: readonly SpineItem[]
  reviews?: readonly SpineReview[]
  events?: readonly SpineEvent[]
}

const TEXT_SCOPES = new Set(["iphone-texts", "iphone-calls"])
const LOCATION = "location"

export function itemAddress(id: string): string {
  return id.startsWith("item:") ? id : `item:${id}`
}

export function periodChain(dayKey: string): { day: string; week: string; month: string; season: string; year: string } | null {
  const date = parseLocalDate(dayKey)
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null
  return {
    day: `day:${dayKey}`,
    week: `week:${getWeekString(date)}`,
    month: `month:${dayKey.slice(0, 7)}`,
    season: `season:${quarterKey(date)}`,
    year: `year:${date.getFullYear()}`,
  }
}

export function dayInPeriod(dayKey: string, periodAddress: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return false
  if (periodAddress === `day:${dayKey}`) return true
  if (periodAddress.startsWith("month:")) return dayKey.startsWith(periodAddress.slice("month:".length))
  if (periodAddress.startsWith("year:")) return dayKey.startsWith(periodAddress.slice("year:".length))
  if (periodAddress.startsWith("week:")) {
    const range = parseWeekString(periodAddress.slice("week:".length))
    if (!range) return false
    const start = formatLocalDateKey(range.start)
    const end = formatLocalDateKey(range.end)
    return dayKey >= start && dayKey <= end
  }
  if (periodAddress.startsWith("season:")) {
    const parsed = parseQuarterKey(periodAddress.slice("season:".length))
    const date = parseLocalDate(dayKey)
    if (!parsed || !date) return false
    return quarterKey(date) === `${parsed.year}-Q${parsed.quarter}`
  }
  return false
}

export function shiftDay(dayKey: string, delta: number): string | null {
  const date = parseLocalDate(dayKey)
  if (!date) return null
  date.setDate(date.getDate() + delta)
  return formatLocalDateKey(date)
}

export function minutesOverlap(
  a: { at?: string; startMin?: number; endMin?: number },
  b: { at?: string; startMin?: number; endMin?: number },
): boolean {
  if (!a.at || a.at !== b.at) return false
  const a0 = a.startMin ?? 0
  const a1 = a.endMin ?? 1440
  const b0 = b.startMin ?? 0
  const b1 = b.endMin ?? 1440
  return a0 < b1 && b0 < a1
}

function dateKeyOf(value: Date | string | undefined | null): string | null {
  if (!value) return null
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return formatLocalDateKey(date)
}

function entryOrder(entry: SpineEntry): EdgeOrder {
  const kind = entry.generatedBy?.kind
  if (kind === "sleep" || kind === "screentime" || kind === "phone-sync") return "observed"
  return "recorded"
}

function periodAddress(period: string, key: string): string {
  if (period === "day") return `day:${key}`
  if (period === "week") return `week:${key}`
  if (period === "month") return `month:${key}`
  if (period === "quarter") return `season:${key}`
  if (period === "year") return `year:${key}`
  return `period:${period}:${key}`
}

function eachDay(start: string, end: string): string[] {
  if (end < start) return []
  const out: string[] = []
  let cursor: string | null = start
  while (cursor && cursor <= end && out.length < 400) {
    out.push(cursor)
    cursor = shiftDay(cursor, 1)
  }
  return out
}

/** Project the vault slice. Pure. */
export function projectVault(vault: SpineVault): SpineGraph {
  const triples: VaultTriple[] = []
  const labels: Record<string, string> = {}
  const seen = new Set<string>()
  const scopes = vault.scopes ?? []
  const entries = vault.entries ?? []
  const penToItem = new Map<string, string>()

  const push = (triple: VaultTriple) => {
    const key = `${triple.s}|${triple.p}|${triple.o}|${triple.at ?? ""}|${triple.startMin ?? ""}`
    if (seen.has(key)) return
    seen.add(key)
    triples.push(triple)
  }
  const name = (address: string, label: string) => {
    if (label.trim()) labels[address] = label.trim()
  }

  for (const item of vault.items ?? []) {
    const address = itemAddress(item.id)
    name(address, item.title || item.description || item.id)
    for (const pipeline of item.personPipelines ?? []) {
      if (pipeline.kind === "company-pen" && pipeline.penId) penToItem.set(pipeline.penId, item.id)
    }
  }

  const personNode = (penId: string): string => {
    const itemId = penToItem.get(penId)
    return itemId ? itemAddress(itemId) : `pen:${penId}`
  }

  for (const scope of scopes) {
    for (const pen of scope.pens) {
      name(`pen:${pen.id}`, pen.name)
      if (pen.personId) name(itemAddress(pen.personId), labels[itemAddress(pen.personId)] || pen.name)
    }
  }

  const company = scopes.find((scope) => scope.id === COMPANY)

  for (const entry of entries) {
    if (!entry.id || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) continue
    const block = `block:${entry.id}@${entry.date}`
    const order = entryOrder(entry)
    const window = { at: entry.date, startMin: entry.startMin, endMin: entry.endMin }
    name(block, entry.title || labels[`pen:${entry.penId}`] || entry.penId)
    push({ s: block, p: "on-day", o: `day:${entry.date}`, graph: "timegrid", order, ...window })

    const stream = entry.generatedBy?.kind
    if (stream === "sleep" || stream === "screentime" || stream === "phone-sync") {
      push({ s: block, p: "generated-by", o: `stream:${stream}`, graph: "timegrid", order, at: entry.date })
    }

    if (TEXT_SCOPES.has(entry.scopeId)) {
      const pen = scopes.find((scope) => scope.id === entry.scopeId)?.pens.find((row) => row.id === entry.penId)
      const who = pen?.personId ? itemAddress(pen.personId) : `pen:${entry.penId}`
      if (pen?.personId) name(who, labels[who] || pen.name)
      push({ s: block, p: "messaged", o: who, graph: "timegrid", order, ...window })
      continue
    }

    if (isInstantEntry(entry)) continue

    push({ s: block, p: "painted-with", o: `pen:${entry.penId}`, graph: "timegrid", order, ...window })
    for (const extra of entry.secondaryPenIds ?? []) {
      push({ s: block, p: "painted-with", o: `pen:${extra}`, graph: "timegrid", order, ...window })
    }

    if (entry.scopeId === COMPANY && company) {
      const stated = blockPeople(company as Parameters<typeof blockPeople>[0], entry)
      for (const penId of stated.people) {
        const who = personNode(penId)
        name(who, labels[who] || labels[`pen:${penId}`] || penId)
        push({ s: block, p: "with-person", o: who, graph: "timegrid", order, ...window })
      }
    }

    if (entry.scopeId === LOCATION) {
      push({ s: block, p: "at-place", o: `pen:${entry.penId}`, graph: "timegrid", order, ...window })
      name(`pen:${entry.penId}`, labels[`pen:${entry.penId}`] || entry.penId)
    }

    const scope = scopes.find((row) => row.id === entry.scopeId)
    const pen = scope?.pens.find((row) => row.id === entry.penId)
    if (scope && pen && isWhoPen(scope.id, pen)) {
      for (const variantId of entry.variantIds ?? []) {
        const variant = pen.variants?.find((row) => row.id === variantId)
        if (!variant) continue
        const companyPen = variantPerson(scopes as Parameters<typeof variantPerson>[0], scope.id, pen, variant)
        const who = companyPen ? personNode(companyPen) : `who:${scope.id}:${pen.id}:${variant.id}`
        name(who, labels[who] || variant.name)
        push({ s: block, p: "with-person", o: who, graph: "timegrid", order, ...window })
      }
    }
  }

  for (const item of vault.items ?? []) {
    const address = itemAddress(item.id)
    const done = dateKeyOf(item.completedDate)
    if (item.completed && done) {
      push({ s: address, p: "completed-on", o: `day:${done}`, graph: "tasks", order: "recorded", at: done })
    }
    const origin = item.captureOrigin?.kind
    const created = dateKeyOf(item.createdAt)
    if (origin && created) {
      push({ s: address, p: "captured-on", o: `day:${created}`, graph: "tasks", order: "recorded", at: created })
      push({ s: address, p: "captured-by", o: `capture:${origin}`, graph: "tasks", order: "recorded", at: created })
      if ((item.links?.length ?? 0) > 0) {
        push({ s: address, p: "has-link", o: address, graph: "tasks", order: "recorded", at: created })
      }
    }
    if ((origin === "notes" || origin === "iphone-notes") && created) {
      push({ s: address, p: "noted-on", o: `day:${created}`, graph: "tasks", order: "recorded", at: created })
    }
    const ruleAdded = new Set(item.listRuleAddedIds ?? [])
    for (const listId of item.lists ?? []) {
      const derived = ruleAdded.has(listId)
      push({
        s: address,
        p: "member-of",
        o: `list:${listId}`,
        graph: "tasks",
        order: derived ? "derived" : "recorded",
      })
    }
    if (item.loggedAction) {
      push({ s: address, p: "derived-from", o: "value:implied-action", graph: "tasks", order: "derived" })
    }
    const start = dateKeyOf(item.scheduledDate)
    const end = dateKeyOf(item.deadline)
    if (start && end) {
      for (const day of eachDay(start, end)) {
        push({ s: address, p: "spans", o: `day:${day}`, graph: "tasks", order: "recorded", at: day })
      }
    }
  }

  for (const review of vault.reviews ?? []) {
    if (!review.period || !review.periodKey) continue
    const address = `review:${review.period}:${review.periodKey}`
    const period = periodAddress(review.period, review.periodKey)
    name(address, `${review.period} review`)
    push({ s: address, p: "reviews", o: period, graph: "reviews", order: "recorded" })
  }

  for (const event of vault.events ?? []) {
    if (event.status !== "applied") continue
    const day = dateKeyOf(event.at)
    if (!day) continue
    const address = `message:${event.id}`
    name(address, "applied message")
    push({ s: address, p: "applied-on", o: `day:${day}`, graph: "ingest", order: "observed", at: day })
    for (const itemId of event.itemIds ?? []) {
      push({ s: address, p: "produced", o: itemAddress(itemId), graph: "ingest", order: "observed", at: day })
    }
  }

  const days = new Set<string>()
  for (const triple of triples) {
    if (triple.at) days.add(triple.at)
    if (triple.o.startsWith("day:")) days.add(triple.o.slice(4))
    if (triple.s.startsWith("day:")) days.add(triple.s.slice(4))
  }
  for (const day of days) {
    const chain = periodChain(day)
    if (!chain) continue
    push({ s: chain.day, p: "nested-in", o: chain.week, graph: "period", order: "derived", at: day })
    push({ s: chain.week, p: "nested-in", o: chain.month, graph: "period", order: "derived" })
    push({ s: chain.month, p: "nested-in", o: chain.season, graph: "period", order: "derived" })
    push({ s: chain.season, p: "nested-in", o: chain.year, graph: "period", order: "derived" })
  }

  return { triples, labels }
}

function isInstantEntry(entry: SpineEntry): boolean {
  return entry.kind === "instant"
}

export function triplesForDay(triples: readonly VaultTriple[], dayKey: string): VaultTriple[] {
  const key = dayKey.startsWith("day:") ? dayKey.slice(4) : dayKey
  const day = `day:${key}`
  return triples.filter((triple) => triple.at === key || triple.s === day || triple.o === day)
}

export function triplesForPeriod(triples: readonly VaultTriple[], periodAddress: string): VaultTriple[] {
  return triples.filter((triple) => {
    if (triple.s === periodAddress || triple.o === periodAddress) return true
    return !!triple.at && dayInPeriod(triple.at, periodAddress)
  })
}

function personMatch(address: string, query: string, labels: Record<string, string>): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return false
  if (address.toLowerCase() === needle) return true
  if (address.toLowerCase() === `item:${needle}` || address.toLowerCase() === `pen:${needle}`) return true
  return (labels[address] ?? "").trim().toLowerCase() === needle
}

export interface PeopleDuring {
  triples: VaultTriple[]
  others: string[]
  places: string[]
  n: number
  orders: EdgeOrder[]
}

/** People and places co-timed with `person` on the inclusive date range. */
export function peopleDuring(
  graph: SpineGraph,
  opts: { start: string; end: string; person: string },
): PeopleDuring {
  const mine = graph.triples.filter(
    (triple) =>
      triple.p === "with-person" &&
      !!triple.at &&
      triple.at >= opts.start &&
      triple.at <= opts.end &&
      personMatch(triple.o, opts.person, graph.labels),
  )
  const triples: VaultTriple[] = []
  const others = new Set<string>()
  const places = new Set<string>()
  const seen = new Set<string>()
  const take = (triple: VaultTriple) => {
    const key = `${triple.s}|${triple.p}|${triple.o}|${triple.at ?? ""}`
    if (seen.has(key)) return
    seen.add(key)
    triples.push(triple)
  }
  for (const row of mine) {
    take(row)
    for (const other of graph.triples) {
      if (!minutesOverlap(row, other)) continue
      if (other.p === "with-person" && other.o !== row.o) {
        take(other)
        others.add(other.o)
      }
      if (other.p === "at-place") {
        take(other)
        places.add(other.o)
      }
    }
  }
  const orders = [...new Set(triples.map((triple) => triple.order))]
  return { triples, others: [...others], places: [...places], n: mine.length, orders }
}

/** Inclusive range a titled item `spans`, if the spine has those days. */
export function spanRangeForTitle(graph: SpineGraph, title: string): { item: string; start: string; end: string } | null {
  const needle = title.trim().toLowerCase()
  if (!needle) return null
  const item = Object.entries(graph.labels).find(([address, label]) => address.startsWith("item:") && label.trim().toLowerCase() === needle)?.[0]
  if (!item) return null
  const days = graph.triples
    .filter((triple) => triple.s === item && triple.p === "spans" && triple.at)
    .map((triple) => triple.at as string)
    .sort()
  if (!days.length) return null
  return { item, start: days[0], end: days[days.length - 1] }
}

export interface PlaceWithOne {
  place: string
  person: string
  n: number
  start: string
  end: string
  triples: VaultTriple[]
}

/** Places whose accompanied visits name exactly one person. */
export function placesWithOnePerson(graph: SpineGraph): PlaceWithOne[] {
  const byPlace = new Map<string, { people: Set<string>; days: string[]; triples: VaultTriple[] }>()
  for (const place of graph.triples) {
    if (place.p !== "at-place" || !place.at) continue
    const people = new Set<string>()
    const company: VaultTriple[] = []
    for (const row of graph.triples) {
      if (row.p === "with-person" && minutesOverlap(place, row)) {
        people.add(row.o)
        company.push(row)
      }
    }
    if (people.size === 0) continue
    const bag = byPlace.get(place.o) ?? { people: new Set<string>(), days: [], triples: [] }
    for (const person of people) bag.people.add(person)
    bag.days.push(place.at)
    bag.triples.push(place, ...company)
    byPlace.set(place.o, bag)
  }
  const out: PlaceWithOne[] = []
  for (const [place, bag] of byPlace) {
    if (bag.people.size !== 1) continue
    const days = [...bag.days].sort()
    out.push({
      place,
      person: [...bag.people][0],
      n: bag.days.length,
      start: days[0],
      end: days[days.length - 1],
      triples: bag.triples,
    })
  }
  out.sort((a, b) => a.place.localeCompare(b.place))
  return out
}

/** Captures (items with a capture origin) that have no item links. */
export function unlinkedCaptures(graph: SpineGraph): VaultTriple[] {
  const linked = new Set(graph.triples.filter((triple) => triple.p === "has-link").map((triple) => triple.s))
  return graph.triples.filter((triple) => triple.p === "captured-on" && !linked.has(triple.s))
}

export interface UnseenMessaged {
  people: { person: string; triples: VaultTriple[] }[]
  /** False when the spine has no `messaged` edge. The query still ran. */
  messagesProjected: boolean
}

/**
 * People with no `with-person` co-time in the last `unseenDays` (default 90)
 * who have a `messaged` edge in each of the last `weeks` weeks (default 4).
 * Messages are iPhone Texts and iPhone Calls blocks. Telegram events are not
 * person messages.
 */
export function peopleNotSeenButMessaged(
  graph: SpineGraph,
  opts: { asOf: string; unseenDays?: number; weeks?: number },
): UnseenMessaged {
  const unseenDays = opts.unseenDays ?? 90
  const weekCount = opts.weeks ?? 4
  const messagesProjected = graph.triples.some((triple) => triple.p === "messaged")
  const cutoff = shiftDay(opts.asOf, -unseenDays)
  const weekKeys: string[] = []
  let cursor: string | null = opts.asOf
  for (let i = 0; i < weekCount && cursor; i++) {
    const date = parseLocalDate(cursor)
    if (!date) break
    weekKeys.push(getWeekString(date))
    cursor = shiftDay(cursor, -7)
  }
  const byPerson = new Map<string, VaultTriple[]>()
  for (const triple of graph.triples) {
    if (triple.p !== "messaged") continue
    const list = byPerson.get(triple.o) ?? []
    list.push(triple)
    byPerson.set(triple.o, list)
  }
  const people: { person: string; triples: VaultTriple[] }[] = []
  for (const [person, rows] of byPerson) {
    const covered = new Set<string>()
    for (const triple of rows) {
      if (!triple.at) continue
      const date = parseLocalDate(triple.at)
      if (!date) continue
      const week = getWeekString(date)
      if (weekKeys.includes(week)) covered.add(week)
    }
    if (covered.size < weekKeys.length) continue
    const seen = graph.triples.some(
      (triple) =>
        triple.p === "with-person" &&
        triple.o === person &&
        !!triple.at &&
        !!cutoff &&
        triple.at >= cutoff &&
        triple.at <= opts.asOf,
    )
    if (seen) continue
    people.push({ person, triples: rows })
  }
  people.sort((a, b) => a.person.localeCompare(b.person))
  return { people, messagesProjected }
}

/** Company person pens, for identity. Re-exported call so callers need not import people-sync. */
export function companyPersonPens(scopes: readonly SpineScope[]): SpinePen[] {
  const company = scopes.find((scope) => scope.id === COMPANY)
  if (!company) return []
  return company.pens.filter((pen) => isPersonPen(company as Parameters<typeof isPersonPen>[0], pen))
}
