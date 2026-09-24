/**
 * ListContentDetails — renders detailsColumns in order; defaults if unset.
 */
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { builtinColumnId } from "@/lib/spreadsheet-catalog"
import type { List, Task } from "@/lib/types"
import { ListContentDetails } from "./ListContentDetails"

const books: List = {
  id: "books",
  name: "Books",
  color: "#3B82F6",
  description: "",
  createdAt: new Date("2026-01-01"),
  order: 0,
  itemAttributes: [
    { id: "author", name: "Author", type: "string" },
    { id: "pages", name: "Pages", type: "number" },
  ],
}

const task = (partial: Partial<Task> & Pick<Task, "id" | "description">): Task => ({
  stage: "list",
  createdAt: new Date("2026-01-01"),
  completed: false,
  lists: ["books"],
  ...partial,
})

const dune = task({ id: "b1", description: "Dune", attributes: { author: "Herbert", pages: 884 }, importance: 4 })

function renderDetails(list: List, tasks: Task[] = [dune]) {
  useTaskStore.getState().setLists([list])
  useTaskStore.getState().setTasks(tasks)
  return render(
    <ListContentDetails
      tasks={tasks}
      openCategory={list}
      categories={[list]}
      folders={[]}
      openFolderAll={false}
      currentFolder={null}
      onTaskSelect={vi.fn()}
      onCompleteTask={vi.fn()}
      onTaskDragStart={vi.fn()}
      onDragEnd={vi.fn()}
    />,
  )
}

function headerTexts(): string[] {
  return screen.getAllByRole("columnheader").map((el) => el.textContent ?? "")
}

describe("ListContentDetails columns", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("defaults to schema attributes in declaration order", () => {
    renderDetails(books)
    const headers = headerTexts()
    expect(headers).toEqual(["Name", "Author", "Pages", "Actions"])
    expect(screen.getByText("Herbert")).toBeInTheDocument()
  })

  it("renders persisted detailsColumns in that order, including built-ins", () => {
    renderDetails({
      ...books,
      detailsColumns: ["pages", builtinColumnId("importance"), "author"],
      sheetConfig: { columnIds: ["author"] },
    })
    expect(headerTexts()).toEqual(["Name", "Pages", "Importance", "Author", "Actions"])
    expect(screen.getByText("884")).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
  })

  it("empty detailsColumns hides extras without dropping Name", () => {
    renderDetails({ ...books, detailsColumns: [] })
    expect(headerTexts()).toEqual(["Name", "Actions"])
    expect(screen.queryByText("Author")).not.toBeInTheDocument()
    expect(screen.getByText("Dune")).toBeInTheDocument()
  })

  it("has no complete or missed checkboxes — those belong to Checklist", () => {
    renderDetails(books)
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Missed opportunity/i })).not.toBeInTheDocument()
    expect(document.querySelectorAll(".fm-checkbox")).toHaveLength(0)
  })

  it("shows select-mode checkboxes without complete ticks", () => {
    useTaskStore.getState().setLists([books])
    useTaskStore.getState().setTasks([dune])
    render(
      <ListContentDetails
        tasks={[dune]}
        openCategory={books}
        categories={[books]}
        folders={[]}
        openFolderAll={false}
        currentFolder={null}
        onTaskSelect={vi.fn()}
        onCompleteTask={vi.fn()}
        onTaskDragStart={vi.fn()}
        onDragEnd={vi.fn()}
        selectMode
        selectedTaskIds={["b1"]}
        onToggleTaskSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole("checkbox", { name: "Select Dune" })).toBeChecked()
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument()
  })
})
