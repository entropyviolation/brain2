import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

const start = vi.fn()
vi.mock("@/components/Focus/TaskClockStarter", () => ({
  useTaskClockStarter: () => ({ start, picker: null }),
}))

import { WorkingNowControl } from "./WorkingNowControl"

describe("WorkingNowControl naming a task", () => {
  it("puts the picked task on the ▶ clock and keeps the operation button", () => {
    render(<WorkingNowControl operationId="op" operationName="Move" tasks={[{ id: "t1", name: "Pack books" }]} />)
    expect(screen.getByRole("button", { name: "Working on this now" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "…or a task" }))
    fireEvent.click(screen.getByRole("button", { name: "Pack books" }))
    expect(start).toHaveBeenCalledWith("t1")
  })

  it("shows no picker with no open tasks", () => {
    render(<WorkingNowControl operationId="op" operationName="Move" />)
    expect(screen.queryByRole("button", { name: "…or a task" })).toBeNull()
  })
})
