import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { CycleConfirmDialog } from "@/components/ItemDetail/CycleConfirmDialog"

describe("CycleConfirmDialog", () => {
  it("explains the loop and dismisses without an add-anyway action", async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(
      <CycleConfirmDialog
        open
        cycleLabel="Write → Review → Write"
        onDismiss={onDismiss}
      />,
    )
    expect(screen.getByRole("heading", { name: "This would loop" })).toBeInTheDocument()
    expect(screen.getByLabelText("Dependency cycle")).toHaveTextContent("Write → Review → Write")
    expect(screen.getByText(/was not added/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /add anyway/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "OK" }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
