/**
 * SheetFullscreen — in-app spreadsheet window: enter/exit, Esc, one live grid.
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { List, Task } from "@/lib/types"
import { ListContentSpreadsheet } from "./ListContentSpreadsheet"

const LIST: List = {
  id: "list1",
  name: "Budget",
  color: "#3B82F6",
  description: "",
  createdAt: new Date(),
  order: 0,
  itemAttributes: [{ id: "cost", name: "Cost", type: "number", unit: "$" }],
  displayedAttributes: ["cost"],
}

function makeTask(id: string, description: string, cost: number): Task {
  return {
    id,
    description,
    title: description,
    stage: "list",
    createdAt: new Date(),
    completed: false,
    lists: ["list1"],
    attributes: { cost },
  }
}

function seed(): Task[] {
  const tasks = [makeTask("a", "Apple", 10), makeTask("b", "Banana", 30)]
  useTaskStore.getState().setLists([LIST])
  useTaskStore.getState().setTasks(tasks)
  return tasks
}

function renderSheet(tasks: Task[]) {
  return render(
    <ListContentSpreadsheet
      tasks={tasks}
      openCategory={LIST}
      categories={[LIST]}
      folders={[]}
      openFolderAll={false}
      currentFolder={null}
      itemLabel="item"
      onTaskSelect={vi.fn()}
      onCompleteTask={vi.fn()}
      onTaskDragStart={vi.fn()}
      onDragEnd={vi.fn()}
    />,
  )
}

async function enterFullscreen(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Fullscreen spreadsheet" }))
  expect(await screen.findByRole("dialog", { name: /Budget — Spreadsheet/ })).toBeInTheDocument()
}

describe("spreadsheet in-app fullscreen", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("enters a near-viewport window and keeps a single formula bar", async () => {
    const user = userEvent.setup()
    renderSheet(seed())

    expect(await screen.findByRole("button", { name: "Fullscreen spreadsheet" })).toBeInTheDocument()
    expect(screen.getAllByLabelText("Formula bar")).toHaveLength(1)

    await enterFullscreen(user)

    expect(screen.getAllByLabelText("Formula bar")).toHaveLength(1)
    expect(document.querySelectorAll("[data-sheet-instance]")).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Exit fullscreen" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Restore down" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
  })

  it("exits when Close is clicked and returns to the in-pane grid", async () => {
    const user = userEvent.setup()
    renderSheet(seed())
    await enterFullscreen(user)

    await user.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /Budget — Spreadsheet/ })).not.toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: "Fullscreen spreadsheet" })).toBeInTheDocument()
    expect(screen.getAllByLabelText("Formula bar")).toHaveLength(1)
  })

  it("exits on Escape when a cell is not being edited", async () => {
    const user = userEvent.setup()
    renderSheet(seed())
    await enterFullscreen(user)

    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /Budget — Spreadsheet/ })).not.toBeInTheDocument()
    })
  })

  it("commits an in-progress cell edit when exiting fullscreen", async () => {
    const user = userEvent.setup()
    renderSheet(seed())
    await enterFullscreen(user)

    const cost = screen.getByText("10 $")
    const td = cost.closest("td")!
    await user.dblClick(td)
    const editor = document.activeElement as HTMLInputElement
    await user.clear(editor)
    await user.type(editor, "77")

    await user.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() => {
      expect(useTaskStore.getState().tasks.find((t) => t.id === "a")?.attributes?.cost).toBe(77)
    })
  })
})
