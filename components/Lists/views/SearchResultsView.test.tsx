/**
 * SearchResultsView — global search hits; select mode for merge/move/all.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Folder, List, Task } from "@/lib/types"
import { SearchResultsView } from "./SearchResultsView"

const folder: Folder = { id: "f1", name: "Work", color: "#3B82F6", createdAt: new Date(), listIds: ["l1"] }
const list: List = {
  id: "l1",
  name: "Books",
  color: "#3B82F6",
  description: "",
  createdAt: new Date(),
  order: 0,
}
const task: Task = {
  id: "t1",
  description: "Dune",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: ["l1"],
}

const base = {
  searchTerm: "du",
  folders: [folder],
  lists: [list],
  tasks: [task],
  getTasksForCategory: () => [task],
  onSelectFolder: vi.fn(),
  onSelectList: vi.fn(),
  onSelectTask: vi.fn(),
}

describe("SearchResultsView select mode", () => {
  it("navigates on click when select mode is off", async () => {
    const user = userEvent.setup()
    const onSelectTask = vi.fn()
    render(<SearchResultsView {...base} onSelectTask={onSelectTask} />)
    await user.click(screen.getByText("Dune"))
    expect(onSelectTask).toHaveBeenCalledWith("t1")
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("toggles selection instead of navigating when select mode is on", async () => {
    const user = userEvent.setup()
    const onToggleTaskSelect = vi.fn()
    const onToggleListSelect = vi.fn()
    const onToggleFolderSelect = vi.fn()
    const onSelectTask = vi.fn()
    render(
      <SearchResultsView
        {...base}
        selectMode
        selectedTaskIds={[]}
        selectedListIds={[]}
        selectedFolderIds={[]}
        onToggleTaskSelect={onToggleTaskSelect}
        onToggleListSelect={onToggleListSelect}
        onToggleFolderSelect={onToggleFolderSelect}
        onSelectTask={onSelectTask}
      />,
    )
    await user.click(screen.getByText("Dune"))
    expect(onToggleTaskSelect).toHaveBeenCalledWith("t1")
    expect(onSelectTask).not.toHaveBeenCalled()
    await user.click(screen.getByRole("checkbox", { name: "Select list Books" }))
    expect(onToggleListSelect).toHaveBeenCalledWith("l1")
    await user.click(screen.getByRole("checkbox", { name: "Select folder Work" }))
    expect(onToggleFolderSelect).toHaveBeenCalledWith("f1")
  })
})
