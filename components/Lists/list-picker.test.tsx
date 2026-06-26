/**
 * ListPicker — folder-aware list selector.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { ListPicker } from "./list-picker"

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
})
