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

    expect(screen.getByRole("combobox", { name: "Operation to work on" })).toHaveValue("Foxtide rebuild")
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

  it("filters operations and creates one that does not exist", async () => {
    const user = userEvent.setup()
    useTaskStore.getState().addTask({
      id: "op_2",
      description: "clean house",
      type: OPERATION_TYPE_ID,
      stage: "clarified",
      createdAt: new Date("2026-01-02"),
      completed: false,
      lists: [],
      attributes: { [OPERATION_ATTR.stage]: "active" },
      links: [],
    })
    render(<WorkingNowStrip />)
    const field = screen.getByRole("combobox", { name: "Operation to work on" })
    await user.click(field)
    await user.type(field, "clean")
    expect(screen.getByRole("option", { name: "clean house" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Foxtide rebuild" })).not.toBeInTheDocument()

    await user.clear(field)
    await user.type(field, "mop floors{Enter}")
    expect(useTaskStore.getState().tasks.some((task) => task.description === "mop floors")).toBe(true)
    expect(field).toHaveValue("mop floors")
    expect(screen.getByText("No tracking tags — set them on the operation in Settings.")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Working on this now" }))
    expect(screen.getByRole("button", { name: "Stop working on mop floors" })).toBeInTheDocument()
  })
})
