/**
 * The Inbox-over-100 cue is written once the vault is hydrated.
 */
import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PROCESS_INBOX_TITLE } from "@/lib/inbox-process-todo"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { useProcessInboxTodo } from "./use-inbox-process-todo"

function idea(id: string): Task {
  return {
    id,
    description: id,
    stage: "inbox",
    completed: false,
    createdAt: new Date(2026, 9, 6),
    lists: [],
  }
}

function Host() {
  useProcessInboxTodo()
  return null
}

describe("useProcessInboxTodo", () => {
  beforeEach(() => {
    resetAllStores()
    vi.spyOn(useTaskStore.persist, "hasHydrated").mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("adds one auto-push todo when the revisit inbox is over 100", () => {
    useTaskStore.setState({ tasks: Array.from({ length: 101 }, (_, index) => idea(`in-${index}`)) })
    render(<Host />)
    const cues = useTaskStore.getState().tasks.filter((task) => task.description === PROCESS_INBOX_TITLE)
    expect(cues).toHaveLength(1)
    expect(cues[0]?.autoPush).toBe(true)
    expect(cues[0]?.title).toBe(PROCESS_INBOX_TITLE)
  })

  it("stays quiet at 100", () => {
    useTaskStore.setState({ tasks: Array.from({ length: 100 }, (_, index) => idea(`in-${index}`)) })
    render(<Host />)
    expect(useTaskStore.getState().tasks.some((task) => task.description === PROCESS_INBOX_TITLE)).toBe(false)
  })
})
