/**
 * SelectionToolbar — list/folder select-mode actions + searchable folder destinations.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Folder } from "@/lib/types"
import { SelectionToolbar } from "./SelectionToolbar"

const folders: Folder[] = [
  { id: "f1", name: "Work", color: "#3B82F6", createdAt: new Date(), listIds: [] },
  { id: "f2", name: "Home", color: "#22C55E", createdAt: new Date(), listIds: [] },
  { id: "f3", name: "Archive projects", color: "#64748B", createdAt: new Date(), listIds: [], description: "old stuff" },
]

const base = {
  selectedListCount: 2,
  selectedFolderCount: 0,
  placementMode: "keep" as const,
  originIsAll: false,
  destinationFolders: folders,
  onSelectAll: vi.fn(),
  onDeselectAll: vi.fn(),
  onPlacementModeChange: vi.fn(),
  onAddToNewFolder: vi.fn(),
  onAddToFolder: vi.fn(),
  onMerge: vi.fn(),
  onDelete: vi.fn(),
}

describe("SelectionToolbar folder search", () => {
  it("lists every destination folder when search is empty", () => {
    render(<SelectionToolbar {...base} />)
    expect(screen.getByRole("option", { name: "→ Work" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "→ Home" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "→ Archive projects" })).toBeInTheDocument()
  })

  it("filters folders by name", async () => {
    const user = userEvent.setup()
    render(<SelectionToolbar {...base} />)
    await user.type(screen.getByRole("searchbox", { name: "Search folders" }), "work")
    expect(screen.getByRole("option", { name: "→ Work" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "→ Home" })).not.toBeInTheDocument()
  })

  it("filters folders by description", async () => {
    const user = userEvent.setup()
    render(<SelectionToolbar {...base} />)
    await user.type(screen.getByRole("searchbox", { name: "Search folders" }), "old")
    expect(screen.getByRole("option", { name: "→ Archive projects" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "→ Work" })).not.toBeInTheDocument()
  })

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup()
    render(<SelectionToolbar {...base} />)
    await user.type(screen.getByRole("searchbox", { name: "Search folders" }), "zzzz")
    expect(screen.getByText(/No folders match/)).toBeInTheDocument()
  })

  it("still adds to the chosen folder", async () => {
    const user = userEvent.setup()
    const onAddToFolder = vi.fn()
    render(<SelectionToolbar {...base} onAddToFolder={onAddToFolder} />)
    await user.type(screen.getByRole("searchbox", { name: "Search folders" }), "home")
    await user.click(screen.getByRole("option", { name: "→ Home" }))
    expect(onAddToFolder).toHaveBeenCalledWith("f2")
  })
})
