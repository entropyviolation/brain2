import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { CockpitSwitch } from "./cockpit-switch"

describe("CockpitSwitch", () => {
  it("renders an analog switch with the given label", () => {
    render(<CockpitSwitch checked={false} onCheckedChange={vi.fn()} label="Heatmap View" />)
    const control = screen.getByRole("switch", { name: "Heatmap View" })
    expect(control).toHaveAttribute("aria-checked", "false")
    expect(control.textContent).toBe("Heatmap View")
    expect(control.textContent).not.toMatch(/OffOn/)
  })

  it("toggles on click", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<CockpitSwitch checked={false} onCheckedChange={onCheckedChange} label="Hide Completed Today" />)
    await user.click(screen.getByRole("switch", { name: /Hide Completed Today/ }))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it("toggles from the keyboard", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<CockpitSwitch checked={true} onCheckedChange={onCheckedChange} label="Count prioritized habits" />)
    const control = screen.getByRole("switch")
    control.focus()
    await user.keyboard("{Enter}")
    expect(onCheckedChange).toHaveBeenCalledWith(false)
  })
})
