/**
 * lib/flight-bimby/file.ts — Write flights to the vault: a Flight item and its calendar event
 *
 * Three tools, each usable alone:
 * - `addFlightFromInfo(text | draft)`: read, fill blanks, then `fileFlightDraft` each leg.
 * - `fileFlightDraft(draft)`: one Flight item (deterministic id, so a second paste of the same
 *   booking updates the first instead of doubling it) plus its event.
 * - `createEventFromFlight(taskId)`: the calendar event for a Flight item that already exists.
 * It only adds. An existing item keeps every field it has; only blanks are filled in.
 */
import { runAsAction } from "@/lib/action-history"
import { taskRepository } from "@/lib/data/task-repository"
import { toLocalCalendarDate } from "@/lib/date-utils"
import { useEventStore } from "@/lib/event-store"
import { FLIGHT_ATTR, FLIGHT_TYPE_ID } from "@/lib/flight-types"
import { useTaskStore } from "@/lib/task-store"
import type { CalendarEvent, List, Task } from "@/lib/types"
import { airportInfo, utcToWall, wallToUtc } from "./airports"
import { extractFlights } from "./extract"
import { fillBlanks } from "./lookup"
import type { FiledFlight, FlightDraft } from "./types"

export const FLIGHT_EVENT_COLOR = "#0ea5e9"

// ── names and ids ──────────────────────────────────────────────────────────

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")

export function flightTaskId(d: FlightDraft): string {
  const who = slug(d.confirmation || d.flightNumber || "flight")
  return `flight-${who}-${d.departDate ?? "undated"}-${(d.from ?? "x").toLowerCase()}${(d.to ?? "x").toLowerCase()}`
}

export const flightEventId = (taskId: string) => `flight-event-${taskId}`

/** "11:48 AM" from "11:48". */
export function clock12(hhmm?: string): string {
  const m = hhmm?.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return ""
  const h = Number(m[1])
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`
}

function dayLabel(iso?: string): string {
  if (!iso) return ""
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

const hm = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`

/** True gate-to-gate minutes when both zones are known, else the printed length, else null. */
export function flightMinutes(d: FlightDraft): number | null {
  const a = airportInfo(d.from)
  const b = airportInfo(d.to)
  if (a && b && d.departDate && d.departTime && d.arriveDate && d.arriveTime) {
    const mins = Math.round((wallToUtc(d.arriveDate, d.arriveTime, b.tz) - wallToUtc(d.departDate, d.departTime, a.tz)) / 60_000)
    if (mins > 0 && mins < 36 * 60) return mins
  }
  return d.durationMinutes ?? null
}

export function flightTitle(d: FlightDraft): string {
  const route = [d.from, d.to].filter(Boolean).join(" → ")
  return [d.airline, d.flightNumber, route].filter(Boolean).join(" ") || "Flight"
}

// ── the Flight item ────────────────────────────────────────────────────────

/** The list flights go to: one that takes the Flight type, else one named for flights, else a new "Upcoming flights". */
export function flightList(lists: readonly List[], make: (list: List) => void, now: Date): List {
  const typed = lists.find((l) => l.itemTypeId === FLIGHT_TYPE_ID)
  if (typed) return typed
  const named = lists.find((l) => /flight/i.test(l.name))
  if (named) return named
  const list: List = {
    id: `list-upcoming-flights-${now.getTime().toString(36)}`,
    name: "Upcoming flights",
    color: "#14b8a6",
    createdAt: now,
    order: lists.length,
    scheduleable: false,
    itemTypeId: FLIGHT_TYPE_ID,
  }
  make(list)
  return list
}

function bodyHtml(d: FlightDraft): string {
  const lines = [
    d.fromCity && d.toCity ? `${d.fromCity} → ${d.toCity}` : "",
    d.confirmation ? `Confirmation: ${d.confirmation}` : "",
    [d.airline, d.flightNumber].filter(Boolean).join(" "),
    d.departTime ? `Departs ${d.from ?? ""} ${clock12(d.departTime)} (local)`.replace("  ", " ") : "",
    d.arriveTime ? `Arrives ${d.to ?? ""} ${clock12(d.arriveTime)} (local)${d.arriveDate && d.arriveDate !== d.departDate ? `, ${dayLabel(d.arriveDate)}` : ""}`.replace("  ", " ") : "",
    flightMinutes(d) ? `Flight time ${hm(flightMinutes(d)!)}${d.miles ? ` · ${d.miles.toLocaleString("en-US")} miles` : ""}` : "",
    ...d.notes,
    d.missing.length ? `Not on the confirmation: ${d.missing.join(", ")}. Add it here when you have it.` : "",
  ].filter(Boolean)
  return `<p>${lines.join("<br>")}</p>`
}

export function flightAttributes(d: FlightDraft): Task["attributes"] {
  const stamp = (date?: string, time?: string) => (date ? (time ? `${date}T${time}` : date) : undefined)
  const dep = stamp(d.departDate, d.departTime)
  const arr = d.arriveTime ? stamp(d.arriveDate ?? d.departDate, d.arriveTime) : undefined
  const attrs: Task["attributes"] = {
    [FLIGHT_ATTR.booked]: true,
    ...(d.airline ? { [FLIGHT_ATTR.airline]: d.airline } : {}),
    ...(d.flightNumber ? { [FLIGHT_ATTR.flightNumber]: d.flightNumber } : {}),
    ...(d.from ? { [FLIGHT_ATTR.departureAirport]: d.from } : {}),
    ...(d.to ? { [FLIGHT_ATTR.arrivalAirport]: d.to } : {}),
    ...(dep ? { [FLIGHT_ATTR.departureTime]: dep } : {}),
    ...(arr ? { [FLIGHT_ATTR.arrivalTime]: arr } : {}),
    ...(d.confirmation ? { [FLIGHT_ATTR.bookingNumber]: d.confirmation } : {}),
    ...(d.cost !== undefined ? { [FLIGHT_ATTR.cost]: d.cost } : {}),
  }
  return attrs
}

export function buildFlightItem(d: FlightDraft, listId: string, now: Date): Task {
  const title = flightTitle(d)
  return {
    id: flightTaskId(d),
    description: title,
    title,
    type: FLIGHT_TYPE_ID,
    lists: [listId],
    stage: "clarified",
    estimatedDuration: 0,
    cognitiveLoad: 1,
    urgency: 3,
    importance: 3,
    dependencies: [],
    context: "@anywhere",
    entropy: 0.2,
    rewardValue: 0,
    completed: false,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    createdAt: now,
    ...(d.departDate ? { scheduledDate: new Date(`${d.departDate}T00:00:00`) } : {}),
    body: bodyHtml(d),
    attributes: flightAttributes(d),
  } as Task
}

/** An item already in the vault for this booking: the same id, or the same code and departure day. */
export function findFlightItem(d: FlightDraft, tasks: readonly Task[]): Task | undefined {
  const id = flightTaskId(d)
  return tasks.find((t) => {
    if (t.id === id) return true
    if (t.type !== FLIGHT_TYPE_ID) return false
    const a = t.attributes ?? {}
    const day = String(a[FLIGHT_ATTR.departureTime] ?? "").slice(0, 10)
    if (day !== d.departDate) return false
    const sameCode = d.confirmation && String(a[FLIGHT_ATTR.bookingNumber] ?? "").toUpperCase() === d.confirmation
    const sameNumber = d.flightNumber && String(a[FLIGHT_ATTR.flightNumber] ?? "").replace(/\s/g, "").toUpperCase() === d.flightNumber
    const sameRoute = String(a[FLIGHT_ATTR.departureAirport] ?? "") === d.from && String(a[FLIGHT_ATTR.arrivalAirport] ?? "") === d.to
    return Boolean((sameCode && sameRoute) || (sameNumber && sameRoute) || (sameCode && sameNumber))
  })
}

// ── the calendar event ─────────────────────────────────────────────────────

/**
 * One block on the calendar, on the departure airport's clock, as long as the flight really is.
 * (A confirmation prints each time in its own airport's zone, so 11:48 AM → 8:13 PM across the
 * country is five hours, not eight.) The landing clock goes in the description.
 */
export function buildFlightEvent(d: FlightDraft, taskId: string): CalendarEvent | null {
  if (!d.departDate || !d.departTime) return null
  const mins = flightMinutes(d)
  const a = airportInfo(d.from)
  let endDate = d.departDate
  let endTime = d.arriveTime ?? d.departTime
  if (mins && a) {
    const wall = utcToWall(wallToUtc(d.departDate, d.departTime, a.tz) + mins * 60_000, a.tz)
    endDate = wall.date
    endTime = wall.time
  } else if (d.arriveDate && d.arriveTime) {
    endDate = d.arriveDate
    endTime = d.arriveTime
  }
  const landing = d.arriveTime ? `Lands ${d.to ?? ""} ${clock12(d.arriveTime)} local${d.arriveDate && d.arriveDate !== d.departDate ? `, ${dayLabel(d.arriveDate)}` : ""}`.replace("  ", " ") : ""
  const description = [
    [d.airline, d.flightNumber].filter(Boolean).join(" "),
    d.confirmation ? `Confirmation ${d.confirmation}` : "",
    landing,
    mins ? `Flight time ${hm(mins)}` : "",
    d.missing.length ? `Not on the confirmation: ${d.missing.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
  return {
    id: flightEventId(taskId),
    title: flightTitle(d),
    startTime: d.departTime,
    endTime,
    date: toLocalCalendarDate(d.departDate),
    ...(endDate !== d.departDate ? { endDate: toLocalCalendarDate(endDate) } : {}),
    type: "event",
    color: FLIGHT_EVENT_COLOR,
    isScheduled: true,
    isAllDay: false,
    location: [d.fromCity, d.from && `(${d.from})`].filter(Boolean).join(" ") || d.from || "",
    description,
  }
}

/** Put the event on the calendar. Rewrites only an event this tool made (its id); never a person's own. */
function upsertEvent(event: CalendarEvent): "created" | "updated" | "existing" {
  const store = useEventStore.getState()
  const have = store.events.find((e) => e.id === event.id)
  if (!have) {
    store.addEvent(event)
    return "created"
  }
  const same =
    have.title === event.title && have.startTime === event.startTime && have.endTime === event.endTime &&
    (have.description ?? "") === (event.description ?? "") && toLocalCalendarDate(have.date).getTime() === event.date.getTime()
  if (same) return "existing"
  store.updateEvent(event)
  return "updated"
}

/** The draft an existing Flight item stands for (attributes back to fields). */
export function draftFromItem(task: Task): FlightDraft {
  const a = task.attributes ?? {}
  const str = (k: string) => (a[k] === undefined || a[k] === null || a[k] === "" ? undefined : String(a[k]))
  const dep = str(FLIGHT_ATTR.departureTime)
  const arr = str(FLIGHT_ATTR.arrivalTime)
  const from = str(FLIGHT_ATTR.departureAirport)
  const to = str(FLIGHT_ATTR.arrivalAirport)
  const draft: FlightDraft = {
    airline: str(FLIGHT_ATTR.airline),
    flightNumber: str(FLIGHT_ATTR.flightNumber)?.replace(/\s/g, "").toUpperCase(),
    from,
    to,
    fromCity: airportInfo(from)?.city,
    toCity: airportInfo(to)?.city,
    departDate: dep?.slice(0, 10),
    departTime: dep?.match(/T(\d{2}:\d{2})/)?.[1],
    arriveDate: arr?.slice(0, 10),
    arriveTime: arr?.match(/T(\d{2}:\d{2})/)?.[1],
    confirmation: str(FLIGHT_ATTR.bookingNumber),
    notes: [],
    missing: [],
  }
  return draft
}

/** Tool: the calendar event for a Flight item that already exists. Null when it has no departure clock yet. */
export function createEventFromFlight(taskId: string): { eventId: string; status: "created" | "updated" | "existing" } | null {
  const task = taskRepository.getById(taskId)
  if (!task || task.type !== FLIGHT_TYPE_ID) return null
  const event = buildFlightEvent(draftFromItem(task), task.id)
  if (!event) return null
  return { eventId: event.id, status: upsertEvent(event) }
}

// ── filing ─────────────────────────────────────────────────────────────────

/** Fill only what the existing item lacks. A value a person typed is never replaced. */
function mergeBlanks(task: Task, d: FlightDraft): { next: Task; changed: boolean } {
  const have = task.attributes ?? {}
  const add: Task["attributes"] = {}
  for (const [k, v] of Object.entries(flightAttributes(d) ?? {})) {
    if (have[k] === undefined || have[k] === null || have[k] === "") add[k] = v
  }
  // A flight marked "to book" is booked now that a confirmation arrived.
  if (have[FLIGHT_ATTR.booked] !== true) add[FLIGHT_ATTR.booked] = true
  const changed = Object.keys(add).length > 0
  return { next: changed ? { ...task, attributes: { ...have, ...add }, body: task.body || bodyHtml(d) } : task, changed }
}

function replyLine(d: FlightDraft, status: FiledFlight["status"], event: FiledFlight["eventStatus"]): string {
  const when = [dayLabel(d.departDate), d.departTime ? `${clock12(d.departTime)}${d.arriveTime ? ` → ${clock12(d.arriveTime)}` : ""}` : ""].filter(Boolean).join(", ")
  const verb = status === "created" ? "Filed" : status === "updated" ? "Filled in" : "Already had"
  const cal = event === "created" ? " On the calendar." : event === "updated" ? " Calendar event updated." : event === "skipped" ? " No calendar event yet (no departure time)." : ""
  const gaps = d.missing.length ? ` Still missing: ${d.missing.join(", ")}.` : ""
  return `${verb} ${flightTitle(d)}${d.confirmation ? ` (${d.confirmation})` : ""}${when ? ` · ${when}` : ""}.${cal}${gaps}`
}

/** Tool: file one flight leg. Sync, so a store can call it; the blanks should be filled already. */
export function fileFlightDraft(draft: FlightDraft, now = new Date()): FiledFlight {
  return runAsAction("flight bimby", () => {
    const state = useTaskStore.getState()
    const found = findFlightItem(draft, state.tasks)
    let taskId: string
    let status: FiledFlight["status"]
    if (found) {
      const { next, changed } = mergeBlanks(found, draft)
      if (changed) taskRepository.update(next)
      taskId = found.id
      status = changed ? "updated" : "existing"
    } else {
      const list = flightList(state.lists, (l) => state.addList(l), now)
      const task = buildFlightItem(draft, list.id, now)
      taskRepository.add(task)
      taskId = task.id
      status = "created"
    }
    const event = buildFlightEvent(draftFromMerged(found, draft), taskId)
    const eventStatus: FiledFlight["eventStatus"] = event ? upsertEvent(event) : "skipped"
    return { draft, taskId, eventId: event?.id, status, eventStatus, line: replyLine(draft, status, eventStatus) }
  })
}

/** When an item already existed, its own values win over the paste for the event too. */
function draftFromMerged(found: Task | undefined, d: FlightDraft): FlightDraft {
  if (!found) return d
  const mine = draftFromItem(found)
  return {
    ...d,
    ...Object.fromEntries(Object.entries(mine).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))),
    notes: d.notes,
    missing: d.missing,
  }
}

export interface AddFlightsResult {
  filed: FiledFlight[]
  /** Chatter after the last flight fact, for the normal ingest. */
  leftover: string
  /** The reply, one line per flight. */
  text: string
}

/**
 * Tool: add every flight in a paste (or an already-read draft). Reads, fills blanks from local tables
 * and, with a key, the live schedule, files each leg and puts it on the calendar.
 */
export async function addFlightFromInfo(
  input: string | FlightDraft | FlightDraft[],
  opts: { now?: Date; live?: boolean } = {},
): Promise<AddFlightsResult> {
  const now = opts.now ?? new Date()
  let drafts: FlightDraft[]
  let leftover = ""
  if (typeof input === "string") {
    const read = extractFlights(input, now)
    drafts = read.flights
    leftover = read.leftover
  } else {
    drafts = Array.isArray(input) ? input : [input]
  }
  const filled: FiledFlight[] = []
  for (const draft of drafts) {
    const full = await fillBlanks(draft, { live: opts.live })
    // Nothing to place without a day and a route: say so rather than file a husk.
    if (!full.departDate || !full.from || !full.to) continue
    filled.push(fileFlightDraft(full, now))
  }
  return { filed: filled, leftover, text: filled.map((f) => f.line).join("\n") }
}
