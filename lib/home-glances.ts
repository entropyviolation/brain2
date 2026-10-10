/**
 * lib/home-glances.ts — Faces for optional Home squares
 *
 * Night well, Harvest leftover, Inbox mill, Already flowing, and Plan and
 * lived. Pure. The tiles only supply the night, the point totals, the inbox
 * titles, the finished counts, and the planned and painted minutes.
 * Plan and lived compares prospective forward minutes with retrospective waking
 * paint — a comparison face, not a third polarity. Catalog:
 * docs/TEMPORAL_POLARITY.md.
 */

import { dateKeyOf, formatLocalDateKey } from "@/lib/date-utils"
import { formatDuration, isInstant, isSleepBlock, type TimeEntry } from "@/lib/time-entries"
import { uniqueMinutes } from "@/lib/tracking-summary"
import {
  formatSleepDuration,
  offsetToLabel,
  previousDateKey,
  sleepMinutes,
  type SleepNight,
} from "@/lib/sleep-log"

export type GlanceFace = { crt: string; footer: string }

/** Prefer the night that ended this morning; else the morning before. */
export function pickHomeNight(
  nights: Record<string, SleepNight | undefined>,
  morning: Date,
): SleepNight | undefined {
  const key = formatLocalDateKey(morning)
  const today = nights[key]
  if (today?.allNighter || sleepMinutes(today) != null) return today
  const prev = nights[previousDateKey(key)]
  if (prev?.allNighter || sleepMinutes(prev) != null) return prev
  return today ?? prev
}

/** Minutes after that evening's sunset. Negative means before sunset. */
export function sleepAfterSunset(sleptMin: number, sunsetMinutes: number): number {
  return sleptMin - (sunsetMinutes - 1440)
}

function spanPhrase(minutes: number): string {
  const abs = Math.abs(Math.round(minutes))
  const hours = Math.floor(abs / 60)
  const mins = abs % 60
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
  if (hours > 0) return `${hours}h`
  return `${mins}m`
}

export function nightWellFace(night: SleepNight | undefined, sunsetMinutes?: number): GlanceFace {
  if (!night) return { crt: "—", footer: "No night logged" }
  if (night.allNighter) return { crt: "all-nighter", footer: "No sleep" }
  const minutes = sleepMinutes(night)
  if (minutes == null || night.sleptMin == null || night.wokeMin == null) {
    return { crt: "—", footer: "Night incomplete" }
  }
  let footer = `asleep ${offsetToLabel(night.sleptMin)} · woke ${offsetToLabel(night.wokeMin)}`
  if (sunsetMinutes != null && Number.isFinite(sunsetMinutes)) {
    const after = sleepAfterSunset(night.sleptMin, sunsetMinutes)
    footer += ` · ${spanPhrase(after)} ${after >= 0 ? "after" : "before"} sunset`
  }
  return { crt: formatSleepDuration(minutes), footer }
}

/** Possible points still unpaid today. `left of` is earned + still possible. */
export function harvestFace(earned: number, possible: number): GlanceFace {
  const left = Math.max(0, Math.round(possible))
  const paid = Math.max(0, Math.round(earned))
  if (left === 0 && paid === 0) return { crt: "—", footer: "Nothing left today" }
  if (left === 0) return { crt: "0", footer: "Day paid" }
  return { crt: String(left), footer: `${left} left of ${paid + left}` }
}

export function inboxMillFace(titles: string[]): GlanceFace {
  const names = titles.map((title) => title.trim()).filter(Boolean)
  if (names.length === 0) return { crt: "0", footer: "Inbox clear" }
  return { crt: String(names.length), footer: names[0]! }
}

export type FlowWord = "Quiet" | "Flowing" | "Pushed" | "Mixed"

export type FinishedTask = {
  completed?: boolean
  createdAt?: Date | string | null
  completedDate?: Date | string | null
}

/**
 * Finished work already in motion, versus work created and finished the same day.
 * Habit completions are already the day's practice, so they count as flowing.
 */
export function flowingCounts(
  tasks: FinishedTask[],
  day: Date,
  habitCompletions: number,
): { flowing: number; pushed: number } {
  const dayKey = formatLocalDateKey(day)
  let flowing = Math.max(0, Math.round(habitCompletions))
  let pushed = 0
  for (const task of tasks) {
    if (!task.completed) continue
    if (dateKeyOf(task.completedDate) !== dayKey) continue
    if (dateKeyOf(task.createdAt) === dayKey) pushed += 1
    else flowing += 1
  }
  return { flowing, pushed }
}

export function alreadyFlowingFace(flowing: number, pushed: number): GlanceFace & { word: FlowWord } {
  const already = Math.max(0, Math.round(flowing))
  const fresh = Math.max(0, Math.round(pushed))
  const footer = already + fresh === 0 ? "Nothing finished" : `${already} already · ${fresh} new`
  let word: FlowWord = "Quiet"
  if (already + fresh === 0) word = "Quiet"
  else if (fresh === 0) word = "Flowing"
  else if (already === 0) word = "Pushed"
  else if (already >= fresh * 2) word = "Flowing"
  else if (fresh >= already * 2) word = "Pushed"
  else word = "Mixed"
  return { crt: word, footer, word }
}

export type PaintWord = "Open" | "Planned" | "Tracked" | "Short" | "Close" | "Over"

/** Painted minutes for one day. Sleep blocks are left out. Each minute counts once. */
export function livedPaintMinutes(entries: TimeEntry[], dateKey: string): number {
  const waking = entries.filter((entry) => entry.date === dateKey && !isInstant(entry) && !isSleepBlock(entry))
  return uniqueMinutes(waking, [dateKey])
}

export function planAndLivedFace(plannedMinutes: number, livedMinutes: number): GlanceFace & { word: PaintWord } {
  const planned = Math.max(0, Math.round(plannedMinutes))
  const lived = Math.max(0, Math.round(livedMinutes))
  const planBit = formatDuration(planned)
  const livedBit = formatDuration(lived)
  let footer = `plan ${planBit} · lived ${livedBit}`
  if (planned === 0 && lived === 0) footer = "Nothing planned or tracked"
  else if (lived === 0) footer = `plan ${planBit} · nothing tracked`
  else if (planned === 0) footer = `nothing planned · lived ${livedBit}`

  let word: PaintWord = "Open"
  if (planned === 0 && lived === 0) word = "Open"
  else if (lived === 0) word = "Planned"
  else if (planned === 0) word = "Tracked"
  else {
    const ratio = lived / planned
    if (ratio < 0.8) word = "Short"
    else if (ratio > 1.2) word = "Over"
    else word = "Close"
  }
  return { crt: word, footer, word }
}
