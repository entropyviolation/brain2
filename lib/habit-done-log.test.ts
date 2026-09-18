import { beforeEach, describe, expect, it } from "vitest"
import { TaskType } from "@/lib/types"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { habitDoneLogId } from "@/lib/habit-done-log"
import { formatLocalDateKey } from "@/lib/date-utils"
import { buildDoneTodoItems } from "@/components/Home/ToDo/todo-utils"
import { resetLocalStorage } from "@/tests/test-utils"

describe("habit Done log", () => {
  const day = new Date(2026, 8, 17, 15, 0, 0)

  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
    useHabitsStore.getState().resetData()
    useHabitsStore.setState({
      tasks: [{ id: "h1", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" }],
      weeklyData: {},
    })
  })

  it("adds a Done-today action when a habit first meets its goal", () => {
    useHabitsStore.getState().updateCompletion("h1", day, { completed: true })
    const id = habitDoneLogId("h1", day)
    const logged = useTaskStore.getState().tasks.find((t) => t.id === id)
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
    expect(useTaskStore.getState().tasks.find((t) => t.id === habitDoneLogId("h1", day))).toBeUndefined()
    expect(buildDoneTodoItems(useTaskStore.getState().tasks, "day", day, [])).toHaveLength(0)
  })

  it("keys the log by local calendar day", () => {
    expect(habitDoneLogId("h1", day)).toBe(`habit-done-h1-${formatLocalDateKey(day)}`)
  })
})
