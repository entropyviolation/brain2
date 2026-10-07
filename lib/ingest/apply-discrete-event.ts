/**
 * lib/ingest/apply-discrete-event.ts — Tracker notes from text
 *
 * `log:` points are vertical instants. A parsed range is a block (start and
 * end). `intake:` is always a point. Switch and transit are point flags.
 * A line under the event is the note; the clock stays on the first line.
 * Whole-message trigger phrases (smoked weed, ate …) stay instants.
 * `logDiscreteNote` is the `n` / `note:` tick. Points sit on a scope and
 * open in the block editor. A later block paint does not remove them.
 * `log: … loc: home` paints a Location-scope instant at that minute.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { eventKindSlug, type IntakeClass, type TimeEntry } from "@/lib/time-entries"
import { PEN_PALETTE, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { minutesPastMidnight } from "./times"
import {
  parseIntakePayload,
  parseLogPayload,
  parseSwitchPayload,
  type LogNote,
  type NoteClockCertainty,
  type SwitchNote,
} from "./parse-tracking-note"
import {
  DEFAULT_DISCRETE_EVENT_TRIGGERS,
  fromTextMessageNote,
  matchDiscreteEventTrigger,
  type DiscreteTriggerDef,
} from "./text-triggers"
import type { ApplyResult, IngestIntentKind } from "./types"

const ACTIVITY = "activity"
const LOCATION = "location"
const DEFAULT_PEN = "Text log"
const TEXT_LABEL = "from text pipeline"

interface OpenStart {
  at: string
  entryId: string
  note?: string
}

const openStarts = new Map<string, OpenStart>()

export function clearOpenLogStarts(): void {
  openStarts.clear()
}

function startKey(title: string): string {
  return title.trim().toLowerCase()
}

export function applyDiscreteLog(payload: string, now = new Date()): ApplyResult {
  const parsed = parseLogPayload(payload, now)
  if (!parsed) {
    return {
      status: "error",
      kind: "event-log",
      reply: "Log what? Example: log: drink water",
    }
  }
  if (parsed.shape === "start") return paintLogStart(parsed, now)
  if (parsed.shape === "end") return paintLogEnd(parsed, now)
  if (parsed.shape === "range") {
    const id = paintSpan(
    parsed.title,
    parsed.start,
    parsed.end,
    DEFAULT_PEN,
    "event-log",
    parsed.note,
    logMeta(parsed.title, parsed.clockCertainty),
  )
    const placeId = pairLocation(parsed, parsed.start)
    return {
      status: "ok",
      kind: "event-log",
      reply: `Logged: ${parsed.title} · ${clockLabel(parsed.start)}–${clockLabel(parsed.end)}${placeSuffix(parsed.location)}`,
      summary: `Event → ${parsed.title}`,
      itemIds: loggedIds(id, placeId),
    }
  }
  const id = paintInstant(
    parsed.title,
    parsed.at,
    "event-log",
    DEFAULT_PEN,
    parsed.note,
    ACTIVITY,
    logMeta(parsed.title, parsed.clockCertainty),
  )
  const placeId = pairLocation(parsed, parsed.at)
  return {
    status: "ok",
    kind: "event-log",
    reply: `Logged: ${parsed.title} · ${clockLabel(parsed.at)}${placeSuffix(parsed.location)}`,
    summary: `Event → ${parsed.title}`,
    itemIds: loggedIds(id, placeId),
  }
}

export function applyIntake(payload: string, now = new Date(), intakeClass?: IntakeClass): ApplyResult {
  const parsed = parseIntakePayload(payload, now)
  if (!parsed) {
    return { status: "error", kind: "intake", reply: "Intake what? Example: intake: coffee" }
  }
  const id = paintInstant(
    parsed.title,
    parsed.at,
    "intake",
    "Intake",
    parsed.note,
    ACTIVITY,
    intakeMeta(intakeClass, parsed.clockCertainty),
  )
  return {
    status: "ok",
    kind: "intake",
    reply: `Intake: ${parsed.title} · ${clockLabel(parsed.at)}`,
    summary: `Intake → ${parsed.title}`,
    itemIds: id ? [id] : undefined,
  }
}

export function applySwitchTask(payload: string, now = new Date()): ApplyResult {
  return applySwitchFlag(payload, now, "switch-task", "Switch", "task")
}

export function applySwitchObjective(payload: string, now = new Date()): ApplyResult {
  return applySwitchFlag(payload, now, "switch-objective", "Objective", "objective")
}

export function applyTransit(payload: string, now = new Date()): ApplyResult {
  return applySwitchFlag(payload, now, "transit", "Transit", "transit")
}

function applySwitchFlag(
  payload: string,
  now: Date,
  kind: IngestIntentKind,
  pen: string,
  noun: "task" | "objective" | "transit",
): ApplyResult {
  const parsed = parseSwitchPayload(payload, now)
  if (!parsed) {
    return { status: "error", kind, reply: `Say what you switched ${noun === "transit" ? "to" : noun}.` }
  }
  const title = flagTitle(parsed, noun)
  const id = paintInstant(
    title,
    parsed.at,
    kind,
    pen,
    parsed.note,
    ACTIVITY,
    parsed.clockCertainty ? { clockCertainty: parsed.clockCertainty } : undefined,
  )
  return {
    status: "ok",
    kind,
    reply: `${flagReply(noun)}: ${title} · ${clockLabel(parsed.at)}`,
    summary: `${flagReply(noun)} → ${title}`,
    itemIds: id ? [id] : undefined,
  }
}

function flagReply(noun: "task" | "objective" | "transit"): string {
  if (noun === "task") return "Switched task"
  if (noun === "objective") return "Switched objective"
  return "Transit"
}

function flagTitle(parsed: SwitchNote, noun: "task" | "objective" | "transit"): string {
  if (noun === "transit") {
    return parsed.from ? `left ${parsed.from} · arrived ${parsed.to}` : `to ${parsed.to}`
  }
  if (noun === "objective") {
    return parsed.from ? `left ${parsed.from} · objective ${parsed.to}` : `objective ${parsed.to}`
  }
  return parsed.from ? `stopped ${parsed.from} · started ${parsed.to}` : `started ${parsed.to}`
}

function paintLogStart(parsed: Extract<LogNote, { shape: "start" }>, now: Date): ApplyResult {
  const title = `START ${parsed.title}`
  const id = paintInstant(
    title,
    parsed.at,
    "event-log",
    DEFAULT_PEN,
    parsed.note,
    ACTIVITY,
    logMeta(parsed.title, parsed.clockCertainty),
  )
  if (id) openStarts.set(startKey(parsed.title), { at: parsed.at.toISOString(), entryId: id, note: parsed.note })
  const placeId = pairLocation(parsed, parsed.at)
  void now
  return {
    status: "ok",
    kind: "event-log",
    reply: `Started: ${parsed.title} · ${clockLabel(parsed.at)}${placeSuffix(parsed.location)}`,
    summary: `Start → ${parsed.title}`,
    itemIds: loggedIds(id, placeId),
  }
}

function paintLogEnd(parsed: Extract<LogNote, { shape: "end" }>, now: Date): ApplyResult {
  const open = openStarts.get(startKey(parsed.title))
  openStarts.delete(startKey(parsed.title))
  const carried = joinUserNotes(open?.note, parsed.note)
  const start = open ? new Date(open.at) : null
  if (!start || Number.isNaN(start.getTime())) {
    const id = paintInstant(
      `END ${parsed.title}`,
      parsed.at,
      "event-log",
      DEFAULT_PEN,
      carried,
      ACTIVITY,
      logMeta(parsed.title, parsed.clockCertainty),
    )
    const placeId = pairLocation(parsed, parsed.at)
    void now
    return {
      status: "ok",
      kind: "event-log",
      reply: `No open start for ${parsed.title}. Logged the end · ${clockLabel(parsed.at)}${placeSuffix(parsed.location)}`,
      summary: `End → ${parsed.title}`,
      itemIds: loggedIds(id, placeId),
    }
  }
  if (open?.entryId) useTimeTrackingStore.getState().removeEntry(open.entryId)
  const id = paintSpan(
    parsed.title,
    start,
    parsed.at,
    DEFAULT_PEN,
    "event-log",
    carried,
    logMeta(parsed.title, parsed.clockCertainty),
  )
  const placeId = pairLocation(parsed, start)
  return {
    status: "ok",
    kind: "event-log",
    reply: `Logged: ${parsed.title} · ${clockLabel(start)}–${clockLabel(parsed.at)}${placeSuffix(parsed.location)}`,
    summary: `Event → ${parsed.title}`,
    itemIds: loggedIds(id, placeId),
  }
}

function clockLabel(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const suffix = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`
}

export function applyDiscreteTriggerLine(
  raw: string,
  triggers: DiscreteTriggerDef[],
  now = new Date(),
): ApplyResult | null {
  const list = triggers.length > 0 ? triggers : DEFAULT_DISCRETE_EVENT_TRIGGERS
  const hit = matchDiscreteEventTrigger(raw, list)
  if (!hit) return null
  const intakeClass = intakeClassForTriggerPattern(hit.trigger.pattern)
  const id = paintInstant(
    hit.title,
    now,
    "event-trigger",
    DEFAULT_PEN,
    undefined,
    ACTIVITY,
    intakeClass ? intakeMeta(intakeClass) : undefined,
  )
  return {
    status: "ok",
    kind: "event-trigger",
    reply: `Logged: ${hit.title}`,
    summary: `Event → ${hit.title}`,
    itemIds: id ? [id] : undefined,
  }
}

/** A point-in-time note (`n` / `note:`) on a tracking scope. Not the day jot. */
export function logDiscreteNote(
  scopeId: string,
  title: string,
  when: Date,
  userNote?: string,
  clockCertainty?: NoteClockCertainty,
): string | undefined {
  const text = title.trim()
  if (!text) return undefined
  return paintInstant(
    text,
    when,
    "note",
    DEFAULT_PEN,
    userNote,
    scopeId,
    clockCertainty ? { clockCertainty } : undefined,
  )
}

/** Find or create a Location-scope pen. Same `addPen` the location view uses. */
export function ensureLocationPen(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ""
  const store = useTimeTrackingStore.getState()
  const scope = store.scopes.find((row) => row.id === LOCATION)
  if (!scope) return ""
  const existing = scope.pens.find((pen) => pen.name.trim().toLowerCase() === trimmed.toLowerCase())
  if (existing) return existing.id
  return store.addPen(LOCATION, {
    name: trimmed,
    color: PEN_PALETTE[scope.pens.length % PEN_PALETTE.length] ?? PEN_PALETTE[0],
  })
}

function pairLocation(parsed: { location?: string; clockCertainty?: NoteClockCertainty }, when: Date): string | undefined {
  const name = parsed.location?.trim()
  if (!name) return undefined
  const penId = ensureLocationPen(name)
  if (!penId) return undefined
  return paintPairedLocationInstant(when, penId, parsed.clockCertainty)
}

function placeSuffix(location?: string): string {
  const name = location?.trim()
  return name ? ` · ${name}` : ""
}

function loggedIds(eventId: string | undefined, placeId: string | undefined): string[] | undefined {
  const ids = [eventId, placeId].filter((id): id is string => Boolean(id))
  return ids.length ? ids : undefined
}

/** Location attached to one log: a Location-scope instant at that minute. */
function paintPairedLocationInstant(
  when: Date,
  penId: string,
  clockCertainty?: NoteClockCertainty,
): string | undefined {
  const date = formatLocalDateKey(when)
  const minute = minutesPastMidnight(when)
  const precision = clockCertainty === "estimated" ? "estimated" : undefined
  const before = new Set(useTimeTrackingStore.getState().entries.map((entry) => entry.id))
  useTimeTrackingStore.getState().paintMinutes(date, LOCATION, minute, minute, penId, undefined, undefined, precision, {
    kind: "instant",
    ...(clockCertainty ? { clockCertainty } : {}),
  })
  const created = useTimeTrackingStore
    .getState()
    .entries.find((entry) => !before.has(entry.id) && entry.kind === "instant" && entry.scopeId === LOCATION && entry.date === date)
  if (!created) return undefined
  useTimeTrackingStore.getState().updateEntry(created.id, {
    generatedBy: { kind: "text", id: date },
    ...(clockCertainty ? { clockCertainty } : {}),
  })
  return created.id
}

function eventNotes(userNote: string | undefined, when: Date): string {
  const stamp = fromTextMessageNote(when, TEXT_LABEL)
  const extra = userNote?.trim()
  if (!extra) return stamp
  return `${extra}\n${stamp}`
}

function joinUserNotes(...parts: (string | undefined)[]): string | undefined {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const part of parts) {
    const text = part?.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    lines.push(text)
  }
  return lines.length ? lines.join("\n") : undefined
}

interface EntryMeta {
  eventKind?: string
  intakeClass?: IntakeClass
  clockCertainty?: NoteClockCertainty
}

function logMeta(phrase: string, clockCertainty?: NoteClockCertainty): EntryMeta {
  const eventKind = eventKindSlug(phrase)
  return {
    ...(eventKind ? { eventKind } : {}),
    ...(clockCertainty ? { clockCertainty } : {}),
  }
}

function intakeMeta(intakeClass: IntakeClass | undefined, clockCertainty?: NoteClockCertainty): EntryMeta {
  return {
    eventKind: intakeClass ? `intake.${intakeClass}` : "intake",
    ...(intakeClass ? { intakeClass } : {}),
    ...(clockCertainty ? { clockCertainty } : {}),
  }
}

/** `ate` / `drank` / `took` keep today's pen. The class is only set when that word already matched. */
function intakeClassForTriggerPattern(pattern: string): IntakeClass | undefined {
  const head = pattern.trim().toLowerCase().split(/\s+/)[0] ?? ""
  if (head === "ate") return "food"
  if (head === "drank") return "drink"
  if (head === "took") return "drug"
  return undefined
}

function paintInstant(
  title: string,
  when: Date,
  _kind: IngestIntentKind,
  penName: string,
  userNote?: string,
  scopeId = ACTIVITY,
  meta?: EntryMeta,
): string | undefined {
  const penId = ensurePen(penName, scopeId)
  const date = formatLocalDateKey(when)
  const minute = minutesPastMidnight(when)
  return paintEntry(date, minute, minute, penId, title, eventNotes(userNote, when), "instant", undefined, scopeId, meta)
}

function paintSpan(
  title: string,
  start: Date,
  end: Date,
  penName: string,
  _kind: IngestIntentKind,
  userNote?: string,
  meta?: EntryMeta,
): string | undefined {
  const penId = ensurePen(penName)
  const date = formatLocalDateKey(start)
  const endKey = formatLocalDateKey(end)
  const startMin = minutesPastMidnight(start)
  let endMin = minutesPastMidnight(end)
  let endDate: string | undefined
  if (endKey !== date) {
    const next = formatLocalDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1))
    if (endKey === next && endMin === 0) endMin = 1440
    else if (!(endKey === next && endMin < startMin)) endDate = endKey
  }
  return paintEntry(date, startMin, endMin, penId, title, eventNotes(userNote, start), undefined, endDate, ACTIVITY, meta)
}

function paintEntry(
  date: string,
  startMin: number,
  endMin: number,
  penId: string,
  title: string,
  notes: string,
  kind: TimeEntry["kind"],
  endDate?: string,
  scopeId = ACTIVITY,
  meta?: EntryMeta,
): string | undefined {
  const precision = meta?.clockCertainty === "estimated" ? "estimated" : undefined
  useTimeTrackingStore.getState().paintMinutes(date, scopeId, startMin, endMin, penId, undefined, undefined, precision, {
    kind,
    title,
    notes,
    endDate,
    eventKind: meta?.eventKind,
    intakeClass: meta?.intakeClass,
    clockCertainty: meta?.clockCertainty,
  })
  const wantInstant = kind === "instant"
  const just = useTimeTrackingStore
    .getState()
    .entries.filter(
      (e) =>
        e.date === date &&
        e.scopeId === scopeId &&
        e.penId === penId &&
        e.startMin === startMin &&
        e.title === title &&
        (wantInstant ? e.kind === "instant" : e.kind !== "instant"),
    )
    .sort((a, b) => b.id.localeCompare(a.id))[0]
  if (!just) return undefined
  useTimeTrackingStore.getState().updateEntry(just.id, {
    notes,
    generatedBy: { kind: "text", id: date },
    ...(meta?.eventKind ? { eventKind: meta.eventKind } : {}),
    ...(meta?.intakeClass ? { intakeClass: meta.intakeClass } : {}),
    ...(meta?.clockCertainty ? { clockCertainty: meta.clockCertainty } : {}),
    ...(meta?.clockCertainty === "estimated" ? { precision: "estimated" as const } : {}),
  })
  return just.id
}

function ensurePen(name: string, scopeId = ACTIVITY): string {
  const store = useTimeTrackingStore.getState()
  const scope = store.scopes.find((s) => s.id === scopeId) ?? store.scopes.find((s) => s.id === ACTIVITY) ?? store.scopes[0]
  if (!scope) {
    store.addScope("Activity")
    const created = useTimeTrackingStore.getState().scopes.find((s) => s.id === ACTIVITY) ?? useTimeTrackingStore.getState().scopes[0]
    if (!created) throw new Error("No tracking scope")
    return store.addPen(created.id, { name, color: PEN_PALETTE[0] })
  }
  const existing = scope.pens.find((p) => p.name.trim().toLowerCase() === name.toLowerCase())
  if (existing) return existing.id
  return store.addPen(scope.id, {
    name,
    color: PEN_PALETTE[scope.pens.length % PEN_PALETTE.length],
  })
}
