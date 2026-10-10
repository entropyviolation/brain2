/**
 * QuickAdd — fast inbox capture dialog.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { QuickAdd } from "./quick-add"

describe("QuickAdd", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
  })

  it("renders the Quick Add trigger", () => {
    render(<QuickAdd />)
    expect(screen.getByRole("button", { name: /Quick Add/i })).toBeInTheDocument()
  })

  it("adds a captured idea to the inbox store", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.type(screen.getByLabelText("Idea"), "Buy more coffee filters")
    await user.click(screen.getByRole("button", { name: /Add to Inbox/i }))

    const tasks = useTaskStore.getState().tasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0].description).toBe("Buy more coffee filters")
    expect(tasks[0].stage).toBe("inbox")
  })

  it("files a path capture onto a folder list when inbox is skipped", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.click(screen.getByLabelText(/Send to Inbox for clarification/i))
    const idea = screen.getByLabelText("Idea")
    await user.type(
      idea,
      "next actions: eventually: go through and edit old three pages into a memoir or essay narrative; mine essays",
    )
    expect(screen.getByText(/eventually \(new list\)/i)).toBeInTheDocument()
    expect(screen.getByText(/next actions \(new folder\)/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Add item/i }))

    const { tasks, lists, folders } = useTaskStore.getState()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].stage).not.toBe("inbox")
    expect(tasks[0].description).toMatch(/go through and edit old three pages/)
    const list = lists.find((l) => l.id === tasks[0].lists?.[0])
    expect(list?.name.toLowerCase()).toBe("eventually")
    const folder = folders.find((f) => f.listIds.includes(list!.id))
    expect(folder?.name.toLowerCase()).toBe("next actions")
  })

  it("writes bulk lines through the same capture path when Bulk is on", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    const dialog = screen.getByRole("dialog", { name: /Add Idea/i })
    expect(screen.getByLabelText("Idea")).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent("before 9/12")

    await user.click(screen.getByLabelText("Bulk"))
    expect(screen.getByLabelText("Tasks and Lists")).toHaveClass("hpp-bulk-box")
    expect(dialog).toHaveTextContent("before 9/12")
    expect(dialog).toHaveTextContent("folder: list:")

    await user.click(screen.getByLabelText(/Send to Inbox for clarification/i))
    await user.type(screen.getByLabelText("Tasks and Lists"), "Next Actions: Eventually:\nGo through old pages")
    await user.click(screen.getByRole("button", { name: /Add Tasks/i }))

    const { lists, folders, tasks } = useTaskStore.getState()
    const list = lists.find((l) => l.name.toLowerCase() === "eventually")
    expect(list).toBeTruthy()
    const folder = folders.find((f) => f.listIds.includes(list!.id))
    expect(folder?.name.toLowerCase()).toBe("next actions")
    expect(tasks[0].description).toBe("Go through old pages")
    expect(tasks[0].stage).not.toBe("inbox")
  })

  it("prefills a multiline selection in Bulk", () => {
    render(<QuickAdd open seed={"Groceries:\nMilk"} />)
    expect(screen.getByLabelText("Bulk")).toBeChecked()
    expect(screen.getByLabelText("Tasks and Lists")).toHaveValue("Groceries:\nMilk")
  })

  it("keeps a detected day and clock in the title", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.type(screen.getByLabelText("Idea"), "go home tomorrow at 3pm")
    expect(screen.getByText("15:00")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Add to Inbox/i }))

    const task = useTaskStore.getState().tasks[0]
    expect(task.description).toBe("go home tomorrow at 3pm")
    expect(task.scheduledTime).toBe("15:00")
    expect(task.scheduledDate).toBeInstanceOf(Date)
    expect(task.stage).toBe("inbox")
  })

  it("stores a -p line as written and does not create a list", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.type(screen.getByLabelText("Idea"), "-p next actions: wash the dog at 3pm")
    expect(screen.getAllByText("Plain").length).toBeGreaterThan(1)
    expect(screen.queryByText(/\(new list\)/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\(new folder\)/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Add to Inbox/i }))

    const { tasks, lists } = useTaskStore.getState()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].description).toBe("next actions: wash the dog at 3pm")
    expect(tasks[0].scheduledTime).toBeUndefined()
    expect(tasks[0].lists ?? []).toHaveLength(0)
    expect(lists.some((list) => list.name.toLowerCase() === "next actions")).toBe(false)
  })

  it("stores bulk lines as written when Plain is checked", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.click(screen.getByLabelText("Bulk"))
    await user.click(screen.getByLabelText("Plain"))
    await user.click(screen.getByLabelText(/Send to Inbox for clarification/i))
    await user.type(screen.getByLabelText("Tasks and Lists"), "Next Actions: Eventually:\nGo through old pages at 3pm")
    await user.click(screen.getByRole("button", { name: /Add Tasks/i }))

    const { tasks, lists } = useTaskStore.getState()
    const titles = tasks.map((task) => task.description).sort()
    expect(titles).toEqual(["Go through old pages at 3pm", "Next Actions: Eventually:"])
    expect(tasks.every((task) => (task.lists ?? []).length === 0)).toBe(true)
    expect(tasks.every((task) => task.scheduledTime == null)).toBe(true)
    expect(lists.some((list) => list.name.toLowerCase() === "eventually")).toBe(false)
  })

  it("stores the line as written when Plain is checked", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.click(screen.getByLabelText("Plain"))
    await user.type(screen.getByLabelText("Idea"), "next actions: wash the dog at 3pm")
    expect(screen.getByText(/Plain is on/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Add to Inbox/i }))

    const task = useTaskStore.getState().tasks[0]
    expect(task.description).toBe("next actions: wash the dog at 3pm")
    expect(task.scheduledTime).toBeUndefined()
    expect(task.lists ?? []).toHaveLength(0)
  })
})
