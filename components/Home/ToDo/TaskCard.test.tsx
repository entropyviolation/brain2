import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { closeTaskCard, openTaskCard } from "@/lib/task-card"
import { resetPointsVisibilityForTests, setPointsVisibility } from "@/lib/points-visibility"
import { undoLastAction } from "@/lib/action-history"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
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
    expect(screen.getAllByText("Finish CDs").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("button", { name: "↗ Item" }))
    expect(itemLayers().map((l) => l.taskId)).toEqual(["t1"])
  })

  it("the Spent card lists the tagged blocks and edits their clock span", () => {
    seed()
    useTimeTrackingStore.setState({
      entries: [{ id: "e1", date: "2026-10-20", scopeId: "s", penId: "p", startMin: 540, endMin: 570, taskId: "t1", stepId: "insert" }],
    } as never)
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    fireEvent.click(document.querySelector('[data-stat="spent"]')!)
    expect(screen.getByRole("list", { name: "Blocks of time spent" })).toBeTruthy()
    const end = screen.getByLabelText("End of the block on 2026-10-20") as HTMLInputElement
    expect(end.value).toBe("9:30")
    fireEvent.change(end, { target: { value: "10:00" } })
    fireEvent.keyDown(end, { key: "Enter" })
    const e = useTimeTrackingStore.getState().entries.find((x) => x.id === "e1")!
    expect([e.startMin, e.endMin]).toEqual([540, 600])
  })

  it("the Progress card opens the completion math: ρ and σ over the top-level parts; Esc closes it", () => {
    seed()
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    fireEvent.click(document.querySelector('[data-stat="progress"]')!)
    const fig = screen.getByRole("figure", { name: "Completion math" })
    expect(fig.textContent).toContain("n = 3")
    expect(fig.textContent).toContain("L = 3")
    expect(fig.textContent).toContain("by ends")
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
    fireEvent.click(screen.getByRole("button", { name: "More…" }))
    fireEvent.click(screen.getByRole("button", { name: "+15" }))
    expect(steps().map((x) => x.estimatedDuration)).toEqual([15, 15, 15])
    act(() => {
      undoLastAction()
    })
    expect(steps().map((x) => x.estimatedDuration)).toEqual([undefined, undefined, undefined])
  })

  it("Session with this seeds a session; the points dial sets and returns to the rule", () => {
    seed()
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    fireEvent.click(screen.getByRole("button", { name: "Session with this" }))
    expect(useSessionOpenStore.getState().request?.seed).toEqual([{ taskId: "t1" }])
    fireEvent.change(screen.getByLabelText("On done"), { target: { value: "10" } })
    expect(screen.getByTestId("task-card-points").querySelector("[aria-label]")?.getAttribute("aria-label")).toContain("10")
    fireEvent.click(screen.getByRole("button", { name: /Back to the rule/ }))
    expect(useTaskStore.getState().tasks[0].pointsOverride).toBeUndefined()
  })

  it("shows notice answers and takes a new one when the dot is due", () => {
    seed({ daysPushed: 3 })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    const input = screen.getByLabelText("Note")
    fireEvent.change(input, { target: { value: "too big" } })
    fireEvent.keyDown(input, { key: "Enter", metaKey: true })
    expect(screen.getByText("too big")).toBeInTheDocument()
    // The log stays open for more notes.
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "start smaller" } })
    fireEvent.click(screen.getByRole("button", { name: "Log note" }))
    expect(screen.getByText("start smaller")).toBeInTheDocument()
    // The log folds.
    fireEvent.click(screen.getByRole("button", { name: /Notes/ }))
    expect(screen.queryByLabelText("Note")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Notes/ }))
  })

  it("shows only needs in use, and adds one by kind", () => {
    seed()
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1"))
    expect(screen.queryByText("Resources")).toBeNull()
    expect(screen.getByText("Needs nothing yet.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Add need/ }))
    fireEvent.click(screen.getByRole("button", { name: "Resource" }))
    const input = screen.getByLabelText("Search items and lists…")
    fireEvent.change(input, { target: { value: "Drill" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(screen.getByText("Resources")).toBeInTheDocument()
    expect(screen.getByText("Drill")).toBeInTheDocument()
  })

  it("toggles completion for a selected step and its nested substeps in the right control panel", () => {
    seed({
      subtasks: [
        s("insert", {
          points: 4,
          subtasks: [s("fold booklet"), s("slip into tray")],
        }),
        s("label"),
      ],
    })
    render(<TaskCard host={host()} />)
    act(() => openTaskCard("t1", "insert"))

    const side = document.querySelector("aside.task-card-side") as HTMLElement
    expect(side).toBeTruthy()

    const stepCheckbox = within(side).getByRole("checkbox", { name: "Complete insert" }) as HTMLInputElement
    expect(stepCheckbox.checked).toBe(false)
    expect(within(side).getByText("Mark complete")).toBeInTheDocument()

    fireEvent.click(stepCheckbox)
    expect(steps().find((x) => x.id === "insert")!.completed).toBe(true)
    expect(stepCheckbox.checked).toBe(true)
    expect(within(side).getByText("Completed")).toBeInTheDocument()

    fireEvent.click(stepCheckbox)
    expect(steps().find((x) => x.id === "insert")!.completed).toBe(false)
    expect(stepCheckbox.checked).toBe(false)

    // Substeps inside SubstepPreview ("Inside") also render completion checkboxes
    const insideSection = within(side).getByRole("region", { name: "Steps inside" })
    const kidCheckbox = within(insideSection).getByRole("checkbox", { name: "Complete fold booklet" }) as HTMLInputElement
    expect(kidCheckbox.checked).toBe(false)

    fireEvent.click(kidCheckbox)
    expect(steps().find((x) => x.id === "insert")!.subtasks!.find((k) => k.id === "fold booklet")!.completed).toBe(true)
    expect(kidCheckbox.checked).toBe(true)

    fireEvent.click(kidCheckbox)
    expect(steps().find((x) => x.id === "insert")!.subtasks!.find((k) => k.id === "fold booklet")!.completed).toBe(false)
    expect(kidCheckbox.checked).toBe(false)
  })
})
