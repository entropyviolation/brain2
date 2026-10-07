/**
 * lib/habit-tagged-count.ts — Count tagged Done tasks into a habit
 *
 * A weekly "cook at least 2 times" habit listens to the tag `cooking` and uses
 * its numeric goal as the count. Two Done tasks tagged cooking in that week
 * meet it. One does not. A task next week stays in next week. Days that have
 * not happened yet are left out. An empty period is 0, stored on
 * `taggedTaskCount`, and that 0 is not a number typed by hand.
 *
 * A Tracking block that carries the same tag files exactly one Done line
 * (`tagged-task-{entryId}`) with that tag. Logging the block again updates
 * that line. The count reads Done tasks only, so the block is not also a pile
 * of minutes. Minute Tracking-tags habits stay on `lib/habit-tracking-sync.ts`.
 *
 * Optional `WeeklyTask.taggedTaskTag`. Missing means this source is off.
 * Done-task wording (`doneTaskPhrase`) still names the habit's own Done line.
 * The count reads tags, not that phrase.
 */
"use client"

import { useEffect } from "react"
import { isRestoring, withoutUndo } from "@/lib/action-history"
import { taskRepository } from "@/lib/data/task-repository"
import { formatLocalDateKey } from "@/lib/date-utils"
import { habitWriteIsQuiet, useHabitsStore } from "@/lib/habits-store"
import { LOGGED_ACTION_TYPE_ID } from "@/lib/item-types"
import { addTag, normalizeTag } from "@/lib/links"
import { periodWindowsForFrequency } from "@/lib/habit-period-windows"
import { startHydratedStoreSync, type HydratedStoreSyncSlot } from "@/lib/start-hydrated-store-sync"
import { effectiveTagIds, findPen } from "@/lib/tracked-time"
import { entryDisplayName, entryMinutes, MINUTES_PER_DAY, type TimeEntry } from "@/lib/time-entries"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore, type TrackScope, type TrackTag } from "@/lib/time-tracking-store"
import type { Task, TaskCompletion, WeeklyData, WeeklyTask } from "@/lib/types"

const PREFIX = "tagged-task-"
const ATTR_TITLE = "taggedTaskTitle"
const ATTR_ENTRY = "trackingEntryId"

export function taggedTaskLogId(entryId: string): string {
  return `${PREFIX}${entryId}`
}

export function taskCarriesTag(task: { tags?: string[] }, tag: string): boolean {
  const want = normalizeTag(tag)
  if (!want) return false
  return (task.tags ?? []).some((item) => normalizeTag(item) === want)
}

export function doneTaskDateKey(task: { completedDate?: Date | string }): string | null {
  if (!task.completedDate) return null
  const date = task.completedDate instanceof Date ? task.completedDate : new Date(task.completedDate)
  if (Number.isNaN(date.getTime())) return null
  return formatLocalDateKey(date)
}

/** Done tasks with `tag` whose done time is on an already-happened day in `dayKeys`. */
export function countTaggedDoneTasks(
  tasks: readonly { tags?: string[]; completed?: boolean; completedDate?: Date | string }[],
  tag: string,
  dayKeys: readonly string[],
  todayKey: string,
): number {
  if (!normalizeTag(tag)) return 0
  const open = new Set(dayKeys.filter((key) => key <= todayKey))
  if (open.size === 0) return 0
  let count = 0
  for (const task of tasks) {
    if (task.completed !== true) continue
    if (!taskCarriesTag(task, tag)) continue
    const key = doneTaskDateKey(task)
    if (key && open.has(key)) count += 1
  }
  return count
}

export function blockCarriesTag(
  entry: Pick<TimeEntry, "penId" | "secondaryPenIds" | "tagIds">,
  scopes: TrackScope[],
  catalog: readonly Pick<TrackTag, "id" | "name">[],
  tag: string,
): boolean {
  const want = normalizeTag(tag)
  if (!want) return false
  const nameById = new Map(catalog.map((item) => [item.id, normalizeTag(item.name)]))
  for (const id of effectiveTagIds(entry, scopes)) {
    if (normalizeTag(id) === want || nameById.get(id) === want) return true
  }
  return false
}

function listens(task: WeeklyTask): boolean {
  return !!task.completionSources?.includes("taggedTasks") && !!normalizeTag(task.taggedTaskTag ?? "")
}

/**
 * Merge a count into the cell. A hand entry, or a minute / occupancy reading,
 * keeps its own number and only stores `taggedTaskCount`. A zero count is a
 * real reading on an otherwise empty cell.
 */
export function applyTaggedTaskCount(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  count: number,
): TaskCompletion | null {
  const handOwned = completion?.handCompleted !== undefined || completion?.manualValue !== undefined
  const otherAuto =
    completion?.trackedValue !== undefined ||
    completion?.trackedCompleted !== undefined ||
    completion?.coverageCompleted !== undefined ||
    completion?.habitSumValue !== undefined ||
    completion?.keywordLogged === true ||
    completion?.listSentPercent !== undefined ||
    completion?.sleepCompleted !== undefined ||
    completion?.listCompleted !== undefined ||
    completion?.dailyFloorCompleted !== undefined
  if (handOwned || otherAuto) {
    if (completion?.taggedTaskCount === count) return null
    return { ...(completion ?? {}), taggedTaskCount: count }
  }
  const goal = task.goal ?? completion?.goal
  if (completion?.taggedTaskCount === count && completion?.value === count && completion?.goal === goal) return null
  return { ...(completion ?? {}), taggedTaskCount: count, value: count, goal }
}

function atLocalMinute(dateKey: string, minute: number): Date {
  const [y, mo, d] = dateKey.split("-").map(Number)
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.floor(minute)))
  return new Date(y, mo - 1, d, Math.floor(clamped / 60), clamped % 60, 0, 0)
}

function sameTags(a: string[] | undefined, b: string[]): boolean {
  const left = [...(a ?? [])].sort()
  const right = [...b].sort()
  return left.length === right.length && left.every((tag, i) => tag === right[i])
}

/**
 * One Done line per Tracking block that carries any listened-to tag.
 * The id is the block id, so a second log updates the same row.
 */
function reconcileTrackedDoneLines(
  entries: TimeEntry[],
  scopes: TrackScope[],
  catalog: TrackTag[],
  wanted: string[],
  todayKey: string,
): void {
  const wantedIds = new Set<string>()
  for (const entry of entries) {
    if (entry.date > todayKey) continue
    const tags = wanted.filter((tag) => blockCarriesTag(entry, scopes, catalog, tag))
    if (!tags.length) continue
    const id = taggedTaskLogId(entry.id)
    wantedIds.add(id)
    const pen = findPen(scopes, entry.penId)
    const title = entryDisplayName(entry, pen?.name)
    const existing = taskRepository.getById(id)
    const generated = String(existing?.attributes?.[ATTR_TITLE] ?? "")
    const edited = !!existing && !!generated && (existing.description || "") !== generated
    const description = edited ? existing!.description : title
    const nextTags = tags.reduce((acc, tag) => addTag(acc, tag), existing?.tags ?? [])
    const completedAt = atLocalMinute(entry.date, entry.kind === "instant" ? entry.startMin : Math.max(entry.startMin, entry.endMin - 1))
    const minutes = entryMinutes(entry)
    const unchanged =
      !!existing &&
      existing.description === description &&
      existing.title === (edited ? existing.title : title) &&
      sameTags(existing.tags, nextTags) &&
      existing.completedDate?.getTime() === completedAt.getTime() &&
      existing.actualDuration === minutes
    if (unchanged) continue
    const fields = {
      description,
      title: edited ? existing!.title : title,
      completedDate: completedAt,
      startedAt: atLocalMinute(entry.date, entry.startMin),
      scheduledDate: atLocalMinute(entry.date, entry.startMin),
      actualDuration: minutes,
      estimatedDuration: minutes,
      tags: nextTags,
      attributes: {
        ...(existing?.attributes ?? {}),
        [ATTR_ENTRY]: entry.id,
        [ATTR_TITLE]: edited ? generated : title,
      },
    }
    if (existing) {
      taskRepository.update({ ...existing, ...fields, completed: true, loggedAction: true })
      continue
    }
    taskRepository.add({
      id,
      type: LOGGED_ACTION_TYPE_ID,
      loggedAction: true,
      stage: "completed",
      status: "done",
      createdAt: completedAt,
      completed: true,
      lists: [],
      links: [],
      rewardValue: 0,
      ...fields,
    })
  }

  for (const task of taskRepository.getAll()) {
    if (!String(task.id).startsWith(PREFIX) || wantedIds.has(task.id)) continue
    const generated = String(task.attributes?.[ATTR_TITLE] ?? "")
    if (generated && (task.description || "") !== generated) continue
    taskRepository.remove(task.id)
  }
}

function bucketFor(task: WeeklyTask, state: ReturnType<typeof useHabitsStore.getState>): WeeklyData {
  const frequency = task.frequency || "daily"
  if (frequency === "monthly") return state.monthlyHabitData
  if (frequency === "quarterly") return state.quarterlyHabitData
  if (frequency === "weekly") return state.weeklyHabitData
  return state.weeklyData
}

function writePeriod(task: WeeklyTask, anchor: Date, next: TaskCompletion): void {
  const habits = useHabitsStore.getState()
  const frequency = task.frequency || "daily"
  if (frequency === "monthly") habits.updateMonthlyHabitCompletion(task.id, anchor, next)
  else if (frequency === "quarterly") habits.updateQuarterlyHabitCompletion(task.id, anchor, next)
  else if (frequency === "weekly") habits.updateWeeklyHabitCompletion(task.id, anchor, next)
  else habits.updateCompletion(task.id, anchor, next)
}

let syncing = false

/** File tracking lines, then write each listening habit's count for the periods those days touch. */
export function syncTaggedTaskCounts(now = new Date()): void {
  if (syncing) return
  const habits = useHabitsStore.getState().tasks.filter(listens)
  if (!habits.length) return
  syncing = true
  try {
    const todayKey = formatLocalDateKey(now)
    const tracking = useTimeTrackingStore.getState()
    const wanted = [...new Set(habits.map((habit) => normalizeTag(habit.taggedTaskTag ?? "")).filter(Boolean))]
    reconcileTrackedDoneLines(tracking.entries ?? [], tracking.scopes, tracking.tags, wanted, todayKey)

    const tasks = taskRepository.getAll()
    const seed = new Set<string>([todayKey])
    for (const task of tasks) {
      if (task.completed !== true) continue
      if (!wanted.some((tag) => taskCarriesTag(task, tag))) continue
      const key = doneTaskDateKey(task)
      if (key && key <= todayKey) seed.add(key)
    }
    for (const entry of tracking.entries ?? []) {
      if (entry.date > todayKey) continue
      if (wanted.some((tag) => blockCarriesTag(entry, tracking.scopes, tracking.tags, tag))) seed.add(entry.date)
    }

    withoutUndo(() => {
      const state = useHabitsStore.getState()
      for (const habit of habits) {
        const tag = normalizeTag(habit.taggedTaskTag ?? "")
        for (const window of periodWindowsForFrequency(habit.frequency, [...seed])) {
          const count = countTaggedDoneTasks(tasks, tag, window.keys, todayKey)
          const previous = bucketFor(habit, state)[window.periodKey]?.[habit.id]
          const next = applyTaggedTaskCount(habit, previous, count)
          if (!next) continue
          writePeriod(habit, window.anchor, next)
        }
      }
    })
  } finally {
    syncing = false
  }
}

const taggedSyncSlot: HydratedStoreSyncSlot = { stopper: null }

export function startTaggedTaskSync(): () => void {
  return startHydratedStoreSync({
    slot: taggedSyncSlot,
    persists: [useHabitsStore.persist, useTimeTrackingStore.persist, useTaskStore.persist],
    onReady: () => {
      const unTrack = useTimeTrackingStore.subscribe((state, prev) => {
        if (isRestoring()) return
        if (state.entries === prev.entries && state.scopes === prev.scopes && state.tags === prev.tags) return
        syncTaggedTaskCounts()
      })
      const unTasks = useTaskStore.subscribe((state, prev) => {
        if (isRestoring() || syncing) return
        if (state.tasks === prev.tasks) return
        syncTaggedTaskCounts()
      })
      const unHabits = useHabitsStore.subscribe((state, prev) => {
        if (isRestoring() || habitWriteIsQuiet() || syncing) return
        if (state.tasks === prev.tasks) return
        syncTaggedTaskCounts()
      })
      syncTaggedTaskCounts()
      return () => {
        unTrack()
        unTasks()
        unHabits()
      }
    },
  })
}

export function useTaggedTaskSync(): void {
  useEffect(() => {
    startTaggedTaskSync()
  }, [])
}
