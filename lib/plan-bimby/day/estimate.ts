/**
 * lib/plan-bimby/day/estimate.ts — How long a thing will take, and where that number came from (pure)
 *
 * Strongest first: minutes said in the message, then the median of your own similar past tasks, then a rule
 * of thumb. A model's guess (`llm.ts`) replaces only a rule of thumb. Every estimate carries one sentence
 * saying what it rests on, so the card can show it and the person can overrule it.
 */

import { nameScore } from "./read"
import type { DayEstimate } from "./types"

/** One finished thing from your own data: a completed task, a tracked block, an earlier day plan row. */
export interface PastRun {
  title: string
  minutes: number
  /** Where it was found, in plain words ("To Do", "Tracking", "day plan"). */
  from: string
}

const THUMB: [RegExp, number, string][] = [
  [/^(?:order|buy|purchase)\b/i, 15, "an online order is usually about 15 min"],
  [/\b(?:dye|colou?r)\b.*\bhair\b|\bhair\b.*\bdye\b/i, 90, "mixing, applying, processing and rinsing is usually about 90 min"],
  [/\bbleach\b.*\b(?:eye)?brows?\b/i, 25, "applying, waiting and wiping off is usually about 25 min"],
  [/\bshave\b/i, 15, "usually about 15 min"],
  [/\b(?:un|re)?pack\b/i, 45, "packing a bag is usually about 45 min"],
  [/\boutfits?\b/i, 25, "choosing outfits is usually about 25 min"],
  [/\b(?:text|reply|respond|message|answer|email)\b/i, 10, "reading and answering a message is usually about 10 min"],
  [/\b(?:call|phone)\b/i, 15, "a call is usually about 15 min"],
  [/\bshower\b/i, 15, "usually about 15 min"],
  [/\b(?:laundry|wash clothes)\b/i, 20, "about 20 min of hands-on time"],
  [/\bdishes\b/i, 15, "usually about 15 min"],
  [/\b(?:clean|tidy|vacuum|mop)\b/i, 30, "usually about 30 min"],
  [/\b(?:cook|make (?:dinner|lunch|breakfast))\b/i, 45, "usually about 45 min"],
  [/\b(?:workout|gym|exercise)\b/i, 60, "usually about an hour"],
  [/^plan\b/i, 45, "planning something is usually about 45 min"],
  [/^(?:finish|complete|wrap up)\b/i, 60, "finishing open work is rarely under an hour"],
]

export const DEFAULT_MINUTES = 30

export function ruleOfThumb(title: string): DayEstimate {
  for (const [re, minutes, why] of THUMB) if (re.test(title)) return { minutes, source: "rule", basis: `Rule of thumb: ${why}. Not from your data.` }
  return { minutes: DEFAULT_MINUTES, source: "default", basis: "Nothing to go on yet, so 30 min. Change it." }
}

function median(ns: number[]): number {
  const s = [...ns].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2)
}

/** Past runs whose name this title shares, in either direction ("dye hair" meets "Dye my hair red"). */
export function similarRuns(title: string, past: readonly PastRun[]): PastRun[] {
  return past.filter((p) => p.minutes > 0 && p.minutes <= 12 * 60 && (nameScore(title, p.title) >= 0.6 || nameScore(p.title, title) >= 0.99))
}

/** The median of your own similar past tasks, or null when there are none. */
export function fromHistory(title: string, past: readonly PastRun[]): DayEstimate | null {
  const like = similarRuns(title, past)
  if (!like.length) return null
  const minutes = median(like.map((p) => p.minutes))
  const shown = like.slice(-3).map((p) => `"${p.title}" ${p.minutes} min (${p.from})`).join(", ")
  const n = like.length
  return {
    minutes,
    source: "history",
    basis: n === 1 ? `From the one time you did something like this: ${shown}.` : `Median of ${n} times you did something like this: ${shown}${n > 3 ? ", …" : ""}.`,
  }
}

export function estimateFor(title: string, saidMinutes: number | undefined, past: readonly PastRun[]): DayEstimate {
  if (saidMinutes && saidMinutes > 0) return { minutes: saidMinutes, source: "said", basis: "You said how long." }
  return fromHistory(title, past) ?? ruleOfThumb(title)
}

export function span(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`
}
