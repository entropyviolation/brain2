import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import type { GridEntry } from "@/components/Lists/types"
import { FolderViewList } from "./FolderViewList"

vi.mock("@/components/Lists/lib/icon-utils", () => ({
  FolderGlyph: () => <span data-testid="folder-glyph" />,
  iconFor: () => "/orb.png",
  orbFor: () => "/orb.png",
}))

const entry = (kind: GridEntry["kind"], id: string, name: string): GridEntry => ({
  kind,
  id,
  name,
  count: 1,
})

function renderList(overrides: Partial<ComponentProps<typeof FolderViewList>> = {}) {
  const props: ComponentProps<typeof FolderViewList> = {
    entries: [
      entry("folder", "sub", "Subfolder"),
      entry("folder-all", "all-f1", "All Items"),
      entry("list", "list-1", "list 1"),
      entry("list", "list-2", "list 2"),
    ],
    activeIconId: null,
    handleCategoryDragStart: vi.fn(),
    handleDragOver: vi.fn(),
    handleDropOnEntry: vi.fn(),
    clearDrag: vi.fn(),
    setActiveIconId: vi.fn(),
    openEntry: vi.fn(),
    inFolder: true,
    ...overrides,
  }
  return { ...render(<FolderViewList {...props} />), props }
}

describe("FolderViewList", () => {
  it("searches lists in the current folder and pins matches to the top", () => {
    renderList()
    const search = screen.getByRole("searchbox", { name: "Search lists in this folder" })
    fireEvent.change(search, { target: { value: "list 2" } })
    const names = [...document.querySelectorAll(".fm-link-text")].map((n) => n.textContent)
    expect(names[0]).toBe("list 2")
  })

  it("selects multiple lists and folders and highlights them together", () => {
    const onToggleListSelect = vi.fn()
    const onToggleFolderSelect = vi.fn()
    const { rerender, props } = renderList({
      selectMode: true,
      selectedCategories: ["list-1"],
      selectedFolderIds: ["sub"],
      onToggleListSelect,
      onToggleFolderSelect,
    })
    expect(screen.getByRole("checkbox", { name: "Select list 1" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Select Subfolder" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Select list 2" })).not.toBeChecked()
    expect(screen.queryByRole("checkbox", { name: "Select All Items" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("list 2"))
    expect(onToggleListSelect).toHaveBeenCalledWith("list-2")

    rerender(
      <FolderViewList
        {...props}
        selectMode
        selectedCategories={["list-1", "list-2"]}
        selectedFolderIds={["sub"]}
        onToggleListSelect={onToggleListSelect}
        onToggleFolderSelect={onToggleFolderSelect}
      />,
    )
    const selectedRows = document.querySelectorAll(".fm-link-row.selected")
    expect(selectedRows).toHaveLength(3)
  })

  it("does not open an entry on double-click while select mode is on", () => {
    const { props } = renderList({ selectMode: true, onToggleListSelect: vi.fn() })
    fireEvent.doubleClick(screen.getByText("list 1"))
    expect(props.openEntry).not.toHaveBeenCalled()
  })
})
