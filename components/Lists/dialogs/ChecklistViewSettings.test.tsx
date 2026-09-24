import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { List } from "@/lib/types"
import { ChecklistViewSettings } from "./ChecklistViewSettings"

const list = (extra: Partial<List> = {}): List => ({
  id: "dishes",
  name: "Dishes",
  color: "#ef4444",
  createdAt: new Date(),
  ...extra,
})

describe("ChecklistViewSettings", () => {
  it("shows Completed locked on and Missed opportunity off by default", () => {
    render(<ChecklistViewSettings list={list()} onChange={vi.fn()} />)
    expect(screen.getByText("View mode settings")).toBeInTheDocument()
    expect(screen.getByText("Default view mode settings")).toBeInTheDocument()
    expect(screen.getByText("Checklist view mode settings")).toBeInTheDocument()
    expect(screen.getByText("Details view mode settings")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Completed" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Completed" })).toBeDisabled()
    expect(screen.getByRole("checkbox", { name: "Missed opportunity" })).not.toBeChecked()
  })

  it("adds Missed opportunity as an extra checkbox variable", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ChecklistViewSettings list={list()} onChange={onChange} />)
    await user.click(screen.getByRole("checkbox", { name: "Missed opportunity" }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].checklistCheckboxVars).toEqual(["completed", "missed"])
  })
})
