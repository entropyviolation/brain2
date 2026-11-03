import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { ListsHelperLab } from "./ListsHelperLab"
import { useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"
import type { Task } from "@/lib/types"

const item = (id: string, title: string): Task => ({
  id,
  description: title,
  title,
  lists: [],
  stage: "list",
  completed: false,
  createdAt: new Date(2026, 0, 1),
})

describe("ListsHelperLab", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("shows the flow and tools, then walks a duplicate to a merge and an undo", () => {
    useTaskStore.setState({ tasks: [item("a", "Dune"), item("b", "dune"), item("c", "Emma")], lists: [] })
    render(<ListsHelperLab />)
    expect(screen.getByText("LISTS · HELPER")).toBeTruthy()
    expect(screen.getAllByText("Find duplicates").length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole("button", { name: "Find duplicates" }))
    expect(screen.getByLabelText("Possible duplicate")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Merge" }))
    expect(useTaskStore.getState().tasks.map((t) => t.id).sort()).toEqual(["a", "c"])
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(useTaskStore.getState().tasks).toHaveLength(3)
  })

  it("plans a type change and writes nothing until yes", () => {
    useTaskStore.setState({ tasks: [item("a", "Dune")].map((t) => ({ ...t, type: "note" })), lists: [] })
    render(<ListsHelperLab />)
    const box = screen.getByRole("textbox")
    fireEvent.change(box, { target: { value: "change all Note items to Book" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(screen.getByLabelText("Plan")).toBeTruthy()
    expect(useTaskStore.getState().tasks[0]!.type).toBe("note")
    fireEvent.click(screen.getByText("Yes, do it"))
    expect(useTaskStore.getState().tasks[0]!.type).toBe("book")
  })
})
