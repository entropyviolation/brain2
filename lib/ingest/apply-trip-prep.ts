/**
 * lib/ingest/apply-trip-prep.ts — BIM Chat command: "have to do before leaving for New York: pack / talk to Shelby"
 *
 * A Trip-prep BIMBY. One line plus the things after it become:
 *   1. a departure date, from the next Flight item that lands in that place, else a Plan event whose title
 *      names it, else one question ("When do you leave for New York?") and a new Plan event from the answer;
 *   2. a list "To do before New York" (made once, reused after);
 *   3. one Home → To Do task per thing, dated on a lead-up timeline to that day (see `leadUpDates`);
 *   4. a merge question when an item looks like a task you already have.
 * Nothing is written until the date and the merge question are settled. Each write is one undo step.
 * Chat only (`tryTell` in `bim-chat.ts`); no model is called. Open question is in memory only.
 */
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { runAsAction } from "@/lib/action-history"
import { addCalendarDays, parseLocalDate, toLocalCalendarDate } from "@/lib/date-utils"
import { useEventStore } from "@/lib/event-store"
import { FLIGHT_ATTR, FLIGHT_TYPE_ID } from "@/lib/flight-types"
import { useTaskStore } from "@/lib/task-store"
import type { List, Task } from "@/lib/types"
import type { TellReply } from "./apply-tell"
import { isDecline, isoOf, parseDayAnswer } from "./bim-tell"
import { hasUnmatchedContent, normalizeName, scoreName } from "./name-resolve"

export type TripPrep = { place: string; items: string[] }

type Dated = { item: string; iso: string }
type Match = { item: string; iso: string; taskId: string; taskName: string }

/** What BIM is waiting to hear. In memory only. */
type Pending =
  | { kind: "date"; prep: TripPrep }
  | { kind: "merge"; prep: TripPrep; departIso: string; dated: Dated[]; matches: Match[] }

let pending: Pending | null = null

export function openTripPrepQuestion(): boolean {
  return pending !== null
}

const LEAD =
  String.raw`(?:(?:i\s+)?(?:have|need|got|gotta|want)\s+to\s+|gotta\s+|things\s+to\s+|to\s+)?(?:do|get\s+done|handle|take\s+care\s+of)\s+(?:things\s+)?before\s+`
const GOING =
  String.raw`(?:i\s+)?(?:leav(?:e|ing)\s+(?:for|to)|go(?:ing)?\s+(?:to|off\s+to)|fly(?:ing)?\s+(?:out\s+)?to|head(?:ing)?\s+(?:out\s+)?to|(?:my|the)\s+(?:trip|flight)\s+to|the\s+(?:trip|flight)\s+to)\s+`
const TRIP_PREP = new RegExp(`^\\s*${LEAD}${GOING}([^:\\n]+?)\\s*(?::|\\s-\\s|\\n)\\s*([\\s\\S]+)$`, "i")

function titleCase(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b([a-z])([a-z']*)/gi, (_m, a: string, b: string) => a.toUpperCase() + b.toLowerCase())
}

function sentence(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text
}

/** The things after the colon: one per line; a single line splits on `;` and `,`. Bullets and numbers are peeled. */
export function splitItems(body: string): string[] {
  const lines = body.split(/\r?\n/)
  const parts = lines.length > 1 ? lines : body.split(/\s*;\s*|\s*,\s*(?:and\s+)?/)
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const clean = part.replace(/^\s*(?:[-*•–]|\d+[.)])\s*/, "").replace(/[.\s]+$/, "").trim()
    const key = normalizeName(clean)
    if (!clean || seen.has(key)) continue
    seen.add(key)
    out.push(sentence(clean))
  }
  return out
}

/** "have to do before leaving for new york: pack \n talk to shelby" → place and items. Null for anything else. */
export function parseTripPrep(text: string): TripPrep | null {
  const m = TRIP_PREP.exec(text)
  if (!m) return null
  const place = titleCase(m[1]!.replace(/^(?:the|a)\s+/i, ""))
  const items = splitItems(m[2]!)
  return place && items.length ? { place, items } : null
}

// ---------------------------------------------------------------- finding the day

/** Airports and nicknames for places people say. A place not here is matched on its own words. */
const PLACE_CODES: Record<string, string[]> = {
  "new york": ["jfk", "lga", "ewr", "nyc"],
  nyc: ["jfk", "lga", "ewr", "nyc"],
  "los angeles": ["lax", "bur", "lgb"],
  la: ["lax", "bur", "lgb"],
  "san francisco": ["sfo", "oak"],
  chicago: ["ord", "mdw"],
  boston: ["bos"],
  seattle: ["sea"],
  miami: ["mia", "fll"],
  "las vegas": ["las"],
  "washington dc": ["dca", "iad", "bwi"],
  washington: ["dca", "iad", "bwi"],
  "san diego": ["san"],
  london: ["lhr", "lgw", "stn", "lcy"],
  paris: ["cdg", "ory"],
  tokyo: ["nrt", "hnd"],
}

function placeTerms(place: string): string[] {
  const key = normalizeName(place)
  return [key, ...(PLACE_CODES[key] ?? [])]
}

function hasTerm(haystack: string, term: string): boolean {
  return ` ${normalizeName(haystack)} `.includes(` ${term} `)
}

function flightDay(task: Task): string | null {
  const raw = task.attributes?.[FLIGHT_ATTR.departureTime]
  const fromAttr = typeof raw === "string" ? /^(\d{4}-\d{2}-\d{2})/.exec(raw)?.[1] : undefined
  if (fromAttr) return fromAttr
  return task.scheduledDate ? isoOf(toLocalCalendarDate(task.scheduledDate)) : null
}

/** The first Flight item from today on whose arrival airport (or title) names the place, and does not leave from it. */
export function findFlightDay(place: string, now: Date, tasks: readonly Task[] = useTaskStore.getState().tasks): string | null {
  const terms = placeTerms(place)
  const today = isoOf(now)
  const days = tasks
    .filter((t) => t.type === FLIGHT_TYPE_ID && !t.completed)
    .filter((t) => {
      const to = String(t.attributes?.[FLIGHT_ATTR.arrivalAirport] ?? "")
      const from = String(t.attributes?.[FLIGHT_ATTR.departureAirport] ?? "")
      const arrives = terms.some((term) => hasTerm(to, term)) || (!to && terms.some((term) => hasTerm(t.title ?? t.description, term)))
      const leaves = terms.some((term) => hasTerm(from, term))
      return arrives && !leaves
    })
    .map(flightDay)
    .filter((iso): iso is string => !!iso && iso >= today)
    .sort()
  return days[0] ?? null
}

/** The first Plan event from today on whose title names the place. */
export function findEventDay(place: string, now: Date): string | null {
  const today = isoOf(now)
  const terms = placeTerms(place)
  const days = useEventStore
    .getState()
    .events.filter((e) => e.title && isoOf(toLocalCalendarDate(e.date)) >= today)
    .filter((e) => terms.some((term) => hasTerm(e.title, term)) || (scoreName(place, e.title) >= 0.75 && !hasUnmatchedContent(place, e.title)))
    .map((e) => isoOf(toLocalCalendarDate(e.date)))
    .sort()
  return days[0] ?? null
}

function endClock(time: string): string {
  const [h, m] = time.split(":").map(Number)
  return `${String(Math.min(23, (h ?? 0) + 1)).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`
}

/** The Plan event for a trip BIM had to make; reuses one with the same title and day. */
function makeTripEvent(place: string, iso: string, time?: string): void {
  const title = `Leave for ${place}`
  const store = useEventStore.getState()
  if (store.events.some((e) => isoOf(toLocalCalendarDate(e.date)) === iso && normalizeName(e.title) === normalizeName(title))) return
  store.addEvent({
    id: `bim-event-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title,
    date: toLocalCalendarDate(parseLocalDate(iso)!),
    startTime: time ?? "00:00",
    endTime: time ? endClock(time) : "23:59",
    type: "event",
    color: "#6366f1",
    isScheduled: true,
    isAllDay: !time,
    location: "",
    description: "Made by BIM for a trip to-do list.",
  })
}

// ---------------------------------------------------------------- the lead-up timeline

/** Things done in the last days: packing, bags, check-in, charging, documents. The rest spread out earlier. */
const LAST_DAYS = /\b(pack|packing|bag|bags|luggage|suitcase|carry[- ]?on|check[- ]?in|charge|charger|chargers|passport|id|print|boarding)\b/i

const LAST_DAY_COUNT = 2

function dayAt(iso: string, offset: number): string {
  return isoOf(addCalendarDays(parseLocalDate(iso)!, offset))
}

/**
 * A day for each item, ahead of `departIso`, in the order given.
 * Last-days items (`LAST_DAYS`) fall on the final two days before leaving (the day before, then the day before that).
 * The rest are spread evenly from today to just before those days. With fewer than a few days left, everything is today.
 * Nothing is dated in the past or on departure day, except when you leave today or tomorrow: then it is all today.
 */
export function leadUpDates(items: readonly string[], departIso: string, now: Date): string[] {
  const today = isoOf(now)
  const last = dayAt(departIso, -1) > today ? dayAt(departIso, -1) : today
  const lateStart = dayAt(last, -(LAST_DAY_COUNT - 1)) > today ? dayAt(last, -(LAST_DAY_COUNT - 1)) : today
  const earlyEnd = lateStart > today ? dayAt(lateStart, -1) : today
  const span = Math.round((parseLocalDate(earlyEnd)!.getTime() - parseLocalDate(today)!.getTime()) / 86_400_000)
  const early = items.filter((i) => !LAST_DAYS.test(i))
  const late = items.filter((i) => LAST_DAYS.test(i))
  const earlyDay = new Map<string, string>()
  early.forEach((item, i) => {
    const offset = early.length <= 1 ? 0 : Math.round((i * span) / (early.length - 1))
    earlyDay.set(item, dayAt(today, offset))
  })
  const lateDay = new Map<string, string>()
  late.forEach((item, i) => {
    // Alternate from the final day backwards so a long packing list does not all pile on one day.
    const back = lateStart === last ? 0 : i % LAST_DAY_COUNT
    lateDay.set(item, dayAt(last, -back))
  })
  return items.map((i) => earlyDay.get(i) ?? lateDay.get(i) ?? last)
}

// ---------------------------------------------------------------- the list and the tasks

function listName(place: string): string {
  return `To do before ${place}`
}

function ensureList(place: string, now: Date): { list: List; created: boolean } {
  const store = useTaskStore.getState()
  const name = listName(place)
  const same = store.lists.find((l) => normalizeName(l.name) === normalizeName(name))
  if (same) return { list: same, created: false }
  const list: List = {
    id: `list-trip-prep-${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name,
    color: "#6366f1",
    createdAt: now,
    order: store.lists.length,
    scheduleable: false,
    description: `Made by BIM from "have to do before leaving for ${place}".`,
  }
  store.addList(list)
  return { list, created: true }
}

/** Open tasks and items already in the vault that read like `item`. Flights, notes and finished things are skipped. */
function lookalikes(item: string, listId: string | null): Task[] {
  return useTaskStore
    .getState()
    .tasks.filter((t) => !t.completed && (t.type === "task" || t.type === "item"))
    .filter((t) => !(listId && t.lists?.includes(listId)))
    .filter((t) => {
      const name = t.title || t.description || ""
      const score = scoreName(item, name)
      return score === 1 || (score >= 0.8 && !hasUnmatchedContent(item, name))
    })
}

function findMatches(dated: Dated[], place: string): Match[] {
  const existing = useTaskStore.getState().lists.find((l) => normalizeName(l.name) === normalizeName(listName(place)))
  const out: Match[] = []
  const used = new Set<string>()
  for (const d of dated) {
    const hit = lookalikes(d.item, existing?.id ?? null).find((t) => !used.has(t.id))
    if (!hit) continue
    used.add(hit.id)
    out.push({ ...d, taskId: hit.id, taskName: hit.title || hit.description || d.item })
  }
  return out
}

function dayLabel(iso: string, now: Date): string {
  const d = parseLocalDate(iso)
  if (!d) return iso
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  })
}

function timelineText(dated: readonly Dated[], now: Date): string {
  return dated.map((d) => `• ${d.item} — ${dayLabel(d.iso, now)}`).join("\n")
}

/** Write the list and tasks. `merge` ids join the list (and the timeline) instead of getting a twin. */
function write(prep: TripPrep, departIso: string, dated: Dated[], merge: Match[], now: Date): TellReply {
  const mergeByItem = new Map(merge.map((m) => [m.item, m]))
  let made = 0
  let merged = 0
  const { list, created } = runAsAction("BIM: trip to-do list", () => {
    const made_ = ensureList(prep.place, now)
    const store = useTaskStore.getState()
    const deadline = toLocalCalendarDate(parseLocalDate(departIso)!)
    for (const d of dated) {
      const day = toLocalCalendarDate(parseLocalDate(d.iso)!)
      const hit = mergeByItem.get(d.item)
      // Saying the same list again re-dates the rows it already made instead of adding twins.
      const old =
        (hit ? store.tasks.find((t) => t.id === hit.taskId) : undefined) ??
        store.tasks.find((t) => t.lists?.includes(made_.list.id) && !t.completed && normalizeName(t.description) === normalizeName(d.item))
      if (old) {
        store.updateTask({
          ...old,
          lists: old.lists?.includes(made_.list.id) ? old.lists : [...(old.lists ?? []), made_.list.id],
          scheduledDate: day,
          deadline,
        })
        merged += 1
        continue
      }
      const task = createScheduledTodoTask({ description: d.item, period: "day", date: day })
      store.addTask({ ...task, lists: [made_.list.id], deadline, stage: "clarified" })
      made += 1
    }
    return made_
  })
  const bits = [
    made ? `${made} new to-do${made === 1 ? "" : "s"}` : "",
    merged ? `${merged} merged into tasks you already had` : "",
  ].filter(Boolean)
  return {
    text:
      `You leave for ${prep.place} on ${dayLabel(departIso, now)}. ${created ? "Made" : "Using"} the list "${list.name}" (Lists) with ${bits.join(" and ")}, ` +
      `dated on a lead-up to that day (To Do):\n${timelineText(dated, now)}`,
    status: "ok",
    summary: `Trip prep → ${list.name}`,
  }
}

function proceed(prep: TripPrep, departIso: string, now: Date): TellReply {
  const days = leadUpDates(prep.items, departIso, now)
  const dated = prep.items.map((item, i) => ({ item, iso: days[i]! }))
  const matches = findMatches(dated, prep.place)
  if (!matches.length) return write(prep, departIso, dated, [], now)
  pending = { kind: "merge", prep, departIso, dated, matches }
  const lines = matches.map((m) => `• "${m.item}" looks like your task "${m.taskName}"`).join("\n")
  return {
    text:
      `${matches.length === 1 ? "One of these looks" : "Some of these look"} like something you already have:\n${lines}\n\n` +
      `Merge ${matches.length === 1 ? "it" : "them"} into "${listName(prep.place)}" (yes), or add new ones next to ${matches.length === 1 ? "it" : "them"} (no)? Say skip to add nothing.`,
    status: "needs_clarify",
    summary: "Asked whether to merge",
  }
}

// ---------------------------------------------------------------- the entry point

/**
 * The trip-prep line, or the answer to the question it left open. Null leaves the line to the rest of the ladder.
 * Run it before the verb check: the line has a colon and several rows, which the ladder would read as a bulk add.
 */
export function applyTripPrep(text: string, now: Date): TellReply | null {
  const held = pending
  pending = null
  if (held) {
    if (isDecline(text) && !/^(?:no|nope|nah|n)$/i.test(text.trim())) {
      return { text: "Okay, I added nothing.", status: "ok", summary: "Trip prep dropped" }
    }
    if (held.kind === "date") {
      const day = parseDayAnswer(text, now, "future")
      if (day) {
        runAsAction("BIM: trip event", () => makeTripEvent(held.prep.place, day.iso, day.time))
        return proceed(held.prep, day.iso, now)
      }
      pending = null
    } else {
      const yes = /^(?:y|yes|yep|yeah|yup|sure|ok|okay|merge(?:\s+(?:them|it))?)\b/i.test(text.trim())
      const no = /^(?:n|no|nope|nah|separate|add(?:\s+new)?)\b/i.test(text.trim())
      if (yes || no) return write(held.prep, held.departIso, held.dated, yes ? held.matches : [], now)
    }
  }

  const prep = parseTripPrep(text)
  if (!prep) return null
  const day = findFlightDay(prep.place, now) ?? findEventDay(prep.place, now)
  if (day) return proceed(prep, day, now)
  pending = { kind: "date", prep }
  return {
    text: `I couldn't find a flight or an event for ${prep.place}. When do you leave? I'll make the event and plan the list around it.`,
    status: "needs_clarify",
    summary: "Asked the departure date",
  }
}
