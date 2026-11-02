/**
 * lib/habit-helper/history.ts — What the person's own cells say: misses, why-questions, nudges, reasons
 *
 * All code, no model. A miss is a day that has ended, on which the habit existed, was not paused, and was
 * not met. The helper asks why about a cell marked missed with no reason, then about a habit missed
 * `threshold` times in the last `window` days, one habit at a time, at most `maxQuestions` a day.
 * A nudge is one line from the habit's own record: the time it is usually done, a streak, a rate, or
 * when it was last done. Reasons are listed with their days, and their common words and themes counted.
 */

import { dateKey } from "@/lib/tracking-helper/clock"
import type { HabitHelperFlow } from "./flow"
import type { HabitBrief, HelperContext } from "./types"
import { clock, contentWords, displayName } from "./words"

const dayBefore = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number)
  return dateKey(new Date(y!, m! - 1, d! - n, 12))
}

const weekday = (key: string) => {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y!, m! - 1, d!, 12).toLocaleDateString("en-US", { weekday: "long" })
}

/** "yesterday", "on Friday", or the date when it is over a week back. */
export function dayWords(key: string, today: string): string {
  if (key === today) return "today"
  if (key === dayBefore(today, 1)) return "yesterday"
  for (let i = 2; i < 7; i++) if (key === dayBefore(today, i)) return `on ${weekday(key)}`
  return `on ${key}`
}

// TODO(A): use `isPausedOn` from `lib/habit-pause.ts` once session A's branch is merged.
export function pausedOn(h: HabitBrief, day: string): boolean {
  return (h.pauses ?? []).some((p) => p.from <= day && (!p.to || day <= p.to))
}

/** Days that have ended in the last `window`, newest first, on which this habit was not met. */
export function missDays(h: HabitBrief, today: string, window: number): string[] {
  const out: string[] = []
  for (let i = 1; i <= window; i++) {
    const day = dayBefore(today, i)
    if (h.since && day < h.since) break
    if (pausedOn(h, day)) continue
    if (!h.days[day]?.met) out.push(day)
  }
  return out
}

export interface WhyQuestion {
  habitId: string
  day: string
  text: string
}

/** Habits worth asking about, most pressing first, skipping any already asked. */
export function whyQueue(ctx: HelperContext, flow: HabitHelperFlow, asked: { habitId: string }[]): WhyQuestion[] {
  const today = dateKey(ctx.now)
  const done = new Set(asked.map((a) => a.habitId))
  const out: WhyQuestion[] = []
  const live = ctx.habits.filter((h) => !done.has(h.id) && !pausedOn(h, today))
  // Marked missed, with no reason yet.
  for (const h of live) {
    for (let i = 0; i <= flow.ask.window; i++) {
      const day = dayBefore(today, i)
      const cell = h.days[day]
      if (cell?.missed && !cell.reason) {
        out.push({ habitId: h.id, day, text: `${displayName(h)} is marked missed ${dayWords(day, today)}. What got in the way?` })
        break
      }
    }
  }
  // Missed again and again, with no reason on the latest miss.
  for (const h of live) {
    if (out.some((q) => q.habitId === h.id)) continue
    const misses = missDays(h, today, flow.ask.window)
    if (misses.length < flow.ask.threshold || h.days[misses[0]!]?.reason) continue
    out.push({ habitId: h.id, day: misses[0]!, text: `${displayName(h)} was missed ${misses.length} of the last ${flow.ask.window} days, most recently ${dayWords(misses[0]!, today)}. What got in the way?` })
  }
  return out
}

export interface Nudge {
  habitId: string
  habit: string
  text: string
  /** How much the habit's own record says: 3 a time or amount, 2 a streak or rate, 1 when last done, 0 nothing. */
  weight: number
}

/** Today's unmet habits, each with one line drawn from its own record, the most specific first. */
export function nudges(ctx: HelperContext): Nudge[] {
  const today = dateKey(ctx.now)
  const nowMin = ctx.now.getHours() * 60 + ctx.now.getMinutes()
  const out: Nudge[] = []
  for (const h of ctx.habits) {
    if (pausedOn(h, today) || h.days[today]?.met || h.days[today]?.missed) continue
    out.push({ habitId: h.id, habit: displayName(h), ...nudgeLine(h, today, nowMin) })
  }
  return out.sort((a, b) => b.weight - a.weight)
}

function nudgeLine(h: HabitBrief, today: string, nowMin: number): { text: string; weight: number } {
  const line = (text: string, weight: number) => ({ text, weight })
  const cell = h.days[today]
  if (h.kind === "goal" && cell?.value && h.goal) return line(`${cell.value} of ${h.goal} so far; ${Math.max(0, h.goal - cell.value)} to go.`, 3)
  const usual = usualMinute(h, today)
  if (usual !== null) {
    const by = (Math.floor(usual / 60) + 1) * 60
    return line(nowMin <= usual ? `You usually do this before ${clock(by).replace(":00", "")}; it's ${clock(nowMin)}.` : `You usually have this done by ${clock(by).replace(":00", "")}; it's ${clock(nowMin)}, and there is still today.`, 3)
  }
  let streak = 0
  for (let i = 1; i < 60 && h.days[dayBefore(today, i)]?.met; i++) streak++
  if (streak >= 2) return line(`${streak} days in a row; today keeps it going.`, 2)
  const met = [1, 2, 3, 4, 5, 6, 7].filter((i) => h.days[dayBefore(today, i)]?.met).length
  if (met >= 3) return line(`Done ${met} of the last 7 days.`, 2)
  for (let i = 1; i <= 30; i++) if (h.days[dayBefore(today, i)]?.met) return line(`Last done ${dayWords(dayBefore(today, i), today)}. A small version counts.`, 1)
  return line("Not done in the last 30 days. A small version counts.", 0)
}

/** The median time of day a met cell was written on its own day, over the last 30 days. Needs 3. */
export function usualMinute(h: HabitBrief, today: string): number | null {
  const mins: number[] = []
  for (let i = 1; i <= 30; i++) {
    const day = dayBefore(today, i)
    const c = h.days[day]
    if (!c?.met || !c.at) continue
    const at = new Date(c.at)
    if (dateKey(at) === day) mins.push(at.getHours() * 60 + at.getMinutes())
  }
  if (mins.length < 3) return null
  mins.sort((a, b) => a - b)
  return mins[Math.floor(mins.length / 2)]!
}

export const THEMES: Record<string, string[]> = {
  sleep: ["woke", "wake", "late", "overslept", "oversleep", "tired", "sleep", "slept", "nap", "exhausted", "alarm"],
  time: ["busy", "time", "work", "meeting", "deadline", "schedule", "rushed"],
  weather: ["dark", "rain", "cold", "weather", "snow", "hot", "storm"],
  health: ["sick", "ill", "pain", "headache", "hurt", "migraine", "period", "cramp"],
  forgot: ["forgot", "forget", "remember", "slipped"],
  mood: ["sad", "anxious", "stressed", "stress", "motivation", "lazy", "depressed", "overwhelmed", "mood"],
  away: ["travel", "trip", "away", "out", "visiting", "airport"],
}

export interface Reasons {
  list: { day: string; reason: string }[]
  words: { word: string; n: number }[]
  themes: { theme: string; n: number }[]
}

/** Every recorded reason on this habit, newest first, with common words and themes. */
export function reasonsOf(h: HabitBrief): Reasons {
  const list: Reasons["list"] = []
  for (const [day, c] of Object.entries(h.days)) {
    const said = new Set([c.reason, ...(c.notes ?? [])].filter((x): x is string => !!x?.trim()))
    for (const reason of said) list.push({ day, reason })
  }
  list.sort((a, b) => (a.day < b.day ? 1 : -1))
  const count = new Map<string, number>()
  const themes = new Map<string, number>()
  for (const { reason } of list) {
    const said = new Set(contentWords(reason))
    for (const w of said) count.set(w, (count.get(w) ?? 0) + 1)
    for (const [theme, keys] of Object.entries(THEMES)) if (keys.some((k) => said.has(k))) themes.set(theme, (themes.get(theme) ?? 0) + 1)
  }
  const top = (m: Map<string, number>) => [...m].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  return { list, words: top(count).slice(0, 6).map(([word, n]) => ({ word, n })), themes: top(themes).map(([theme, n]) => ({ theme, n })) }
}
