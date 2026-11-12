/**
 * lib/tracking-helper/sleep.ts — Sleep is easy, so code reads it
 *
 * "woke up at 1:30 am after going to bed yesterday at around 9" has one right answer: asleep 9 PM
 * yesterday, awake 1:30 AM. A small model got it wrong (9 AM to 9:05 AM). So before the model's
 * answer is placed, code reads each clock by the word before it:
 * - after a wake word (woke, wake up, got up, awake) the clock is a wake time, read as morning;
 * - after a bed word (bed, asleep, slept, sleep, lights out) the clock is a bed time, read as night:
 *   6–11 is PM, 12 is midnight, 1–5 is AM. "slept from 10 to 6" takes the second clock as the wake;
 * - an am/pm written by the person always wins.
 * With both a bed and a wake clock the whole sleep block is built here and replaces whatever sleep entry
 * the model made. With one, only that clock's reading is fixed. Pure.
 */

import type { Token, WiredSegment } from "./types"

const WAKE = /\b(woke|wake|wakes|waking|woken|got up|get up|getting up|awake|awoke)\b/gi
const BED = /\b(bed|asleep|sleep|slept|sleeping|lights out|passed out|crashed|knocked out|conked out)\b/gi
/** An activity the model already wrote for sleep. */
export const SLEEP_ACTIVITY = /\b(sleep|sleeping|slept|asleep|bed|bedtime|rest)\b/i

export interface SleepRead {
  /** Minutes past midnight, per clock id, to use instead of continuity. */
  readings: Map<string, number>
  /** The finished sleep entry when both a bed and a wake clock were found. */
  segment?: WiredSegment
  bed?: string
  wake?: string
}

const last = (text: string, re: RegExp): { at: number; end: number } | null => {
  let out: { at: number; end: number } | null = null
  for (const m of text.matchAll(re)) out = { at: m.index!, end: m.index! + m[0].length }
  return out
}

/** A bed clock without am/pm: evening and night hours are PM, 12 is midnight, 1–5 is after midnight. */
function bedMinutes(t: Token): number {
  const h = t.hour ?? 0
  const m = t.minute ?? 0
  if (t.ampm === "pm") return (h % 12) * 60 + 720 + m
  if (t.ampm === "am") return (h % 12) * 60 + m
  if (h === 0 || h > 12) return (h % 24) * 60 + m
  if (h === 12) return m
  return h >= 6 ? h * 60 + 720 + m : h * 60 + m
}

/** A wake clock without am/pm is morning; 12 is noon. */
function wakeMinutes(t: Token): number {
  const h = t.hour ?? 0
  const m = t.minute ?? 0
  if (t.ampm === "pm") return (h % 12) * 60 + 720 + m
  if (t.ampm === "am") return (h % 12) * 60 + m
  if (h === 0 || h > 12) return (h % 24) * 60 + m
  return h === 12 ? 720 + m : h * 60 + m
}

export function readSleep(text: string, tokens: Token[]): SleepRead {
  const readings = new Map<string, number>()
  let bed: Token | undefined
  let wake: Token | undefined
  let prevEnd = 0
  let prevRole: "bed" | "wake" | null = null
  let prevTok: Token | undefined
  for (const t of tokens) {
    if (t.kind !== "clock") continue
    const sentStart = Math.max(prevEnd, text.lastIndexOf(".", t.at - 1) + 1, text.lastIndexOf("\n", t.at - 1) + 1)
    const before = text.slice(Math.max(sentStart, t.at - 60), t.at)
    const w = last(before, WAKE)
    const b = last(before, BED)
    let role: "bed" | "wake" | null = null
    if (w && (!b || w.at > b.at || /out of bed/i.test(before.slice(w.at)))) role = "wake"
    else if (b) role = "bed"
    // "slept from 10 to 6": a bare clock joined to the bed clock before it is the wake.
    else if (prevRole === "bed" && prevTok && /^\s*(?:-|–|—|to|until|til|till|through)\s*$/i.test(text.slice(prevTok.at + prevTok.raw.length, t.at))) role = "wake"
    if (role === "bed" && !bed) {
      bed = t
      readings.set(t.id, bedMinutes(t))
    } else if (role === "wake" && !wake) {
      wake = t
      readings.set(t.id, wakeMinutes(t))
    }
    prevEnd = t.at + t.raw.length
    prevRole = role
    prevTok = t
  }
  if (!bed || !wake) return { readings, bed: bed?.id, wake: wake?.id }

  // The day word beside the bed clock ("going to bed yesterday at around 9").
  const dayTok = [...tokens].reverse().find((d) => d.kind === "day" && d.at < bed!.at && bed!.at - d.at < 40 && !/[.!?\n]/.test(text.slice(d.at, bed!.at)))
  const segment: WiredSegment = { activity: "sleeping", place: "", day: dayTok?.id ?? "", start: bed.id, end: wake.id, maybeEnd: "", length: "", startVague: false, endVague: false, notes: "", with: "", mood: "" }
  return { readings, segment, bed: bed.id, wake: wake.id }
}

/** The model's entries with its sleep entry swapped for the one code built, placed first when its clocks come first. */
export function withSleep(segments: WiredSegment[], read: SleepRead): WiredSegment[] {
  if (!read.segment) return segments
  const rest = segments.filter((s) => !SLEEP_ACTIVITY.test(s.activity))
  return [read.segment, ...rest]
}
