/**
 * ListPicker — folder-aware list selector.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { ListPicker } from "./list-picker"

function ControlledPicker(props: { excludeIds?: string[]; mode?: "single" | "multi" }) {
  const [selected, setSelected] = useState<string[]>([])
  return <ListPicker selected={selected} onChange={setSelected} mode={props.mode ?? "multi"} excludeIds={props.excludeIds} />
}

describe("ListPicker", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().setLists([
      {
        id: "list-1",
        name: "Groceries",
        color: "#10B981",
        description: "Food shopping",
        createdAt: new Date(),
        order: 0,
      },
      {
        id: "list-2",
        name: "Books",
        color: "#8B5CF6",
        description: "Reading list",
        createdAt: new Date(),
        order: 1,
      },
    ])
  })

  it("renders loose lists from the store", () => {
    render(<ListPicker selected={[]} onChange={vi.fn()} />)
    expect(screen.getByText("Groceries")).toBeInTheDocument()
    expect(screen.getByText("Books")).toBeInTheDocument()
  })

  it("filters lists when searching", async () => {
    const user = userEvent.setup()
    render(<ListPicker selected={[]} onChange={vi.fn()} />)
    await user.type(screen.getByPlaceholderText("Search lists…"), "groc")
    expect(screen.getByText("Groceries")).toBeInTheDocument()
    expect(screen.queryByText("Books")).not.toBeInTheDocument()
  })

  it("calls onChange when a list is selected in single mode", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ListPicker selected={[]} onChange={onChange} mode="single" />)
    await user.click(screen.getByText("Groceries"))
    expect(onChange).toHaveBeenCalledWith(["list-1"])
  })

  it("hides excluded lists from browse and search", async () => {
    const user = userEvent.setup()
    render(<ListPicker selected={[]} onChange={vi.fn()} excludeIds={["list-2"]} />)
    expect(screen.getByText("Groceries")).toBeInTheDocument()
    expect(screen.queryByText("Books")).not.toBeInTheDocument()
    await user.type(screen.getByPlaceholderText("Search lists…"), "book")
    expect(screen.getByText("No lists match.")).toBeInTheDocument()
  })

  it("multi-selects more than one list", async () => {
    const user = userEvent.setup()
    render(<ControlledPicker />)
    await user.click(screen.getByText("Groceries"))
    await user.click(screen.getByText("Books"))
    expect(screen.getByText("Selected (2)")).toBeInTheDocument()
  })

  it("renders each list as a full-width row, not inline chips", () => {
    render(<ListPicker selected={[]} onChange={vi.fn()} mode="single" />)
    const groceries = screen.getByRole("button", { name: "Groceries" })
    const books = screen.getByRole("button", { name: "Books" })
    expect(groceries).toHaveClass("list-picker-row")
    expect(books).toHaveClass("list-picker-row")
    expect(groceries).not.toBe(books)
  })

  it("does not nest the multi-select checkbox inside a button", () => {
    render(<ListPicker selected={[]} onChange={vi.fn()} mode="multi" />)
    const groceries = screen.getByRole("checkbox", { name: "Add to Groceries" })
    const books = screen.getByRole("checkbox", { name: "Add to Books" })
    // Radix Checkbox is itself a <button role="checkbox">; it must not sit inside another button.
    expect(groceries.parentElement?.closest("button")).toBeNull()
    expect(books.parentElement?.closest("button")).toBeNull()
    expect(groceries.closest("label")).toHaveClass("list-picker-row")
    expect(books.closest("label")).toHaveClass("list-picker-row")
  })

  it("toggles multi-select when clicking the row label, not only the checkbox", async () => {
    const user = userEvent.setup()
    render(<ControlledPicker />)
    await user.click(screen.getByText("Groceries"))
    expect(screen.getByText("Selected (1)")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Add to Groceries" })).toBeChecked()
  })

  it("shows selected chips with remove when showSelectedChips is on", async () => {
    const user = userEvent.setup()
    function Chipped() {
      const [selected, setSelected] = useState<string[]>([])
      return (
        <ListPicker selected={selected} onChange={setSelected} mode="single" showSelectedChips />
      )
    }
    render(<Chipped />)
    await user.click(screen.getByRole("button", { name: "Groceries" }))
    expect(screen.getByLabelText("Selected lists")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove Groceries" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Remove Groceries" }))
    expect(screen.queryByLabelText("Selected lists")).not.toBeInTheDocument()
  })

  it("pins suggested lists under a Recent label", () => {
    render(<ListPicker selected={[]} onChange={vi.fn()} suggestedIds={["list-2"]} />)
    expect(screen.getByLabelText("Recent lists")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Add to Books" })).toBeInTheDocument()
  })

  it("seeds New list with a search that matches no list name", async () => {
    const user = userEvent.setup()
    render(<ListPicker selected={[]} onChange={vi.fn()} />)
    await user.type(screen.getByRole("textbox", { name: "Search lists" }), "Sourdough")
    await user.click(screen.getByRole("button", { name: /New list/i }))
    expect(screen.getByRole("textbox", { name: "New list name" })).toHaveValue("Sourdough")
  })

  it("leaves the new list name blank when the search is an existing list", async () => {
    const user = userEvent.setup()
    render(<ListPicker selected={[]} onChange={vi.fn()} />)
    await user.type(screen.getByRole("textbox", { name: "Search lists" }), "Groceries")
    await user.click(screen.getByRole("button", { name: /New list/i }))
    expect(screen.getByRole("textbox", { name: "New list name" })).toHaveValue("")
  })

  it("selects the first search hit on Enter", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ListPicker selected={[]} onChange={onChange} mode="single" />)
    const search = screen.getByRole("textbox", { name: "Search lists" })
    await user.type(search, "groc")
    await user.keyboard("{Enter}")
    expect(onChange).toHaveBeenCalledWith(["list-1"])
  })
})
