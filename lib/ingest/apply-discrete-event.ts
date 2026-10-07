/**
 * lib/ingest/apply-discrete-event.ts — Tracker notes from text
 *
 * `log:` points are vertical instants. A parsed range is a block (start and
 * end). `intake:` is always a point. Switch and transit are point flags.
 * A line under the event is the note; the clock stays on the first line.
 * Whole-message trigger phrases (smoked weed, ate …) stay instants.
 * `logDiscreteNote` is the `n` / `note:` tick. `applyThoughtProcess` is the
 * `tp:` / `thought process:` / `log: tp:` tick: the same paint, with
 * `eventKind` `thought-process`. Points sit on a scope and open in the block
 * editor. A later block paint does not remove them.
 * `log: … loc: home` paints a Location-scope instant at that minute.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { recordCountForKeyword } from "@/lib/count-statuses"
import { formatLogKeywordList, isLogKeywordListQuery } from "@/lib/log-keywords"
import { savedLogKeywordPhrases } from "@/lib/log-keywords-store"
import { eventKindSlug, type IntakeClass, type TimeEntry } from "@/lib/time-entries"
import { PEN_PALETTE, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { minutesPastMidnight } from "./times"
import {
  parseIntakePayload,
  parseLogPayload,
  parseSwitchCommand,
  parseSwitchPayload,
  parseThoughtPayload,
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
/** Crystallized thought of this moment. A specialized note, not a general note. */
export const THOUGHT_PROCESS_KIND = "thought-process"

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
  const phrases = savedLogKeywordPhrases()
  if (isLogKeywordListQuery(payload)) {
    return {
      status: "ok",
      kind: "event-log",
      reply: formatLogKeywordList(phrases),
    }
  }
  const parsed = parseLogPayload(payload, now, phrases)
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
  tallySavedKeyword(parsed.title, parsed.at, phrases, parsed.clockCertainty)
  return {
    status: "ok",
    kind: "event-log",
    reply: `Logged: ${parsed.title} · ${clockLabel(parsed.at)}${placeSuffix(parsed.location)}`,
    summary: `Event → ${parsed.title}`,
    itemIds: loggedIds(id, placeId),
  }
}

/** A saved `log` / `log:` phrase increments a bound count. No binding is a no-op. */
function tallySavedKeyword(
  title: string,
  at: Date,
  phrases: readonly string[],
  clockCertainty?: NoteClockCertainty,
): void {
  const key = title.trim().toLowerCase()
  if (!key || !phrases.some((phrase) => phrase.trim().toLowerCase() === key)) return
  recordCountForKeyword(title, {
    date: formatLocalDateKey(at),
    startMin: minutesPastMidnight(at),
    clockCertainty: clockCertainty ?? "exact",
  })
}

/**
 * `tp:` / `thought process:` / `log: tp:`. Same Activity instant as a note,
 * pen Text log, with `eventKind` `thought-process`. The first line is the
 * title. Later lines are `notes`. A general note stays `note:`.
 */
export function applyThoughtProcess(payload: string, now = new Date()): ApplyResult {
  const parsed = parseThoughtPayload(payload, now)
  if (!parsed?.title.trim()) {
    return {
      status: "error",
      kind: "thought-process",
      reply: "Thought process what? Example: tp: opening the editor to fix the clock",
    }
  }
  const id = paintInstant(
    parsed.title,
    parsed.at,
    "thought-process",
    DEFAULT_PEN,
    parsed.note,
    ACTIVITY,
    {
      eventKind: THOUGHT_PROCESS_KIND,
      ...(parsed.clockCertainty ? { clockCertainty: parsed.clockCertainty } : {}),
    },
  )
  if (!id) {
    return { status: "error", kind: "thought-process", reply: "Could not save that thought process." }
  }
  return {
    status: "ok",
    kind: "thought-process",
    reply: `Thought: ${parsed.title} · ${clockLabel(parsed.at)}`,
    summary: `Thought → ${parsed.title}`,
    itemIds: [id],
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

/**
 * `switch:` — colon, then an optional scope word, then from/to.
 * Activity (omitted, or activity) is the `st:` instant: Switch pen, `started …`.
 * Any other real scope paints on that scope. `to` is the pen (found or created
 * with `addPen`). `from` is found or created the same way and stored; the
 * tick’s color is the destination. There is no Goal scope — `so:` stays
 * `applySwitchObjective`.
 */
export function applyScopeSwitch(payload: string, scopeLabel?: string, now = new Date()): ApplyResult {
  const parsed = parseSwitchCommand(payload, now)
  if (!parsed?.to.trim()) {
    return { status: "error", kind: "switch", reply: "Switch to what? Example: switch: to cleaning" }
  }
  const scope = findTrackingScope(scopeLabel?.trim() || parsed.scope)
  if (!scope) {
    const name = (scopeLabel?.trim() || parsed.scope || "that view").trim()
    return { status: "error", kind: "switch", reply: `No tracking view named "${name}".` }
  }
  if (scope.id === ACTIVITY) {
    const rebuilt = parsed.from ? `from: ${parsed.from} to: ${parsed.to}` : parsed.to
    const result = applySwitchTask(rebuilt, parsed.at)
    if (result.status !== "ok") return { ...result, kind: "switch" }
    const id = result.itemIds?.[0]
    if (id && parsed.clockCertainty) {
      useTimeTrackingStore.getState().updateEntry(id, { clockCertainty: parsed.clockCertainty })
    }
    return {
      ...result,
      kind: "switch",
      reply: `${scopeReply(scope.name, parsed)} · ${clockLabel(parsed.at)}`,
      summary: `Switch ${scope.name} → ${parsed.to}`,
    }
  }
  if (parsed.from) ensurePen(parsed.from, scope.id)
  const title = parsed.from ? `${parsed.from} → ${parsed.to}` : parsed.to
  const id = paintInstant(title, parsed.at, "switch", parsed.to, parsed.note, scope.id, {
    eventKind: "switch",
    ...(parsed.clockCertainty ? { clockCertainty: parsed.clockCertainty } : {}),
  })
  if (id) stampSwitchEnds(id, parsed)
  return {
    status: "ok",
    kind: "switch",
    reply: `${scopeReply(scope.name, parsed)} · ${clockLabel(parsed.at)}`,
    summary: `Switch ${scope.name} → ${parsed.to}`,
    itemIds: id ? [id] : undefined,
  }
}

/** Numbered tracking views for `log categories`. Not a logged event. */
export function applyLogCategories(): ApplyResult {
  const lines = useTimeTrackingStore.getState().scopes.map((scope, index) => {
    const depth = typeof scope.displayDepth === "number" ? ` — depth ${scope.displayDepth}` : ""
    return `${index + 1}. ${scope.name} — ${scope.id}${depth}`
  })
  return {
    status: "ok",
    kind: "log-categories",
    reply: lines.length ? `Tracking views\n${lines.join("\n")}` : "No tracking views.",
    summary: "Tracking views",
  }
}

/** A store scope by id or name. Empty and "activity" are the Activity view. */
export function findTrackingScope(label: string | undefined): { id: string; name: string } | null {
  const scopes = useTimeTrackingStore.getState().scopes
  const raw = (label ?? "").trim().toLowerCase()
  if (!raw || raw === "activity") {
    const activity =
      scopes.find((row) => row.id === ACTIVITY) ?? scopes.find((row) => row.name.trim().toLowerCase() === "activity")
    if (activity) return { id: activity.id, name: activity.name }
    return { id: ACTIVITY, name: "Activity" }
  }
  const hit = scopes.find((row) => row.id.toLowerCase() === raw || row.name.trim().toLowerCase() === raw)
  return hit ? { id: hit.id, name: hit.name } : null
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
  if (id && noun !== "transit") stampSwitchEnds(id, parsed)
  return {
    status: "ok",
    kind,
    reply: `${flagReply(noun)}: ${title} · ${clockLabel(parsed.at)}`,
    summary: `${flagReply(noun)} → ${title}`,
    itemIds: id ? [id] : undefined,
  }
}

function scopeReply(scopeName: string, parsed: SwitchNote): string {
  const arrow = parsed.from ? `${parsed.from} → ${parsed.to}` : parsed.to
  return `Switched ${scopeName}: ${arrow}`
}

function stampSwitchEnds(id: string, parsed: SwitchNote): void {
  const from = parsed.from?.trim()
  const to = parsed.to?.trim()
  const patch: Partial<Omit<TimeEntry, "id">> = {}
  if (from) patch.switchFrom = from
  if (to) patch.switchTo = to
  if (from || to) useTimeTrackingStore.getState().updateEntry(id, patch)
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
  const before = new Set(useTimeTrackingStore.getState().entries.map((entry) => entry.id))
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
        !before.has(e.id) &&
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
