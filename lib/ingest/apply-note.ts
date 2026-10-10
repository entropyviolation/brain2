/**
 * lib/ingest/apply-note.ts — Tracker notes from a text phrase
 *
 * A moment note (`n` / `note:` / `jot:` / `memo:`) is a discrete event at send
 * time, or at a clock on that line. If a block covers that minute, the text
 * is also appended there. `est` / `estimated` / `~` and `unknown` set
 * `clockCertainty` the same way a log line does. `n loc:` / `n mood:` use
 * those scopes. `day:` / `n day:` add a paragraph to that day's summary and
 * do not become a tick.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { appendDayNote, getDayNote } from "@/lib/day-notes-persist"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { logDiscreteNote } from "./apply-discrete-event"
import { parseIntakePayload, splitEventLine } from "./parse-tracking-note"
import { minutesPastMidnight } from "./times"
import type { ApplyResult } from "./types"

type NoteTarget = "activity" | "location" | "mood" | "day"

export function applyNote(payload: string, now = new Date()): ApplyResult {
  const peeled = peelNotePayload(payload)
  if (!peeled.text) {
    return {
      status: "error",
      kind: "note",
      reply: "Note what? Example: n stuck in aisle 4  ·  day: tired  ·  n loc: crowded",
    }
  }

  if (peeled.target === "day") {
    const date = formatLocalDateKey(now)
    const entry = appendDayNote(date, peeled.text, now)
    if (!entry) return { status: "error", kind: "note", reply: "Could not save that day summary." }
    useTimeTrackingStore.getState().setDayNotes(date, getDayNote(date))
    return {
      status: "ok",
      kind: "note",
      reply: `Day summary (${date}): ${peeled.text}`,
      summary: "Day summary",
    }
  }

  const parsed = parseIntakePayload(peeled.text, now)
  const split = splitEventLine(peeled.text)
  const title = parsed?.title || split.line
  const when = parsed?.at ?? now
  const userNote = parsed?.note ?? split.note
  const date = formatLocalDateKey(when)
  const nowMin = minutesPastMidnight(when)
  const store = useTimeTrackingStore.getState()
  const covering = coveringEntry(store.entries, date, peeled.target, nowMin)
  const instantId = logDiscreteNote(peeled.target, title, when, userNote, parsed?.clockCertainty)
  if (covering) {
    const next = covering.notes ? `${covering.notes}\n${peeled.text}` : peeled.text
    store.updateEntry(covering.id, { notes: next })
    const pen = store.scopes
      .find((s) => s.id === covering.scopeId)
      ?.pens.find((p) => p.id === covering.penId)
    const label = pen?.name ?? peeled.target
    return {
      status: "ok",
      kind: "note",
      reply: `Noted on ${label}: ${peeled.text}`,
      summary: `Note → ${label}`,
      itemIds: instantId ? [covering.id, instantId] : [covering.id],
    }
  }

  if (!instantId) {
    appendDayNote(date, `[${peeled.target}] ${peeled.text}`, now)
    useTimeTrackingStore.getState().setDayNotes(date, getDayNote(date))
    return {
      status: "ok",
      kind: "note",
      reply: `No live ${peeled.target} block — saved on the day summary.`,
      summary: `Note → day (${peeled.target})`,
    }
  }

  return {
    status: "ok",
    kind: "note",
    reply: `Logged: ${title}`,
    summary: `Note → ${peeled.target}`,
    itemIds: [instantId],
  }
}

function peelNotePayload(payload: string): { target: NoteTarget; text: string } {
  const text = payload.trim()
  const lower = text.toLowerCase()
  const match = lower.match(/^(day(?:\s*note)?|dnote|loc(?:ation)?|at|mood|feel(?:ing)?|act(?:ivity)?|doing)[:\s]+/)
  if (!match) return { target: "activity", text }
  const rest = text.slice(match[0].length).trim()
  const key = match[1].replace(/\s+/g, "")
  if (key === "day" || key === "daynote" || key === "dnote") return { target: "day", text: rest }
  if (key === "loc" || key === "location" || key === "at") return { target: "location", text: rest }
  if (key === "mood" || key === "feel" || key === "feeling") return { target: "mood", text: rest }
  return { target: "activity", text: rest }
}

function coveringEntry(
  entries: { id: string; date: string; scopeId: string; startMin: number; endMin: number; notes?: string; penId: string; kind?: string }[],
  date: string,
  scopeId: string,
  nowMin: number,
) {
  const hits = entries.filter(
    (entry) =>
      entry.date === date &&
      entry.scopeId === scopeId &&
      entry.kind !== "instant" &&
      entry.startMin <= nowMin &&
      nowMin < entry.endMin,
  )
  return hits.sort((a, b) => b.startMin - a.startMin)[0] ?? null
}
