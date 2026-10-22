import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useSessionPlanStore } from "@/lib/session-plan-store"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import type { Subtask, Task } from "@/lib/types"
import { SessionPlanner } from "./SessionPlanner"

const T0 = new Date("2026-10-15T20:00:00")

function s(id: string, extra: Partial<Subtask> = {}): Subtask {
  return { id, description: id, completed: false, ...extra }
}

function seed() {
  const tasks: Task[] = [
    {
      id: "cds",
      description: "Finish CDs",
      stage: "scheduled",
      createdAt: T0,
      completed: false,
      lists: [],
      subtasks: [s("add spines", { estimatedDuration: 30 }), s("confirm wood")],
    },
    { id: "inbox", description: "process inbox", stage: "scheduled", createdAt: T0, completed: false, lists: [], estimatedDuration: 20 },
  ]
  useTaskStore.getState().setTasks(tasks)
  return tasks
}

const plan = () => {
  const { open, focusId } = useSessionPlanStore.getState()
  return open.find((p) => p.id === focusId)!
}
const task = (id: string) => useTaskStore.getState().tasks.find((t) => t.id === id)!

describe("SessionPlanner", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    resetAllStores()
  })
  afterEach(() => vi.useRealTimers())

  it("drafts, gauges fit, refuses Start until Bare minimum is estimated, runs and reviews", () => {
    const tasks = seed()
    render(<SessionPlanner open onClose={() => {}} periodTasks={tasks} periodLabel="This day" />)
    expect(plan().phase).toBe("draft")

    // Expand Finish CDs and put "confirm wood" (no estimate) in Bare minimum.
    fireEvent.click(screen.getByRole("button", { name: "Show steps of Finish CDs" }))
    fireEvent.click(within(screen.getByRole("group", { name: "Add confirm wood to" })).getByRole("button", { name: "Min" }))
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled()
    expect(screen.getByText(/Estimate “Finish CDs › confirm wood” first/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Estimate for Finish CDs › confirm wood"), { target: { value: "10" } })
    fireEvent.blur(screen.getByLabelText("Estimate for Finish CDs › confirm wood"))
    expect(task("cds").subtasks![1].estimatedDuration).toBe(10)

    fireEvent.click(within(screen.getByRole("group", { name: "Add process inbox to" })).getByRole("button", { name: "Goal" }))
    fireEvent.click(screen.getByRole("button", { name: "1h" }))
    expect(screen.getByText("10m · 10m of 1h")).toBeInTheDocument()
    expect(screen.getByText("20m · 30m of 1h")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    expect(plan().phase).toBe("run")
    expect(screen.getByText("1:00:00")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "confirm wood" })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(12 * 60_000)
    })
    fireEvent.click(screen.getByRole("button", { name: "Step done" }))
    expect(task("cds").subtasks![1].completed).toBe(true)
    // Bare minimum is done; the current line moves to Goal.
    expect(screen.getByRole("heading", { name: /process inbox|This line is ready to close/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "End" }))
    // Phase 15 A: End shows the end-of-sitting strip first. "process inbox" has no steps, so no "Left it here".
    expect(screen.getByText(/^Sat \d+m\.$/)).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole("dialog", { name: "End of sitting" })).getByRole("button", { name: "Close" }))
    expect(plan().phase).toBe("review")
    expect(screen.getByText(/Bare minimum reached/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Save session" }))

    const store = useSessionPlanStore.getState()
    expect(store.open).toEqual([])
    expect(store.focusId).toBeNull()
    expect(store.history).toHaveLength(1)
    expect(store.history[0]).toMatchObject({ phase: "done", reachedTier: "min" })
    expect(store.kept).toEqual([{ tier: "goal", taskId: "inbox" }])
    expect(usePlannedActionStore.getState().actions.some((a) => a.title === "Session · Session")).toBe(true)
  })

  function startQuick(onClose = () => {}) {
    const tasks = seed()
    const view = render(<SessionPlanner open onClose={onClose} periodTasks={tasks} periodLabel="This day" />)
    fireEvent.click(within(screen.getByRole("group", { name: "Add process inbox to" })).getByRole("button", { name: "Min" }))
    fireEvent.click(screen.getByRole("button", { name: "1h" }))
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    return view
  }

  it("Stop lets go of the line; Next shortest task offers it again and ▶ starts it", () => {
    startQuick()
    act(() => {
      vi.advanceTimersByTime(3 * 60_000)
    })
    fireEvent.click(screen.getByRole("button", { name: "Stop process inbox" }))
    expect(plan().activeLineId).toBeUndefined()
    expect(plan().clock?.running).toBe(true)
    expect(screen.getByRole("heading", { name: "Pick what's next." })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Next shortest task" }))
    expect(screen.getByRole("status")).toHaveTextContent("Try process inbox")
    fireEvent.click(screen.getByRole("button", { name: "▶ Start this" }))
    expect(plan().activeLineId).toBeDefined()
    expect(screen.getByRole("button", { name: "Stop this task" })).toBeInTheDocument()
  })

  it("edits an estimate and the session name while running", () => {
    startQuick()
    fireEvent.click(screen.getAllByRole("button", { name: "Edit estimate for process inbox" })[1])
    const field = screen.getByRole("spinbutton", { name: "Estimate for process inbox in minutes" })
    fireEvent.change(field, { target: { value: "40" } })
    fireEvent.keyDown(field, { key: "Enter" })
    expect(task("inbox").estimatedDuration).toBe(40)
    expect(plan().tiers.min[0].estMin).toBe(40)
    fireEvent.change(screen.getByRole("textbox", { name: "Session name" }), { target: { value: "Morning push" } })
    expect(plan().title).toBe("Morning push")
  })

  it("Park keeps the line and the time left; Resume picks it up", () => {
    startQuick()
    act(() => {
      vi.advanceTimersByTime(10 * 60_000)
    })
    const line = plan().activeLineId
    fireEvent.click(screen.getByRole("button", { name: "Park" }))
    fireEvent.click(screen.getByRole("button", { name: "Park now" })) // the note to tomorrow-you is optional
    expect(plan()).toMatchObject({ phase: "parked", activeLineId: line })
    expect(screen.getByText("50:00")).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(30 * 60_000)
    })
    fireEvent.click(screen.getByRole("button", { name: "Resume" }))
    expect(plan()).toMatchObject({ phase: "run", activeLineId: line })
    expect(screen.getByText("50:00")).toBeInTheDocument()
  })

  it("closing a running session asks Park or Keep running", () => {
    const onClose = vi.fn()
    startQuick(onClose)
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Keep running" }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(plan().phase).toBe("run")
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Park" }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(plan().phase).toBe("parked")
  })

  it("starting a second session parks the first; the shelves show both and Run again", () => {
    startQuick()
    const first = plan().id
    fireEvent.click(screen.getByRole("button", { name: "Sessions" }))
    fireEvent.click(screen.getByRole("button", { name: "New session" }))
    fireEvent.click(within(screen.getByRole("group", { name: "Add process inbox to" })).getByRole("button", { name: "Min" }))
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    const open = useSessionPlanStore.getState().open
    expect(open.find((p) => p.id === first)?.phase).toBe("parked")
    expect(open.filter((p) => p.phase === "run")).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "End" }))
    fireEvent.click(within(screen.getByRole("dialog", { name: "End of sitting" })).getByRole("button", { name: /^(Skip|Close)$/ }))
    fireEvent.click(screen.getByRole("button", { name: "Save session" }))
    expect(useSessionPlanStore.getState().history).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "Sessions" }))
    const parked = screen.getByRole("region", { name: "Parked" })
    expect(within(parked).getAllByRole("listitem")).toHaveLength(1)
    const done = screen.getByRole("region", { name: "Done" })
    fireEvent.click(within(done).getByRole("button", { name: "Run again" }))
    expect(plan()).toMatchObject({ phase: "draft" })
    expect(plan().tiers.min.map((l) => l.taskId)).toEqual(["inbox"])
  })
})
