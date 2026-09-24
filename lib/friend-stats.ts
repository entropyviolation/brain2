/**
 * lib/friend-stats.ts — Bond, streak, badges, and mix math for the friend instrument
 *
 * Pure. The instrument paints these; it does not invent a second mission ruleset.
 * Bond score is lifetime friend points (done missions) plus times worn.
 * Every 20 points is one level. A new level starts the bar over.
 */

import type { FriendPersonality } from "@/lib/baby-animal-personality"
import { titleLoveBoost } from "@/lib/baby-animal-personality"
import { isBeforeDeadline, type FriendMission, type FriendMissionLogEntry } from "@/lib/friend-mission"

export const BOND_PER_LEVEL = 20

export type BondProgress = {
  level: number
  score: number
  into: number
  need: number
  /** 0–100 fill of the current level. */
  fill: number
}

export function friendPointsTotal(missions: FriendMission[]): number {
  return missions.reduce((sum, row) => (row.status === "done" ? sum + row.points : sum), 0)
}

export function finishedMissionCount(missions: FriendMission[]): number {
  return missions.reduce((sum, row) => (row.status === "done" ? sum + 1 : sum), 0)
}

export function bondProgress(points: number, wearCount: number): BondProgress {
  const score = Math.max(0, Math.round(points)) + Math.max(0, Math.round(wearCount))
  const need = BOND_PER_LEVEL
  const level = 1 + Math.floor(score / need)
  const into = score % need
  return { level, score, into, need, fill: (into / need) * 100 }
}

/** Local calendar day `YYYY-MM-DD`. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function dayFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

function shiftDay(key: string, days: number): string {
  const date = dayFromKey(key)
  date.setDate(date.getDate() + days)
  return localDayKey(date)
}

function doneDayKeys(missions: FriendMission[]): Set<string> {
  const days = new Set<string>()
  for (const row of missions) {
    if (row.status !== "done") continue
    const stamp = row.log.find((entry) => entry.note === "done")?.at || row.offeredAt
    const date = new Date(stamp)
    if (!Number.isNaN(date.getTime())) days.add(localDayKey(date))
  }
  return days
}

/**
 * Finished days in a row, counting today if one is finished today,
 * otherwise yesterday. A gap before that ends the streak.
 */
export function friendStreak(missions: FriendMission[], now = new Date()): number {
  const days = doneDayKeys(missions)
  let cursor = localDayKey(now)
  if (!days.has(cursor)) {
    cursor = shiftDay(cursor, -1)
    if (!days.has(cursor)) return 0
  }
  let count = 0
  while (days.has(cursor)) {
    count += 1
    cursor = shiftDay(cursor, -1)
  }
  return count
}

export type TodayLamp = "empty" | "accepted" | "finished"

/** One tube: nothing open, a mission still due today, or a finish today. */
export function todayLamp(missions: FriendMission[], now = new Date()): TodayLamp {
  const today = localDayKey(now)
  const finishedToday = [...doneDayKeys(missions)].includes(today)
  if (finishedToday) return "finished"
  const open = missions.some((row) => row.status === "accepted" && isBeforeDeadline(row.deadline, now))
  return open ? "accepted" : "empty"
}

/** Newest offered mission, else an accepted mission still inside its day. */
export function pinnedMission(missions: FriendMission[], now = new Date()): FriendMission | null {
  const offered = missions.find((row) => row.status === "offered")
  if (offered) return offered
  return missions.find((row) => row.status === "accepted" && isBeforeDeadline(row.deadline, now)) ?? null
}

export type FriendBadgeId =
  | "first-mission"
  | "first-step"
  | "streak-3"
  | "worn-10"
  | "before-noon"
  | "bond-5"
  | "streak-7"
  | "every-tone"
  | "whim-done"

export type FriendBadge = {
  id: FriendBadgeId
  label: string
  earned: boolean
  progress: number
  goal: number
}

function finishedBeforeNoon(missions: FriendMission[]): boolean {
  return missions.some((row) =>
    row.log.some((entry) => {
      if (entry.note !== "done") return false
      const date = new Date(entry.at)
      return !Number.isNaN(date.getTime()) && date.getHours() < 12
    }),
  )
}

export function friendBadges(
  missions: FriendMission[],
  wearCount: number,
  now = new Date(),
  extra?: { points?: number; tonesTried?: number },
): FriendBadge[] {
  const streak = friendStreak(missions, now)
  const tookStep = missions.some(
    (row) => row.log.some((entry) => entry.note === "first-step-yes") || Boolean(row.stepTitle),
  )
  const points = Math.max(0, extra?.points ?? 0)
  const bond = bondProgress(points, wearCount)
  const tones = Math.max(0, extra?.tonesTried ?? 0)
  const whim = missions.some((row) => row.kind === "whim" && row.status === "done")
  const noon = finishedBeforeNoon(missions)
  return [
    { id: "first-mission", label: "First mission", earned: missions.length > 0, progress: Math.min(missions.length, 1), goal: 1 },
    { id: "first-step", label: "Took the first step", earned: tookStep, progress: tookStep ? 1 : 0, goal: 1 },
    { id: "streak-3", label: "3-day streak", earned: streak >= 3, progress: Math.min(streak, 3), goal: 3 },
    { id: "worn-10", label: "Worn 10 times", earned: wearCount >= 10, progress: Math.min(wearCount, 10), goal: 10 },
    { id: "before-noon", label: "Finished before noon", earned: noon, progress: noon ? 1 : 0, goal: 1 },
    { id: "bond-5", label: "Bond Lv 5", earned: bond.level >= 5, progress: Math.min(bond.level, 5), goal: 5 },
    { id: "streak-7", label: "7-day streak", earned: streak >= 7, progress: Math.min(streak, 7), goal: 7 },
    { id: "every-tone", label: "Tried every tone", earned: tones >= 4, progress: Math.min(tones, 4), goal: 4 },
    { id: "whim-done", label: "Finished a whim", earned: whim, progress: whim ? 1 : 0, goal: 1 },
  ]
}

export type SourceMix = { habit: number; todo: number; next: number }

/** Share of picks from the three source weights. They sum to 100, or 0 when all weights are 0. */
export function sourceMixPercents(
  personality: Pick<FriendPersonality, "habitWeight" | "todoWeight" | "nextActionsWeight">,
): SourceMix {
  const habitW = Math.max(0, personality.habitWeight)
  const todoW = Math.max(0, personality.todoWeight)
  const nextW = Math.max(0, personality.nextActionsWeight)
  const sum = habitW + todoW + nextW
  if (sum <= 0) return { habit: 0, todo: 0, next: 0 }
  const habit = Math.round((habitW / sum) * 100)
  const todo = Math.round((todoW / sum) * 100)
  let next = 100 - habit - todo
  if (next < 0) {
    const overflow = -next
    next = 0
    if (habit >= todo) return { habit: habit - overflow, todo, next }
    return { habit, todo: todo - overflow, next }
  }
  return { habit, todo, next }
}

export function titleLoveMatchCount(titles: string[], loves: string[]): number {
  if (!loves.length) return 0
  return titles.reduce((sum, title) => (titleLoveBoost(title, loves) > 0 ? sum + 1 : sum), 0)
}

export function formatHistoryDate(iso: string | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function formatExactTime(iso: string | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function formatRelativeTime(iso: string | undefined, now = new Date()): string {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "—"
  const ms = now.getTime() - then
  if (ms < 45_000) return "just now"
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  const hours = Math.round(ms / 3_600_000)
  if (hours < 24) return `${Math.max(1, hours)}h ago`
  const days = Math.round(hours / 24)
  if (days < 14) return `${Math.max(1, days)}d ago`
  return formatHistoryDate(iso)
}

export function formatCountdown(deadline: string | undefined, now = new Date()): string {
  if (!deadline) return ""
  const end = new Date(deadline).getTime()
  if (Number.isNaN(end)) return ""
  const ms = end - now.getTime()
  if (ms <= 0) return "0m"
  const total = Math.ceil(ms / 60_000)
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours <= 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

/** Hours and minutes left, as a 7-segment pair. */
export function formatCountdownClock(deadline: string | undefined, now = new Date()): string {
  if (!deadline) return ""
  const end = new Date(deadline).getTime()
  if (Number.isNaN(end)) return ""
  const ms = end - now.getTime()
  if (ms <= 0) return "00:00"
  const total = Math.ceil(ms / 60_000)
  const hours = Math.min(99, Math.floor(total / 60))
  const mins = total % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

export function dayGroupLabel(iso: string, now = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Earlier"
  const key = localDayKey(date)
  const today = localDayKey(now)
  if (key === today) return "Today"
  if (key === shiftDay(today, -1)) return "Yesterday"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export type MissionDayGroup = {
  key: string
  label: string
  rows: FriendMission[]
}

export function groupMissionsByDay(rows: FriendMission[], now = new Date()): MissionDayGroup[] {
  const groups: MissionDayGroup[] = []
  for (const row of rows) {
    const date = new Date(row.offeredAt)
    const key = Number.isNaN(date.getTime()) ? "earlier" : localDayKey(date)
    const label = key === "earlier" ? "Earlier" : dayGroupLabel(row.offeredAt, now)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.rows.push(row)
    else groups.push({ key, label, rows: [row] })
  }
  return groups
}

/** Expanded log, without a second copy of the decline reason already shown on the row. */
export function journalLogEntries(row: FriendMission): FriendMissionLogEntry[] {
  if (row.status !== "declined") return row.log
  return row.log.filter((entry) => {
    if (entry.note !== "declined") return true
    if (!entry.detail) return false
    return entry.detail !== row.declineReason
  })
}
