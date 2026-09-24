/**
 * CompletionDialog — search through objectives and goals after completing a task;
 * Undo reopens the item as still to-do.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useGoalsStore } from "@/lib/goals-store"
import { usePointsStore } from "@/lib/points-store"
import type { Goal, Objective, Task } from "@/lib/types"
import { CompletionDialog } from "./CompletionDialog"

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "description">): Task {
  return {
    stage: "completed",
    createdAt: new Date("2026-06-20T12:00:00"),
    completed: true,
    lists: [],
    urgency: 3,
    importance: 3,
    estimatedDuration: 30,
    cognitiveLoad: 1,
    dependencies: [],
    context: "@home",
    entropy: 0.3,
    rewardValue: 5,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    ...overrides,
  }
}

function makeObjective(id: string, title: string, extras: Partial<Objective> = {}): Objective {
  return { id, title, createdAt: new Date("2026-01-01"), priorities: [], reviews: [], ...extras }
}

function makeGoal(id: string, title: string, extras: Partial<Goal> = {}): Goal {
  return {
    id,
    title,
    type: "count",
    target: 10,
    current: 0,
    unit: "times",
    periodKind: "year",
    objectiveIds: ["obj-a"],
    points: 10,
    completed: false,
    createdAt: new Date("2026-01-01"),
    ...extras,
  }
}

describe("CompletionDialog", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.getState().setTasks([makeTask({ id: "t1", description: "INVOICE NOWWW" })])
    useGoalsStore.setState({
      objectives: [
        makeObjective("obj-a", "be a really good communicator"),
        makeObjective("obj-b", "keep house clean"),
        makeObjective("obj-c", "have a lot of charisma"),
      ],
      goals: [
        makeGoal("goal-books", "Read 20 books this year", { target: 20, unit: "books" }),
        makeGoal("goal-pages", "Read 10 pages per day", { target: 10, unit: "pages", periodKind: "day" }),
        makeGoal("goal-surf", "Surf once a week", { target: 1, unit: "sessions", periodKind: "week" }),
      ],
    })
  })

  it("filters objectives as you type in the search field", async () => {
    const user = userEvent.setup()
    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)

    expect(screen.getByText("be a really good communicator")).toBeInTheDocument()
    expect(screen.getByText("keep house clean")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Search objectives"), "charisma")

    expect(screen.getByText("have a lot of charisma")).toBeInTheDocument()
    expect(screen.queryByText("be a really good communicator")).not.toBeInTheDocument()
    expect(screen.queryByText("keep house clean")).not.toBeInTheDocument()
  })

  it("filters goals as you type in the search field", async () => {
    const user = userEvent.setup()
    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)

    expect(screen.getByText("Read 20 books this year")).toBeInTheDocument()
    expect(screen.getByText("Surf once a week")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Search goals"), "surf")

    expect(screen.getByText("Surf once a week")).toBeInTheDocument()
    expect(screen.queryByText("Read 20 books this year")).not.toBeInTheDocument()
    expect(screen.queryByText("Read 10 pages per day")).not.toBeInTheDocument()
  })

  it("keeps a selected objective visible after searching for something else", async () => {
    const user = userEvent.setup()
    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "keep house clean" }))
    await user.type(screen.getByLabelText("Search objectives"), "charisma")

    expect(screen.getByRole("button", { name: /keep house clean/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "have a lot of charisma" })).toBeInTheDocument()
    expect(screen.queryByText("be a really good communicator")).not.toBeInTheDocument()
  })

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup()
    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText("Search objectives"), "zzzz-nope")
    expect(screen.getByText("No matching objectives")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Search goals"), "zzzz-nope")
    expect(screen.getByText("No matching goals")).toBeInTheDocument()
  })

  it("hints the usual duration from similar observed completions", () => {
    useTaskStore.getState().setTasks([
      makeTask({ id: "t1", description: "INVOICE NOWWW" }),
      makeTask({
        id: "past-a",
        description: "INVOICE NOWWW",
        completed: true,
        actualDuration: 20,
      }),
      makeTask({
        id: "past-b",
        description: "INVOICE NOWWW",
        completed: true,
        actualDuration: 40,
      }),
    ])
    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)
    expect(screen.getByText(/Usually takes you ~30 min/)).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.find((t) => t.id === "t1")?.estimatedDuration).toBe(30)
  })

  it("offers Undo alongside Skip and Save", () => {
    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Undo completion" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()
  })

  it("Undo reopens the task, drops that day's points, and closes", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const completedDate = new Date("2026-06-20T12:00:00")
    useTaskStore.getState().setTasks([makeTask({ id: "t1", description: "INVOICE NOWWW", completedDate })])
    usePointsStore.getState().addPoints("t1", 1, "INVOICE NOWWW", completedDate)

    render(<CompletionDialog taskId="t1" basePoints={1} onClose={onClose} />)
    await user.click(screen.getByRole("button", { name: "Undo completion" }))

    const reopened = useTaskStore.getState().tasks.find((t) => t.id === "t1")
    expect(reopened?.completed).toBe(false)
    expect(reopened?.completedDate).toBeUndefined()
    expect(reopened?.status).toBe("active")
    expect(usePointsStore.getState().pointsHistory.filter((e) => e.taskId === "t1")).toHaveLength(0)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("Skip keeps the task completed and the awarded points", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const completedDate = new Date("2026-06-20T12:00:00")
    useTaskStore.getState().setTasks([makeTask({ id: "t1", description: "INVOICE NOWWW", completedDate })])
    usePointsStore.getState().addPoints("t1", 1, "INVOICE NOWWW", completedDate)

    render(<CompletionDialog taskId="t1" basePoints={1} onClose={onClose} />)
    await user.click(screen.getByRole("button", { name: "Skip" }))

    const kept = useTaskStore.getState().tasks.find((t) => t.id === "t1")
    expect(kept?.completed).toBe(true)
    expect(usePointsStore.getState().pointsHistory).toHaveLength(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("Undo from a pending completion leaves the task incomplete", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    useTaskStore.getState().setTasks([makeTask({ id: "t1", description: "INVOICE NOWWW", completed: false, stage: "list" })])

    render(<CompletionDialog taskId="t1" basePoints={1} pending onClose={onClose} />)
    await user.click(screen.getByRole("button", { name: "Undo completion" }))

    const stillOpen = useTaskStore.getState().tasks.find((t) => t.id === "t1")
    expect(stillOpen?.completed).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("Skip from a pending completion applies the completion", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    useTaskStore.getState().setTasks([makeTask({ id: "t1", description: "INVOICE NOWWW", completed: false, stage: "list" })])

    render(<CompletionDialog taskId="t1" basePoints={1} pending onClose={onClose} />)
    await user.click(screen.getByRole("button", { name: "Skip" }))

    const done = useTaskStore.getState().tasks.find((t) => t.id === "t1")
    expect(done?.completed).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
