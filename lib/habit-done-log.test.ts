import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { habitDoneLogId } from "@/lib/habit-done-log"
import { formatLocalDateKey } from "@/lib/date-utils"
import { confirmEstimates, isEstimated, findEstimate } from "@/lib/estimated-values"
import { buildDoneTodoItems } from "@/components/Home/ToDo/todo-utils"
import { resetLocalStorage } from "@/tests/test-utils"

const NOW = new Date(2026, 8, 17, 20, 30, 0)

const water: WeeklyTask = { id: "h1", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" }
const writing: WeeklyTask = {
  id: "h2",
  name: "Write at least 3 pages per day",
  type: TaskType.GOAL,
  goal: 3,
  unit: "pages",
  rewardValue: 30,
  frequency: "daily",
  timeEstimate: { minutesPerUnit: 10 },
}

function loggedRow(habitId: string, date: Date) {
  return useTaskStore.getState().tasks.find((t) => t.id === habitDoneLogId(habitId, date))
}

describe("habit Done log", () => {
  const day = NOW

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
    useHabitsStore.getState().resetData()
    useHabitsStore.setState({ tasks: [water, writing], weeklyData: {} })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("adds a Done-today action when a habit first meets its goal", () => {
    useHabitsStore.getState().updateCompletion("h1", day, { completed: true })
    const logged = loggedRow("h1", day)
    expect(logged?.loggedAction).toBe(true)
    expect(logged?.description).toBe("Drink water")
    expect(logged?.completed).toBe(true)
    const done = buildDoneTodoItems(useTaskStore.getState().tasks, "day", day, [])
    expect(done.some((row) => row.description === "Drink water")).toBe(true)
    const weekDone = buildDoneTodoItems(useTaskStore.getState().tasks, "week", day, [])
    expect(weekDone.some((row) => row.description === "Drink water")).toBe(true)
  })

  it("does not duplicate the log on a second write", () => {
    useHabitsStore.getState().updateCompletion("h1", day, { completed: true })
    useHabitsStore.getState().updateCompletion("h1", day, { completed: true })
    expect(useTaskStore.getState().tasks.filter((t) => t.id === habitDoneLogId("h1", day))).toHaveLength(1)
  })

  it("removes the Done log when the habit is unmarked", () => {
    useHabitsStore.getState().updateCompletion("h1", day, { completed: true })
    useHabitsStore.getState().updateCompletion("h1", day, { completed: false })
    expect(loggedRow("h1", day)).toBeUndefined()
    expect(buildDoneTodoItems(useTaskStore.getState().tasks, "day", day, [])).toHaveLength(0)
  })

  it("keys the log by local calendar day", () => {
    expect(habitDoneLogId("h1", day)).toBe(`habit-done-h1-${formatLocalDateKey(day)}`)
  })

  it("stamps the current time on today's completion instead of midday", () => {
    useHabitsStore.getState().updateCompletion("h1", day, { completed: true })
    const logged = loggedRow("h1", day)
    expect(logged?.completedDate).toEqual(NOW)
    expect(isEstimated(logged?.estimates, "completedDate")).toBe(true)
    expect(findEstimate(logged?.estimates, "completedDate")?.kind).toBe("now")
  })

  it("records the assumed duration and start from the habit's per-unit rate", () => {
    useHabitsStore.getState().updateCompletion("h2", day, { value: 4 })
    const logged = loggedRow("h2", day)
    expect(logged?.actualDuration).toBe(40)
    expect(logged?.startedAt).toEqual(new Date(2026, 8, 17, 19, 50))
    expect(findEstimate(logged?.estimates, "actualDuration")?.basis).toBe("4 pages × 10 min each")
    expect(isEstimated(logged?.estimates, "startedAt")).toBe(true)
  })

  it("lifts the duration when more is logged, without moving the finish time", () => {
    useHabitsStore.getState().updateCompletion("h2", day, { value: 4 })
    const finish = loggedRow("h2", day)?.completedDate
    vi.setSystemTime(new Date(2026, 8, 17, 22, 0, 0))
    useHabitsStore.getState().updateCompletion("h2", day, { value: 6 })
    const logged = loggedRow("h2", day)
    expect(logged?.actualDuration).toBe(60)
    expect(logged?.completedDate).toEqual(finish)
    expect(logged?.startedAt).toEqual(new Date(2026, 8, 17, 19, 30))
  })

  it("leaves a confirmed duration alone when the amount changes again", () => {
    useHabitsStore.getState().updateCompletion("h2", day, { value: 4 })
    const logged = loggedRow("h2", day)!
    useTaskStore.getState().updateTask({
      ...logged,
      actualDuration: 55,
      estimates: confirmEstimates(logged.estimates, ["actualDuration"], NOW),
    })
    useHabitsStore.getState().updateCompletion("h2", day, { value: 6 })
    expect(loggedRow("h2", day)?.actualDuration).toBe(55)
  })

  it("anchors a back-filled day at the user's default time of day", () => {
    const earlier = new Date(2026, 8, 15, 9, 0, 0)
    useHabitsStore.getState().updateCompletion("h2", earlier, { value: 3 })
    const logged = loggedRow("h2", earlier)
    expect(logged?.completedDate).toEqual(new Date(2026, 8, 15, 21, 0))
    expect(logged?.startedAt).toEqual(new Date(2026, 8, 15, 20, 30))
    expect(findEstimate(logged?.estimates, "completedDate")?.kind).toBe("anchor")
  })

  it("carries no duration for a habit with no time component", () => {
    useHabitsStore.getState().updateCompletion("h1", day, { completed: true })
    const logged = loggedRow("h1", day)
    expect(logged?.actualDuration).toBeUndefined()
    expect(findEstimate(logged?.estimates, "actualDuration")).toBeUndefined()
  })
})
