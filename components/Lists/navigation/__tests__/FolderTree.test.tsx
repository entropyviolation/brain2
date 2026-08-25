import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FolderTree } from "../FolderTree"

const mockFolders = [
  { id: "f1", name: "Work", color: "#ff0000", createdAt: new Date(), listIds: [] },
  { id: "f2", name: "Personal", color: "#0000ff", createdAt: new Date(), listIds: [] },
  {
    id: "na",
    name: "Next Actions",
    color: "#2563eb",
    createdAt: new Date(),
    listIds: [],
    parentFolderId: undefined,
  },
  {
    id: "na-scheduled",
    name: "Scheduled",
    color: "#64748b",
    createdAt: new Date(),
    listIds: [],
    parentFolderId: "na",
  },
  {
    id: "na-sched-y-2026",
    name: "2026",
    color: "#94a3b8",
    createdAt: new Date(),
    listIds: [],
    parentFolderId: "na-scheduled",
  },
]

describe("FolderTree", () => {
  it("renders root folders only when collapsed", () => {
    render(
      <FolderTree
        folders={mockFolders}
        location="home"
        openTarget={null}
        isHome
        isAll={false}
        onNavTo={vi.fn()}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onCreateFolder={vi.fn()}
      />,
    )
    expect(screen.getByText("Work")).toBeInTheDocument()
    expect(screen.getByText("Personal")).toBeInTheDocument()
    expect(screen.getByText("Next Actions")).toBeInTheDocument()
    // Next Actions auto-expands, so its child is visible; deeper years stay collapsed.
    expect(screen.getByText("Scheduled")).toBeInTheDocument()
    expect(screen.queryByText("2026")).not.toBeInTheDocument()
  })

  it("expands nested folders when toggled", () => {
    render(
      <FolderTree
        folders={mockFolders}
        location="home"
        openTarget={null}
        isHome
        isAll={false}
        onNavTo={vi.fn()}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onCreateFolder={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText("Expand folder"))
    expect(screen.getByText("Scheduled")).toBeInTheDocument()
  })

  it("highlights the selected folder", () => {
    render(
      <FolderTree
        folders={mockFolders}
        location="f1"
        openTarget={null}
        isHome={false}
        isAll={false}
        onNavTo={vi.fn()}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onCreateFolder={vi.fn()}
      />,
    )
    expect(screen.getByText("Work").closest(".active")).toBeTruthy()
  })

  it("calls onNavTo when a folder is clicked", () => {
    const onNavTo = vi.fn()
    render(
      <FolderTree
        folders={mockFolders}
        location="home"
        openTarget={null}
        isHome
        isAll={false}
        onNavTo={onNavTo}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onCreateFolder={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText("Personal"))
    expect(onNavTo).toHaveBeenCalledWith("f2")
  })

  it("calls onEditFolder from the settings button", () => {
    const onEditFolder = vi.fn()
    render(
      <FolderTree
        folders={mockFolders}
        location="home"
        openTarget={null}
        isHome
        isAll={false}
        onNavTo={vi.fn()}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onCreateFolder={vi.fn()}
        onEditFolder={onEditFolder}
      />,
    )
    fireEvent.click(screen.getByLabelText("Edit Work"))
    expect(onEditFolder).toHaveBeenCalledWith(expect.objectContaining({ id: "f1" }))
  })

  it("adds Module Lists to Quick Access when the folder exists", () => {
    render(
      <FolderTree
        folders={[
          ...mockFolders,
          { id: "folder-module-lists", name: "Module Lists", createdAt: new Date(), listIds: [] },
        ]}
        location="home"
        openTarget={null}
        isHome
        isAll={false}
        onNavTo={vi.fn()}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onCreateFolder={vi.fn()}
      />,
    )
    expect(screen.getAllByText("Module Lists").length).toBeGreaterThanOrEqual(2)
  })
})
