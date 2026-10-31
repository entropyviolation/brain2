/**
 * lib/bim-flow/accept.ts — Write one accepted suggestion through the app's own paths
 *
 * Each accept is one undo step (`runAsAction`). An item goes through Quick Add capture onto the list the
 * flow picked, a habit goes through the same writer BIM's `habit:` command uses.
 *
 * A time block lands on Activity, stamped `generatedBy: { kind: "llm" }` (`acceptedBlockStamp`). Unlike
 * every other block it may overlap another LLM block: both stay, and the person sets the true bounds in
 * Tracking (moving one edge trims the other, as any move does). Time the person painted still refuses.
 * An LLM block of the same activity that overlaps is merged with it: one block over both spans, its
 * notes listing every detection ("Detected 2 times by LLM: …"). The notes always say it was
 * autodetected and carry the flow's reasons, its evidence lines, and the person's note.
 */
"use client"

import { runAsAction } from "@/lib/action-history"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { ensureActivityPen } from "@/lib/ingest/apply-activity-span"
import { applyCapture } from "@/lib/ingest/apply-capture"
import { writeHabit } from "@/lib/ingest/apply-habit"
import type { TimeEntry } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Detection, Suggestion } from "./suggestions"

export interface Accepted {
  ok: boolean
  message: string
}

const MINUTES_PER_DAY = 1440
const ACTIVITY = "activity"

/** `generatedBy` on a block painted by Accept. */
export function acceptedBlockStamp(suggestionId: string): { kind: "llm"; id: string } {
  return { kind: "llm", id: `bim-suggest:${suggestionId}` }
}

export const isLlmBlock = (e: Pick<TimeEntry, "generatedBy">) => e.generatedBy?.kind === "llm"

/** Calendar-day pieces of [start, end): a block over midnight is stored as one entry per day. */
export function dayPieces(startIso: string, endIso: string): { date: string; startMin: number; endMin: number }[] {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const out: { date: string; startMin: number; endMin: number }[] = []
  for (let day = new Date(start.getFullYear(), start.getMonth(), start.getDate()); day < end; day.setDate(day.getDate() + 1)) {
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    const a = Math.max(start.getTime(), day.getTime())
    const b = Math.min(end.getTime(), next.getTime())
    const startMin = Math.round((a - day.getTime()) / 60_000)
    const endMin = b >= next.getTime() ? MINUTES_PER_DAY : Math.round((b - day.getTime()) / 60_000)
    if (endMin > startMin) out.push({ date: formatLocalDateKey(day), startMin, endMin })
  }
  return out
}

const HEADER = "Autodetected by the BIM LLM flow."
const pad = (n: number) => String(n).padStart(2, "0")
const stampOf = (iso: string) => {
  const d = new Date(iso)
  return `${formatLocalDateKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** One detection as a notes item: when, from what, why, then its evidence lines. */
export function detectionText(d: Detection): string {
  return [`${stampOf(d.start)}–${stampOf(d.end).slice(11)} from ${d.source}: ${d.why}`, ...d.evidence.map((e) => `   > ${e}`)].join("\n")
}

/** The detections already in a block's notes. Notes without the header (older or hand-written) are one item. */
export function notesItems(notes: string | undefined): string[] {
  const text = (notes ?? "").trim()
  if (!text) return []
  const m = text.match(/Detected \d+ times? by LLM:\n([\s\S]*)$/)
  if (!m) return [text.replace(HEADER, "").trim()].filter(Boolean)
  return m[1]!.split(/\n(?=\d+\) )/).map((x) => x.replace(/^\d+\) /, "").trimEnd()).filter(Boolean)
}

export function renderNotes(items: string[]): string {
  const n = items.length
  return [`${HEADER}`, `Detected ${n} time${n === 1 ? "" : "s"} by LLM:`, ...items.map((t, i) => `${i + 1}) ${t}`)].join("\n")
}

function detectionsOf(s: Suggestion): Detection[] {
  return s.detections?.length ? s.detections : [{ start: s.at, end: s.end ?? s.at, source: s.source, why: s.why, evidence: s.evidence }]
}

const overlaps = (e: TimeEntry, p: { date: string; startMin: number; endMin: number }) =>
  e.scopeId === ACTIVITY && e.kind !== "instant" && e.date === p.date && e.startMin < p.endMin && e.endMin > p.startMin

function acceptTimeblock(s: Suggestion, note: string): Accepted {
  if (!s.end) return { ok: false, message: "NO END TIME" }
  const pieces = dayPieces(s.at, s.end)
  const before = useTimeTrackingStore.getState().entries
  // Someone may have painted this time since the suggestion was made. Only LLM blocks may overlap.
  if (pieces.some((p) => before.some((e) => overlaps(e, p) && !isLlmBlock(e)))) return { ok: false, message: "TIME NOW HAS AN ACTIVITY YOU PAINTED. RUN AGAIN." }
  const fresh = detectionsOf(s).map(detectionText)
  if (note.trim()) fresh[fresh.length - 1] += `\n   Note: ${note.trim()}`
  let merged = 0
  let overlapping = 0
  runAsAction(`Accept suggested block: ${s.title}`, () => {
    const penId = ensureActivityPen(s.title)
    const entries = useTimeTrackingStore.getState().entries
    const add: Omit<TimeEntry, "id">[] = []
    const drop: string[] = []
    for (const p of pieces) {
      const same = entries.filter((e) => overlaps(e, p) && isLlmBlock(e) && e.penId === penId && !drop.includes(e.id))
      overlapping += entries.filter((e) => overlaps(e, p) && isLlmBlock(e) && e.penId !== penId).length
      merged += same.length
      const startMin = Math.min(p.startMin, ...same.map((e) => e.startMin))
      const endMin = Math.max(p.endMin, ...same.map((e) => e.endMin))
      const items = [...same.flatMap((e) => notesItems(e.notes)), ...fresh]
      const ids = [...same.map((e) => e.generatedBy!.id.replace(/^bim-suggest:/, "")), s.id]
      drop.push(...same.map((e) => e.id))
      add.push({ date: p.date, scopeId: ACTIVITY, penId, startMin, endMin, precision: "estimated", notes: renderNotes(items), generatedBy: acceptedBlockStamp(ids.join("+")) })
    }
    useTimeTrackingStore.getState().layerEntries(add, drop)
  })
  const extra = merged ? ` · MERGED WITH ${merged} EARLIER DETECTION${merged === 1 ? "" : "S"}` : overlapping ? ` · OVERLAPS ${overlapping} LLM BLOCK${overlapping === 1 ? "" : "S"}: SET THE TRUE BOUNDS IN TRACKING` : ""
  return { ok: true, message: `PAINTED ${s.title.toUpperCase()}${extra}` }
}

function acceptItem(s: Suggestion): Accepted {
  const result = runAsAction(`Accept suggested item: ${s.title}`, () => applyCapture(s.list ? `${s.list}: ${s.title}` : s.title, { sendToInbox: !s.list }))
  return { ok: result.status === "ok", message: (result.reply ?? "").toUpperCase() }
}

function acceptHabit(s: Suggestion): Accepted {
  const habit = useHabitsStore.getState().tasks.find((t) => t.id === s.habitId)
  if (!habit) return { ok: false, message: "HABIT NOT FOUND" }
  const result = runAsAction(`Accept suggested habit: ${s.title}`, () => writeHabit(habit, "", new Date(s.at)))
  return { ok: result.status === "ok", message: (result.reply ?? "").toUpperCase() }
}

/** `note` is the person's own words; on a block it is kept in the notes beside the evidence. */
export function acceptSuggestion(s: Suggestion, note = ""): Accepted {
  try {
    return s.kind === "timeblock" ? acceptTimeblock(s, note) : s.kind === "item" ? acceptItem(s) : acceptHabit(s)
  } catch (err) {
    return { ok: false, message: `FAILED: ${err instanceof Error ? err.message.toUpperCase() : "ERROR"}` }
  }
}

export interface LlmOverlap {
  a: TimeEntry
  b: TimeEntry
  date: string
  startMin: number
  endMin: number
}

/** Accepted LLM blocks that still overlap one another, newest day first: the ones waiting for true bounds. */
export function llmOverlaps(entries: TimeEntry[]): LlmOverlap[] {
  const llm = entries.filter((e) => e.scopeId === ACTIVITY && e.kind !== "instant" && isLlmBlock(e))
  const out: LlmOverlap[] = []
  for (let i = 0; i < llm.length; i++) {
    for (let j = i + 1; j < llm.length; j++) {
      const a = llm[i]!
      const b = llm[j]!
      if (a.date !== b.date || a.startMin >= b.endMin || b.startMin >= a.endMin) continue
      const [x, y] = a.startMin <= b.startMin ? [a, b] : [b, a]
      out.push({ a: x, b: y, date: a.date, startMin: Math.max(a.startMin, b.startMin), endMin: Math.min(a.endMin, b.endMin) })
    }
  }
  return out.sort((p, q) => q.date.localeCompare(p.date) || p.startMin - q.startMin)
}
