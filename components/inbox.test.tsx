/**
 * Inbox — clarification queue for captured ideas.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { Inbox } from "./inbox"

describe("Inbox", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
    useTaskStore.getState().addTask({
      id: "inbox-1",
      description: "Untitled idea",
      stage: "inbox",
      createdAt: new Date(),
      estimatedDuration: 1,
      cognitiveLoad: 1,
      urgency: 3,
      importance: 3,
      dependencies: [],
      context: "@inbox",
      entropy: 0.5,
      rewardValue: 5,
      completed: false,
      lists: [],
      allowPartialCompletion: false,
      minimumChunkSize: 15,
    })
  })

  it("shows inbox count badge on the trigger", () => {
    render(<Inbox onTaskSelect={vi.fn()} />)
    expect(screen.getByRole("button", { name: /Inbox/i })).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it("lists inbox tasks in the dialog", async () => {
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    expect(screen.getByText("Untitled idea")).toBeInTheDocument()
    expect(screen.getByText(/Inbox — Clarify Your Ideas/)).toBeInTheDocument()
  })

  it("deletes an inbox task from the store", async () => {
    const user = userEvent.setup()
    render(<Inbox onTaskSelect={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /Inbox/i }))
    await user.click(screen.getByTitle("Delete this idea"))
    expect(useTaskStore.getState().tasks).toHaveLength(0)
  })
})
