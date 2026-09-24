/**
 * Inbox — walk, batch list/deadline/merge, clarification (Vitest store only).
 */
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { resetActionHistory } from "@/lib/action-history"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { Inbox } from "./inbox"
import type { Task } from "@/lib/types"
import { INBOX_CLEAR_BONUS, INBOX_HANDLE_POINTS } from "@/lib/inbox-credit"

function inboxTask(id: string, description: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    description,
    stage: "inbox",
    createdAt: new Date(),
    estimatedDuration: 1,
    cognitiveLoad: 1,
    urgency: 3,
    importance: 3,
    dependencies: [],
    context: "@inbox",
    entropy: 0.5,
    rewardValue: 5,
    completed: false,
    lists: [],
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    ...extra,
  }
}

describe("Inbox", () => {
  beforeEach(() => {
    resetLocalStorage()
    resetActionHistory()
    useTaskStore.getState().clearAllData()
    usePointsStore.setState({ pointsHistory: [] })
    useTaskStore.getState().addTask(inboxTask("inbox-1", "Untitled idea"))
    useTaskStore.getState().setLists([
      {
        id: "list-work",
        name: "Work",
        color: "#3366ff",
        description: "",
        createdAt: new Date(),
      },
    ])
  })

  it("shows inbox count badge on the trigger", () => {
    render(<Inbox onTaskSelect={vi.fn()} />)
    expect(screen.getByRole("button", { name: /Inbox/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Inbox/i })).toHaveAttribute("title", "1 to revisit")
    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it("lists the newest inbox idea first", async () => {
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask(inboxTask("old", "Older idea", { createdAt: new Date("2020-01-01T00:00:00Z") }))
    useTaskStore.getState().addTask(inboxTask("new", "Newer idea", { createdAt: new Date("2026-09-23T12:00:00Z") }))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    const labels = screen.getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"))
    expect(labels).toEqual(["Select Newer idea", "Select Older idea"])
  })

  it("lists inbox tasks in the dialog and has no bulk Clarify All", async () => {
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    expect(screen.getByText("Untitled idea")).toBeInTheDocument()
    expect(screen.getByText(/Inbox — Clarify Your Ideas/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^W Walk$/i })).toBeEnabled()
    expect(screen.queryByRole("button", { name: /Clarify All Ideas/i })).not.toBeInTheDocument()
  })

  it("deletes an inbox task from the store", async () => {
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByTitle("Delete this idea"))
    await user.click(screen.getByRole("button", { name: /Yes, delete 1/i }))
    expect(useTaskStore.getState().tasks).toHaveLength(0)
    const points = usePointsStore.getState().pointsHistory.map((row) => row.points)
    expect(points).toContain(INBOX_HANDLE_POINTS)
    expect(points).toContain(INBOX_CLEAR_BONUS)
  })

  it("walks only the selected ideas", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Second idea"))
    useTaskStore.getState().addTask(inboxTask("inbox-3", "Third idea"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Second idea/i }))
    await user.click(screen.getByRole("button", { name: /Walk selected/i }))
    expect(screen.getByText(/1 of 2/)).toBeInTheDocument()
    expect(screen.getByLabelText("Idea name")).toHaveValue("Second idea")
    await user.click(screen.getByRole("button", { name: /^Skip$/i }))
    expect(screen.getByText(/2 of 2/)).toBeInTheDocument()
    expect(screen.getByLabelText("Idea name")).toHaveValue("Untitled idea")
    expect(useTaskStore.getState().tasks.filter((t) => t.stage === "inbox")).toHaveLength(3)
  })

  it("discards the current idea during the walk and credits a point", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Second idea"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("button", { name: /Walk selected/i }))
    await user.click(screen.getByRole("button", { name: /Discard idea/i }))
    expect(useTaskStore.getState().tasks.map((t) => t.id)).toEqual(["inbox-2"])
    expect(usePointsStore.getState().pointsHistory.some((row) => row.points === INBOX_HANDLE_POINTS)).toBe(true)
  })

  it("renames the idea during the walk", async () => {
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("button", { name: /Walk selected/i }))
    const name = screen.getByLabelText("Idea name")
    await user.clear(name)
    await user.type(name, "Renamed capture")
    await user.click(screen.getByRole("button", { name: /Save & next/i }))
    expect(useTaskStore.getState().tasks[0]?.title).toBe("Renamed capture")
  })

  it("applies a list to the multi-selection without leaving inbox", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Second idea"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Second idea/i }))
    await user.click(screen.getByRole("button", { name: "L Apply list" }))
    await user.click(screen.getByText("Work"))
    await user.click(screen.getByRole("button", { name: /^Apply$/i }))
    const tasks = useTaskStore.getState().tasks
    expect(tasks.every((t) => t.lists?.includes("list-work"))).toBe(true)
    expect(tasks.every((t) => t.stage === "inbox")).toBe(true)
  })

  it("apply and clarify files the selection onto the chosen lists and out of inbox", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Second idea"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Second idea/i }))
    await user.click(screen.getByRole("button", { name: "L Apply list" }))
    await user.click(screen.getByText("Work"))
    await user.click(screen.getByRole("button", { name: /Apply and clarify/i }))
    const tasks = useTaskStore.getState().tasks
    expect(tasks.every((t) => t.lists?.includes("list-work"))).toBe(true)
    expect(tasks.every((t) => t.stage === "clarified")).toBe(true)
    expect(screen.queryByText("Untitled idea")).not.toBeInTheDocument()
    expect(usePointsStore.getState().pointsHistory.filter((row) => row.points === INBOX_HANDLE_POINTS)).toHaveLength(2)
  })

  it("applies a deadline to the focused row", async () => {
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("button", { name: /^D Due$/i }))
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: "2026-09-21" } })
    await user.click(screen.getByRole("button", { name: /^Apply$/i }))
    const due = useTaskStore.getState().tasks[0]?.deadline
    expect(due).toBeInstanceOf(Date)
    expect((due as Date).getFullYear()).toBe(2026)
    expect((due as Date).getMonth()).toBe(8)
    expect((due as Date).getDate()).toBe(21)
  })

  it("merges selected ideas after confirm and undoes via the banner", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Second idea"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Second idea/i }))
    await user.click(screen.getByRole("button", { name: "M Merge" }))
    expect(screen.getByText(/Merge 2 items/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Continue/i }))
    await user.click(screen.getByRole("button", { name: /^Merge$/i }))
    expect(useTaskStore.getState().tasks).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: /^Undo$/i }))
    expect(useTaskStore.getState().tasks).toHaveLength(2)
  })

  it("toggles selection with x and starts the walk with w", async () => {
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.keyboard("x")
    expect(screen.getByText(/1 selected/)).toBeInTheDocument()
    await user.keyboard("w")
    expect(screen.getByText(/1 of 1/)).toBeInTheDocument()
    expect(screen.getByLabelText("Idea name")).toHaveValue("Untitled idea")
  })

  it("selects all and deselects all from the toolbar", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Second idea"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    expect(screen.queryByRole("button", { name: /Deselect/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Select all/i }))
    expect(screen.getByText(/2 selected/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Select all/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Deselect/i }))
    expect(screen.queryByText(/\d+ selected/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^W Walk$/i })).toBeEnabled()
  })

  it("asks before deleting the selection and credits points after confirm", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Second idea"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("button", { name: /# Delete/i }))
    expect(screen.getByRole("heading", { name: /Are you sure/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }))
    expect(useTaskStore.getState().tasks).toHaveLength(2)
    await user.click(screen.getByRole("button", { name: /# Delete/i }))
    await user.click(screen.getByRole("button", { name: /Yes, delete 1/i }))
    expect(useTaskStore.getState().tasks.map((t) => t.id)).toEqual(["inbox-2"])
    expect(usePointsStore.getState().pointsHistory.filter((row) => row.points === INBOX_HANDLE_POINTS)).toHaveLength(1)
    expect(usePointsStore.getState().pointsHistory.some((row) => row.points === INBOX_CLEAR_BONUS)).toBe(false)
  })

  it("outlines selected rows in the inbox list, never orange", async () => {
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    const row = document.querySelector('[data-inbox-row="inbox-1"]')
    expect(row).toHaveClass("inbox-row")
    expect(row).toHaveAttribute("data-selected", "true")
    expect(row?.className).not.toMatch(/orange|amber/i)
  })

  it("marks a selection clarified onto its lists, or the list stage when none", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Listed idea", { lists: ["list-work"] }))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("button", { name: /Select all/i }))
    await user.click(screen.getByRole("button", { name: /File/i }))
    const tasks = useTaskStore.getState().tasks
    const bare = tasks.find((t) => t.id === "inbox-1")
    const listed = tasks.find((t) => t.id === "inbox-2")
    expect(bare?.stage).toBe("list")
    expect(listed?.stage).toBe("clarified")
    expect(listed?.lists).toEqual(["list-work"])
    expect(screen.getByText(/Nothing waiting to revisit/)).toBeInTheDocument()
  })

  it("keeps monkey brain off the revisit pile and can send it back", async () => {
    useTaskStore.getState().addTask(inboxTask("mb-1", "looping thought", { monkeyBrain: true }))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    expect(screen.getByRole("button", { name: /Inbox/i })).toHaveAttribute("title", "1 to revisit · 1 in monkey brain")
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    expect(screen.queryByText("looping thought")).not.toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: /Monkey brain/i }))
    expect(screen.getByText("looping thought")).toBeInTheDocument()
    expect(screen.queryByText("Untitled idea")).not.toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: /Select looping thought/i }))
    await user.click(screen.getByRole("button", { name: /To inbox/i }))
    await user.click(screen.getByRole("tab", { name: /^Inbox/i }))
    expect(screen.getByText("looping thought")).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.find((t) => t.id === "mb-1")?.monkeyBrain).toBeUndefined()
  })

  it("opens the selection in bulk edit and can file the rewritten lines", async () => {
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("button", { name: /Bulk edit/i }))
    const area = screen.getByLabelText("Tasks and Lists")
    expect(area).toHaveValue("Untitled idea")
    await user.clear(area)
    await user.type(area, "Rewritten idea")
    await user.click(screen.getByLabelText(/Send to Inbox/i))
    await user.click(screen.getByRole("button", { name: /Add Tasks/i }))
    const tasks = useTaskStore.getState().tasks
    expect(tasks.some((t) => t.id === "inbox-1")).toBe(false)
    const next = tasks.find((t) => t.description === "Rewritten idea" || t.title === "Rewritten idea")
    expect(next?.stage).not.toBe("inbox")
  })

  it("selects a random count, or the whole pile when the number is larger", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Second idea"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("button", { name: /Select N/i }))
    await user.type(screen.getByLabelText(/How many ideas/i), "1")
    await user.click(screen.getByRole("button", { name: /^Select$/i }))
    expect(screen.getByText(/1 selected/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Select N/i }))
    await user.type(screen.getByLabelText(/How many ideas/i), "9")
    await user.click(screen.getByRole("button", { name: /^Select$/i }))
    expect(screen.getByText(/2 selected/)).toBeInTheDocument()
  })

  it("selects ideas that are only a name", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Listed idea", { lists: ["list-work"] }))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("button", { name: /Select unsorted/i }))
    expect(screen.getByRole("checkbox", { name: /Select Untitled idea/i })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Select Listed idea/i })).not.toBeChecked()
  })

  it("puts a trailing parenthetical on a quieter line", async () => {
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask(inboxTask("inbox-1", "Plan something else (Give yourself intense assignments)"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    expect(screen.getByText("Plan something else")).toBeInTheDocument()
    expect(screen.getByText("Give yourself intense assignments")).toBeInTheDocument()
  })
})
