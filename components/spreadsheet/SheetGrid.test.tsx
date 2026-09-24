/**
 * SheetGrid — editable grid: cell commit, formula read-only guard, sort, filter,
 * Sheets-style double-click edit, and TSV clipboard paste.
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task, List, AttributeValue } from "@/lib/types"
import { SheetGrid } from "./SheetGrid"

const CATEGORY: List = {
  id: "list1",
  name: "Budget",
  color: "#3B82F6",
  description: "",
  createdAt: new Date(),
  order: 0,
  itemAttributes: [
    { id: "cost", name: "Cost", type: "number", unit: "$" },
    { id: "total", name: "Total", type: "formula", formula: "=cost*2", formatAs: "currency", unit: "$" },
  ],
  displayedAttributes: ["cost", "total"],
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

function seed(order: Array<[string, string, number]> = [["a", "Apple", 10], ["b", "Banana", 30]]): Task[] {
  const tasks = order.map(([id, name, cost]) => makeTask(id, name, cost))
  useTaskStore.getState().setLists([CATEGORY])
  useTaskStore.getState().setTasks(tasks)
  return tasks
}

const rowOrder = () => screen.getAllByText(/^(Apple|Banana)$/).map((el) => el.textContent)

/** Select a cell by visible text without entering edit mode. */
function selectCellByText(text: string, shiftKey = false) {
  const el = screen.getByText(text)
  const td = el.closest("td")!
  fireEvent.mouseDown(td, { shiftKey })
}

/** Double-click to enter Sheets-style edit mode. */
async function editCellByText(user: ReturnType<typeof userEvent.setup>, text: string) {
  const el = screen.getByText(text)
  const td = el.closest("td")!
  await user.dblClick(td)
}

describe("SheetGrid", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("commits an edited cell value through updateTask", async () => {
    const user = userEvent.setup()
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)

    await editCellByText(user, "10 $")
    // Cells are Google-Sheets-style text inputs (so "=" formulas are typeable);
    // the inline editor is auto-focused.
    const editor = document.activeElement as HTMLInputElement
    await user.clear(editor)
    await user.type(editor, "99{Enter}")

    expect(useTaskStore.getState().tasks.find((t) => t.id === "a")?.attributes?.cost).toBe(99)
  })

  it("renders formula cells as read-only and rejects writes via the formula bar", async () => {
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)

    // Computed value is displayed (cost 10 * 2, currency).
    expect(screen.getByText("$20.00")).toBeInTheDocument()

    // Selecting the formula cell shows its expression in the (disabled) formula bar.
    selectCellByText("$20.00")
    const formulaBar = screen.getByLabelText("Formula bar") as HTMLInputElement
    expect(formulaBar).toBeDisabled()
    expect(formulaBar.value).toContain("cost*2")

    // No inline editor is offered for the computed column.
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()

    // The underlying row is untouched (no stored value for the formula column).
    expect(useTaskStore.getState().tasks.find((t) => t.id === "a")?.attributes?.total).toBeUndefined()
  })

  it("sorts rows when a column header is clicked", async () => {
    const user = userEvent.setup()
    const tasks = seed()

    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)
    expect(rowOrder()).toEqual(["Apple", "Banana"])

    const costHeader = screen.getByRole("button", { name: /Sort Cost/ })

    await user.click(costHeader) // asc → already ascending by cost
    expect(rowOrder()).toEqual(["Apple", "Banana"])

    await user.click(costHeader) // desc
    expect(rowOrder()).toEqual(["Banana", "Apple"])
  })

  it("filters rows by the free-text filter", async () => {
    const user = userEvent.setup()
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)

    expect(screen.getByText("Apple")).toBeInTheDocument()
    expect(screen.getByText("Banana")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Filter rows"), "Apple")

    expect(screen.getByText("Apple")).toBeInTheDocument()
    expect(screen.queryByText("Banana")).not.toBeInTheDocument()
  })

  it("shows a currency-aware total footer for numeric columns", () => {
    const tasks = seed()
    const { container } = render(
      <SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />,
    )
    const footer = container.querySelector("tfoot")!
    // cost 10 + 30 = $40.00 (currency-aware, "$" unit)
    expect(within(footer).getByText("$40.00")).toBeInTheDocument()
  })

  it("adds a new column to the list's attributes and surfaces it even when columns are curated", async () => {
    const user = userEvent.setup()
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn />)

    // Open the add-column dialog and create a text column "Notes".
    await user.click(screen.getByTitle("Add column"))
    await user.type(screen.getByPlaceholderText("e.g. Cost"), "Notes")
    await user.click(screen.getByRole("button", { name: "Add column" }))

    // The attribute is appended to the list, and to the curated displayed set
    // (so the column is actually visible rather than silently hidden).
    const list = useTaskStore.getState().lists.find((l) => l.id === "list1")!
    expect(list.itemAttributes?.some((a) => a.id === "notes" && a.type === "string")).toBe(true)
    expect(list.displayedAttributes).toEqual(["cost", "total", "notes"])

    // The new header renders in the grid.
    expect(screen.getByRole("button", { name: /Sort Notes/ })).toBeInTheDocument()
  })

  it("writes a value into the new column onto the item in that row", async () => {
    const user = userEvent.setup()
    const tasks = seed([["a", "Apple", 10]])
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn />)

    await user.click(screen.getByTitle("Add column"))
    await user.type(screen.getByPlaceholderText("e.g. Cost"), "Notes")
    await user.click(screen.getByRole("button", { name: "Add column" }))

    // Notes is the last data column on the Apple row (gutter, name, cost, total, notes).
    const appleRow = screen.getByText("Apple").closest("tr")!
    const notesTd = appleRow.querySelectorAll("td")[4]
    await user.dblClick(notesTd)
    await user.keyboard("buy more{Enter}")

    expect(useTaskStore.getState().tasks.find((t) => t.id === "a")?.attributes?.notes).toBe("buy more")
  })

  it("evaluates a per-cell =A1 formula and shows the computed result", () => {
    // Columns: A=name, B=cost, C=total. Banana's cost references Apple's (B1).
    const apple = makeTask("a", "Apple", 10)
    const banana: Task = { ...makeTask("b", "Banana", 0), attributes: { cost: "=B1+5" } }
    useTaskStore.getState().setLists([CATEGORY])
    useTaskStore.getState().setTasks([apple, banana])
    render(<SheetGrid categoryId="list1" tasks={[apple, banana]} enableAddRow={false} enableAddColumn={false} />)

    // 10 (Apple's cost) + 5 = 15 shown in Banana's cost cell.
    expect(screen.getByText("15")).toBeInTheDocument()
  })

  it("commits a formula typed into the formula bar onto the selected cell", async () => {
    const user = userEvent.setup()
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)

    // Select Banana's cost cell (B2) without opening the inline editor.
    selectCellByText("30 $")
    const bar = screen.getByLabelText("Formula bar")
    await user.clear(bar)
    await user.type(bar, "=B1+5{Enter}")

    // Stored verbatim as a formula; the cell now computes 10 + 5 = 15.
    expect(useTaskStore.getState().tasks.find((t) => t.id === "b")?.attributes?.cost).toBe("=B1+5")
  })

  it("shows a Google-Sheets-style sum for a multi-cell selection", () => {
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)

    // Anchor on Apple's cost, shift-extend to Banana's cost (B1:B2 = 10 + 30).
    selectCellByText("10 $")
    selectCellByText("30 $", true)

    expect(screen.getByText(/Sum: 40/)).toBeInTheDocument()
  })

  it("fills a formula down with relative references via the fill handle", () => {
    const FILL_LIST: List = {
      id: "fill1",
      name: "Calc",
      color: "#3B82F6",
      description: "",
      createdAt: new Date(),
      order: 0,
      itemAttributes: [
        { id: "x", name: "X", type: "number" },
        { id: "y", name: "Y", type: "number" },
      ],
      displayedAttributes: ["x", "y"],
    }
    const mk = (id: string, x: number, y: AttributeValue): Task => ({
      id,
      description: id,
      title: id,
      stage: "list",
      createdAt: new Date(),
      completed: false,
      lists: ["fill1"],
      attributes: { x, y },
    })
    // y = X * 2 as a per-cell formula on the first row (B is the X column).
    const rows = [mk("r1", 10, "=B1*2"), mk("r2", 5, undefined), mk("r3", 7, undefined)]
    useTaskStore.getState().setLists([FILL_LIST])
    useTaskStore.getState().setTasks(rows)
    render(<SheetGrid categoryId="fill1" tasks={rows} enableAddRow={false} enableAddColumn={false} />)

    // Select the Y cell of row 1 (computes 20) and drag its fill handle to row 3.
    const r1Cells = screen.getByText("r1").closest("tr")!.querySelectorAll("td")
    fireEvent.mouseDown(r1Cells[3])
    fireEvent.mouseDown(screen.getByLabelText("Fill handle"))
    // Y cell of row 3 (tds: 0 gutter, 1 name, 2 X, 3 Y) — keep the drag in column Y.
    const r3Cells = screen.getByText("r3").closest("tr")!.querySelectorAll("td")
    fireEvent.mouseOver(r3Cells[3])
    fireEvent.mouseUp(window)

    const after = useTaskStore.getState().tasks
    expect(after.find((t) => t.id === "r2")?.attributes?.y).toBe("=B2*2")
    expect(after.find((t) => t.id === "r3")?.attributes?.y).toBe("=B3*2")
  })

  it("pastes a TSV block across cells when not editing", () => {
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)

    selectCellByText("Apple")
    fireEvent.paste(window, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "Cherry\t50\nDate\t60" : ""),
      },
    })

    const after = useTaskStore.getState().tasks
    expect(after.find((t) => t.id === "a")?.description).toBe("Cherry")
    expect(after.find((t) => t.id === "a")?.attributes?.cost).toBe(50)
    expect(after.find((t) => t.id === "b")?.description).toBe("Date")
    expect(after.find((t) => t.id === "b")?.attributes?.cost).toBe(60)
  })

  it("pastes literal text into one cell while double-click editing", async () => {
    const user = userEvent.setup()
    const tasks = seed([["a", "Apple", 10]])
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)

    await editCellByText(user, "Apple")
    const editor = document.activeElement as HTMLInputElement
    expect(editor.tagName).toBe("INPUT")

    // Tabs/newlines stay in the single cell (no grid split) — matches Sheets edit mode.
    const literal = "line1\tcol2 and more tabs\there"
    fireEvent.change(editor, { target: { value: literal } })
    fireEvent.blur(editor)

    const apple = useTaskStore.getState().tasks.find((t) => t.id === "a")
    expect(apple?.description).toBe(literal)
    expect(apple?.attributes?.cost).toBe(10)
  })

  it("copies the selection as TSV", () => {
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)

    selectCellByText("Apple")
    selectCellByText("Banana", true)

    const setData = vi.fn()
    fireEvent.copy(window, {
      clipboardData: { setData },
    })

    expect(setData).toHaveBeenCalledWith("text/plain", expect.stringContaining("Apple"))
    expect(setData.mock.calls[0][1]).toMatch(/Apple.*\nBanana/)
  })

  it("shows attributes held on items even when they are not in displayedAttributes", () => {
    const apple: Task = { ...makeTask("a", "Apple", 10), attributes: { cost: 10, rating: 5 } }
    useTaskStore.getState().setLists([CATEGORY])
    useTaskStore.getState().setTasks([apple])
    render(<SheetGrid categoryId="list1" tasks={[apple]} enableAddRow={false} enableAddColumn={false} />)
    expect(screen.getByRole("button", { name: /Sort Rating/ })).toBeInTheDocument()
  })

  it("respects per-list columnIds from viewConfig", () => {
    const tasks = seed()
    render(
      <SheetGrid
        categoryId="list1"
        tasks={tasks}
        enableAddRow={false}
        enableAddColumn={false}
        viewConfig={{ columnIds: ["total"] }}
      />,
    )
    expect(screen.queryByRole("button", { name: /Sort Cost/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Sort Total/ })).toBeInTheDocument()
  })

  it("add column suggests attributes already associated with this list", async () => {
    const user = userEvent.setup()
    const tasks = seed()
    render(
      <SheetGrid
        categoryId="list1"
        tasks={tasks}
        enableAddRow={false}
        enableAddColumn
        viewConfig={{ columnIds: ["cost"] }}
      />,
    )
    await user.click(screen.getByTitle("Add column"))
    expect(screen.getByText("On this list")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Total/ })).toBeInTheDocument()
  })

  it("creating a new attribute assigns it so every row can hold a value", async () => {
    const user = userEvent.setup()
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn />)
    await user.click(screen.getByTitle("Add column"))
    expect(screen.getByRole("checkbox", { name: "Assign to every item on this list" })).toBeChecked()
    await user.type(screen.getByPlaceholderText("e.g. Cost"), "Mood")
    await user.click(screen.getByRole("button", { name: "Add column" }))
    const list = useTaskStore.getState().lists.find((l) => l.id === "list1")!
    expect(list.itemAttributes?.some((a) => a.id === "mood")).toBe(true)
    expect(list.sheetConfig?.columnIds).toContain("mood")
  })

  it("hiding a column removes it from this view and does not delete the attribute", async () => {
    const user = userEvent.setup()
    const tasks = seed()
    const onViewConfigChange = vi.fn()
    render(
      <SheetGrid
        categoryId="list1"
        tasks={tasks}
        enableAddRow={false}
        enableAddColumn={false}
        onViewConfigChange={onViewConfigChange}
      />,
    )
    await user.click(screen.getByLabelText("Cost column menu"))
    await user.click(screen.getByText("Hide column"))
    expect(screen.queryByRole("button", { name: /Sort Cost/ })).not.toBeInTheDocument()
    const list = useTaskStore.getState().lists.find((l) => l.id === "list1")!
    expect(list.itemAttributes?.some((a) => a.id === "cost")).toBe(true)
    expect(list.sheetConfig?.columnIds).not.toContain("cost")
    expect(list.sheetConfig?.columnIds).toContain("total")
    const last = onViewConfigChange.mock.calls.at(-1)?.[0] as { columnIds?: string[] }
    expect(last.columnIds).not.toContain("cost")
  })

  it("Attribute settings opens the schema editor for that column's attribute id", async () => {
    const user = userEvent.setup()
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)
    await user.click(screen.getByLabelText("Cost column menu"))
    await user.click(screen.getByRole("menuitem", { name: "Attribute settings" }))
    expect(screen.getByRole("dialog", { name: "Attribute settings" })).toBeInTheDocument()
    expect(screen.getByDisplayValue("Cost")).toBeInTheDocument()
    expect(useTaskStore.getState().lists.find((l) => l.id === "list1")?.itemAttributes?.some((a) => a.id === "cost")).toBe(
      true,
    )
  })

  it("disables Attribute settings on the built-in Item name column", async () => {
    const user = userEvent.setup()
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)
    await user.click(screen.getByLabelText("Item column menu"))
    const item = screen.getByRole("menuitem", { name: "Attribute settings" })
    expect(item).toHaveAttribute("aria-disabled", "true")
    expect(item).toHaveAttribute(
      "title",
      "Item name is always the first column — it is not a custom attribute.",
    )
    expect(screen.queryByRole("dialog", { name: "Attribute settings" })).not.toBeInTheDocument()
  })

  it("moves with arrows, edits on Enter, and cancels with Escape", () => {
    const tasks = seed([["a", "Apple", 10]])
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)
    selectCellByText("Apple")
    fireEvent.keyDown(window, { key: "ArrowRight" })
    fireEvent.keyDown(window, { key: "Enter" })
    const editor = document.activeElement as HTMLInputElement
    expect(editor.tagName).toBe("INPUT")
    fireEvent.change(editor, { target: { value: "99" } })
    fireEvent.keyDown(editor, { key: "Escape" })
    expect(useTaskStore.getState().tasks.find((t) => t.id === "a")?.attributes?.cost).toBe(10)
  })

  it("centers header labels with padding classes and a reserved sort slot", () => {
    const tasks = seed()
    const { container } = render(
      <SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />,
    )
    const costHeader = screen.getByRole("columnheader", { name: /Cost/ })
    expect(costHeader).toHaveClass("sheet-th")
    expect(costHeader.querySelector(".sheet-th-sort")).toBeTruthy()
    expect(costHeader.querySelector(".sheet-th-label")?.textContent).toBe("Cost")
    expect(costHeader.querySelector(".sheet-th-slot-end")).toBeTruthy()
    const sortBtn = screen.getByRole("button", { name: /Sort Cost/ })
    expect(sortBtn).toHaveClass("sheet-th-sort")
    expect(container.querySelector(".sheet-th-letter")).toBeTruthy()
  })

  it("highlights the header of the selected column", () => {
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)
    selectCellByText("10 $")
    const costHeader = screen.getByRole("columnheader", { name: /Cost/ })
    expect(costHeader).toHaveClass("sheet-th-active")
  })

  it("sorts empty and em-dash cells to the end of the column", async () => {
    const user = userEvent.setup()
    const apple = makeTask("a", "Apple", 10)
    const blank: Task = { ...makeTask("c", "Blank", 0), attributes: {} }
    const dash: Task = { ...makeTask("d", "Dash", 0), attributes: { cost: "—" as unknown as number } }
    const banana = makeTask("b", "Banana", 30)
    useTaskStore.getState().setLists([CATEGORY])
    useTaskStore.getState().setTasks([apple, blank, banana, dash])
    render(
      <SheetGrid
        categoryId="list1"
        tasks={[apple, blank, banana, dash]}
        enableAddRow={false}
        enableAddColumn={false}
      />,
    )
    await user.click(screen.getByRole("button", { name: /Sort Cost/ }))
    const names = () =>
      screen.getAllByText(/^(Apple|Banana|Blank|Dash)$/).map((el) => el.textContent)
    expect(names()).toEqual(["Apple", "Banana", "Blank", "Dash"])
    await user.click(screen.getByRole("button", { name: /Sort Cost/ }))
    expect(names()).toEqual(["Banana", "Apple", "Blank", "Dash"])
  })

  it("reports resized column widths immediately and leaves never-resized columns unset", () => {
    const tasks = seed()
    const onViewConfigChange = vi.fn()
    render(
      <SheetGrid
        categoryId="list1"
        tasks={tasks}
        enableAddRow={false}
        enableAddColumn={false}
        onViewConfigChange={onViewConfigChange}
      />,
    )
    const handles = screen.getAllByLabelText("Resize column")
    fireEvent.pointerDown(handles[1], { clientX: 100 })
    fireEvent.pointerMove(window, { clientX: 180 })
    fireEvent.pointerUp(window)
    expect(onViewConfigChange).toHaveBeenCalled()
    const last = onViewConfigChange.mock.calls.at(-1)?.[0] as { columnWidths?: Record<string, number> }
    expect(last.columnWidths?.cost).toBe(240)
    expect(last.columnWidths?.[Object.keys(last.columnWidths ?? {}).find((k) => k !== "cost") ?? ""]).toBeUndefined()
    expect(Object.keys(last.columnWidths ?? {})).toEqual(["cost"])
  })

  it("caps the frozen name column so it cannot stretch over later headers", () => {
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn />)
    const nameHeader = screen.getByRole("columnheader", { name: /Item/ })
    expect(nameHeader.style.maxWidth).toBe(nameHeader.style.width)
    expect(nameHeader.style.width).not.toBe("")
  })
})
