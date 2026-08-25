import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import type { Folder } from "@/lib/types"
import type { GridEntry } from "@/components/Lists/types"
import { FolderViewDetails } from "./FolderViewDetails"

const entry = (kind: GridEntry["kind"], id: string, name: string): GridEntry => ({
  kind,
  id,
  name,
  count: 1,
})

const folder = (partial: Partial<Folder> & Pick<Folder, "id" | "name">): Folder => ({
  createdAt: new Date(),
  listIds: [],
  ...partial,
})

function renderDetails(overrides: Partial<ComponentProps<typeof FolderViewDetails>> = {}) {
  const props: ComponentProps<typeof FolderViewDetails> = {
    entries: [
      entry("folder", "child", "Child"),
      entry("list", "groceries", "Groceries"),
      entry("smart", "daily", "Daily To Do List"),
    ],
    folders: [
      folder({ id: "work", name: "Work", listIds: ["groceries"] }),
      folder({ id: "home", name: "Home", listIds: ["groceries"] }),
      folder({ id: "root", name: "Root" }),
      folder({ id: "child", name: "Child", parentFolderId: "root" }),
    ],
    activeIconId: null,
    handleCategoryDragStart: vi.fn(),
    setActiveIconId: vi.fn(),
    openEntry: vi.fn(),
    getCategoryCompletionRate: () => 0,
    ...overrides,
  }
  return { ...render(<FolderViewDetails {...props} />), props }
}

describe("FolderViewDetails Within column", () => {
  it("shows how many folders a list or folder is within", () => {
    renderDetails()
    expect(screen.getByRole("columnheader", { name: "Within" })).toBeInTheDocument()
    const groceries = screen.getByText("Groceries").closest("tr")!
    expect(within(groceries).getByText("2")).toBeInTheDocument()
    const child = screen.getByText("Child").closest("tr")!
    expect(within(child).getByText("1")).toBeInTheDocument()
    const smart = screen.getByText("Daily To Do List").closest("tr")!
    const smartCells = within(smart).getAllByRole("cell")
    expect(smartCells[smartCells.length - 1]).toHaveTextContent("—")
  })

  it("lists containing folder names when the toggle is on", () => {
    renderDetails()
    fireEvent.click(screen.getByRole("checkbox", { name: "List within folder names" }))
    const groceries = screen.getByText("Groceries").closest("tr")!
    expect(within(groceries).getByText("Home, Work")).toBeInTheDocument()
    const child = screen.getByText("Child").closest("tr")!
    expect(within(child).getByText("Root")).toBeInTheDocument()
  })
})
