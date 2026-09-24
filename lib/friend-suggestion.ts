/**
 * lib/friend-suggestion.ts — Score and pick what today's friend mentions
 *
 * Candidates: unmet daily habits, today's To Do, open Next Actions.
 * Flavor (opt-in): affection lines, whims, title-love boosts.
 * Tests leave `flavor` off so rng=0 stays a deterministic world pick.
 */

import {
  DEFAULT_FRIEND_PERSONALITY,
  sourceWeight,
  titleLoveBoost,
  type FriendDialogEffect,
  type FriendPersonality,
  type FriendSuggestionKind,
  type FriendSuggestionSource,
  type FriendWorldSource,
} from "@/lib/baby-animal-personality"
import { EMPTY_FRIEND_NUDGE, friendMissionBlurb, friendSuggestionLine } from "@/lib/friend-copy"
import { friendRewardPoints } from "@/lib/friend-reward"
import { friendWhim } from "@/lib/friend-whims"
import { isLoggedAction, itemTitleOrUntitled, taskIsNextAction } from "@/lib/item-utils"
import { isClearedFromWork } from "@/lib/completion-status"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { isHabitPeriodExempt, type ExemptionBooks } from "@/lib/habit-exemption"
import { isDailyHabit } from "@/lib/habit-points"
import { formatLocalDateKey } from "@/lib/date-utils"
import { buildTodoItems, filterAndSortTodos } from "@/components/Home/ToDo/todo-utils"
import type { Folder, Task, WeeklyData, WeeklyTask } from "@/lib/types"

export type FriendCandidate = {
  id: string
  source: FriendWorldSource
  title: string
  urgency: number
  importance: number
  overdueDays: number
  listIds: string[]
}

export type FriendSuggestion = {
  taskId: string | null
  line: string
  source: FriendSuggestionSource | null
  kind: FriendSuggestionKind
  title: string
  blurb: string
  effect: FriendDialogEffect
  rewardPoints: number
}

export type FriendSuggestionContext = {
  personality?: FriendPersonality
  habits?: WeeklyTask[]
  weeklyData?: WeeklyData
  habitExemptions?: ExemptionBooks
  now?: Date
  /** Affection / whim rolls. Nest turns this on; unit tests leave it off. */
  flavor?: boolean
}

export function openFriendNextActions(tasks: Task[], folders: Folder[]): Task[] {
  return tasks.filter((task) => {
    if (isClearedFromWork(task)) return false
    if (isLoggedAction(task)) return false
    return taskIsNextAction(task, folders)
  })
}

export function openFriendHabits(
  habits: WeeklyTask[],
  weeklyData: WeeklyData,
  now: Date,
  books?: ExemptionBooks,
): WeeklyTask[] {
  const key = formatLocalDateKey(now)
  return habits.filter((habit) => {
    if (!isDailyHabit(habit)) return false
    if (habit.priorityMuted) return false
    if (books && isHabitPeriodExempt(habit, key, "daily", books)) return false
    return !isHabitGoalMet(habit, weeklyData[key]?.[habit.id], { date: now, weeklyData })
  })
}

export function openFriendTodos(tasks: Task[], now: Date): Task[] {
  const rows = filterAndSortTodos(buildTodoItems(tasks, false, now), "day", false, now)
  const byId = new Map(tasks.map((task) => [task.id, task]))
  return rows.map((row) => byId.get(row.taskId)).filter((task): task is Task => Boolean(task && !isClearedFromWork(task)))
}

function listScore(personality: FriendPersonality, listIds: string[]): number {
  if (!listIds.length) return 50
  let best = 50
  let hit = false
  for (const id of listIds) {
    const value = personality.listBias[id]
    if (typeof value !== "number") continue
    hit = true
    if (value > best) best = value
  }
  return hit ? best : 50
}

export function collectFriendCandidates(
  tasks: Task[],
  folders: Folder[],
  ctx: FriendSuggestionContext = {},
): FriendCandidate[] {
  const now = ctx.now ?? new Date()
  const habits = ctx.habits ?? []
  const weeklyData = ctx.weeklyData ?? {}
  const byId = new Map<string, FriendCandidate>()

  const take = (row: FriendCandidate) => {
    const prev = byId.get(row.id)
    if (!prev) {
      byId.set(row.id, row)
      return
    }
    if (sourceWeight(ctx.personality ?? DEFAULT_FRIEND_PERSONALITY, row.source) >
      sourceWeight(ctx.personality ?? DEFAULT_FRIEND_PERSONALITY, prev.source)) {
      byId.set(row.id, row)
    }
  }

  for (const habit of openFriendHabits(habits, weeklyData, now, ctx.habitExemptions)) {
    take({
      id: `habit:${habit.id}`,
      source: "habit",
      title: habit.name.trim() || "Untitled habit",
      urgency: 3,
      importance: habit.priorityPinned ? 4 : 3,
      overdueDays: 0,
      listIds: [],
    })
  }

  for (const task of openFriendTodos(tasks, now)) {
    take({
      id: task.id,
      source: "todo",
      title: itemTitleOrUntitled(task),
      urgency: task.urgency ?? 3,
      importance: task.importance ?? 3,
      overdueDays: 0,
      listIds: task.lists ?? [],
    })
  }

  for (const task of openFriendNextActions(tasks, folders)) {
    take({
      id: task.id,
      source: "nextAction",
      title: itemTitleOrUntitled(task),
      urgency: task.urgency ?? 3,
      importance: task.importance ?? 3,
      overdueDays: 0,
      listIds: task.lists ?? [],
    })
  }

  return [...byId.values()]
}

export function scoreFriendCandidate(row: FriendCandidate, personality: FriendPersonality): number {
  const source = sourceWeight(personality, row.source)
  const urg = Math.max(0, Math.min(5, row.urgency)) / 5
  const imp = Math.max(0, Math.min(5, row.importance)) / 5
  const lists = listScore(personality, row.listIds) / 100
  const love = titleLoveBoost(row.title, personality.titleLoves)
  return source * 2 + personality.urgencyBias * urg + imp * 20 + lists * 25 + love
}

function pickWeighted<T>(rows: Array<{ item: T; weight: number }>, rng: () => number): T {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.weight), 0)
  if (total <= 0) return rows[0]!.item
  let dart = rng() * total
  for (const row of rows) {
    dart -= Math.max(0, row.weight)
    if (dart <= 0) return row.item
  }
  return rows[rows.length - 1]!.item
}

function pack(
  personality: FriendPersonality,
  source: FriendSuggestionSource | null,
  kind: FriendSuggestionKind,
  title: string,
  line: string,
  taskId: string | null,
  rewardPoints: number,
): FriendSuggestion {
  return {
    taskId,
    line,
    source,
    kind,
    title,
    blurb: friendMissionBlurb(source, title),
    effect: personality.dialogEffect,
    rewardPoints,
  }
}

export function pickFriendSuggestion(
  tasks: Task[],
  folders: Folder[],
  lastId: string | null = null,
  rng: () => number = Math.random,
  ctx: FriendSuggestionContext = {},
): FriendSuggestion {
  const personality = ctx.personality ?? DEFAULT_FRIEND_PERSONALITY
  const reward = friendRewardPoints(personality.rewardScale)

  if (ctx.flavor) {
    if (rng() * 100 < personality.loveYouRate) {
      return pack(
        personality,
        "affection",
        "affection",
        "I love you",
        friendSuggestionLine(personality.tone, "affection", "I love you", rng),
        `affection:${Date.now()}`,
        0,
      )
    }
    if (rng() * 100 < personality.whimRate) {
      const whim = friendWhim(personality.whimId)
      return pack(
        personality,
        "whim",
        "whim",
        whim.title,
        friendSuggestionLine(personality.tone, "whim", whim.title, rng),
        `whim:${whim.id}`,
        reward,
      )
    }
  }

  const all = collectFriendCandidates(tasks, folders, { ...ctx, personality })
  if (all.length === 0) {
    return pack(personality, null, "empty", "No mission", EMPTY_FRIEND_NUDGE, null, 0)
  }

  const pool = lastId && all.length > 1 ? all.filter((row) => row.id !== lastId) : all
  const live = pool.filter((row) => sourceWeight(personality, row.source) > 0)
  const usable = live.length > 0 ? live : pool
  const ranked = [...usable].sort((a, b) => {
    const diff = scoreFriendCandidate(b, personality) - scoreFriendCandidate(a, personality)
    if (diff !== 0) return diff
    return a.id.localeCompare(b.id)
  })
  const picked = pickWeighted(
    ranked.map((row) => ({ item: row, weight: Math.max(1, scoreFriendCandidate(row, personality)) })),
    rng,
  )
  return pack(
    personality,
    picked.source,
    "mission",
    picked.title,
    friendSuggestionLine(personality.tone, picked.source, picked.title, rng),
    picked.id,
    reward,
  )
}
