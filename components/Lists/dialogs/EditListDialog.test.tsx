/**
 * EditListDialog — In folders section, wider shell, save still works.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Folder, List } from "@/lib/types"
import { EditListDialog } from "./EditListDialog"

const list = (partial: Partial<List> & Pick<List, "id" | "name">): List => ({
  color: "#3B82F6",
  description: "",
  createdAt: new Date("2026-01-01"),
  order: 0,
  ...partial,
})

const folder = (partial: Partial<Folder> & Pick<Folder, "id" | "name">): Folder => ({
  createdAt: new Date("2026-01-01"),
  listIds: [],
  ...partial,
})

const kitchen: Folder = folder({ id: "kitchen", name: "Kitchen", listIds: ["dishes"] })
const dishes: List = list({ id: "dishes", name: "Dishes", description: "Wash up", color: "#ef4444" })

describe("EditListDialog", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.getState().setLists([dishes, list({ id: "other", name: "Other" })])
    useTaskStore.getState().setFolders([kitchen])
  })

  const renderDialog = (onSave = vi.fn(), onDelete = vi.fn()) => {
    const onEditingCategoryChange = vi.fn()
    render(
      <EditListDialog
        editingCategory={dishes}
        onEditingCategoryChange={onEditingCategoryChange}
        folders={[kitchen]}
        homePinned={[]}
        listDisplay={{}}
        setListDisplay={vi.fn()}
        toggleHomePin={vi.fn()}
        onOpenIconPicker={vi.fn()}
        onSave={onSave}
        onDelete={onDelete}
      />,
    )
    return { onSave, onDelete, onEditingCategoryChange }
  }

  it("is a bit wider than the default settings dialog", () => {
    renderDialog()
    const dialog = screen.getByRole("dialog")
    expect(dialog.className).toMatch(/max-w-\[37\.5rem\]/)
  })

  it("shows In folders next to Connected lists", () => {
    renderDialog()
    expect(screen.getByText("In folders")).toBeInTheDocument()
    expect(screen.getByText("Connected lists")).toBeInTheDocument()
    expect(screen.getByText("Details view mode settings")).toBeInTheDocument()
    expect(screen.getByText("Checklist view mode settings")).toBeInTheDocument()
    expect(screen.getByText("Spreadsheet view mode settings")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove from Kitchen" })).toBeInTheDocument()
  })

  it("offers Default view mode settings in the view-mode host", () => {
    renderDialog()
    expect(screen.getByText("View mode settings")).toBeInTheDocument()
    expect(screen.getByText("Default view mode settings")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Use default layout" })).toBeChecked()
    expect(screen.getByText("Checklist view mode settings")).toBeInTheDocument()
    expect(screen.getByText("In folders")).toBeInTheDocument()
    expect(screen.getByTestId("list-danger-actions")).toBeInTheDocument()
  })

  it("Save still writes other list settings", async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog()
    await user.click(screen.getByRole("button", { name: "Save Changes" }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as List
    expect(saved.id).toBe("dishes")
    expect(saved.name).toBe("Dishes")
    expect(saved.color).toBe("#ef4444")
    expect(saved.description).toBe("Wash up")
  })

  it("keeps Clear list and Delete together in Dangerous actions", () => {
    renderDialog()
    const danger = screen.getByTestId("list-danger-actions")
    expect(within(danger).getByRole("button", { name: "Clear list" })).toBeInTheDocument()
    expect(within(danger).getByRole("button", { name: "Delete" })).toBeInTheDocument()
  })

  it("confirm Cancel leaves list membership alone", async () => {
    const user = userEvent.setup()
    useTaskStore.getState().setTasks([
      {
        id: "spoon",
        description: "Spoon",
        lists: ["dishes", "other"],
        stage: "list",
        completed: false,
        createdAt: new Date(),
        urgency: 1,
        importance: 1,
      },
    ])
    renderDialog()
    await user.click(screen.getByRole("button", { name: "Clear list" }))
    const confirm = await screen.findByRole("dialog", { name: /Are you sure/i })
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }))
    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument()
    expect(useTaskStore.getState().tasks.find((t) => t.id === "spoon")?.lists).toEqual(["dishes", "other"])
  })

  it("confirm Clear list removes membership without deleting items", async () => {
    const user = userEvent.setup()
    useTaskStore.getState().setTasks([
      {
        id: "spoon",
        description: "Spoon",
        lists: ["dishes", "other"],
        stage: "list",
        completed: false,
        createdAt: new Date(),
        urgency: 1,
        importance: 1,
      },
      {
        id: "plate",
        description: "Plate",
        lists: ["dishes"],
        stage: "list",
        completed: false,
        createdAt: new Date(),
        urgency: 1,
        importance: 1,
      },
    ])
    renderDialog()
    await user.click(screen.getByRole("button", { name: "Clear list" }))
    const confirm = await screen.findByRole("dialog", { name: /Are you sure/i })
    await user.click(within(confirm).getByRole("button", { name: "Clear list" }))
    const tasks = useTaskStore.getState().tasks
    expect(tasks.map((t) => t.id).sort()).toEqual(["plate", "spoon"])
    expect(tasks.find((t) => t.id === "spoon")?.lists).toEqual(["other"])
    expect(tasks.find((t) => t.id === "plate")?.lists).toEqual([])
    expect(useTaskStore.getState().lists.find((l) => l.id === "dishes")).toBeTruthy()
  })

  it("folder All Items settings keep view modes and omit delete, clear, filing, and links", async () => {
    const user = userEvent.setup()
    const allItems = list({
      id: "__all-items__kitchen",
      name: "All Items",
      description: "All items in this folder",
    })
    useTaskStore.getState().setLists([allItems, dishes])
    const onSave = vi.fn()
    const onDelete = vi.fn()
    render(
      <EditListDialog
        editingCategory={allItems}
        onEditingCategoryChange={vi.fn()}
        folders={[kitchen]}
        homePinned={[]}
        listDisplay={{}}
        setListDisplay={vi.fn()}
        toggleHomePin={vi.fn()}
        onOpenIconPicker={vi.fn()}
        onSave={onSave}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText("View mode settings")).toBeInTheDocument()
    expect(screen.getByText("Default view mode settings")).toBeInTheDocument()
    expect(screen.getByText("Checklist view mode settings")).toBeInTheDocument()
    expect(screen.getByText("Details view mode settings")).toBeInTheDocument()
    expect(screen.getByText("Spreadsheet view mode settings")).toBeInTheDocument()
    expect(screen.getByText("Display options offered")).toBeInTheDocument()
    expect(screen.queryByText("In folders")).not.toBeInTheDocument()
    expect(screen.queryByText("Connected lists")).not.toBeInTheDocument()
    expect(screen.queryByTestId("list-danger-actions")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Clear list" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save Changes" }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onDelete).not.toHaveBeenCalled()
    expect(useTaskStore.getState().folders.find((f) => f.id === "kitchen")).toBeTruthy()
    expect(useTaskStore.getState().lists.find((l) => l.id === "dishes")).toBeTruthy()
  })

  it("global All settings keep view modes and omit delete, clear, filing, and links", async () => {
    const user = userEvent.setup()
    const globalAll = list({
      id: "__all-items__root",
      name: "All Items",
      description: "All items",
    })
    useTaskStore.getState().setLists([globalAll, dishes])
    const onSave = vi.fn()
    const onDelete = vi.fn()
    render(
      <EditListDialog
        editingCategory={globalAll}
        onEditingCategoryChange={vi.fn()}
        folders={[kitchen]}
        homePinned={[]}
        listDisplay={{}}
        setListDisplay={vi.fn()}
        toggleHomePin={vi.fn()}
        onOpenIconPicker={vi.fn()}
        onSave={onSave}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText("View mode settings")).toBeInTheDocument()
    expect(screen.getByText("Display options offered")).toBeInTheDocument()
    expect(screen.queryByText("In folders")).not.toBeInTheDocument()
    expect(screen.queryByText("Connected lists")).not.toBeInTheDocument()
    expect(screen.queryByTestId("list-danger-actions")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Clear list" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save Changes" }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onDelete).not.toHaveBeenCalled()
    expect(useTaskStore.getState().lists.find((l) => l.id === "dishes")).toBeTruthy()
  })
})
