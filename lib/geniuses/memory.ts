/**
 * lib/geniuses/memory.ts — What a genius remembers, read back as prompt lines (pure)
 *
 * Three kinds, newest first, each capped so the prompt stays small:
 *   notes     what you told it and it kept (yours, or picked up from a reply and accepted)
 *   talks     how your last few arguments with it went: the task, your last words, the outcome
 *   council   meetings it sat in: what it asked for and whether the time went to it
 * A genius reads only its own notes and talks. From a meeting it learns only which area got the time, never another
 * genius's notes (`docs/GENIUSES.md` "The council").
 */

import type { CouncilMeeting, Genius, GeniusTalk } from "./types"

export type MemoryCaps = { notes: number; talks: number; meetings: number }
export const MEMORY_CAPS: MemoryCaps = { notes: 12, talks: 3, meetings: 3 }

const day = (iso: string) => iso.slice(0, 10)

export type GeniusMemory = {
  notes: Genius["notes"]
  talks: GeniusTalk[]
  meetings: CouncilMeeting[]
}

/** The rows a genius remembers, newest first. `exceptTalkId` leaves out the talk being had now. */
export function recall(g: Genius, talks: GeniusTalk[], meetings: CouncilMeeting[], caps: MemoryCaps = MEMORY_CAPS, exceptTalkId?: string): GeniusMemory {
  return {
    notes: [...g.notes].sort((a, b) => b.at.localeCompare(a.at)).slice(0, caps.notes),
    talks: talks
      .filter((t) => t.geniusId === g.id && t.id !== exceptTalkId && t.lines.length)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, caps.talks),
    meetings: meetings
      .filter((m) => m.geniusIds.includes(g.id))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, caps.meetings),
  }
}

const OUTCOME: Record<GeniusTalk["outcome"], string> = {
  open: "left open",
  accepted: "they took it",
  declined: "they declined",
  conceded: "you conceded",
  rescheduled: "moved to another time",
}

export function memoryLines(g: Genius, mem: GeniusMemory, names: Record<string, string> = {}): string {
  const out: string[] = []
  if (mem.notes.length) {
    out.push("WHAT THEY TOLD YOU:")
    for (const n of mem.notes) out.push(`- ${day(n.at)}: "${n.said}"${n.source === "picked-up" ? " (you picked this up)" : ""}`)
  }
  if (mem.talks.length) {
    out.push("LAST TALKS:")
    for (const t of mem.talks) {
      const theirs = [...t.lines].reverse().find((l) => l.who === "you")
      out.push(`- ${day(t.startedAt)} about "${t.task}": ${theirs ? `they said "${theirs.text}"; ` : ""}${OUTCOME[t.outcome]}`)
    }
  }
  if (mem.meetings.length) {
    out.push("COUNCILS:")
    for (const m of mem.meetings) {
      const mine = m.asks.find((a) => a.geniusId === g.id)
      const went = m.pickedId === null ? "undecided" : m.pickedId === g.id ? "the time went to you" : `the time went to ${names[m.pickedId] ?? "another area"}`
      out.push(`- ${day(m.at)} "${m.topic}": ${mine ? `you asked "${mine.ask}"; ` : ""}${went}${m.pickedId && m.pickNote ? ` ("${m.pickNote}")` : ""}`)
    }
  }
  return out.length ? out.join("\n") : "Nothing yet. This is your first time talking."
}
