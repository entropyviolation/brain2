/**
 * QuickAdd — fast inbox capture dialog.
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import * as quickAddLog from "@/lib/quick-add-log"
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
    expect(tasks[0].captureOrigin).toEqual({ kind: "quick-add", detail: "Buy more coffee filters" })
    expect(screen.getByRole("status")).toHaveTextContent("Item added to Inbox from Quick Add")
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
    expect(screen.getByRole("status")).toHaveTextContent(`Item added to ${list!.name} from Quick Add`)
  })

  it("files folder: all: item on the folder All Items chip, not a new list named all", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.type(screen.getByLabelText("Idea"), "next actions: all: buy milk")
    expect(screen.getByText("All Items")).toBeInTheDocument()
    expect(screen.queryByText(/all \(new list\)/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Add to Inbox/i }))

    const { tasks, folders, lists } = useTaskStore.getState()
    const folder = folders.find((row) => row.name.toLowerCase() === "next actions")
    expect(tasks[0].description).toBe("buy milk")
    expect(tasks[0].lists).toEqual([`__all-items__${folder!.id}`])
    expect(lists.some((list) => list.name.toLowerCase() === "all" && !list.id.startsWith("__all-items__"))).toBe(false)
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
    expect(screen.getByRole("status")).toHaveTextContent(`Item added to ${list!.name} from Quick Add`)
  })

  it("prefills a multiline selection in Bulk", () => {
    render(<QuickAdd open seed={"Groceries:\nMilk"} />)
    expect(screen.getByLabelText("Bulk")).toBeChecked()
    expect(screen.getByLabelText("Tasks and Lists")).toHaveValue("Groceries:\nMilk")
  })

  it("shows a brain2 chip and files the idea onto that list", async () => {
    useTaskStore.getState().addList({
      id: "list-brain2",
      name: "brain2",
      color: "#111",
      createdAt: new Date(),
    })
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.type(screen.getByLabelText("Idea"), "brain2: finish the report")
    expect(screen.getByText("brain2")).toBeInTheDocument()
    expect(screen.queryByText(/\(new list\)/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Add to Inbox/i }))

    const task = useTaskStore.getState().tasks[0]
    expect(task.description).toBe("finish the report")
    expect(task.lists).toEqual(["list-brain2"])
    expect(task.stage).toBe("inbox")
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

  it("logs log: as a tracking log with a LOG mark, not a list or the inbox", async () => {
    useTimeTrackingStore.setState({ entries: [] })
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.type(screen.getByLabelText("Idea"), "log: left room")
    const logMark = screen.getByText("LOG", { selector: "[data-log-flag]" })
    expect(logMark.className).toMatch(/12315c/)
    expect(screen.queryByText(/log \(new list\)/i)).not.toBeInTheDocument()
    expect(screen.queryByText("left room")).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Send to Inbox for clarification/i)).toBeDisabled()
    expect(screen.getByText(/does not go to Inbox/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Log" }))

    expect(useTaskStore.getState().tasks).toHaveLength(0)
    expect(useTaskStore.getState().lists.some((list) => list.name.toLowerCase() === "log")).toBe(false)
    const entry = useTimeTrackingStore.getState().entries.find((row) => row.title === "left room")
    expect(entry?.kind).toBe("instant")
    expect(entry?.scopeId).toBe("activity")
    expect(screen.getByRole("status")).toHaveTextContent("Item added to the tracking log from Quick Add")
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

  it("names All Items, with the folder, when the write skips Inbox", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.click(screen.getByLabelText(/Send to Inbox for clarification/i))
    await user.type(screen.getByLabelText("Idea"), "next actions: all: buy milk")
    await user.click(screen.getByRole("button", { name: /Add item/i }))

    const folder = useTaskStore.getState().folders.find((row) => row.name.toLowerCase() === "next actions")
    expect(screen.getByRole("status")).toHaveTextContent(`Item added to ${folder!.name} All Items from Quick Add`)
    expect(screen.getByRole("status")).toHaveClass("qa-wrote")
  })

  it("names Monkey brain when the line is a monkey-brain dump", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.type(screen.getByLabelText("Idea"), "wash the dog -mb")
    await user.click(screen.getByRole("button", { name: /Add to Monkey brain/i }))

    expect(useTaskStore.getState().tasks[0].monkeyBrain).toBe(true)
    expect(screen.getByRole("status")).toHaveTextContent("Item added to Monkey brain from Quick Add")
  })

  it("counts a bulk write that shares one destination", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.click(screen.getByLabelText("Bulk"))
    await user.click(screen.getByLabelText(/Send to Inbox for clarification/i))
    await user.type(screen.getByLabelText("Tasks and Lists"), "Errands:\nBuy stamps\nMail the letter")
    await user.click(screen.getByRole("button", { name: /Add Tasks/i }))

    expect(useTaskStore.getState().tasks).toHaveLength(2)
    expect(screen.getByRole("status")).toHaveTextContent("2 items added to Errands from Quick Add")
  })

  it("counts a bulk write that lands in more than one place", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.click(screen.getByLabelText("Bulk"))
    await user.click(screen.getByLabelText(/Send to Inbox for clarification/i))
    await user.type(screen.getByLabelText("Tasks and Lists"), "Groceries:\nMilk\nErrands:\nWalk")
    await user.click(screen.getByRole("button", { name: /Add Tasks/i }))

    expect(screen.getByRole("status")).toHaveTextContent("2 items added from Quick Add")
  })

  it("does not confirm an empty submit or a bulk write of nothing", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.click(screen.getByRole("button", { name: /Add to Inbox/i }))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()

    await user.click(screen.getByLabelText("Bulk"))
    await user.type(screen.getByLabelText("Tasks and Lists"), "Groceries:")
    await user.click(screen.getByRole("button", { name: /Add Tasks/i }))
    expect(useTaskStore.getState().tasks).toHaveLength(0)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("keeps the dialog open and stays quiet when the log write errors", async () => {
    useTimeTrackingStore.setState({ entries: [] })
    const spy = vi.spyOn(quickAddLog, "applyQuickAddLog").mockReturnValue({
      status: "error",
      kind: "event-log",
      reply: "Log what?",
    })
    const user = userEvent.setup()
    try {
      render(<QuickAdd />)
      await user.click(screen.getByRole("button", { name: /Quick Add/i }))
      await user.type(screen.getByLabelText("Idea"), "log: left room")
      await user.click(screen.getByRole("button", { name: "Log" }))

      expect(screen.getByRole("dialog", { name: /Add Idea/i })).toBeInTheDocument()
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
      expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    } finally {
      spy.mockRestore()
    }
  })

  it("dismisses the confirmation from the flag and from its close control", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.type(screen.getByLabelText("Idea"), "Buy more coffee filters")
    await user.click(screen.getByRole("button", { name: /Add to Inbox/i }))
    await user.click(screen.getByRole("status"))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.type(screen.getByLabelText("Idea"), "Buy filters again")
    await user.click(screen.getByRole("button", { name: /Add to Inbox/i }))
    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("replaces the previous confirmation when another write succeeds", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.type(screen.getByLabelText("Idea"), "Buy more coffee filters")
    await user.click(screen.getByRole("button", { name: /Add to Inbox/i }))
    expect(screen.getByRole("status")).toHaveTextContent("Item added to Inbox from Quick Add")

    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.click(screen.getByLabelText(/Send to Inbox for clarification/i))
    await user.type(screen.getByLabelText("Idea"), "errands: mail the letter")
    await user.click(screen.getByRole("button", { name: /Add item/i }))

    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(screen.getByRole("status")).toHaveTextContent("Item added to errands from Quick Add")
  })

  it("hides the confirmation after a few seconds", async () => {
    const user = userEvent.setup()
    render(<QuickAdd wroteMs={30} />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.type(screen.getByLabelText("Idea"), "Probe flag")
    await user.click(screen.getByRole("button", { name: /Add to Inbox/i }))
    expect(screen.getByRole("status")).toHaveTextContent("Item added to Inbox from Quick Add")
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    })
  })
})
