/**
 * lib/habit-tagged-count.test.ts — Cooking counts as tasks, not minutes
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { taskRepository } from "@/lib/data/task-repository"
import { formatLocalDateKey, getWeekStartDate, getWeekString } from "@/lib/date-utils"
import { habitDoneLogId } from "@/lib/habit-done-log"
import { readingsFromCell, trustedOutcome } from "@/lib/habit-completion-trust"
import { applyTrackedToCompletion } from "@/lib/habit-tracking"
import { syncTrackedHabits } from "@/lib/habit-tracking-sync"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { trackedMinutesForTags } from "@/lib/tracked-time"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TaskType, type Task, type WeeklyTask } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import {
  applyTaggedTaskCount,
  countTaggedDoneTasks,
  syncTaggedTaskCounts,
  taggedTaskLogId,
} from "./habit-tagged-count"

const NOW = new Date(2026, 9, 6, 15, 0, 0)

const cook: WeeklyTask = {
  id: "cook-week",
  name: "Cook at least 2 times per week",
  type: TaskType.GOAL,
  goal: 2,
  unit: "times",
  frequency: "weekly",
  rewardValue: 0,
  taggedTaskTag: "cooking",
  doneTaskPhrase: "cooked {value} times",
  completionSources: ["manual", "taggedTasks"],
}

const minuteHabit: WeeklyTask = {
  id: "habit-clean",
  name: "Clean for at least 15 minutes",
  type: TaskType.GOAL,
  goal: 15,
  unit: "minutes",
  frequency: "daily",
  trackingLink: { tagIds: ["tag-cleaning"] },
  completionSources: ["manual", "tags"],
}

function atNoon(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 12, 0, 0)
}

function done(id: string, description: string, when: Date, tags: string[]): Task {
  return {
    id,
    description,
    title: description,
    type: "action",
    loggedAction: true,
    stage: "completed",
    status: "done",
    createdAt: when,
    completed: true,
    completedDate: when,
    lists: [],
    tags,
    links: [],
    rewardValue: 0,
  }
}

function weekCell() {
  const start = getWeekStartDate(NOW)
  return useHabitsStore.getState().weeklyHabitData[getWeekString(start)]?.[cook.id]
}

describe("tagged task count", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    resetAllStores()
    useTaskStore.getState().clearAllData()
    useHabitsStore.setState({ tasks: [cook], weeklyData: {}, weeklyHabitData: {} })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("meets a goal of 2 from two cooking tasks this week, and not from one", () => {
    taskRepository.add(done("soup", "made soup for dinner", atNoon(2026, 9, 5), ["cooking"]))
    taskRepository.add(done("breakfast", "made breakfast", atNoon(2026, 9, 6), ["cooking"]))
    taskRepository.add(done("phrase-only", "cooked 2 times", atNoon(2026, 9, 6), ["dinner"]))
    syncTaggedTaskCounts(NOW)

    const cell = weekCell()
    expect(cell?.taggedTaskCount).toBe(2)
    expect(cell?.value).toBe(2)
    expect(cell?.handCompleted).toBeUndefined()
    expect(isHabitGoalMet(cook, cell)).toBe(true)
    expect(cell?.completed).toBe(true)
    const logged = useTaskStore.getState().tasks.find((task) => task.id === habitDoneLogId(cook.id, getWeekStartDate(NOW)))
    expect(logged?.description).toBe("cooked 2 times")
    expect(logged?.tags).toEqual(["habit"])

    useTaskStore.getState().deleteTask("breakfast")
    syncTaggedTaskCounts(NOW)
    const one = weekCell()
    expect(one?.taggedTaskCount).toBe(1)
    expect(isHabitGoalMet(cook, one)).toBe(false)
  })

  it("leaves a task next week out of this week, and a later day of this week out until it arrives", () => {
    const start = getWeekStartDate(NOW)
    const keys = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      return formatLocalDateKey(date)
    })
    const tasks = [
      done("soup", "made soup for dinner", atNoon(2026, 9, 5), ["cooking"]),
      done("breakfast", "made breakfast", atNoon(2026, 9, 6), ["cooking"]),
      done("sunday", "made sunday lunch", atNoon(2026, 9, 11), ["cooking"]),
      done("next", "made soup next week", atNoon(2026, 9, 12), ["cooking"]),
    ]
    const today = formatLocalDateKey(NOW)
    expect(countTaggedDoneTasks(tasks, "cooking", keys, today)).toBe(2)
    expect(countTaggedDoneTasks(tasks.slice(0, 1), "cooking", keys, today)).toBe(1)
    expect(countTaggedDoneTasks([], "cooking", keys, today)).toBe(0)
  })

  it("treats an empty period as 0 and lets a hand entry win", () => {
    syncTaggedTaskCounts(NOW)
    const empty = weekCell()
    expect(empty?.taggedTaskCount).toBe(0)
    expect(empty?.value).toBe(0)
    expect(readingsFromCell(cook.completionSources!, empty, 2).manual?.state).toBe("empty")
    expect(readingsFromCell(cook.completionSources!, empty, 2).taggedTasks?.state).toBe("unmet")
    expect(isHabitGoalMet(cook, empty)).toBe(false)

    useHabitsStore.getState().updateWeeklyHabitCompletion(cook.id, getWeekStartDate(NOW), { value: 0, goal: 2 })
    taskRepository.add(done("soup", "made soup for dinner", atNoon(2026, 9, 5), ["cooking"]))
    taskRepository.add(done("breakfast", "made breakfast", atNoon(2026, 9, 6), ["cooking"]))
    syncTaggedTaskCounts(NOW)
    const handed = weekCell()
    expect(handed?.handCompleted).toBe(false)
    expect(handed?.taggedTaskCount).toBe(2)
    expect(handed?.value).toBe(0)
    expect(trustedOutcome(cook.completionSources!, readingsFromCell(cook.completionSources!, handed, 2)).winner).toBe(
      "manual",
    )
    expect(isHabitGoalMet(cook, handed)).toBe(false)
  })

  it("files one Done line for a tagged tracking block, and a second log does not count twice", () => {
    const tracking = useTimeTrackingStore.getState()
    const tagId = tracking.addTag("Cooking")
    tracking.paintMinutes("2026-10-06", "activity", 18 * 60, 19 * 60, "act-work")
    const entry = useTimeTrackingStore.getState().entries.find((row) => row.date === "2026-10-06")!
    useTimeTrackingStore.getState().updateEntry(entry.id, { tagIds: [tagId], title: "made soup for dinner" })

    syncTaggedTaskCounts(NOW)
    syncTaggedTaskCounts(NOW)

    const filed = useTaskStore.getState().tasks.filter((task) => String(task.id).startsWith("tagged-task-"))
    expect(filed).toHaveLength(1)
    expect(filed[0]?.id).toBe(taggedTaskLogId(entry.id))
    expect(filed[0]?.tags).toEqual(["cooking"])
    expect(filed[0]?.description).toBe("made soup for dinner")
    expect(weekCell()?.taggedTaskCount).toBe(1)
    expect(isHabitGoalMet(cook, weekCell())).toBe(false)

    const minutes = trackedMinutesForTags(
      { scopes: useTimeTrackingStore.getState().scopes, entries: useTimeTrackingStore.getState().entries },
      "2026-10-06",
      [tagId],
    )
    expect(minutes).toBe(60)
    expect(weekCell()?.taggedTaskCount).toBe(1)
  })

  it("counts a daily habit from that day's tagged tasks", () => {
    const daily: WeeklyTask = { ...cook, id: "cook-day", frequency: "daily", goal: 1 }
    useHabitsStore.setState({ tasks: [daily], weeklyData: {}, weeklyHabitData: {} })
    taskRepository.add(done("soup", "made soup for dinner", NOW, ["cooking"]))
    syncTaggedTaskCounts(NOW)
    const cell = useHabitsStore.getState().weeklyData[formatLocalDateKey(NOW)]?.[daily.id]
    expect(cell?.taggedTaskCount).toBe(1)
    expect(isHabitGoalMet(daily, cell)).toBe(true)
  })

  it("still reads minutes for a habit on the Tracking tags source", () => {
    useHabitsStore.setState({ tasks: [minuteHabit, cook], weeklyData: {}, weeklyHabitData: {} })
    useTimeTrackingStore.getState().paintMinutes("2026-10-06", "activity", 8 * 60, 8 * 60 + 30, "act-chores")
    syncTrackedHabits(["2026-10-06"])
    const before = useHabitsStore.getState().weeklyData["2026-10-06"]?.[minuteHabit.id]
    expect(before).toMatchObject({ value: 30, trackedValue: 30 })

    syncTaggedTaskCounts(NOW)
    const after = useHabitsStore.getState().weeklyData["2026-10-06"]?.[minuteHabit.id]
    expect(after?.trackedValue).toBe(30)
    expect(after?.value).toBe(30)
    expect(after?.taggedTaskCount).toBeUndefined()
    expect(readingsFromCell(["manual", "tags"], after, 15).tags).toEqual({ state: "met", value: 30 })
    expect(isHabitGoalMet(minuteHabit, after)).toBe(true)

    const linked = applyTrackedToCompletion(minuteHabit, minuteHabit.trackingLink!, undefined, 90)
    expect(linked?.value).toBe(90)
    expect(linked?.trackedValue).toBe(90)
    expect(applyTaggedTaskCount(minuteHabit, linked!, 1)?.value).toBe(90)
    expect(applyTaggedTaskCount(minuteHabit, linked!, 1)?.taggedTaskCount).toBe(1)
  })
})
