/**
 * CompletionDialog — search through objectives and goals after completing a task;
 * Undo reopens the item as still to-do.
 */
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useGoalsStore } from "@/lib/goals-store"
import { usePointsStore } from "@/lib/points-store"
import type { Goal, Objective, Task } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
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

  it("creates an objective and a goal without leaving the popup", async () => {
    const user = userEvent.setup()
    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText("New objective"), "Write the letter")
    await user.click(screen.getByRole("button", { name: "Add objective" }))
    const created = useGoalsStore.getState().objectives.find((o) => o.title === "Write the letter")
    expect(created).toBeTruthy()
    expect(screen.getByRole("button", { name: /Write the letter/ })).toHaveAttribute("aria-pressed", "true")

    await user.type(screen.getByLabelText("New goal"), "Send one letter")
    await user.click(screen.getByRole("button", { name: "Add goal" }))
    const goal = useGoalsStore.getState().goals.find((g) => g.title === "Send one letter")
    expect(goal?.objectiveIds).toContain(created!.id)
    expect(goal?.type).toBe("count")
    expect(screen.getByRole("button", { name: /Send one letter/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("requires an objective before a new goal can be added", () => {
    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Add goal" })).toBeDisabled()
  })

  it("awards 3 points plus 0.1 per word for the quick review", async () => {
    const user = userEvent.setup()
    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)

    await user.click(screen.getByRole("switch", { name: "Add a quick reflection" }))
    await user.type(screen.getByLabelText("Notes"), "one two three")
    expect(screen.getByTestId("review-points-preview")).toHaveTextContent("3.3")
    expect(screen.getByTestId("review-points-preview")).toHaveTextContent("3 words")

    await user.click(screen.getByRole("button", { name: "Save" }))
    const saved = useTaskStore.getState().tasks.find((t) => t.id === "t1")
    expect(saved?.completionReview?.reviewWordCount).toBe(3)
    expect(saved?.completionReview?.reviewPoints).toBe(3.3)
    expect(saved?.completionReview?.resistance).toBeUndefined()
    const ledger = usePointsStore.getState().pointsHistory.find((entry) => entry.taskId === "review:t1")
    expect(ledger?.points).toBe(3.3)
    expect(ledger?.taskDescription).toMatch(/Quick review/)
  })

  it("stores an unknown length without a number and an estimated start", async () => {
    const user = userEvent.setup()
    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)

    await user.click(screen.getByRole("switch", { name: "Add a quick reflection" }))
    await user.click(screen.getByRole("button", { name: "Unknown duration" }))
    await user.click(screen.getByRole("button", { name: "Estimated start" }))
    await user.type(screen.getByLabelText("Start time"), "09:15")
    await user.click(screen.getByRole("button", { name: "Enjoyment 8" }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    const saved = useTaskStore.getState().tasks.find((t) => t.id === "t1")
    expect(saved?.durationCertainty).toBe("unknown")
    expect(saved?.actualDuration).toBeUndefined()
    expect(saved?.completionReview?.actualDuration).toBeUndefined()
    expect(saved?.completionReview?.durationCertainty).toBe("unknown")
    expect(saved?.startCertainty).toBe("estimated")
    expect(saved?.timeRough).toBe(true)
    expect(saved?.startedAt?.getHours()).toBe(9)
    expect(saved?.startedAt?.getMinutes()).toBe(15)
    expect(saved?.completionReview?.enjoyment).toBe(8)
    expect(saved?.completionReview?.satisfaction).toBeUndefined()
  })

  it("keeps an estimated length out of the exact slot", async () => {
    const user = userEvent.setup()
    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)

    await user.click(screen.getByRole("switch", { name: "Add a quick reflection" }))
    await user.click(screen.getByRole("button", { name: "Estimated duration" }))
    await user.type(screen.getByLabelText("Duration minutes"), "40")
    await user.click(screen.getByRole("button", { name: "Save" }))

    const saved = useTaskStore.getState().tasks.find((t) => t.id === "t1")
    expect(saved?.durationCertainty).toBe("estimated")
    expect(saved?.actualDuration).toBe(40)
    expect(saved?.timeRough).toBe(true)
    expect(saved?.completionReview?.durationCertainty).toBe("estimated")
  })

  it("stores an unknown start with no time", async () => {
    const user = userEvent.setup()
    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)

    await user.click(screen.getByRole("switch", { name: "Add a quick reflection" }))
    await user.click(screen.getByRole("button", { name: "Exact start" }))
    await user.type(screen.getByLabelText("Start time"), "10:05")
    await user.click(screen.getByRole("button", { name: "Unknown start" }))
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Exact start" }))
    expect(screen.getByLabelText("Start time")).toHaveValue("")
    await user.click(screen.getByRole("button", { name: "Unknown start" }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    const cleared = useTaskStore.getState().tasks.find((t) => t.id === "t1")
    expect(cleared?.startCertainty).toBe("unknown")
    expect(cleared?.startedAt).toBeUndefined()
    expect(cleared?.timeRough).toBeUndefined()
    expect(cleared?.completionReview?.startCertainty).toBe("unknown")
    expect(cleared?.completionReview?.startedAt).toBeUndefined()
    expect(cleared?.completionReview?.reviewPoints).toBe(3)
  })

  it("stores a finish on another day and marks it estimated", async () => {
    const user = userEvent.setup()
    const completedDate = new Date(2026, 5, 20, 12, 0, 0, 0)
    useTaskStore.getState().setTasks([
      makeTask({ id: "t1", description: "INVOICE NOWWW", completed: false, stage: "list", completedDate }),
    ])

    render(<CompletionDialog taskId="t1" basePoints={1} pending onClose={vi.fn()} />)
    await user.click(screen.getByRole("switch", { name: "Add a quick reflection" }))
    fireEvent.change(screen.getByLabelText("Done date"), { target: { value: "2026-06-18" } })
    fireEvent.change(screen.getByLabelText("Done time"), { target: { value: "15:40" } })
    await user.click(screen.getByRole("button", { name: "Estimated finish" }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    const saved = useTaskStore.getState().tasks.find((t) => t.id === "t1")
    const finish = new Date(2026, 5, 18, 15, 40, 0, 0)
    expect(saved?.completed).toBe(true)
    expect(saved?.completedDate).toEqual(finish)
    expect(saved?.completedCertainty).toBe("estimated")
    expect(saved?.timeRough).toBe(true)
    expect(saved?.completionReview?.completedAt).toEqual(finish)
    expect(saved?.completionReview?.completedCertainty).toBe("estimated")
    const ledger = usePointsStore.getState().pointsHistory.filter((entry) => entry.taskId === "t1")
    expect(ledger.map((entry) => entry.date)).toEqual(["2026-06-18"])
  })

  it("moves points already awarded onto the new finish day", async () => {
    const user = userEvent.setup()
    const completedDate = new Date(2026, 5, 20, 12, 0, 0, 0)
    useTaskStore.getState().setTasks([makeTask({ id: "t1", description: "INVOICE NOWWW", completedDate })])
    usePointsStore.getState().addPoints("t1", 5, "INVOICE NOWWW", completedDate)

    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)
    await user.click(screen.getByRole("switch", { name: "Add a quick reflection" }))
    fireEvent.change(screen.getByLabelText("Done date"), { target: { value: "2026-06-18" } })
    await user.click(screen.getByRole("button", { name: "Save" }))

    const saved = useTaskStore.getState().tasks.find((t) => t.id === "t1")
    expect(saved?.completedDate).toEqual(new Date(2026, 5, 18, 12, 0, 0, 0))
    expect(saved?.completedCertainty).toBe("exact")
    expect(saved?.timeRough).toBeUndefined()
    const ledger = usePointsStore.getState().pointsHistory.filter((entry) => entry.taskId === "t1")
    expect(ledger.map((entry) => entry.date)).toEqual(["2026-06-18"])
  })

  it("leaves the finish stamp alone until it is marked", async () => {
    const user = userEvent.setup()
    const completedDate = new Date(2026, 5, 20, 12, 0, 0, 0)
    useTaskStore.getState().setTasks([makeTask({ id: "t1", description: "INVOICE NOWWW", completedDate })])

    render(<CompletionDialog taskId="t1" basePoints={1} onClose={vi.fn()} />)
    await user.click(screen.getByRole("switch", { name: "Add a quick reflection" }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    const saved = useTaskStore.getState().tasks.find((t) => t.id === "t1")
    expect(saved?.completedDate).toEqual(completedDate)
    expect(saved?.completedCertainty).toBeUndefined()
    expect(formatLocalDateKey(saved!.completedDate!)).toBe("2026-06-20")
  })
})
