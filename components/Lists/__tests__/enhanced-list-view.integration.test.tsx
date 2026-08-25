import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { EnhancedCategoryView } from "../enhanced-list-view"

vi.mock("@/components/task-detail-popup", () => ({
  TaskDetailPopup: () => null,
}))

vi.mock("@/components/Lists/settings-dialog", () => ({
  NextActionsSettingsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="lists-settings">Settings</div> : null,
}))

vi.mock("@/components/Lists/daily-habits-list", () => ({
  DailyHabitsList: () => <div data-testid="daily-habits">Daily habits</div>,
  WeeklyHabitsList: () => <div data-testid="weekly-habits">Weekly habits</div>,
  MonthlyHabitsList: () => <div data-testid="monthly-habits">Monthly habits</div>,
}))

vi.mock("@/components/Lists/objectives-list", () => ({
  ObjectivesList: () => <div data-testid="objectives-list">Objectives</div>,
}))

vi.mock("@/lib/remove-background", () => ({
  removeBackground: vi.fn(),
}))

describe("EnhancedCategoryView Integration", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().setLists([
      {
        id: "list-1",
        name: "Work Tasks",
        color: "#ff0000",
        description: "",
        createdAt: new Date(),
        order: 0,
      },
    ])
    useTaskStore.getState().addTask({
      id: "task-1",
      description: "Complete project",
      lists: ["list-1"],
      stage: "list",
      completed: false,
      createdAt: new Date(),
      urgency: 1,
      importance: 1,
    })
    useListsUiStore.setState({
      listDisplay: {},
      folderAllHiddenListIds: {},
      folderAllUncategorizedOnly: {},
      folderView: "icons",
    })
  })

  it("displays tasks when a list is opened", async () => {
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    fireEvent.click(screen.getByText("All"))
    fireEvent.click(screen.getByRole("button", { name: "List" }))
    fireEvent.dblClick(screen.getByText(/Work Tasks/))
    await waitFor(() => {
      expect(screen.getByText("Complete project")).toBeInTheDocument()
    })
  })

  it("filters tasks by search", async () => {
    const user = userEvent.setup()
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    const searchInput = screen.getByPlaceholderText("Search folders, lists, items…")
    await user.type(searchInput, "project")
    expect(screen.getByText(/Search: project/i)).toBeInTheDocument()
    expect(screen.getByText("Complete project")).toBeInTheDocument()
  })

  it("creates a new task via quick add", async () => {
    const user = userEvent.setup()
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    fireEvent.click(screen.getByText("All"))
    fireEvent.click(screen.getByRole("button", { name: "List" }))
    fireEvent.dblClick(screen.getByText(/Work Tasks/))
    await waitFor(() => expect(screen.getByText("Complete project")).toBeInTheDocument())
    const addButtons = screen.getAllByRole("button", { name: "Add Item" })
    fireEvent.click(addButtons[addButtons.length - 1])
    const quickAdd = document.querySelector(".fm-quickadd")!
    const textarea = within(quickAdd as HTMLElement).getByPlaceholderText(/enter .* description/i)
    await user.type(textarea, "New test task")
    fireEvent.click(within(quickAdd as HTMLElement).getByRole("button", { name: "Add Item" }))
    await waitFor(() => {
      expect(screen.getByText("New test task")).toBeInTheDocument()
    })
  })

  it("completes a task via checkbox in checklist view", async () => {
    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    fireEvent.click(screen.getByText("All"))
    fireEvent.click(screen.getByRole("button", { name: "List" }))
    fireEvent.dblClick(screen.getByText(/Work Tasks/))
    await waitFor(() => expect(screen.getByText("Complete project")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Checklist" }))
    const completeButton = screen.getByRole("button", { name: "Complete" })
    fireEvent.click(completeButton)
    await waitFor(() => {
      expect(useTaskStore.getState().tasks.find((t) => t.id === "task-1")?.completed).toBe(true)
    })
  })

  it("filters a folder All list in default display without changing list membership", async () => {
    const user = userEvent.setup()
    useTaskStore.getState().setLists([
      { id: "list-1", name: "list 1", color: "#ff0000", description: "", createdAt: new Date(), order: 0 },
      { id: "list-2", name: "list 2", color: "#00ff00", description: "", createdAt: new Date(), order: 1 },
    ])
    useTaskStore.getState().addFolder({
      id: "folder1",
      name: "folder1",
      createdAt: new Date(),
      listIds: ["list-1", "list-2"],
    })
    useTaskStore.getState().setTasks([
      {
        id: "a",
        description: "item a",
        lists: ["list-1"],
        stage: "list",
        completed: false,
        createdAt: new Date(),
        urgency: 1,
        importance: 1,
      },
      {
        id: "b",
        description: "item b",
        lists: ["list-2"],
        stage: "list",
        completed: false,
        createdAt: new Date(),
        urgency: 1,
        importance: 1,
      },
      {
        id: "c",
        description: "item c",
        lists: ["list-2"],
        stage: "list",
        completed: false,
        createdAt: new Date(),
        urgency: 1,
        importance: 1,
      },
    ])

    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    fireEvent.click(screen.getByText("folder1"))
    fireEvent.click(screen.getByRole("button", { name: "List" }))
    await waitFor(() => expect(screen.getByText("All Items")).toBeInTheDocument())
    fireEvent.dblClick(screen.getByText("All Items"))

    await waitFor(() => {
      expect(screen.getByText("item a")).toBeInTheDocument()
      expect(screen.getByText("item b")).toBeInTheDocument()
      expect(screen.getByText("item c")).toBeInTheDocument()
    })
    expect(screen.getByRole("checkbox", { name: "list 1" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "list 2" })).toBeChecked()

    await user.click(screen.getByRole("checkbox", { name: "list 1" }))
    await waitFor(() => {
      expect(screen.queryByText("item a")).not.toBeInTheDocument()
    })
    expect(screen.getByText("item b")).toBeInTheDocument()
    expect(screen.getByText("item c")).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.find((t) => t.id === "a")?.lists).toEqual(["list-1"])
    expect(useTaskStore.getState().lists.map((c) => c.id)).toEqual(expect.arrayContaining(["list-1", "list-2"]))

    fireEvent.click(screen.getByRole("button", { name: "Details" }))
    await waitFor(() => {
      expect(screen.getByText("item a")).toBeInTheDocument()
    })
    expect(screen.queryByRole("group", { name: "Filter lists" })).not.toBeInTheDocument()
  })

  it("selects lists in folder list view and creates a nested folder from the selection", async () => {
    const user = userEvent.setup()
    useTaskStore.getState().setLists([
      { id: "list-1", name: "list 1", color: "#ff0000", description: "", createdAt: new Date(), order: 0 },
      { id: "list-2", name: "list 2", color: "#00ff00", description: "", createdAt: new Date(), order: 1 },
    ])
    useTaskStore.getState().addFolder({
      id: "folder1",
      name: "folder1",
      createdAt: new Date(),
      listIds: ["list-1", "list-2"],
    })
    useTaskStore.getState().addFolder({
      id: "folder2",
      name: "folder2",
      createdAt: new Date(),
      listIds: [],
    })

    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    fireEvent.click(screen.getByText("folder1"))
    fireEvent.click(screen.getByRole("button", { name: "List" }))
    await waitFor(() => expect(screen.getByText("list 1")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: "Select" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel Select" })).toBeInTheDocument())
    fireEvent.click(screen.getByText("list 1"))
    fireEvent.click(screen.getByText("list 2"))

    await waitFor(() => expect(screen.getByText("2 selected")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "→ folder2" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: "Move from this folder" }))

    fireEvent.click(screen.getByRole("button", { name: "Add to New Folder" }))
    const nameInput = await screen.findByLabelText("Folder Name")
    await user.type(nameInput, "nested")
    fireEvent.click(screen.getByRole("button", { name: "Create Folder" }))

    await waitFor(() => {
      const nested = useTaskStore.getState().folders.find((f) => f.name === "nested")
      expect(nested).toBeTruthy()
      expect(nested?.parentFolderId).toBe("folder1")
      expect(nested?.listIds).toEqual(expect.arrayContaining(["list-1", "list-2"]))
    })
    expect(useTaskStore.getState().folders.find((f) => f.id === "folder1")?.listIds ?? []).not.toContain("list-1")
    expect(useTaskStore.getState().folders.find((f) => f.id === "folder1")?.listIds ?? []).not.toContain("list-2")
  })

  it("moves a selected list into an existing folder from list view select mode", async () => {
    useTaskStore.getState().setLists([
      { id: "list-1", name: "list 1", color: "#ff0000", description: "", createdAt: new Date(), order: 0 },
    ])
    useTaskStore.getState().addFolder({
      id: "folder1",
      name: "folder1",
      createdAt: new Date(),
      listIds: ["list-1"],
    })
    useTaskStore.getState().addFolder({
      id: "folder2",
      name: "folder2",
      createdAt: new Date(),
      listIds: [],
    })

    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    fireEvent.click(screen.getByText("folder1"))
    fireEvent.click(screen.getByRole("button", { name: "List" }))
    await waitFor(() => expect(screen.getByText("list 1")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Select" }))
    fireEvent.click(screen.getByText("list 1"))
    fireEvent.click(screen.getByRole("radio", { name: "Move from this folder" }))
    fireEvent.click(screen.getByRole("button", { name: "→ folder2" }))

    await waitFor(() => {
      expect(useTaskStore.getState().folders.find((f) => f.id === "folder2")?.listIds).toContain("list-1")
    })
    expect(useTaskStore.getState().folders.find((f) => f.id === "folder1")?.listIds ?? []).not.toContain("list-1")
  })

  it("keeps a list in the original folder when adding to another folder", async () => {
    useTaskStore.getState().setLists([
      { id: "list-1", name: "list 1", color: "#ff0000", description: "", createdAt: new Date(), order: 0 },
    ])
    useTaskStore.getState().addFolder({
      id: "folder1",
      name: "folder1",
      createdAt: new Date(),
      listIds: ["list-1"],
    })
    useTaskStore.getState().addFolder({
      id: "folder2",
      name: "folder2",
      createdAt: new Date(),
      listIds: [],
    })

    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    fireEvent.click(screen.getByText("folder1"))
    fireEvent.click(screen.getByRole("button", { name: "List" }))
    await waitFor(() => expect(screen.getByText("list 1")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Select" }))
    fireEvent.click(screen.getByText("list 1"))
    expect(screen.getByRole("radio", { name: "Keep in this folder" })).toBeChecked()
    fireEvent.click(screen.getByRole("button", { name: "→ folder2" }))

    await waitFor(() => {
      expect(useTaskStore.getState().folders.find((f) => f.id === "folder2")?.listIds).toContain("list-1")
    })
    expect(useTaskStore.getState().folders.find((f) => f.id === "folder1")?.listIds).toContain("list-1")
  })

  it("selects all lists, merges them, and can delete a remaining selection", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    useTaskStore.getState().setLists([
      { id: "list-1", name: "list 1", color: "#ff0000", description: "", createdAt: new Date(), order: 0 },
      { id: "list-2", name: "list 2", color: "#00ff00", description: "", createdAt: new Date(), order: 1 },
    ])
    useTaskStore.getState().addFolder({
      id: "folder1",
      name: "folder1",
      createdAt: new Date(),
      listIds: ["list-1", "list-2"],
    })
    useTaskStore.getState().addTask({
      id: "item-b",
      description: "from list 2",
      lists: ["list-2"],
      stage: "list",
      completed: false,
      createdAt: new Date(),
      urgency: 1,
      importance: 1,
    })

    render(<EnhancedCategoryView onTaskSelect={vi.fn()} />)
    fireEvent.click(screen.getByText("folder1"))
    fireEvent.click(screen.getByRole("button", { name: "List" }))
    await waitFor(() => expect(screen.getByText("list 1")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Select" }))
    fireEvent.click(screen.getByRole("button", { name: "Select All" }))
    expect(screen.getByRole("checkbox", { name: "Select list 1" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Select list 2" })).toBeChecked()

    fireEvent.click(screen.getByRole("button", { name: "Merge lists" }))
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }))
    fireEvent.click(await screen.findByRole("button", { name: "Merge" }))

    await waitFor(() => {
      expect(useTaskStore.getState().lists.filter((l) => l.id === "list-1" || l.id === "list-2").map((l) => l.id)).toEqual([
        "list-1",
      ])
    })
    expect(useTaskStore.getState().tasks.find((t) => t.id === "item-b")?.lists).toContain("list-1")

    fireEvent.click(screen.getByRole("button", { name: "Select" }))
    fireEvent.click(screen.getByText("list 1"))
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }))
    await waitFor(() => {
      expect(useTaskStore.getState().lists.find((l) => l.id === "list-1")).toBeUndefined()
    })
    confirmSpy.mockRestore()
  })
})
