import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { TaskType } from "@/lib/types"
import { habitDoneLogId } from "@/lib/habit-done-log"
import { PlanGemDayBody } from "./plan-gem-day-body"

const DAY = new Date("2026-06-19T12:00:00")

describe("PlanGemDayBody", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("keeps events as chips and completed work as clickable gems", async () => {
    const user = userEvent.setup()
    const onTaskClick = vi.fn()
    const onEventClick = vi.fn()

    useHabitsStore.getState().setTasks([
      {
        id: "water",
        name: "Drink water",
        type: TaskType.BOOLEAN,
        frequency: "daily",
        gem: "/gems-removebackground/gem5.png",
      },
    ])
    useHabitsStore.getState().setWeeklyData({
      "2026-06-19": { water: { completed: true } },
    })
    useTaskStore.getState().setTasks([
      {
        id: "brief",
        description: "Write brief",
        title: "Write brief",
        stage: "completed",
        createdAt: DAY,
        completed: true,
        completedDate: DAY,
        icon: "/orbs-removebackground/abc.png",
        lists: [],
      },
      {
        id: "still-open",
        description: "Open task",
        title: "Open task",
        stage: "scheduled",
        createdAt: DAY,
        completed: false,
        scheduledDate: DAY,
        lists: [],
      },
    ])

    render(
      <PlanGemDayBody
        date={DAY}
        events={[
          {
            id: "ev-1",
            title: "Standup",
            startTime: "09:00",
            endTime: "09:30",
            date: DAY,
            type: "event",
            isScheduled: true,
            color: "#8cd4a5",
          },
        ]}
        onTaskClick={onTaskClick}
        onEventClick={onEventClick}
      />,
    )

    expect(screen.getByText("Standup")).toBeInTheDocument()
    expect(screen.getByText("Open task")).toBeInTheDocument()
    expect(screen.queryByText("Write brief")).not.toBeInTheDocument()
    expect(screen.queryByText("Drink water")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Drink water" }))
    expect(onTaskClick).toHaveBeenCalledWith(habitDoneLogId("water", DAY))
    expect(onEventClick).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Write brief" }))
    expect(onTaskClick).toHaveBeenCalledWith("brief")

    await user.click(screen.getByRole("button", { name: /Standup/ }))
    expect(onEventClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Drink water" })).toHaveAttribute("data-no95")
  })

  it("renders an empty gem body so past days stay a rectangle", () => {
    const { container } = render(
      <PlanGemDayBody date={DAY} events={[]} onTaskClick={vi.fn()} onEventClick={vi.fn()} />,
    )
    expect(container.querySelector('[data-plan-day-body="gems"]')).toBeTruthy()
    expect(container.querySelector(".plan-gem-day-icons")).toBeNull()
  })
})
