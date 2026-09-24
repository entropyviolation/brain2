/**
 * lib/home-glances.ts — Faces for optional Home squares
 *
 * Night well, Harvest leftover, and Inbox mill. Pure. The tiles only
 * supply the night, the point totals, and the inbox titles.
 */

import { formatLocalDateKey } from "@/lib/date-utils"
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
