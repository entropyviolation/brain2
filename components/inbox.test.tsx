/**
 * Inbox — walk, batch list/deadline/merge, clarification (Vitest store only).
 */
import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { resetActionHistory } from "@/lib/action-history"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { usePointsStore } from "@/lib/points-store"
import { Inbox } from "./inbox"
import type { Folder, Task } from "@/lib/types"
import { INBOX_CLEAR_BONUS, INBOX_HANDLE_POINTS } from "@/lib/inbox-credit"
import { lineCaptureOrigin, telegramCaptureOrigin } from "@/lib/capture-origin"
import { inboxSubmissionTime } from "@/lib/inbox-transfer-log"
import { folderAllItemsCategoryId, getTasksForFolderAllView } from "@/lib/folder-all-items"
import { flushInboxLogTransfers, resetInboxLogTransferQueue } from "@/lib/inbox-transfer-queue"

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
    resetInboxLogTransferQueue()
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

  it("applies a folder All Items row and keeps the lists the idea already had", async () => {
    const cleaning: Folder = {
      id: "clean",
      name: "Cleaning",
      createdAt: new Date(),
      listIds: ["list-work"],
      color: "#64748b",
    }
    useTaskStore.getState().setFolders([
      cleaning,
      { id: "pantry", name: "Pantry", createdAt: new Date(), listIds: [], color: "#888888" },
    ])
    useTaskStore.getState().updateTask({
      ...useTaskStore.getState().tasks[0],
      lists: ["list-work"],
    })
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("button", { name: "L Apply list" }))
    const search = screen.getByRole("textbox", { name: "Search lists" })
    await user.type(search, "cleaning: all")
    const row = screen.getByRole("checkbox", { name: "Add to Cleaning > All" }).closest("label")
    expect(row).toHaveClass("list-picker-folder-all")
    expect(screen.queryByRole("checkbox", { name: "Add to All" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: "Add to Cleaning > All" }))
    await user.click(screen.getByRole("button", { name: /^Apply$/i }))
    const task = useTaskStore.getState().tasks.find((item) => item.id === "inbox-1")
    const allId = folderAllItemsCategoryId("clean")
    expect(task?.lists).toEqual(["list-work", allId])
    expect(task?.stage).toBe("inbox")
    expect(getTasksForFolderAllView([task!], cleaning).map((item) => item.id)).toEqual(["inbox-1"])
    expect(useTaskStore.getState().lists.some((item) => item.id === allId)).toBe(true)
    expect(useTaskStore.getState().folders.find((item) => item.id === "clean")?.listIds).toContain(allId)
  })

  it("resolves all cleaning the same way and does not attach an ambiguous folder", async () => {
    useTaskStore.getState().setFolders([
      { id: "east", name: "Cleaning East", createdAt: new Date(), listIds: [], color: "#64748b" },
      { id: "west", name: "Cleaning West", createdAt: new Date(), listIds: [], color: "#888888" },
    ])
    useTaskStore.getState().updateTask({
      ...useTaskStore.getState().tasks[0],
      lists: ["list-work"],
    })
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("button", { name: "L Apply list" }))
    await user.type(screen.getByRole("textbox", { name: "Search lists" }), "all cleaning")
    expect(screen.getByRole("checkbox", { name: "Add to Cleaning East > All" })).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Add to Cleaning West > All" })).toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: "Add to Cleaning West > All" }))
    await user.click(screen.getByRole("button", { name: /^Apply$/i }))
    const lists = useTaskStore.getState().tasks.find((item) => item.id === "inbox-1")?.lists
    expect(lists).toEqual(["list-work", folderAllItemsCategoryId("west")])
    expect(lists).not.toContain(folderAllItemsCategoryId("east"))
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

  it("opens apply list from L without removing a selected idea", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Second idea"))
    useTaskStore.getState().addTask(inboxTask("inbox-3", "Third idea"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Second idea/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Third idea/i }))
    screen.getByRole("button", { name: "Second idea" }).focus()
    await user.keyboard("l")
    expect(screen.getByRole("heading", { name: "Apply list" })).toBeInTheDocument()
    expect(screen.getByText(/· 3 selected/)).toBeInTheDocument()
    expect(screen.getByText("Untitled idea")).toBeInTheDocument()
    expect(screen.getByText("Second idea")).toBeInTheDocument()
    expect(screen.getByText("Third idea")).toBeInTheDocument()
    const tasks = useTaskStore.getState().tasks
    expect(tasks.filter((task) => task.stage === "inbox")).toHaveLength(3)
    expect(screen.queryByRole("heading", { name: /Are you sure/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: /Clarify idea/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: /Walk/i })).not.toBeInTheDocument()
  })

  it("L on the row trash does not delete, and click Apply list still opens the picker", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Second idea"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Second idea/i }))
    document.querySelector<HTMLButtonElement>('[data-inbox-row="inbox-1"] [title="Delete this idea"]')?.focus()
    await user.keyboard("l")
    expect(screen.getByRole("heading", { name: "Apply list" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: /Are you sure/i })).not.toBeInTheDocument()
    expect(useTaskStore.getState().tasks).toHaveLength(2)
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("button", { name: "L Apply list" }))
    expect(screen.getByRole("heading", { name: "Apply list" })).toBeInTheDocument()
    expect(screen.getByText(/· 2 selected/)).toBeInTheDocument()
  })

  it("L with a selection opens apply list even when Search ideas is focused", async () => {
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask(inboxTask("a", "Cat"))
    useTaskStore.getState().addTask(inboxTask("b", "Dog"))
    useTaskStore.getState().addTask(inboxTask("c", "Lemon"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Cat/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Dog/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Lemon/i }))
    screen.getByLabelText("Search ideas").focus()
    await user.keyboard("l")
    expect(screen.getByRole("heading", { name: "Apply list" })).toBeInTheDocument()
    expect(screen.getByText("Cat")).toBeInTheDocument()
    expect(screen.getByText("Dog")).toBeInTheDocument()
    expect(screen.getByText("Lemon")).toBeInTheDocument()
    expect(screen.getByText(/· 3 selected/)).toBeInTheDocument()
    expect((screen.getByLabelText("Search ideas") as HTMLInputElement).value).toBe("")
    expect(useTaskStore.getState().tasks.every((task) => task.stage === "inbox")).toBe(true)
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

  it("keeps Monkey brain off the header count and on its own tab", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Second idea"))
    useTaskStore.getState().addTask(inboxTask("mb-1", "looping thought", { monkeyBrain: true }))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)

    const header = document.querySelector<HTMLButtonElement>("[data-inbox-entry]")
    expect(header).toBeTruthy()
    const shellCount = () => header?.querySelector(".b2-shell-count")?.textContent ?? null
    const tabCount = (name: RegExp) =>
      screen.getByRole("tab", { name }).querySelector(".inbox-crt-count")?.textContent

    expect(shellCount()).toBe("2")
    expect(header).toHaveAttribute("title", "2 to revisit · 1 in monkey brain")
    expect(header?.querySelector(".inbox-mb-count")).toBeNull()

    await user.click(header!)
    expect(tabCount(/^Inbox/)).toBe("2")
    expect(tabCount(/Monkey brain/)).toBe("1")

    await user.click(screen.getByRole("checkbox", { name: /Select Second idea/i }))
    await user.click(screen.getByRole("button", { name: /Monkey brain/i }))
    expect(shellCount()).toBe("1")
    expect(tabCount(/^Inbox/)).toBe("1")
    expect(tabCount(/Monkey brain/)).toBe("2")

    await user.click(screen.getByRole("checkbox", { name: /Select Untitled idea/i }))
    await user.click(screen.getByRole("button", { name: /Monkey brain/i }))
    expect(shellCount()).toBeNull()
    expect(header).toHaveAttribute("title", "Inbox — nothing to revisit · 3 in monkey brain")
    expect(tabCount(/^Inbox/)).toBe("0")
    expect(tabCount(/Monkey brain/)).toBe("3")

    await user.click(screen.getByRole("tab", { name: /Monkey brain/ }))
    await user.click(screen.getByRole("checkbox", { name: /Select Second idea/i }))
    await user.click(screen.getByRole("button", { name: /To inbox/i }))
    expect(shellCount()).toBe("1")
    expect(tabCount(/^Inbox/)).toBe("1")
    expect(tabCount(/Monkey brain/)).toBe("2")
    expect(useTaskStore.getState().tasks.find((task) => task.id === "inbox-2")?.monkeyBrain).toBeUndefined()
    expect(useTaskStore.getState().tasks.find((task) => task.id === "mb-1")?.monkeyBrain).toBe(true)
  })

  it("shows no header count when the only open ideas are Monkey brain", () => {
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask(inboxTask("mb-1", "looping thought", { monkeyBrain: true }))
    useTaskStore.getState().addTask(inboxTask("mb-2", "another loop", { monkeyBrain: true }))
    render(<Inbox onTaskSelect={vi.fn()} />)
    const header = screen.getByRole("button", { name: /^Inbox$/ })
    expect(header.querySelector(".b2-shell-count")).toBeNull()
    expect(header).toHaveAttribute("title", "Inbox — nothing to revisit · 2 in monkey brain")
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

  it("puts clarify and delete on every row, including one that is not the caret", async () => {
    useTaskStore.getState().addTask(inboxTask("inbox-2", "Second idea", { createdAt: new Date("2020-01-01T00:00:00Z") }))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    const rows = document.querySelectorAll("[data-inbox-row]")
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.querySelector('[title="Clarify this idea"]')).toBeTruthy()
      expect(row.querySelector('[title="Delete this idea"]')).toBeTruthy()
    }
    const older = document.querySelector('[data-inbox-row="inbox-2"]')
    expect(older).not.toHaveAttribute("data-focused")
    fireEvent.click(older!.querySelector('[title="Delete this idea"]')!)
    expect(screen.getByRole("heading", { name: /Are you sure/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Yes, delete 1/i }))
    expect(useTaskStore.getState().tasks.map((t) => t.id)).toEqual(["inbox-1"])
    await user.click(screen.getByRole("button", { name: /^Undo$/i }))
    expect(useTaskStore.getState().tasks.map((t) => t.id).sort()).toEqual(["inbox-1", "inbox-2"])
  })

  it("filters the visible pile and keeps select all, select N, and unsorted inside that view", async () => {
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask(inboxTask("bags-1", "French bags"))
    useTaskStore.getState().addTask(inboxTask("bags-2", "Sandwich bags"))
    useTaskStore.getState().addTask(inboxTask("shoe", "Shoe repair"))
    useTaskStore.getState().addTask(inboxTask("listed", "Sandwich listed", { lists: ["list-work"] }))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    const search = screen.getByLabelText("Search ideas")
    await user.type(search, "bags")
    expect(screen.getByText("French bags")).toBeInTheDocument()
    expect(screen.getByText("Sandwich bags")).toBeInTheDocument()
    expect(screen.queryByText("Shoe repair")).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+ selected/)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Select all/i }))
    expect(screen.getByText(/2 selected/)).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /Select French bags/i })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Select Sandwich bags/i })).toBeChecked()

    await user.clear(search)
    expect(screen.getByText("Shoe repair")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /Select Shoe repair/i })).not.toBeChecked()
    expect(screen.getByText(/2 selected/)).toBeInTheDocument()

    await user.click(screen.getByRole("checkbox", { name: /Select Shoe repair/i }))
    expect(screen.getByText(/3 selected/)).toBeInTheDocument()
    await user.type(search, "bags")
    expect(screen.queryByText("Shoe repair")).not.toBeInTheDocument()
    expect(screen.getByText(/2 selected/)).toBeInTheDocument()

    await user.clear(search)
    await user.click(screen.getByRole("button", { name: /Deselect/i }))
    await user.type(search, "sand")
    await user.click(screen.getByRole("button", { name: /Select N/i }))
    expect(screen.getByText(/More selects every idea in view/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/How many ideas/i), "9")
    await user.click(screen.getByRole("button", { name: /^Select$/i }))
    expect(screen.getByText(/2 selected/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText("Search ideas"))
    expect(screen.getByRole("checkbox", { name: /Select Shoe repair/i })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Select French bags/i })).not.toBeChecked()

    await user.type(screen.getByLabelText("Search ideas"), "sand")
    await user.click(screen.getByRole("button", { name: /Select unsorted/i }))
    expect(screen.getByRole("checkbox", { name: /Select Sandwich bags/i })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Select Sandwich listed/i })).not.toBeChecked()
    await user.clear(screen.getByLabelText("Search ideas"))
    expect(screen.getByRole("checkbox", { name: /Select French bags/i })).not.toBeChecked()
    expect(screen.getByText(/1 selected/)).toBeInTheDocument()
  })

  it("plates an assigned list by its folder and previews that list on double-click", async () => {
    useTaskStore.getState().setLists([
      {
        id: "list-work",
        name: "Work",
        color: "#3366ff",
        description: "",
        createdAt: new Date(),
      },
      {
        id: "list-loose",
        name: "Scratch",
        color: "#888888",
        description: "",
        createdAt: new Date(),
      },
    ])
    useTaskStore.getState().setFolders([
      {
        id: "house",
        name: "House",
        createdAt: new Date(),
        listIds: ["list-work"],
      },
    ])
    useTaskStore.getState().addTask(
      inboxTask("on-list", "Already filed", { stage: "list", lists: ["list-work"] }),
    )
    useTaskStore.getState().addTask(
      inboxTask("idea", "the great", { lists: ["list-work", "list-loose"] }),
    )
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    fireEvent.click(document.querySelector('[data-inbox-row="idea"] [title="Clarify this idea"]')!)

    expect(document.querySelector(".inbox-clarify-folder")?.textContent).toBe("House")
    expect(screen.queryByText(/no folder/i)).not.toBeInTheDocument()
    expect(screen.getByTitle("Double-click to preview Scratch")).toBeInTheDocument()
    const work = screen.getByTitle("Double-click to preview Work")
    await user.click(work)
    expect(screen.queryByTestId("habit-list-popup")).not.toBeInTheDocument()
    await user.dblClick(work)
    expect(screen.getByTestId("habit-list-popup")).toBeInTheDocument()
    expect(screen.getByText("Already filed")).toBeInTheDocument()
    expect(screen.getByLabelText("Idea name")).toHaveValue("the great")

    await user.click(screen.getByRole("button", { name: "Close list" }))
    expect(screen.queryByTestId("habit-list-popup")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Idea name")).toHaveValue("the great")
    expect(screen.getByTitle("Double-click to preview Work")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Remove Scratch" }))
    expect(screen.queryByTitle("Double-click to preview Scratch")).not.toBeInTheDocument()
    expect(document.querySelector(".inbox-clarify-folder")?.textContent).toBe("House")
    expect(screen.getByLabelText("Idea name")).toHaveValue("the great")
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }))
    expect(screen.queryByLabelText("Idea name")).not.toBeInTheDocument()
  })

  it("keeps the inbox arrival time through clarify and a second save", async () => {
    const arrived = new Date(2026, 8, 24, 2, 29, 41)
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask(inboxTask("sep24", "morning note", { createdAt: arrived, lists: ["list-work"] }))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByTitle("Clarify this idea"))
    await user.click(screen.getByRole("button", { name: /Save & Clarify/i }))

    const clarified = useTaskStore.getState().tasks.find((t) => t.id === "sep24")
    expect(clarified?.stage).toBe("clarified")
    expect(clarified?.createdAt).toEqual(arrived)
    expect(inboxSubmissionTime(clarified?.createdAt)?.getTime()).toBe(arrived.getTime())

    useTaskStore.getState().updateTask({ ...clarified!, description: "morning note again", createdAt: new Date() })
    const again = useTaskStore.getState().tasks.find((t) => t.id === "sep24")
    expect(again?.description).toBe("morning note again")
    expect(again?.createdAt).toEqual(arrived)
  })

  it("shows a BIM telegram capture on the walk sheet and keeps it through save", async () => {
    const arrived = new Date("2026-09-22T08:00:00.000Z")
    const origin = telegramCaptureOrigin(
      { source: { channel: "telegram", chatId: "99", username: "ada" }, telegramMessageId: 42 },
      "pick up milk",
    )
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask(inboxTask("tg", "pick up milk", { createdAt: arrived, captureOrigin: origin }))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByTitle("Clarify this idea"))
    expect(screen.queryByTestId("inbox-walk-origin")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }))

    await user.click(screen.getByRole("checkbox", { name: /Select pick up milk/i }))
    await user.click(screen.getByRole("button", { name: /Walk selected/i }))
    const line = screen.getByTestId("inbox-walk-origin")
    expect(line).toHaveAttribute("title", "BIM · @ada · message 42 · pick up milk")
    expect(line).toHaveTextContent("BIM")
    expect(line).toHaveTextContent("@ada · message 42 · pick up milk")

    await user.click(screen.getByRole("button", { name: /Save & next/i }))
    const saved = useTaskStore.getState().tasks.find((task) => task.id === "tg")
    expect(saved?.stage).not.toBe("inbox")
    expect(saved?.captureOrigin).toEqual(origin)
    expect(saved?.createdAt).toEqual(arrived)

    useTaskStore.getState().updateTask({
      ...saved!,
      description: "pick up milk again",
      createdAt: new Date("2026-10-10T12:00:00.000Z"),
      captureOrigin: lineCaptureOrigin("quick-add", "nope"),
    })
    const again = useTaskStore.getState().tasks.find((task) => task.id === "tg")
    expect(again?.description).toBe("pick up milk again")
    expect(again?.captureOrigin).toEqual(origin)
    expect(again?.createdAt).toEqual(arrived)
  })

  it("shows a Quick Add line on the walk sheet", async () => {
    const origin = lineCaptureOrigin("quick-add", "Buy more coffee filters")
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask(inboxTask("qa", "Buy more coffee filters", { captureOrigin: origin }))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Buy more coffee filters/i }))
    await user.click(screen.getByRole("button", { name: /Walk selected/i }))
    expect(screen.getByTestId("inbox-walk-origin")).toHaveAttribute(
      "title",
      "Quick Add · Buy more coffee filters",
    )
  })

  it("does not invent a source for an idea that stored none", async () => {
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask(inboxTask("bare", "Loose idea"))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select Loose idea/i }))
    await user.click(screen.getByRole("button", { name: /Walk selected/i }))
    expect(screen.queryByTestId("inbox-walk-origin")).not.toBeInTheDocument()
    expect(screen.queryByText("BIM")).not.toBeInTheDocument()
    expect(screen.queryByText("Quick Add")).not.toBeInTheDocument()
    expect(screen.queryByText("From notes")).not.toBeInTheDocument()
    expect(screen.queryByText("Scheduled")).not.toBeInTheDocument()
  })

  it("copies the inbox arrival time onto a bulk-edited line", async () => {
    const arrived = new Date(2026, 8, 24, 2, 29, 41)
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask(
      inboxTask("sep24", "morning note", {
        createdAt: arrived,
        captureOrigin: lineCaptureOrigin("quick-add", "morning note"),
      }),
    )
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select morning note/i }))
    await user.click(screen.getByRole("button", { name: /Bulk edit/i }))
    const area = screen.getByLabelText("Tasks and Lists")
    await user.clear(area)
    await user.type(area, "Rewritten morning")
    await user.click(screen.getByLabelText(/Send to Inbox/i))
    await user.click(screen.getByRole("button", { name: /Add Tasks/i }))
    const next = useTaskStore.getState().tasks.find((t) => t.title === "Rewritten morning" || t.description === "Rewritten morning")
    expect(next?.stage).not.toBe("inbox")
    expect(next?.createdAt).toEqual(arrived)
    expect(next?.captureOrigin).toEqual(lineCaptureOrigin("quick-add", "morning note"))
    expect(useTaskStore.getState().tasks.some((t) => t.id === "sep24")).toBe(false)
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

  it("transfers the checked ideas to the tracking log at each createdAt", async () => {
    const early = new Date(2026, 8, 24, 2, 29, 0)
    const late = new Date(2026, 8, 24, 19, 24, 0)
    useTaskStore.getState().clearAllData()
    useTimeTrackingStore.setState({ entries: [] })
    useTaskStore.getState().addTask(inboxTask("early", "total exercise", { createdAt: early, estimatedDuration: 60 }))
    useTaskStore.getState().addTask(inboxTask("late", "log need candy", { createdAt: late }))
    useTaskStore.getState().addTask(inboxTask("stay", "leave me", { createdAt: new Date(2026, 8, 24, 12, 0, 0) }))
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    expect(screen.queryByRole("button", { name: /Transfer to log/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole("checkbox", { name: /Select total exercise/i }))
    await user.click(screen.getByRole("checkbox", { name: /Select log need candy/i }))
    await user.click(screen.getByRole("button", { name: /Transfer to log/i }))
    expect(useTaskStore.getState().tasks.map((task) => task.id)).toEqual(["stay"])
    flushInboxLogTransfers()
    const entries = useTimeTrackingStore.getState().entries
    expect(entries.find((entry) => entry.title === "total exercise 60m")).toMatchObject({
      date: "2026-09-24",
      startMin: 2 * 60 + 29,
      endMin: 2 * 60 + 29,
      kind: "instant",
    })
    expect(entries.find((entry) => entry.title === "need candy")).toMatchObject({
      date: "2026-09-24",
      startMin: 19 * 60 + 24,
      endMin: 19 * 60 + 24,
      kind: "instant",
    })
    expect(entries.some((entry) => entry.date === "2026-10-09")).toBe(false)
    await user.click(screen.getByRole("button", { name: /^Undo$/i }))
    expect(useTaskStore.getState().tasks.map((task) => task.id).sort()).toEqual(["early", "late", "stay"])
    expect(useTimeTrackingStore.getState().entries.some((entry) => entry.title === "total exercise 60m")).toBe(false)
  })

  it("keeps the idea list scrolled when a checked idea transfers to the log", async () => {
    useTaskStore.getState().clearAllData()
    useTimeTrackingStore.setState({ entries: [] })
    for (let i = 0; i < 8; i++) {
      useTaskStore.getState().addTask(
        inboxTask(`idea-${i}`, `Idea ${i}`, { createdAt: new Date(2026, 0, 1, 8, i, 0) }),
      )
    }
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    const scroller = document.querySelector(".inbox-rows-scroll") as HTMLDivElement
    const firstId = scroller.querySelector("[data-inbox-row]")?.getAttribute("data-inbox-row")
    expect(firstId).toBe("idea-7")
    let top = 0
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value
      },
    })
    const original = HTMLElement.prototype.scrollIntoView
    let pulledFirst = false
    HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
      const row = (this as HTMLElement).closest("[data-inbox-row]") ?? (this as HTMLElement)
      const host = row.closest(".inbox-rows-scroll") as HTMLElement | null
      if (row.getAttribute("data-inbox-row") === firstId && host) {
        pulledFirst = true
        host.scrollTop = 0
      }
    }
    try {
      await user.click(screen.getByRole("checkbox", { name: /Select Idea 3/i }))
      top = 240
      pulledFirst = false
      await user.click(screen.getByRole("button", { name: /Transfer to log/i }))
      expect(scroller.isConnected).toBe(true)
      expect(document.querySelector(".inbox-rows-scroll")).toBe(scroller)
      expect(pulledFirst).toBe(false)
      expect(top).toBe(240)
      await act(async () => {
        flushInboxLogTransfers()
      })
      expect(document.querySelector(".inbox-rows-scroll")).toBe(scroller)
      expect(pulledFirst).toBe(false)
      expect(top).toBe(240)
      expect(screen.queryByText("Idea 3")).not.toBeInTheDocument()
      expect(screen.getByText("Idea 4")).toBeInTheDocument()
    } finally {
      HTMLElement.prototype.scrollIntoView = original
    }
  })
})
