import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { closeTaskCard, openTaskCard } from "@/lib/task-card"
import { resetPointsVisibilityForTests, setPointsVisibility } from "@/lib/points-visibility"
import { undoLastAction } from "@/lib/action-history"
import { useSessionOpenStore } from "@/lib/session-open-store"
import { itemLayers, clearItemLayers } from "@/lib/step-item-stack"
import type { Subtask, Task } from "@/lib/types"
import { TaskCard, type TaskCardHost } from "./TaskCard"

const s = (id: string, extra: Partial<Subtask> = {}): Subtask => ({ id, description: id, completed: false, ...extra })

function host(extra: Partial<TaskCardHost> = {}): TaskCardHost {
  return {
    period: "day",
    periodLabel: "This day",
    focusedDate: new Date(),
    isRequired: () => false,
    isPrioritized: () => false,
    onToggleRequired: vi.fn(),
    onTogglePrioritized: vi.fn(),
    onStepsChange: (taskId, steps) => {
      const t = useTaskStore.getState().tasks.find((x) => x.id === taskId)!
      useTaskStore.getState().updateTask({ ...t, subtasks: steps })
    },
    onJustStart: vi.fn(),
    onNeeds: vi.fn(),
    hoursLeft: 4,
    ...extra,
  }
}

function seed(extra: Partial<Task> = {}) {
  useTaskStore.getState().addTask({
    id: "t1",
    description: "Finish CDs",
    completed: false,
    subtasks: [s("insert", { points: 4 }), s("label"), s("ship")],
    ...extra,
  } as Task)
}

const steps = () => useTaskStore.getState().tasks.find((t) => t.id === "t1")!.subtasks!

describe("TaskCard", () => {
  beforeEach(() => {
    resetAllStores()
    resetPointsVisibilityForTests()
    clearItemLayers()
    closeTaskCard()
  })

  it("opens from the store and links to item detail with ↗ Item", () => {
    seed()
    render(<TaskCard host={host()} />)
    expect(screen.queryByText("Finish CDs")).toBeNull()
    act(() => openTaskCard("t1"))
    expect(screen.getByText("Finish CDs")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "↗ Item" }))
    expect(itemLayers().map((l) => l.taskId)).toEqual(["t1"])
  })

  it("Points visible off: no steps N and no Points column; on: task · steps", () => {
    seed()
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    expect(screen.getByTestId("task-card-points").textContent).not.toContain("steps")
    expect(screen.queryByLabelText("Points for insert")).toBeNull()
    act(() => setPointsVisibility({ stepPoints: true }))
    expect(screen.getByTestId("task-card-points").textContent).toContain("steps 0")
  })

  it("a mass edit is one undo step", () => {
    seed()
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    fireEvent.click(screen.getByRole("button", { name: "Select all open" }))
    fireEvent.click(screen.getByRole("button", { name: "+15" }))
    expect(steps().map((x) => x.estimatedDuration)).toEqual([15, 15, 15])
    act(() => {
      undoLastAction()
    })
    expect(steps().map((x) => x.estimatedDuration)).toEqual([undefined, undefined, undefined])
  })

  it("Session with this seeds a session; quick points override and clear", () => {
    seed()
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    fireEvent.click(screen.getByRole("button", { name: "Session with this" }))
    expect(useSessionOpenStore.getState().request?.seed).toEqual([{ taskId: "t1" }])
    fireEvent.change(screen.getByLabelText("Quick points"), { target: { value: "10" } })
    expect(screen.getByTestId("task-card-points").textContent).toContain("task 10")
    fireEvent.click(screen.getByRole("button", { name: "Back to the rule" }))
    expect(useTaskStore.getState().tasks[0].pointsOverride).toBeUndefined()
  })

  it("shows notice answers and takes a new one when the dot is due", () => {
    seed({ daysPushed: 3 })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    const input = screen.getByLabelText("Notice answer")
    fireEvent.change(input, { target: { value: "too big" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(screen.getByText("too big")).toBeInTheDocument()
    expect(screen.queryByLabelText("Notice answer")).toBeNull()
  })
})
