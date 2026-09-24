import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import { WorkingNowStrip } from "./working-now-strip"

describe("WorkingNowStrip", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.getState().addTask({
      id: "op_1",
      description: "Foxtide rebuild",
      type: OPERATION_TYPE_ID,
      stage: "clarified",
      createdAt: new Date("2026-01-01"),
      completed: false,
      lists: [],
      attributes: { [OPERATION_ATTR.stage]: "active" },
      links: [],
    })
  })

  it("starts and stops a session from Tracking, painting the Activity grid", async () => {
    const user = userEvent.setup()
    render(<WorkingNowStrip />)

    expect(screen.getByRole("combobox", { name: "Operation to work on" })).toHaveValue("op_1")
    await user.click(screen.getByRole("button", { name: "Working on this now" }))
    expect(screen.getByRole("button", { name: "Stop working on Foxtide rebuild" })).toBeInTheDocument()
    expect(useTimeTrackingStore.getState().entries.length).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: "Stop working on Foxtide rebuild" }))
    expect(screen.getByRole("button", { name: "Working on this now" })).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.some((t) => t.description === "worked on Foxtide rebuild")).toBe(true)
  })

  it("shows usually ~N from past timeLogs while a session is running", async () => {
    const user = userEvent.setup()
    const op = useTaskStore.getState().tasks.find((t) => t.id === "op_1")!
    useTaskStore.getState().updateTask({
      ...op,
      timeLogs: [
        { id: "tl1", date: "2026-09-01", durationMinutes: 20 },
        { id: "tl2", date: "2026-09-02", durationMinutes: 40 },
      ],
    })
    render(<WorkingNowStrip />)

    expect(screen.queryByText("usually ~30m")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Working on this now" }))
    expect(screen.getByText("usually ~30m")).toBeInTheDocument()
    expect(screen.getByTitle(/same title/i)).toBeInTheDocument()
    expect(op.estimatedDuration).toBeUndefined()
    expect(useTaskStore.getState().tasks.find((t) => t.id === "op_1")?.estimatedDuration).toBeUndefined()
  })
})
