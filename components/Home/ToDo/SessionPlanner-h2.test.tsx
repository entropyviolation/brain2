/** Slice H2 in the popup: floor suggestion, flat list, Just 25, park note, templates. */
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useSessionPlanStore } from "@/lib/session-plan-store"
import { startSession, type SessionPlan } from "@/lib/session-plan"
import type { Subtask, Task } from "@/lib/types"
import { SessionPlanner } from "./SessionPlanner"
import { getTodoPrefs } from "./todo-prefs"

const T0 = new Date("2026-10-16T20:00:00")
const s = (id: string, extra: Partial<Subtask> = {}): Subtask => ({ id, description: id, completed: false, ...extra })

function seed(): Task[] {
  const tasks: Task[] = [
    {
      id: "cds",
      description: "Finish CDs",
      stage: "scheduled",
      createdAt: T0,
      completed: false,
      lists: [],
      subtasks: [s("add spines", { estimatedDuration: 30 }), s("confirm wood", { estimatedDuration: 5 })],
    },
  ]
  useTaskStore.getState().setTasks(tasks)
  return tasks
}
const focused = (): SessionPlan => {
  const { open, focusId } = useSessionPlanStore.getState()
  return open.find((p) => p.id === focusId)!
}

describe("SessionPlanner, slice H2", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    resetAllStores()
  })
  afterEach(() => vi.useRealTimers())

  it("suggests the smallest step for an empty Bare minimum, and adds it on one click", () => {
    const tasks = seed()
    render(<SessionPlanner open onClose={() => {}} periodTasks={tasks} periodLabel="This day" />)
    expect(screen.getByText(/Smallest step that counts/)).toHaveTextContent("Finish CDs › confirm wood")
    expect(focused().tiers.min).toHaveLength(0) // nothing added unasked
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    expect(focused().tiers.min[0]).toMatchObject({ taskId: "cds", stepId: "confirm wood" })
  })

  it("opens the flat list without making a session, then Just 25 makes a timebox", () => {
    const tasks = seed()
    render(<SessionPlanner open startOn="list" onClose={() => {}} periodTasks={tasks} periodLabel="This day" />)
    expect(useSessionPlanStore.getState().open).toHaveLength(0)
    fireEvent.click(screen.getByRole("button", { name: "Just 25 on Finish CDs › add spines" }))
    expect(focused()).toMatchObject({ shape: "timebox", durationMin: 25 })
    expect(focused().tiers.goal[0]).toMatchObject({ stepId: "add spines" })
    expect(screen.getByRole("button", { name: "Start" })).toBeEnabled()
  })

  it("parks with a note to tomorrow-you and shows it first when parked", () => {
    const tasks = seed()
    const draft = useSessionPlanStore.getState()
    render(<SessionPlanner open onClose={() => {}} periodTasks={tasks} periodLabel="This day" />)
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    act(() => {
      draft.put(startSession(focused(), tasks, T0))
    })
    fireEvent.click(screen.getByRole("button", { name: "Park" }))
    fireEvent.change(screen.getByLabelText("Note to tomorrow-you"), { target: { value: "wood first" } })
    fireEvent.click(screen.getByRole("button", { name: "Park now" }))
    expect(focused()).toMatchObject({ phase: "parked", futureNote: { text: "wood first" } })
    expect(screen.getByRole("note")).toHaveTextContent("wood first")
  })

  it("pads the gauge with your pace, and shows raw estimates when off", () => {
    // Three finished steps that ran 2× their estimates: your pace is ×2.
    const done = (id: string) => s(id, { completed: true, estimatedDuration: 10, actualDuration: 20 })
    const tasks: Task[] = [
      { id: "cds", description: "Finish CDs", stage: "scheduled", createdAt: T0, completed: false, lists: [], subtasks: [done("a"), done("b"), done("c"), s("open", { estimatedDuration: 30 })] },
    ]
    useTaskStore.getState().setTasks(tasks)
    render(<SessionPlanner open onClose={() => {}} periodTasks={tasks} periodLabel="This day" />)
    fireEvent.click(screen.getByRole("button", { name: "Add" })) // the 30m step into Bare minimum (of 180m)
    const toggle = screen.getByRole("checkbox", { name: /Padded for you/ })
    expect(toggle).toBeChecked()
    expect(screen.getByText("padded for you ×2.0")).toBeInTheDocument()
    expect(screen.getAllByText(/With Hofstadter ×2: 67% of the time/)).not.toHaveLength(0) // 30 × 2 × 2 ÷ 180
    fireEvent.click(toggle)
    expect(getTodoPrefs().sessionPadded).toBe(false)
    expect(screen.getByText("raw estimates")).toBeInTheDocument()
    expect(screen.queryByText("padded for you ×2.0")).toBeNull()
    expect(screen.getAllByText(/With Hofstadter ×2: 33% of the time/)).not.toHaveLength(0) // 30 × 2 ÷ 180
  })

  it("saves the draft as a template", () => {
    const tasks = seed()
    render(<SessionPlanner open onClose={() => {}} periodTasks={tasks} periodLabel="This day" />)
    fireEvent.click(screen.getByRole("button", { name: "Save as template" }))
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Evening CDs" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(useSessionPlanStore.getState().templates.map((t) => t.title)).toEqual(["Evening CDs"])
    expect(screen.getByRole("option", { name: "Evening CDs" })).toBeInTheDocument()
  })
})
