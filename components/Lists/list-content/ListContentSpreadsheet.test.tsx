/**
 * ListContentSpreadsheet — persists column widths and hide on List.sheetConfig.
 */
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { columnWidthsByList, NAME_COLUMN_ID } from "@/lib/spreadsheet-contract"
import type { List, Task } from "@/lib/types"
import { ListContentSpreadsheet } from "./ListContentSpreadsheet"
import { SpreadsheetViewSettings } from "@/components/Lists/dialogs/SpreadsheetViewSettings"

const living: List = {
  id: "living-room",
  name: "Living Room",
  color: "#3B82F6",
  description: "",
  createdAt: new Date("2026-01-01"),
  order: 0,
  itemAttributes: [
    { id: "tidyImportance", name: "Priority", type: "selection", options: ["Crucial", "Important", "Preferred"] },
    { id: "estMin", name: "Est", type: "number", unit: "min" },
    { id: "actualSec", name: "Actual", type: "number", unit: "s", allowFloat: false },
  ],
  sheetConfig: { columnIds: ["tidyImportance", "estMin", "actualSec"] },
}

const books: List = {
  id: "books",
  name: "Books",
  color: "#10B981",
  description: "",
  createdAt: new Date("2026-01-01"),
  order: 1,
  itemAttributes: [{ id: "pages", name: "Pages", type: "number" }],
}

function item(partial: Partial<Task> & Pick<Task, "id" | "description" | "lists">): Task {
  return {
    stage: "list",
    createdAt: new Date("2026-01-01"),
    completed: false,
    ...partial,
  }
}

function renderSheet(list: List, extraLists: List[] = []) {
  const tasks = [
    item({ id: "t1", description: "Clear surfaces", lists: [list.id], attributes: { tidyImportance: "Important", estMin: 10 } }),
  ]
  useTaskStore.getState().setLists([list, ...extraLists])
  useTaskStore.getState().setTasks(tasks)
  return render(
    <ListContentSpreadsheet
      tasks={tasks}
      openCategory={list}
      categories={[list, ...extraLists]}
      folders={[]}
      openFolderAll={false}
      currentFolder={null}
      itemLabel="Item"
      onTaskSelect={vi.fn()}
      onCompleteTask={vi.fn()}
      onTaskDragStart={vi.fn()}
      onDragEnd={vi.fn()}
    />,
  )
}

describe("ListContentSpreadsheet persist", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("writes resized widths onto this list's sheetConfig.columnWidths immediately", () => {
    renderSheet(living)
    const handles = screen.getAllByLabelText("Resize column")
    fireEvent.pointerDown(handles[1], { clientX: 40 })
    fireEvent.pointerMove(window, { clientX: 120 })
    fireEvent.pointerUp(window)
    const stored = useTaskStore.getState().lists.find((l) => l.id === "living-room")
    expect(stored?.sheetConfig?.columnWidths?.tidyImportance).toBe(240)
    expect(columnWidthsByList(useTaskStore.getState().lists)).toEqual({
      "living-room": { tidyImportance: 240 },
    })
  })

  it("keeps a per-list width map so switching lists does not share widths", () => {
    useTaskStore.getState().setLists([
      { ...living, sheetConfig: { columnWidths: { estMin: 200 } } },
      { ...books, sheetConfig: { columnWidths: { [NAME_COLUMN_ID]: 280 } } },
    ])
    expect(columnWidthsByList(useTaskStore.getState().lists)).toEqual({
      "living-room": { estMin: 200 },
      books: { [NAME_COLUMN_ID]: 280 },
    })
  })

  it("renders centered padded headers for Item / Priority / Est", () => {
    renderSheet(living)
    const priority = screen.getByRole("columnheader", { name: /Priority/ })
    expect(priority).toHaveClass("sheet-th")
    expect(priority.querySelector(".sheet-th-sort")).toHaveClass("sheet-th-sort")
    expect(priority.querySelector(".sheet-th-label")?.textContent).toBe("Priority")
    expect(screen.getByRole("columnheader", { name: /Est/ }).querySelector(".sheet-th-unit")?.textContent).toBe("(min)")
  })

  it("hiding Actual writes sheetConfig.columnIds and the settings picker shows it unchecked", async () => {
    const user = userEvent.setup()
    renderSheet(living)
    expect(screen.getByRole("columnheader", { name: /Actual/ }).querySelector(".sheet-th-unit")?.textContent).toBe("(s)")
    await user.click(screen.getByLabelText("Actual column menu"))
    await user.click(screen.getByText("Hide column"))
    expect(screen.queryByRole("button", { name: /Sort Actual/ })).not.toBeInTheDocument()
    const stored = useTaskStore.getState().lists.find((l) => l.id === "living-room")!
    expect(stored.sheetConfig?.columnIds).toEqual(["tidyImportance", "estMin"])
    expect(stored.itemAttributes?.some((d) => d.id === "actualSec")).toBe(true)
    const onChange = vi.fn()
    render(<SpreadsheetViewSettings list={stored} onChange={onChange} />)
    expect(screen.getByRole("checkbox", { name: "Actual column" })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Priority column" })).toBeChecked()
    await user.click(screen.getByRole("checkbox", { name: "Actual column" }))
    const restored = onChange.mock.calls[0][0] as List
    expect(restored.sheetConfig?.columnIds).toContain("actualSec")
    expect(restored.itemAttributes?.some((d) => d.id === "actualSec")).toBe(true)
  })

  it("Attribute settings on a mapped attr opens the existing editor for that id", async () => {
    const user = userEvent.setup()
    renderSheet(living)
    await user.click(screen.getByLabelText("Actual column menu"))
    await user.click(screen.getByRole("menuitem", { name: "Attribute settings" }))
    expect(screen.getByRole("dialog", { name: "Attribute settings" })).toBeInTheDocument()
    expect(screen.getByDisplayValue("Actual")).toBeInTheDocument()
    expect(useTaskStore.getState().lists.find((l) => l.id === "living-room")?.itemAttributes?.some((d) => d.id === "actualSec")).toBe(
      true,
    )
  })
})
