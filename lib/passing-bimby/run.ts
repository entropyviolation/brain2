/**
 * lib/passing-bimby/run.ts — the Passing BIMBY: keep what was said in passing on the day's Tracking notes
 *
 * After BIM answers a line, `notePassing` reads it (`readPassing`) and adds what Tracking should know to that
 * day's summary (`appendDayNote`, the Tracking notes field): one paragraph per message,
 * `Said in passing at 9:25 AM:` then one `activity: …` / `event: …` / `place: …` / `company: …` / `mood: …`
 * line each, with the sentence it came from. Nothing becomes a block: the words wait for the Tracking BIMBY,
 * the Day Log BIMBY or you to place them. `passingForDay` re-reads every line you sent that day, so a later
 * reader gets the whole day's notes as data, not prose. Code only, no model.
 */

import { formatLocalDateKey } from "@/lib/date-utils"
import { appendDayNote, getDayNote } from "@/lib/day-notes-persist"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { noteText, readPassing, type PassingNote } from "./parse"

export const PASSING_HEAD = "Said in passing at"

function clock(now: Date): string {
  const h = now.getHours()
  const m = now.getMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}

/** The paragraph for one message, or null when it says nothing Tracking should keep. */
export function passingParagraph(notes: PassingNote[], now: Date): string | null {
  if (!notes.length) return null
  return [`${PASSING_HEAD} ${clock(now)}:`, ...notes.map((n) => `- ${noteText(n)} ("${n.source.replace(/"/g, "'")}")`)].join("\n")
}

export interface PassingResult {
  notes: PassingNote[]
  /** The day key written to. */
  date: string
  /** One short line for the chat reply. */
  reply: string
}

/**
 * Read one line and, when it says something Tracking should know, add it to that day's notes. A line already
 * noted (same note text on that day) is not added twice. Never throws.
 */
export function notePassing(text: string, now: Date): PassingResult | null {
  try {
    const notes = readPassing(text, now)
    if (!notes.length) return null
    const date = formatLocalDateKey(now)
    const have = getDayNote(date)
    const fresh = notes.filter((n) => !have.includes(`- ${noteText(n)} (`))
    if (!fresh.length) return null
    const para = passingParagraph(fresh, now)!
    if (!appendDayNote(date, para, now)) return null
    useTimeTrackingStore.getState().setDayNotes(date, getDayNote(date))
    return { notes: fresh, date, reply: `Noted on today's Tracking: ${fresh.map((n) => noteText(n).replace(/^[a-z]+: /, "")).join(" · ")}.` }
  } catch {
    return null
  }
}

/** Every passing note in the lines you sent on `date` (YYYY-MM-DD), in order. For the BIMBIES that place them. */
export function passingForDay(lines: { text: string; at: string }[], date: string): (PassingNote & { at: string })[] {
  const out: (PassingNote & { at: string })[] = []
  for (const l of lines) {
    const at = new Date(l.at)
    if (formatLocalDateKey(at) !== date) continue
    for (const n of readPassing(l.text, at)) out.push({ ...n, at: l.at })
  }
  return out
}
