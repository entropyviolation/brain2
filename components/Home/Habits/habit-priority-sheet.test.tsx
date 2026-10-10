import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { localDayKey, useReviewsStore } from "@/lib/reviews-store"
import { TaskType } from "@/lib/types"
import { WeeklyTaskTracker } from "./habit-tracker"

describe("Priority sheet", () => {
  beforeEach(() => {
    resetAllStores()
    useHabitsStore.getState().setTasks([
      { id: "a", name: "Alpha", type: TaskType.BOOLEAN, frequency: "daily" },
      { id: "b", name: "Beta", type: TaskType.BOOLEAN, frequency: "daily" },
    ])
    useHabitsStore.setState({
      weeklyData: { "2026-06-20": { a: { completed: true } } },
      habitSortMode: "default",
      habitSortDirection: "asc",
      highlightHabitPriorities: false,
      showStreakMarks: true,
      morningRitualPointMultiplier: 5,
    })
  })

  it("leaves rows uncolored until highlight is on, and marks a ritual habit", async () => {
    const user = userEvent.setup()
    const day = localDayKey(new Date("2026-06-20T12:00:00"))
    useReviewsStore.getState().saveMorningReview(day, { priorityHabitIds: ["a"] })
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    const cell = screen.getByText("Alpha").closest("td")
    expect(cell).not.toHaveClass("is-priority-ritual")
    expect(screen.getByTitle("Morning ritual points")).toHaveTextContent("×5")
    await user.click(screen.getByRole("switch", { name: "Highlight priorities" }))
    expect(screen.getByText("Alpha").closest("td")).toHaveClass("is-priority-ritual")
    await user.click(screen.getByRole("switch", { name: "Highlight priorities" }))
    expect(screen.getByText("Alpha").closest("td")).not.toHaveClass("is-priority-ritual")
  })

  it("saves a new default order and cancel does not", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    const completions = structuredClone(useHabitsStore.getState().weeklyData)
    await user.click(screen.getByRole("button", { name: "Edit default order" }))
    const paint = () => {
      const rows = [...document.querySelectorAll("tr[data-habit-id]")]
      rows.forEach((row, index) => {
        row.getBoundingClientRect = () =>
          ({
            top: index * 40,
            bottom: index * 40 + 40,
            height: 40,
            left: 0,
            right: 200,
            width: 200,
            x: 0,
            y: index * 40,
            toJSON() {
              return {}
            },
          }) as DOMRect
      })
      return rows
    }
    const dragToEnd = () => {
      const rows = paint()
      const first = rows[0] as HTMLElement
      fireEvent.pointerDown(first, { clientY: 10, pointerId: 1, button: 0 })
      fireEvent.pointerUp(first, { clientY: 70, pointerId: 1, button: 0 })
    }
    dragToEnd()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(useHabitsStore.getState().tasks.map((task) => task.id)).toEqual(["a", "b"])
    expect(useHabitsStore.getState().weeklyData).toEqual(completions)

    await user.click(screen.getByRole("button", { name: "Edit default order" }))
    dragToEnd()
    await user.click(screen.getByRole("button", { name: "Save default order" }))
    expect(useHabitsStore.getState().tasks.map((task) => task.id)).toEqual(["b", "a"])
    expect(useHabitsStore.getState().weeklyData).toEqual(completions)
  })
})
