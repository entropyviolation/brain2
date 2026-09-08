/**
 * QuickAdd — fast inbox capture dialog.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { QuickAdd } from "./quick-add"

describe("QuickAdd", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
  })

  it("renders the Quick Add trigger", () => {
    render(<QuickAdd />)
    expect(screen.getByRole("button", { name: /Quick Add/i })).toBeInTheDocument()
  })

  it("adds a captured idea to the inbox store", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.type(screen.getByLabelText("Idea"), "Buy more coffee filters")
    await user.click(screen.getByRole("button", { name: /Add to Inbox/i }))

    const tasks = useTaskStore.getState().tasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0].description).toBe("Buy more coffee filters")
    expect(tasks[0].stage).toBe("inbox")
  })

  it("files a path capture onto a folder list when inbox is skipped", async () => {
    const user = userEvent.setup()
    render(<QuickAdd />)
    await user.click(screen.getByRole("button", { name: /Quick Add/i }))
    await user.click(screen.getByLabelText(/Send to Inbox for clarification/i))
    await user.type(
      screen.getByLabelText("Idea"),
      "next actions: eventually: go through and edit old three pages into a memoir or essay narrative; mine essays",
    )
    await user.click(screen.getByRole("button", { name: /Add item/i }))

    const { tasks, lists, folders } = useTaskStore.getState()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].stage).not.toBe("inbox")
    expect(tasks[0].description).toMatch(/go through and edit old three pages/)
    const list = lists.find((l) => l.id === tasks[0].lists?.[0])
    expect(list?.name.toLowerCase()).toBe("eventually")
    const folder = folders.find((f) => f.listIds.includes(list!.id))
    expect(folder?.name.toLowerCase()).toBe("next actions")
  })
})
