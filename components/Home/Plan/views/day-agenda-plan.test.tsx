import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { persistKey } from "@/lib/storage-keys"
import { resetPlanDrag } from "@/lib/plan-drag"
import { useHabitsStore } from "@/lib/habits-store"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { useTaskStore } from "@/lib/task-store"
import { TaskType } from "@/lib/types"
import { DayView } from "./day-view"

vi.mock("@/lib/weather-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/weather-client")>()
  return { ...actual, fetchDayClimate: vi.fn().mockResolvedValue(null) }
})

describe("Day agenda planning", () => {
  const currentDate = new Date(2026, 8, 21, 12)

  beforeEach(() => {
    resetAllStores()
    resetPlanDrag()
  })

  it("habit drop creates a planned placement with notes and time, not an event", async () => {
    const user = userEvent.setup()
    useHabitsStore.getState().setTasks([
      { id: "habit-walk", name: "Walk", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
    ])
    useTaskStore.getState().setTasks([
      {
        id: "rail-todo",
        description: "Call dentist",
        stage: "clarified",
        createdAt: currentDate,
        completed: false,
        scheduledDate: currentDate,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@home",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])

    const { unmount } = render(
      <DayView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )

    const habitRow = screen.getByText("Walk").closest(".plan-rail-item")!
    const todoRow = screen.getByText("Call dentist").closest(".plan-rail-item")!
    const slot = document.querySelectorAll(".agenda-slot")[9]
    const bag: Record<string, string> = {}
    const dt = {
      setData: (type: string, value: string) => {
        bag[type] = value
      },
      getData: (type: string) => bag[type] ?? "",
      effectAllowed: "move",
      dropEffect: "move",
    }

    fireEvent.dragStart(habitRow, { dataTransfer: dt })
    fireEvent.drop(slot, { dataTransfer: dt })

    const habit = usePlannedActionStore.getState().actions.find((row) => row.source === "habit")
    expect(habit).toMatchObject({
      source: "habit",
      sourceId: "habit-walk",
      date: formatLocalDateKey(currentDate),
      startTime: "09:00",
      title: "Walk",
    })
    expect(habit).not.toHaveProperty("type", "event")

    await user.clear(screen.getByLabelText("Notes"))
    await user.type(screen.getByLabelText("Notes"), "around the block")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(usePlannedActionStore.getState().actions[0].notes).toBe("around the block")

    const todoBag: Record<string, string> = {}
    const todoDt = {
      setData: (type: string, value: string) => {
        todoBag[type] = value
      },
      getData: (type: string) => todoBag[type] ?? "",
      effectAllowed: "move",
      dropEffect: "move",
    }
    fireEvent.dragStart(todoRow, { dataTransfer: todoDt })
    delete todoBag.taskId
    fireEvent.drop(document.querySelectorAll(".agenda-slot")[10], { dataTransfer: todoDt })

    const todo = usePlannedActionStore.getState().actions.find((row) => row.source === "todo")
    expect(todo?.sourceId).toBe("rail-todo")
    expect(useTaskStore.getState().tasks.find((t) => t.id === "rail-todo")?.scheduledTime).toBe("10:00")

    await Promise.resolve()
    const raw = localStorage.getItem(persistKey("planned-actions")) ?? localStorage.getItem("cogs-planned-actions")
    unmount()
    usePlannedActionStore.setState({ actions: [] })
    if (raw) {
      localStorage.setItem(persistKey("planned-actions"), raw)
      localStorage.setItem("cogs-planned-actions", raw)
    }
    await usePlannedActionStore.persist.rehydrate()
    const restored = usePlannedActionStore.getState().actions
    expect(restored.some((row) => row.source === "habit" && row.notes === "around the block")).toBe(true)
    expect(restored.some((row) => row.source === "todo" && row.sourceId === "rail-todo")).toBe(true)
    expect(localStorage.getItem(persistKey("planned-actions"))).toBeTruthy()
  })

  it("agenda column is not a postage-stamp max-height when the rail has many items", () => {
    useTaskStore.getState().setFolders([
      { id: "folder-next-actions", name: "Next Actions", createdAt: currentDate, listIds: ["na"] },
    ])
    useTaskStore.getState().setTasks(
      Array.from({ length: 36 }, (_, i) => ({
        id: `na-${i}`,
        description: `Next action ${i + 1}`,
        stage: "list" as const,
        type: "task",
        createdAt: currentDate,
        completed: false,
        lists: ["na"],
        urgency: 3,
        importance: 3,
        estimatedDuration: 15,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@tour",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      })),
    )

    render(
      <div className="plan95">
        <DayView
          currentDate={currentDate}
          setCurrentDate={vi.fn()}
          events={[]}
          setEvents={vi.fn()}
          onTaskClick={vi.fn()}
          onEventClick={vi.fn()}
          onCreateEvent={vi.fn()}
        />
      </div>,
    )

    expect(screen.getByRole("button", { name: "Next actions (36)" })).toBeInTheDocument()
    expect(document.querySelector(".plan-split-day")).toBeTruthy()
    expect(document.querySelector(".plan-schedule-well")).toBeTruthy()
    const schedule = document.querySelector(".plan-group-schedule")
    expect(schedule).toHaveAttribute("data-plan-agenda-fill", "column")
    const agenda = document.querySelector(".plan-desktop-day .plan-group-schedule .agenda95") as HTMLElement | null
    expect(agenda).toBeTruthy()
    const styles = getComputedStyle(agenda!)
    expect(styles.maxHeight === "none" || styles.maxHeight === "").toBe(true)
    expect(styles.minHeight === "22rem" || Number.parseFloat(styles.minHeight) >= 352).toBe(true)
  })
})
