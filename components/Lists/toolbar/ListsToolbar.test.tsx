import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ListsToolbar } from "./ListsToolbar"

const props = {
  openTarget: null,
  isHome: true,
  isAll: false,
  searchResetKey: 0,
  searchActive: false,
  selectMode: false,
  folderView: "icons" as const,
  currentDisplay: "default" as const,
  location: "home",
  entryKeys: [],
  onUp: vi.fn(),
  onNewList: vi.fn(),
  onNewFolder: vi.fn(),
  onImportCsv: vi.fn(),
  onSettings: vi.fn(),
  onToggleSelect: vi.fn(),
  onSearchChange: vi.fn(),
  onClearSearch: vi.fn(),
  onFolderViewChange: vi.fn(),
  onListDisplayChange: vi.fn(),
  onAutoOrganize: vi.fn(),
}

describe("ListsToolbar", () => {
  it("keeps New / Settings / Select and does not show Completed or Missed Opportunities buttons", () => {
    render(<ListsToolbar {...props} />)
    expect(screen.getByRole("button", { name: "New List" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Completed" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Missed Opportunities" })).not.toBeInTheDocument()
  })
})
