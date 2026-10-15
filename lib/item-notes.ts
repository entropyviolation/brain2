/**
 * lib/item-notes.ts — Dated note log on any item (`Task.noteLog`)
 *
 * Notes on an item are a log: each entry carries the local day it is about
 * (and an optional clock), so a book, a flight, a room, or a person collects
 * entries over time instead of one overwritten paragraph. The legacy
 * `Task.notes` string stays as the pinned standing note; ingest still appends
 * there.
 */
import type { ItemNoteEntry } from "@/lib/types"

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** Local day YYYY-MM-DD. */
export function localDayIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local clock HH:MM. */
export function localClock(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function newNoteId(): string {
  return `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** A new entry stamped now unless a day / clock is given. Blank text returns null. */
export function makeNoteEntry(
  text: string,
  opts: { date?: string; time?: string | null; now?: Date } = {},
): ItemNoteEntry | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const now = opts.now ?? new Date()
  const entry: ItemNoteEntry = { id: newNoteId(), date: opts.date || localDayIso(now), text: trimmed }
  const time = opts.time === null ? undefined : (opts.time ?? localClock(now))
  if (time) entry.time = time
  return entry
}

function sortKey(entry: ItemNoteEntry): string {
  return `${entry.date}T${entry.time ?? "00:00"}`
}

/** Newest first; entries on the same minute keep insertion order reversed (last added first). */
export function notesNewestFirst(entries: readonly ItemNoteEntry[] | undefined): ItemNoteEntry[] {
  const indexed = (entries ?? []).map((entry, index) => ({ entry, index }))
  indexed.sort((a, b) => {
    const ka = sortKey(a.entry)
    const kb = sortKey(b.entry)
    if (ka !== kb) return ka < kb ? 1 : -1
    return b.index - a.index
  })
  return indexed.map((row) => row.entry)
}

/** Group newest-first entries under their day, preserving order. */
export function groupNotesByDay(entries: readonly ItemNoteEntry[]): { date: string; entries: ItemNoteEntry[] }[] {
  const groups: { date: string; entries: ItemNoteEntry[] }[] = []
  for (const entry of entries) {
    const last = groups[groups.length - 1]
    if (last && last.date === entry.date) last.entries.push(entry)
    else groups.push({ date: entry.date, entries: [entry] })
  }
  return groups
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function parseDay(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** "Today", "Yesterday", or "Mon Oct 5, 2026" (year only when it is not this year). */
export function noteDayLabel(date: string, now: Date = new Date()): string {
  const day = parseDay(date)
  if (!day) return date
  const today = parseDay(localDayIso(now))!
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff === -1) return "Tomorrow"
  const base = `${WEEKDAYS[day.getDay()]} ${MONTHS[day.getMonth()]} ${day.getDate()}`
  return day.getFullYear() === now.getFullYear() ? base : `${base}, ${day.getFullYear()}`
}

/** "8:05 PM" from HH:MM. */
export function noteClockLabel(time: string | undefined): string {
  if (!time) return ""
  const m = /^(\d{1,2}):(\d{2})/.exec(time)
  if (!m) return time
  const h = Number(m[1])
  const suffix = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m[2]} ${suffix}`
}

/** Plain text of every entry, for search / sort indexes. */
export function noteLogText(entries: readonly ItemNoteEntry[] | undefined): string {
  return (entries ?? []).map((e) => e.text).join("\n")
}
