import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FolderTree } from "../FolderTree"

const mockFolders = [
  { id: "f1", name: "Work", color: "#ff0000", createdAt: new Date(), categoryIds: [] },
  { id: "f2", name: "Personal", color: "#0000ff", createdAt: new Date(), categoryIds: [] },
]

describe("FolderTree", () => {
  it("renders all folders", () => {
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
})
