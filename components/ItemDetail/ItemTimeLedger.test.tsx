import { describe, expect, it, beforeEach, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ItemTimeLedger } from "./ItemTimeLedger"

const added = new Date(2026, 9, 10, 10, 5, 0).toISOString()
const done = new Date(2026, 9, 10, 10, 40, 0).toISOString()

beforeEach(() => {
  useTimeTrackingStore.setState({
    scopes: [
      {
        id: "activity",
        name: "Activity",
        pens: [{ id: "cd", name: "CD design", color: "#336" }],
      },
    ],
    entries: [
      {
        id: "e1",
        date: "2026-10-10",
        scopeId: "activity",
        penId: "cd",
        startMin: 600,
        endMin: 690,
        taskId: "t1",
        nowObjectives: [{ id: "o1", text: "ship it", addedAt: added, completedAt: done, stepId: "cut" }],
      },
    ],
  } as never)
})

const task = {
  id: "t1",
  penLinks: [{ scopeId: "activity", penId: "cd" }],
  estimatedDuration: 120,
  timeLogs: [
    {
      id: "session-log-1",
      date: "2026-10-11",
      durationMinutes: 25,
      notes: "Session · Morning · Tray",
      taskId: "t1",
    },
  ],
  subtasks: [{ id: "cut", description: "Cut the tray", completed: true }],
}

describe("ItemTimeLedger", () => {
  it("shows a tagged block, its objective clocks, and a session log", () => {
    render(<ItemTimeLedger task={task} onPatch={() => {}} />)
    expect(screen.getByText(/tracked/).textContent).toMatch(/1h 55m/)
    expect(screen.getByLabelText("Objective ship it")).toBeInTheDocument()
    expect(screen.getByLabelText("Added time for ship it")).toHaveValue("10:05")
    expect(screen.getByLabelText("Done time for ship it")).toHaveValue("10:40")
    expect(screen.getByText("35m")).toBeInTheDocument()
    expect(screen.getByText("Session")).toBeInTheDocument()
    expect(screen.getByLabelText("Minutes of log session-log-1")).toHaveValue("25")
  })

  it("writes a corrected start back onto the tracking block", () => {
    render(<ItemTimeLedger task={task} onPatch={() => {}} />)
    const start = screen.getByLabelText("Start of the block on 2026-10-10 at 10:00")
    fireEvent.change(start, { target: { value: "11:00" } })
    fireEvent.blur(start)
    expect(useTimeTrackingStore.getState().entries.find((e) => e.id === "e1")?.startMin).toBe(660)
  })

  it("corrects a session log through the draft", () => {
    const onPatch = vi.fn()
    render(<ItemTimeLedger task={task} onPatch={onPatch} />)
    const minutes = screen.getByLabelText("Minutes of log session-log-1")
    fireEvent.change(minutes, { target: { value: "40" } })
    fireEvent.blur(minutes)
    expect(onPatch).toHaveBeenCalledWith({
      timeLogs: [expect.objectContaining({ id: "session-log-1", durationMinutes: 40 })],
    })
  })

  it("keeps a whole-task block out of the step total and says so", () => {
    useTaskStore.setState({
      tasks: [{ id: "t1", description: "Finish CDs", subtasks: [{ id: "cut", description: "Cut the tray" }], timeLogs: [] }],
    } as never)
    render(
      <ItemTimeLedger
        task={{ id: "step-1", description: "Cut the tray", stepOf: { taskId: "t1", stepId: "cut" }, penLinks: task.penLinks }}
        onPatch={() => {}}
      />,
    )
    expect(screen.getByText(/on this step/).textContent).toMatch(/0m/)
    expect(screen.getByText(/names this step/)).toBeInTheDocument()
    expect(screen.getAllByText("Whole task").length).toBeGreaterThan(0)
  })

  it("paints an added block onto this task", () => {
    render(<ItemTimeLedger task={{ ...task, timeLogs: [], subtasks: [] }} onPatch={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Add time" }))
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "9:00" } })
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "10:00" } })
    fireEvent.change(screen.getByLabelText("Objective"), { target: { value: "layout" } })
    fireEvent.click(screen.getByRole("button", { name: "Add this block" }))
    const made = useTimeTrackingStore.getState().entries.find((e) => e.taskId === "t1" && e.startMin === 540 && e.endMin === 600)
    expect(made?.nowObjectives?.[0]?.text).toBe("layout")
    expect(made?.nowObjectives?.[0]?.completedAt).toBeTruthy()
  })
})
