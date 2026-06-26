/**
 * SheetGrid — editable grid: cell commit, formula read-only guard, sort, filter.
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
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

describe("SheetGrid", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("commits an edited cell value through updateTask", async () => {
    const user = userEvent.setup()
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)

    await user.click(screen.getByRole("button", { name: "10 $" }))
    // Cells are Google-Sheets-style text inputs (so "=" formulas are typeable);
    // the inline editor is auto-focused.
    const editor = document.activeElement as HTMLInputElement
    await user.clear(editor)
    await user.type(editor, "99{Enter}")

    expect(useTaskStore.getState().tasks.find((t) => t.id === "a")?.attributes?.cost).toBe(99)
  })

  it("renders formula cells as read-only and rejects writes via the formula bar", async () => {
    const user = userEvent.setup()
    const tasks = seed()
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn={false} />)

    // Computed value is displayed (cost 10 * 2, currency).
    expect(screen.getByText("$20.00")).toBeInTheDocument()

    // Selecting the formula cell shows its expression in the (disabled) formula bar.
    await user.click(screen.getByText("$20.00"))
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

    const costHeader = screen.getByRole("button", { name: /Cost/ })

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
    expect(screen.getByRole("button", { name: /Notes/ })).toBeInTheDocument()
  })

  it("writes a value into the new column onto the item in that row", async () => {
    const user = userEvent.setup()
    const tasks = seed([["a", "Apple", 10]])
    render(<SheetGrid categoryId="list1" tasks={tasks} enableAddRow={false} enableAddColumn />)

    await user.click(screen.getByTitle("Add column"))
    await user.type(screen.getByPlaceholderText("e.g. Cost"), "Notes")
    await user.click(screen.getByRole("button", { name: "Add column" }))

    // The single new-column cell starts empty ("—"); click to edit and type
    // into the auto-focused inline editor.
    await user.click(screen.getByRole("button", { name: "—" }))
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
    fireEvent.mouseDown(screen.getByRole("button", { name: "30 $" }))
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
    fireEvent.mouseDown(screen.getByRole("button", { name: "10 $" }))
    fireEvent.mouseDown(screen.getByRole("button", { name: "30 $" }), { shiftKey: true })

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
    fireEvent.mouseDown(screen.getByRole("button", { name: "20" }))
    fireEvent.mouseDown(screen.getByLabelText("Fill handle"))
    // Y cell of row 3 (tds: 0 gutter, 1 name, 2 X, 3 Y) — keep the drag in column Y.
    const r3Cells = screen.getByText("r3").closest("tr")!.querySelectorAll("td")
    fireEvent.mouseOver(r3Cells[3])
    fireEvent.mouseUp(window)

    const after = useTaskStore.getState().tasks
    expect(after.find((t) => t.id === "r2")?.attributes?.y).toBe("=B2*2")
    expect(after.find((t) => t.id === "r3")?.attributes?.y).toBe("=B3*2")
  })
})
