/**
 * components/Analytics/sleep-rhythm.ts — Chronobiology numbers for the Sleep tab
 *
 * Pure. Works on `SleepNightStat` rows (offsets from the morning's midnight;
 * negative is the evening before). Every result carries its own n and returns
 * null under its floor, so a thin window says "not yet" instead of a number.
 *
 * - Social jetlag: mid-sleep on free days minus mid-sleep on workdays
 *   (Wittmann et al. 2006, Chronobiol Int 23:497).
 * - MSFsc: free-day mid-sleep corrected for oversleep on free days, the
 *   Munich ChronoType Questionnaire chronotype (Roenneberg et al. 2004).
 * - Sleep Regularity Index: chance of the same asleep/awake state at the same
 *   clock minute on consecutive days, scaled −100…100 (Phillips et al. 2017,
 *   Sci Rep 7:3216). Here it runs on the 6 PM → noon window only.
 */
import type { SleepNightStat } from "@/lib/sleep-log"

type Night = Pick<SleepNightStat, "date" | "minutes" | "sleptMin" | "wokeMin">

/** Floor per group before a mid-sleep comparison is shown. */
export const JETLAG_FLOOR = 2

export function midSleep(night: Pick<Night, "sleptMin" | "wokeMin">): number {
  return (night.sleptMin + night.wokeMin) / 2
}

function weekday(date: string): number {
  return new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))).getDay()
}

/** A night is "free" when its morning is Saturday or Sunday (Fri and Sat nights). */
export function isFreeNight(date: string): boolean {
  const d = weekday(date)
  return d === 0 || d === 6
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)

export type SocialJetlag = {
  /** Mean mid-sleep offset, free nights. */
  msf: number
  /** Mean mid-sleep offset, work nights. */
  msw: number
  /** msf − msw in minutes. Positive = later on free days. */
  jetlag: number
  /** Mean duration, free and work nights. */
  sdf: number
  sdw: number
  /** Chronotype: msf minus half the free-night oversleep. Equals msf when there is none. */
  msfsc: number
  nFree: number
  nWork: number
}

export function socialJetlag(nights: readonly Night[]): SocialJetlag | null {
  const free = nights.filter((n) => isFreeNight(n.date))
  const work = nights.filter((n) => !isFreeNight(n.date))
  if (free.length < JETLAG_FLOOR || work.length < JETLAG_FLOOR) return null
  const msf = mean(free.map(midSleep))
  const msw = mean(work.map(midSleep))
  const sdf = mean(free.map((n) => n.minutes))
  const sdw = mean(work.map((n) => n.minutes))
  const sdWeek = (5 * sdw + 2 * sdf) / 7
  const msfsc = sdf > sdw ? msf - (sdf - sdWeek) / 2 : msf
  return { msf, msw, jetlag: msf - msw, sdf, sdw, msfsc, nFree: free.length, nWork: work.length }
}

/** Plain-language band for a chronotype mid-sleep offset (minutes from midnight). */
export function chronotypeWord(msfsc: number): string {
  const h = msfsc / 60
  if (h < 2.5) return "early type"
  if (h < 4) return "slightly early"
  if (h < 5) return "intermediate"
  if (h < 6.5) return "slightly late"
  return "late type"
}

const SRI_START = -6 * 60
const SRI_END = 12 * 60
const SRI_STEP = 5

function asleepAt(night: Night, minute: number): boolean {
  return minute >= night.sleptMin && minute < night.wokeMin
}

function nextDate(date: string): string {
  const d = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * SRI over consecutive tracked night pairs. Null below 2 pairs.
 * 100 = identical schedule every day; 0 = random; negative = anti-phase.
 */
export function sleepRegularityIndex(nights: readonly Night[]): { sri: number; pairs: number } | null {
  const byDate = new Map(nights.map((n) => [n.date, n]))
  let same = 0
  let total = 0
  let pairs = 0
  for (const night of nights) {
    const next = byDate.get(nextDate(night.date))
    if (!next) continue
    pairs++
    for (let m = SRI_START; m < SRI_END; m += SRI_STEP) {
      if (asleepAt(night, m) === asleepAt(next, m)) same++
      total++
    }
  }
  if (pairs < 2 || total === 0) return null
  return { sri: 200 * (same / total) - 100, pairs }
}

/** Nights asleep strictly after `cutoff` (offset minutes). */
export function nightsAfter<T extends Pick<Night, "sleptMin">>(nights: readonly T[], cutoff: number): T[] {
  return nights.filter((n) => n.sleptMin > cutoff)
}

/** Shortfall against a what-if target. Nights over target add nothing. */
export function debtAt(nights: readonly Pick<Night, "minutes">[], target: number): { debt: number; atTarget: number } {
  let debt = 0
  let atTarget = 0
  for (const n of nights) {
    if (n.minutes >= target) atTarget++
    else debt += target - n.minutes
  }
  return { debt, atTarget }
}
