/**
 * TaskDetailPopup — compact inline task detail modal.
 */
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { listItemActivity, resetItemActivity } from "@/lib/item-activity"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"

describe("TaskDetailPopup", () => {
  const onClose = vi.fn()

  beforeEach(() => {
    resetLocalStorage()
    resetItemActivity()
    onClose.mockClear()
    useItemTypeStore.getState().resetTypes()
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().setLists([
      {
        id: "na-list",
        name: "Work Tasks",
        color: "#3B82F6",
        description: "",
        createdAt: new Date(),
        order: 0,
        scheduleable: true,
      },
    ])
    useTaskStore.getState().setFolders([
      {
        id: "folder-na",
        name: "Next Actions",
        color: "#3B82F6",
        listIds: ["na-list"],
        createdAt: new Date(),
      },
    ])
    useTaskStore.getState().addTask({
      id: "popup-task",
      description: "Plan sprint demo",
      stage: "list",
      createdAt: new Date(),
      estimatedDuration: 30,
      cognitiveLoad: 2,
      urgency: 4,
      importance: 4,
      dependencies: [],
      context: "@work",
      entropy: 0.3,
      rewardValue: 25,
      completed: false,
      lists: ["na-list"],
      allowPartialCompletion: false,
      minimumChunkSize: 15,
    })
  })

  it("renders nothing meaningful when closed", () => {
    render(<TaskDetailPopup taskId="popup-task" open={false} onClose={onClose} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("renders key sections when open", () => {
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Plan sprint demo")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Details/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Scheduling/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /History/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Complete/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Sent" })).not.toBeInTheDocument()
  })

  it("hides Sent when the list has not opted in, and shows it when Sent this week is on", () => {
    const { rerender } = render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    expect(screen.queryByRole("button", { name: "Sent" })).not.toBeInTheDocument()

    act(() => {
      useTaskStore.getState().updateList({
        ...useTaskStore.getState().lists[0],
        sentThisWeek: true,
      })
    })
    rerender(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    expect(screen.getByRole("button", { name: "Sent" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument()
  })

  it("shows Send to Scheduler on the Scheduling tab with inherit-on for lists sent there", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    await user.click(screen.getByRole("tab", { name: /Scheduling/i }))
    expect(screen.getByText("Send to Scheduler")).toBeInTheDocument()
    const toggle = screen.getByRole("switch", { name: "Send to Scheduler" })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    expect(toggle).not.toBeChecked()
    await user.click(screen.getByRole("button", { name: /^Save$/i }))
    expect(useTaskStore.getState().tasks.find((t) => t.id === "popup-task")?.scheduleable).toBe(false)
  })

  it("leaves Auto-push off until the Scheduling switch is turned on", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    await user.click(screen.getByRole("tab", { name: /Scheduling/i }))
    const auto = screen.getByRole("switch", { name: "Auto-push" })
    expect(auto).not.toBeChecked()
    await user.click(auto)
    await user.click(screen.getByRole("button", { name: /^Save$/i }))
    const saved = useTaskStore.getState().tasks.find((t) => t.id === "popup-task")
    expect(saved?.autoPush).toBe(true)
    expect(saved?.scheduleable).toBeUndefined()
  })

  it("shows Save after editing description and persists to store", async () => {
    const user = userEvent.setup({ delay: null })
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    expect(screen.getByRole("status")).toHaveTextContent("Saved")
    const nameInput = screen.getByDisplayValue("Plan sprint demo")
    fireEvent.change(nameInput, { target: { value: "Plan team demo" } })
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes")
    await user.click(screen.getByRole("button", { name: /^Save$/i }))
    expect(screen.getByRole("status")).toHaveTextContent("Saved")
    expect(useTaskStore.getState().tasks[0].description).toBe("Plan team demo")
    const rows = listItemActivity("popup-task")
    expect(rows[0]?.changes.some((c) => c.field === "title" && c.to === "Plan team demo")).toBe(true)
    await user.click(screen.getByRole("tab", { name: /History/i }))
    expect(screen.getByText(/Plan team demo/)).toBeInTheDocument()
  })

  it("clarifies an inbox item and saves the live title", () => {
    useTaskStore.getState().addTask({
      id: "inbox-idea",
      description: "Raw idea",
      title: "Raw idea",
      stage: "inbox",
      lists: ["na-list"],
      completed: false,
      createdAt: new Date(),
      entropy: 0.9,
      estimatedDuration: 30,
      cognitiveLoad: 2,
      urgency: 3,
      importance: 3,
      dependencies: [],
      context: "@general",
      rewardValue: 1,
      allowPartialCompletion: false,
      minimumChunkSize: 15,
    })
    render(<TaskDetailPopup taskId="inbox-idea" open onClose={onClose} />)
    expect(screen.getByRole("button", { name: "Clarify" })).toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue("Raw idea"), { target: { value: "Named idea" } })
    fireEvent.click(screen.getByRole("button", { name: "Clarify" }))
    const stored = useTaskStore.getState().tasks.find((t) => t.id === "inbox-idea")
    expect(stored?.description).toBe("Named idea")
    expect(stored?.title).toBe("Named idea")
    expect(stored?.stage).toBe("clarified")
    expect(screen.queryByRole("button", { name: "Clarify" })).not.toBeInTheDocument()
  })

  it("saves unsaved changes with Cmd+S", async () => {
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    fireEvent.change(screen.getByDisplayValue("Plan sprint demo"), { target: { value: "Plan team demo" } })
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes")
    const saveAs = new KeyboardEvent("keydown", { key: "s", metaKey: true, shiftKey: true, bubbles: true, cancelable: true })
    window.dispatchEvent(saveAs)
    expect(saveAs.defaultPrevented).toBe(false)
    expect(useTaskStore.getState().tasks[0].description).toBe("Plan sprint demo")
    const event = new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true, cancelable: true })
    await act(async () => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(useTaskStore.getState().tasks[0].description).toBe("Plan team demo")
    expect(screen.getByRole("status")).toHaveTextContent("Saved")
  })

  it("shows the item orb on the fascia and saves a pick from it", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    const orb = screen.getByRole("button", { name: "Change item orb" })
    expect(orb.querySelector("img")?.getAttribute("src")).toBeTruthy()
    await user.click(orb)
    expect(await screen.findByText("Choose an Icon")).toBeInTheDocument()
    const picks = [...document.querySelectorAll("[role=dialog] img")].filter((img) => !orb.contains(img))
    const pick = picks.at(-1) as HTMLElement
    await user.click(pick.closest("button") ?? pick)
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes")
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true, cancelable: true }))
    })
    expect(useTaskStore.getState().tasks[0].icon).toEqual(expect.any(String))
  })

  it("opens the item type editor when a type badge is double-clicked", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    await user.dblClick(screen.getByTitle("Double-click to view or edit this type"))
    expect(await screen.findByRole("dialog", { name: /Task \(system\)/i })).toBeInTheDocument()
    expect(screen.getByText(/Items of this type/i)).toBeInTheDocument()
  })

  it("navigates to a list when its badge is double-clicked", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    await user.dblClick(screen.getByTitle("Double-click to open this list"))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Plan sprint demo" })).toBeInTheDocument()
    await waitFor(() => {
      expect(localStorage.getItem("brain2-lists-navigation")).toContain("na-list")
    })
  })

  describe("unsaved guard on every way out", () => {
    const listNav = () => localStorage.getItem("brain2-lists-navigation") ?? ""

    function typeIntoDescription() {
      fireEvent.change(screen.getByDisplayValue("Plan sprint demo"), { target: { value: "Plan team demo" } })
    }

    it("minimizes on a dirty list double-click and keeps the draft", async () => {
      const user = userEvent.setup()
      render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
      typeIntoDescription()
      await user.dblClick(screen.getByTitle("Double-click to open this list"))
      expect(screen.queryByRole("heading", { name: "Unsaved changes" })).not.toBeInTheDocument()
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: "Plan team demo" })).toBeInTheDocument()
      await waitFor(() => expect(listNav()).toContain("na-list"))
      await user.click(screen.getByRole("button", { name: "Plan team demo" }))
      expect(screen.getByDisplayValue("Plan team demo")).toBeInTheDocument()
    })

    it("asks before the minimized item is closed, then saves", async () => {
      const user = userEvent.setup()
      render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
      typeIntoDescription()
      await user.click(screen.getByRole("button", { name: "Minimize" }))
      await user.click(screen.getByRole("button", { name: "Close Plan team demo" }))
      await user.click(screen.getByRole("button", { name: "Save changes" }))
      expect(useTaskStore.getState().tasks[0].description).toBe("Plan team demo")
      expect(onClose).toHaveBeenCalled()
    })

    it("Exit without saving from the minimized item drops the edit", async () => {
      const user = userEvent.setup()
      render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
      typeIntoDescription()
      await user.click(screen.getByRole("button", { name: "Minimize" }))
      await user.click(screen.getByRole("button", { name: "Close Plan team demo" }))
      await user.click(screen.getByRole("button", { name: "Exit without saving" }))
      expect(useTaskStore.getState().tasks[0].description).toBe("Plan sprint demo")
      expect(onClose).toHaveBeenCalled()
    })

    it("asks before opening a related item, and opens it after Exit without saving", async () => {
      const user = userEvent.setup()
      act(() => {
        useTaskStore.getState().addTask({
          ...useTaskStore.getState().tasks[0],
          id: "other-task",
          title: "Book the room",
          description: "Book the room",
        })
        useTaskStore.getState().updateTask({
          ...useTaskStore.getState().tasks.find((t) => t.id === "popup-task")!,
          links: [{ id: "l1", relation: "related", targetId: "other-task" }],
        })
      })
      render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
      typeIntoDescription()
      await user.click(screen.getByRole("tab", { name: /Links/i }))
      await user.click(screen.getByRole("button", { name: "Open Book the room" }))
      expect(screen.getByRole("heading", { name: "Unsaved changes" })).toBeInTheDocument()
      expect(screen.getByDisplayValue("Plan team demo")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Exit without saving" }))
      expect(await screen.findByDisplayValue("Book the room")).toBeInTheDocument()
      expect(useTaskStore.getState().tasks.find((t) => t.id === "popup-task")?.description).toBe("Plan sprint demo")
    })

    it("a clean list double-click leaves with no prompt", async () => {
      const user = userEvent.setup()
      render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
      await user.dblClick(screen.getByTitle("Double-click to open this list"))
      expect(screen.queryByRole("heading", { name: "Unsaved changes" })).not.toBeInTheDocument()
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: "Plan sprint demo" })).toBeInTheDocument()
    })
  })

  it("hides Scheduling and Complete for a non-scheduleable furniture item", () => {
    useTaskStore.getState().setLists([
      {
        id: "wishlist",
        name: "Wishlist",
        color: "#78716c",
        description: "",
        createdAt: new Date(),
        order: 0,
        scheduleable: false,
        itemTypeId: "furniture",
      },
    ])
    useTaskStore.getState().setFolders([
      {
        id: "folder-stuff",
        name: "Stuff",
        color: "#78716c",
        listIds: ["wishlist"],
        createdAt: new Date(),
      },
    ])
    useTaskStore.getState().addTask({
      id: "rug-1",
      description: "big area rug",
      type: "furniture",
      stage: "list",
      createdAt: new Date(),
      completed: false,
      lists: ["wishlist"],
    })
    render(<TaskDetailPopup taskId="rug-1" open onClose={onClose} />)
    expect(screen.getByDisplayValue("big area rug")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Details/i })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /Scheduling/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /Subtasks/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /Analysis/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Complete$/i })).not.toBeInTheDocument()
    expect(screen.getByText(/No photo yet/i)).toBeInTheDocument()
    expect(screen.queryByText("Send to Scheduler")).not.toBeInTheDocument()
    expect(screen.queryByText("Show in Scheduler")).not.toBeInTheDocument()
    expect(screen.queryByText("Repeated Task Settings")).not.toBeInTheDocument()
  })

  it("shows a Book cover hero and featured pages-read without Scheduling", () => {
    useTaskStore.getState().setLists([
      {
        id: "reading",
        name: "Reading",
        color: "#b45309",
        description: "",
        createdAt: new Date(),
        order: 0,
        itemTypeId: "book",
      },
    ])
    useTaskStore.getState().setFolders([
      {
        id: "folder-books",
        name: "Books",
        color: "#b45309",
        listIds: ["reading"],
        createdAt: new Date(),
      },
    ])
    useTaskStore.getState().addTask({
      id: "book-1",
      description: "Dune",
      type: "book",
      stage: "list",
      createdAt: new Date(),
      completed: false,
      lists: ["reading"],
      attributes: { pagesRead: 0, pageCount: 500, status: "reading" },
    })
    render(<TaskDetailPopup taskId="book-1" open onClose={onClose} />)
    expect(screen.getByText(/No cover yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Pages read/i)).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /Scheduling/i })).not.toBeInTheDocument()
  })

  it("logs a dated note from the Notes tab and saves it with the item", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    await user.click(screen.getByRole("tab", { name: /Notes/i }))
    await user.type(screen.getByLabelText("New note"), "Demo went well")
    await user.click(screen.getByRole("button", { name: /add entry/i }))
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes")
    await user.click(screen.getByRole("button", { name: /^Save$/i }))
    const saved = useTaskStore.getState().tasks.find((t) => t.id === "popup-task")
    expect(saved?.noteLog?.[0]).toMatchObject({ text: "Demo went well" })
    expect(saved?.noteLog?.[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(screen.getByRole("tab", { name: /Notes/i })).toHaveTextContent("1")
  })

  it("offers Notes, Resources, and Links on a non-task item and keeps Additional Notes out of Analysis", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    expect(screen.getByRole("tab", { name: /Resources/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Links/i })).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: /Resources/i }))
    expect(screen.getByRole("button", { name: /attach files/i })).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: /Analysis/i }))
    expect(screen.queryByText("Additional Notes")).not.toBeInTheDocument()
  })

  it("puts the Attributes panel above the description on Details", () => {
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    const attrs = screen.getByRole("region", { name: "Attributes" })
    const desc = screen.getByLabelText(/Detailed Description/i)
    expect(attrs.compareDocumentPosition(desc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole("button", { name: /add attribute/i })).toBeInTheDocument()
  })

  it("keeps two person fields typed without blur when saved with Cmd+S", async () => {
    const user = userEvent.setup({ delay: null })
    useTaskStore.getState().addTask({
      ...useTaskStore.getState().tasks[0],
      id: "popup-person",
      description: "Eli",
      type: "person",
    })
    render(<TaskDetailPopup taskId="popup-person" open onClose={onClose} />)
    await user.type(screen.getByLabelText("Full name"), "Elijah Hart")
    await user.type(screen.getByLabelText("Instagram"), "eli")
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes")
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true, cancelable: true }))
    })
    const saved = useTaskStore.getState().tasks.find((t) => t.id === "popup-person")
    expect(saved?.personProfile?.fullName).toBe("Elijah Hart")
    expect(saved?.personProfile?.instagram).toBe("eli")
  })

  it("keeps a string attribute typed without blur when saved with Cmd+S", async () => {
    const user = userEvent.setup({ delay: null })
    useTaskStore.getState().addTask({
      ...useTaskStore.getState().tasks[0],
      id: "popup-attr",
      description: "Book",
      itemAttributeDefinitions: [{ id: "author", name: "Author", type: "string" }],
      attributes: {},
    })
    render(<TaskDetailPopup taskId="popup-attr" open onClose={onClose} />)
    await user.type(screen.getByLabelText("Author"), "Ada")
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes")
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true, cancelable: true }))
    })
    const saved = useTaskStore.getState().tasks.find((t) => t.id === "popup-attr")
    expect(saved?.attributes?.author).toBe("Ada")
  })

  it("makes a Brain2 list from a text list and keeps the list id on the item", async () => {
    const user = userEvent.setup()
    useTaskStore.getState().addTask({
      id: "listy",
      description: "Shoot",
      title: "Shoot",
      stage: "list",
      createdAt: new Date(),
      completed: false,
      lists: ["na-list"],
      attributes: { todo: ["write script", "film"] },
      itemAttributeDefinitions: [{ id: "todo", name: "To do", type: "multistring" }],
    })
    render(<TaskDetailPopup taskId="listy" open onClose={onClose} />)
    await user.click(screen.getByRole("button", { name: "Make Brain2 List" }))
    const saved = useTaskStore.getState().tasks.find((t) => t.id === "listy")
    const listId = typeof saved?.attributes?.todo === "string" ? saved.attributes.todo : ""
    expect(listId).toBeTruthy()
    expect(saved?.textListIds?.todo).toBeUndefined()
    expect(saved?.itemAttributeDefinitions?.find((def) => def.id === "todo")?.type).toBe("list")
    expect(useTaskStore.getState().lists.some((list) => list.id === listId && list.name === "To do")).toBe(true)
    const lines = useTaskStore
      .getState()
      .tasks.filter((row) => listId && row.lists?.includes(listId))
      .map((row) => row.title)
    expect(lines).toEqual(["write script", "film"])
    expect(screen.getByRole("button", { name: "write script" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "film" })).toBeInTheDocument()
  })

  it("opens item settings and can hide a tab on this item", async () => {
    const user = userEvent.setup()
    render(<TaskDetailPopup taskId="popup-task" open onClose={onClose} />)
    expect(screen.queryByRole("tab", { name: /Settings/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Item settings" }))
    expect(screen.getByRole("dialog", { name: "Item settings" })).toBeInTheDocument()
    expect(screen.getByTestId("item-id-line")).toHaveTextContent("popup-task")
    await user.click(screen.getByRole("checkbox", { name: "Scheduling" }))
    expect(screen.queryByRole("tab", { name: /Scheduling/i })).not.toBeInTheDocument()
    expect(useTaskStore.getState().tasks.find((t) => t.id === "popup-task")?.hiddenDetailPanels).toBeUndefined()
  })
})

