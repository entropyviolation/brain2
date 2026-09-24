/**
 * DetailsViewSettings — on-this-list first; persists Details only.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { builtinColumnId } from "@/lib/spreadsheet-catalog"
import type { List, Task } from "@/lib/types"
import { DetailsViewSettings } from "./DetailsViewSettings"

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
  sheetConfig: { columnIds: ["author", builtinColumnId("tags")] },
}

const films: List = {
  id: "films",
  name: "Films",
  color: "#ef4444",
  description: "",
  createdAt: new Date("2026-01-01"),
  order: 1,
  itemAttributes: [{ id: "year", name: "Year", type: "number" }],
}

const task = (partial: Partial<Task> & Pick<Task, "id" | "description">): Task => ({
  stage: "list",
  createdAt: new Date("2026-01-01"),
  completed: false,
  lists: ["books"],
  ...partial,
})

describe("DetailsViewSettings", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.getState().setLists([books, films])
    useTaskStore.getState().setTasks([
      task({ id: "b1", description: "Dune", attributes: { author: "Herbert" }, importance: 4 }),
      task({ id: "f1", description: "Heat", lists: ["films"], attributes: { year: 1995 } }),
    ])
  })

  it("lists attributes on this list first and still offers vault attrs", () => {
    render(<DetailsViewSettings list={books} onChange={vi.fn()} />)
    expect(screen.getByText("Details view mode settings")).toBeInTheDocument()
    const labels = screen.getAllByRole("checkbox").map((el) => el.getAttribute("aria-label"))
    const author = labels.indexOf("Author column")
    const year = labels.indexOf("Year column")
    expect(author).toBeGreaterThan(-1)
    expect(year).toBeGreaterThan(-1)
    expect(author).toBeLessThan(year)
  })

  it("filters to On this list", async () => {
    const user = userEvent.setup()
    render(<DetailsViewSettings list={books} onChange={vi.fn()} />)
    await user.click(screen.getByRole("checkbox", { name: "Details on this list" }))
    expect(screen.getByRole("checkbox", { name: "Author column" })).toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: "Year column" })).not.toBeInTheDocument()
  })

  it("searches attributes", async () => {
    const user = userEvent.setup()
    render(<DetailsViewSettings list={books} onChange={vi.fn()} />)
    await user.type(screen.getByLabelText("Search details columns"), "year")
    expect(screen.getByRole("checkbox", { name: "Year column" })).toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: "Author column" })).not.toBeInTheDocument()
  })

  it("persists chosen columns on detailsColumns only", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DetailsViewSettings list={books} onChange={onChange} />)
    await user.click(screen.getByRole("checkbox", { name: "Year column" }))
    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls[0][0] as List
    expect(next.id).toBe("books")
    expect(next.detailsColumns).toContain("year")
    expect(next.sheetConfig?.columnIds).toEqual(["author", builtinColumnId("tags")])
    expect(next.itemAttributes?.some((d) => d.id === "year")).toBe(false)
  })

  it("unchecking hides from Details and does not delete the attribute or change spreadsheet", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DetailsViewSettings list={books} onChange={onChange} />)
    await user.click(screen.getByRole("checkbox", { name: "Author column" }))
    const next = onChange.mock.calls[0][0] as List
    expect(next.detailsColumns).not.toContain("author")
    expect(next.itemAttributes?.some((d) => d.id === "author")).toBe(true)
    expect(next.sheetConfig?.columnIds).toEqual(["author", builtinColumnId("tags")])
  })

  it("reorders persisted Details columns without touching spreadsheet", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DetailsViewSettings
        list={{ ...books, detailsColumns: ["author", "pages"] }}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Move Author down" }))
    const next = onChange.mock.calls[0][0] as List
    expect(next.detailsColumns).toEqual(["pages", "author"])
    expect(next.sheetConfig?.columnIds).toEqual(["author", builtinColumnId("tags")])
  })
})
