import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { addPenColorNowObjective } from "@/lib/pen-color-session"
import { startTaskClock } from "@/lib/task-clock"
import type { Task } from "@/lib/types"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import FocusBar from "./FocusBar"
import { useTaskClockStarter } from "./TaskClockStarter"

function seed(extra: Partial<Task> = {}) {
  useTaskStore.getState().setTasks([
    {
      id: "cds",
      description: "Finish CDs",
      stage: "scheduled",
      createdAt: new Date(),
      completed: false,
      lists: [],
      subtasks: [{ id: "spines", description: "add spines", completed: false, estimatedDuration: 15 }],
      ...extra,
    },
  ])
}

const task = () => useTaskStore.getState().tasks.find((t) => t.id === "cds")!

function StarterHarness() {
  const { start, picker } = useTaskClockStarter()
  return (
    <>
      <button type="button" onClick={() => start("cds", "spines")}>
        go
      </button>
      {picker}
    </>
  )
}

describe("task clock UI", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("asks for a pen once, remembers it, and starts the clock on the step", () => {
    seed()
    render(<StarterHarness />)
    fireEvent.click(screen.getByRole("button", { name: "go" }))
    expect(screen.getByRole("dialog", { name: "Pen for Finish CDs" })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Search pens"), { target: { value: "exercise" } })
    fireEvent.click(screen.getByRole("button", { name: /Exercise/ }))
    expect(usePenColorSessionStore.getState().session).toMatchObject({ taskId: "cds", stepId: "spines", penId: "act-exercise" })
    expect(task().penLinks?.[0].penId).toBe("act-exercise")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("stacks over an open dialog: Escape and Cancel close only the picker", () => {
    seed()
    let outerOpen = true
    render(
      <Dialog open onOpenChange={(open) => (outerOpen = open)}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Session</DialogTitle>
          <StarterHarness />
        </DialogContent>
      </Dialog>,
    )
    fireEvent.click(screen.getByRole("button", { name: "go" }))
    const picker = screen.getByRole("dialog", { name: "Pen for Finish CDs" })
    expect(picker).toContainElement(document.activeElement as HTMLElement) // focus moved into the picker
    fireEvent.keyDown(picker, { key: "Escape" })
    expect(screen.queryByRole("dialog", { name: "Pen for Finish CDs" })).toBeNull()
    expect(outerOpen).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "go" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog", { name: "Pen for Finish CDs" })).toBeNull()
    expect(outerOpen).toBe(true)
  })

  it("the focus bar shows Task › step and the estimate, and Stop asks about free objectives", () => {
    seed({ penLinks: [{ scopeId: "activity", penId: "act-exercise" }] })
    act(() => {
      startTaskClock("cds", { stepId: "spines" })
      addPenColorNowObjective("call the printer")
    })
    render(<FocusBar />)
    expect(screen.getByText("Finish CDs › add spines")).toBeInTheDocument()
    expect(screen.getByText("15m est")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Stop the clock on Finish CDs › add spines" }))
    fireEvent.click(screen.getByRole("button", { name: "No" }))
    expect(screen.getByText("1 objective isn't a step yet.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Keep as steps" }))
    expect(task().subtasks!.map((s) => s.description)).toContain("call the printer")
    expect(screen.getByRole("dialog", { name: "End of sitting" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    expect(usePenColorSessionStore.getState().session).toBeNull()
  })

  it("Stop shows the end-of-sitting strip, and Keep saves the step's context", () => {
    seed({ penLinks: [{ scopeId: "activity", penId: "act-exercise" }] })
    act(() => {
      startTaskClock("cds", { stepId: "spines" })
    })
    render(<FocusBar />)
    fireEvent.click(screen.getByRole("button", { name: "Stop the clock on Finish CDs › add spines" }))
    fireEvent.click(screen.getByRole("button", { name: "No" }))
    expect(screen.getByText(/^Sat \d+m\. Left it here:$/)).toBeInTheDocument()
    expect(usePenColorSessionStore.getState().session?.pausedAt).toBeTruthy()
    const field = screen.getByLabelText("Left it here")
    expect(field).toHaveValue("add spines")
    fireEvent.change(field, { target: { value: "spines: disc 4 of 6" } })
    fireEvent.click(screen.getByRole("button", { name: "Keep" }))
    expect(task().subtasks![0].context).toBe("spines: disc 4 of 6")
    expect(usePenColorSessionStore.getState().session).toBeNull()
  })
})
