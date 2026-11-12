/**
 * lib/report-bimby/sleep.ts — Place one night of sleep from what was said and what the data shows
 *
 * Pure. The message gives a wake clock ("woke up at 1:30 am", often sure) and a rough bedtime
 * ("fell asleep at around 8 yesterday", often unsure, often with no am/pm). The evidence only moves
 * a time by presence: a sign of life (Mac or phone Screen Time, Chrome, a sent text, a BIM line, an
 * item created) means awake, so sleep cannot begin before the last one. Silence moves nothing.
 * Every move is written down with the sign that caused it.
 */

import { sleepFact, type SleepOffsets } from "@/lib/bim-flow/text-sleep"
import { describeSignal, firstHardFrom, hardIn, lastHardBefore, type Evidence } from "./evidence"
import { fmtClock, fmtDateTime } from "./time"
import type { Parsed } from "./parse"

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export interface SleepRead {
  sleptMs: number
  wokeMs: number
  wakeSure: boolean
  /** The bedtime is a guess with nothing to check it against. */
  bedGuessed: boolean
  reasoning: string[]
  evidence: string[]
}

/** The latest moment at or before `beforeMs` whose clock reads `minute`; with `ampm` false, either half of the day. */
export function latestClock(beforeMs: number, minute: number, ampm: boolean): number {
  const mins = ampm ? [minute] : [minute, (minute + 720) % 1440]
  let best = -Infinity
  for (const m of mins) {
    const d = new Date(beforeMs)
    let t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, m).getTime()
    if (t > beforeMs) t -= DAY
    best = Math.max(best, t)
  }
  return best
}

/** The bedtime clock that makes a sensible night ending at `wokeMs`: 2 to 14 hours long. Prefers the longer, as a person says "8" for 8 pm. */
function placeBed(minute: number, ampm: boolean, wokeMs: number): number | null {
  const mins = ampm ? [minute] : [minute, (minute + 720) % 1440]
  const fits = mins
    .map((m) => {
      const d = new Date(wokeMs)
      let t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, m).getTime()
      if (t > wokeMs - 2 * HOUR) t -= DAY
      return t
    })
    .filter((t) => wokeMs - t >= 2 * HOUR && wokeMs - t <= 14 * HOUR)
  return fits.length ? Math.min(...fits) : null
}

export function resolveSleep(parsed: Parsed, nowMs: number, ev: Evidence | null, offsets: SleepOffsets | null): SleepRead | null {
  if (!parsed.wake) return null
  const wokeMs = latestClock(nowMs, parsed.wake.minute, parsed.wake.ampm)
  const reasoning: string[] = [`You said you woke up at ${fmtClock(wokeMs)}${parsed.wake.sure ? " and were sure" : ""}, so the latest ${fmtClock(wokeMs)} before now is ${fmtDateTime(wokeMs)}.`]
  const evidence: string[] = []

  // The stated bedtime, put on the clock side that makes a sensible night.
  let stated: number | null = null
  if (parsed.bed) {
    stated = placeBed(parsed.bed.minute, parsed.bed.ampm, wokeMs)
    if (stated === null) reasoning.push(`You said you fell asleep around ${parsed.bed.phrase.match(/asleep at (?:around |about )?\S+/i)?.[0] ?? "then"}, but no am/pm choice makes a night of 2 to 14 hours ending ${fmtClock(wokeMs)}. I ignored it.`)
    else reasoning.push(`You said you fell asleep at around ${fmtClock(stated)}${parsed.bed.ampm ? "" : " (no am/pm; that side makes a night ending when you woke)"}.`)
  }

  let sleptMs: number
  let bedGuessed = false
  const awake = ev ? lastHardBefore(ev, wokeMs - 30 * MIN, 16 * HOUR) : null
  if (ev) {
    const first = firstHardFrom(ev, wokeMs - 45 * MIN, 4 * HOUR)
    if (first) {
      evidence.push(`First sign of you around the wake: ${describeSignal(first)}.`)
      if (first.t < wokeMs - 15 * MIN) reasoning.push(`That sign is before ${fmtClock(wokeMs)}. You may have woken earlier than you remember; the wake time stays as you said it.`)
    } else evidence.push(`No sign of you (Screen Time, Chrome, texts sent, BIM, items) from ${fmtClock(wokeMs - 45 * MIN)} to ${fmtClock(wokeMs + 4 * HOUR)}, so the wake rests on your word alone.`)
    if (awake) evidence.push(`Last sign of you before the wake: ${describeSignal(awake)}.`)
    else evidence.push("No sign of you in the 16 hours before the wake, so nothing shows when you were last up.")
  }

  if (stated !== null) {
    if (awake && awake.end > stated + 10 * MIN) {
      sleptMs = Math.round((awake.end + 10 * MIN) / (5 * MIN)) * 5 * MIN
      reasoning.push(`But there is a sign of you at ${fmtClock(awake.t)} (${describeSignal(awake)}), so you were up then. Sleep starts after it, at ${fmtClock(sleptMs)}.`)
    } else {
      sleptMs = stated
      reasoning.push(awake ? `The last sign of you is ${fmtClock(awake.t)}, before ${fmtClock(stated)}, so your bedtime fits what the data shows.` : "Nothing in the data contradicts it, but nothing confirms it either.")
      bedGuessed = !awake
    }
  } else if (awake) {
    sleptMs = Math.round((awake.end + 15 * MIN) / (5 * MIN)) * 5 * MIN
    reasoning.push(`You gave no bedtime. The last sign of you was ${fmtClock(awake.t)}, so I put sleep 15 minutes after it.`)
  } else {
    sleptMs = wokeMs - 8 * HOUR
    bedGuessed = true
    reasoning.push("You gave no bedtime and the data shows no last sign of you, so this is a guess: 8 hours before the wake. Set the real bedtime.")
  }

  if (sleptMs >= wokeMs) {
    sleptMs = wokeMs - 60 * MIN
    reasoning.push("The bedtime came out after the wake, so I cut it to 1 hour before the wake. Set the real bedtime.")
    bedGuessed = true
  }
  const hours = (wokeMs - sleptMs) / HOUR
  reasoning.push(`That is ${(Math.round(hours * 10) / 10).toString()} hours of sleep.`)

  if (ev) {
    const inside = hardIn(ev, sleptMs + 30 * MIN, wokeMs - 30 * MIN)
    if (inside.length) evidence.push(`${inside.length} sign${inside.length === 1 ? "" : "s"} of you inside this sleep (first ${describeSignal(inside[0]!)}). Your logs say a sent text never fell inside a logged sleep, so check the times.`)
    else evidence.push(`No sign of you from ${fmtClock(sleptMs + 30 * MIN)} to ${fmtClock(wokeMs - 30 * MIN)}.`)
    if (ev.texts) {
      const key = `${new Date(wokeMs).getFullYear()}-${String(new Date(wokeMs).getMonth() + 1).padStart(2, "0")}-${String(new Date(wokeMs).getDate()).padStart(2, "0")}`
      const fact = sleepFact(ev.texts, key, offsets)
      if (fact) evidence.push(fact)
      const lastSent = ev.signals.filter((s) => s.kind === "text-out" && s.t < wokeMs).at(-1)
      evidence.push(lastSent ? `Last text you sent before waking: ${fmtDateTime(lastSent.t)} to ${lastSent.label}.` : "No text you sent in the window before the wake.")
    }
  }
  return { sleptMs, wokeMs, wakeSure: parsed.wake.sure, bedGuessed, reasoning, evidence }
}
