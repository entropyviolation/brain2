import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { PlanGemModeToggle } from "./plan-gem-mode-toggle"

describe("PlanGemModeToggle", () => {
  it("labels gem and trinket mode and reports pressed state", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PlanGemModeToggle on={false} onChange={onChange} />)
    const button = screen.getByRole("button", { name: "Gem and trinket" })
    expect(button).toHaveAttribute("id", "plan-gem-mode")
    expect(button).toHaveAttribute("aria-pressed", "false")
    await user.click(button)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it("flips to no gem no trinket when the latch is on", () => {
    render(<PlanGemModeToggle on={true} onChange={() => {}} />)
    const button = screen.getByRole("button", { name: "no gem no trinket" })
    expect(button).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: "Gem and trinket" })).not.toBeInTheDocument()
  })
})
