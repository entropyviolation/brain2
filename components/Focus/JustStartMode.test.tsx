import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Subtask, Task } from "@/lib/types"
import JustStartMode from "./JustStartMode"

const now = new Date("2026-10-15T20:00:00")

function step(id: string, extra: Partial<Subtask> = {}): Subtask {
  return { id, description: id, completed: false, ...extra }
}

function seed(subtasks: Subtask[], extra: Partial<Task> = {}) {
  useTaskStore.getState().setTasks([
    {
      id: "cds",
      description: "Finish CDs",
      stage: "scheduled",
      createdAt: now,
      completed: false,
      lists: [],
      subtasks,
      ...extra,
    },
  ])
}

const task = () => useTaskStore.getState().tasks.find((t) => t.id === "cds")!

describe("JustStartMode", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    resetAllStores()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows the smallest ready leaf with its path, and counts down its estimate", () => {
    seed([
      step("insert", { subtasks: [step("reformat insert", { estimatedDuration: 30 }), step("find photos", { estimatedDuration: 10 })] }),
      step("add spines", { estimatedDuration: 15 }),
    ])
    render(<JustStartMode taskId="cds" onClose={() => {}} />)
    expect(screen.getByRole("heading", { name: "find photos" })).toBeInTheDocument()
    expect(screen.getByText(/Finish CDs/).textContent).toContain("insert")
    expect(screen.getByText("10:00")).toBeInTheDocument()
    expect(screen.getByText(/smallest of 3 ready steps/)).toBeInTheDocument()
  })

  it("Done ticks the step with its minutes, logs the time, and moves on", () => {
    seed([step("a", { estimatedDuration: 5 }), step("b", { estimatedDuration: 10 })])
    render(<JustStartMode taskId="cds" onClose={() => {}} />)
    act(() => {
      vi.advanceTimersByTime(3 * 60_000)
    })
    fireEvent.click(screen.getByRole("button", { name: /Done/ }))
    const a = task().subtasks!.find((s) => s.id === "a")!
    expect(a.completed).toBe(true)
    expect(a.actualDuration).toBe(3)
    expect(task().timeLogs?.[0]).toMatchObject({ durationMinutes: 3, taskId: "cds" })
    expect(screen.getByRole("heading", { name: "b" })).toBeInTheDocument()
  })

  it("Skip shows the next smallest step", () => {
    seed([step("a", { estimatedDuration: 5 }), step("b", { estimatedDuration: 10 })])
    render(<JustStartMode taskId="cds" onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /Skip/ }))
    expect(screen.getByRole("heading", { name: "b" })).toBeInTheDocument()
  })

  it("Blocked by… saves a prerequisite and re-picks", () => {
    seed([step("a", { estimatedDuration: 5 }), step("b", { estimatedDuration: 10 })])
    render(<JustStartMode taskId="cds" onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /Blocked by/ }))
    fireEvent.click(screen.getByRole("checkbox", { name: "b" }))
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(task().subtasks!.find((s) => s.id === "a")!.dependsOn).toEqual(["b"])
    expect(screen.getByRole("heading", { name: "b" })).toBeInTheDocument()
  })

  it("Too big splits the step and starts the smallest part", () => {
    seed([step("reformat insert", { estimatedDuration: 30 })])
    render(<JustStartMode taskId="cds" onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /Too big/ }))
    fireEvent.change(screen.getByLabelText("Part 1"), { target: { value: "open template" } })
    fireEvent.click(screen.getByRole("group", { name: "Estimate for part 1" }).querySelector("button")!)
    fireEvent.click(screen.getByRole("button", { name: "Split" }))
    expect(screen.getByRole("heading", { name: "open template" })).toBeInTheDocument()
  })

  it("asks for estimates when the open steps have none", () => {
    seed([step("bare one")])
    render(<JustStartMode taskId="cds" onClose={() => {}} />)
    expect(screen.getByRole("heading", { name: "Estimate a step to start" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "5m" }))
    expect(screen.getByRole("heading", { name: "bare one" })).toBeInTheDocument()
  })

  it("asks for a first step when there are none", () => {
    seed([])
    render(<JustStartMode taskId="cds" onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText("First step"), { target: { value: "open the folder" } })
    fireEvent.click(screen.getByRole("button", { name: "2m" }))
    fireEvent.click(screen.getByRole("button", { name: /Add/ }))
    expect(screen.getByRole("heading", { name: "open the folder" })).toBeInTheDocument()
  })

  it("starts a chosen step first when given one", () => {
    seed([step("a", { estimatedDuration: 5 }), step("b", { estimatedDuration: 10 })])
    render(<JustStartMode taskId="cds" stepId="b" onClose={() => {}} />)
    expect(screen.getByRole("heading", { name: "b" })).toBeInTheDocument()
  })
})
