/**
 * EnhancedBulkAdd — multi-line list capture.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { EnhancedBulkAdd } from "./enhanced-bulk-add"

describe("EnhancedBulkAdd", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
  })

  it("renders the Bulk Add trigger", () => {
    render(<EnhancedBulkAdd />)
    expect(screen.getByRole("button", { name: /Bulk Add/i })).toBeInTheDocument()
  })

  it("creates lists and tasks from bulk text", async () => {
    const user = userEvent.setup()
    render(<EnhancedBulkAdd />)
    await user.click(screen.getByRole("button", { name: /Bulk Add/i }))
    await user.type(
      screen.getByLabelText("Tasks and Lists"),
      "Groceries:\nMilk\nBread\n\nErrands:\nPost office",
    )
    await user.click(screen.getByRole("button", { name: /Add Tasks/i }))

    const { lists: categories, tasks } = useTaskStore.getState()
    expect(categories.map((c) => c.name).sort()).toEqual(["Errands", "Groceries"])
    expect(tasks.map((t) => t.description).sort()).toEqual(["Bread", "Milk", "Post office"])
  })

  it("creates a folder and list from a path header", async () => {
    const user = userEvent.setup()
    render(<EnhancedBulkAdd />)
    await user.click(screen.getByRole("button", { name: /Bulk Add/i }))
    await user.type(
      screen.getByLabelText("Tasks and Lists"),
      "Next Actions: Eventually:\nGo through old pages",
    )
    await user.click(screen.getByRole("button", { name: /Add Tasks/i }))

    const { lists, folders, tasks } = useTaskStore.getState()
    const list = lists.find((l) => l.name.toLowerCase() === "eventually")
    expect(list).toBeTruthy()
    const folder = folders.find((f) => f.listIds.includes(list!.id))
    expect(folder?.name.toLowerCase()).toBe("next actions")
    expect(tasks[0].description).toBe("Go through old pages")
    expect(tasks[0].stage).not.toBe("inbox")
  })
})
