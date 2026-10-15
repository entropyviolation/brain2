import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ViewModeControls } from "./ViewModeControls"

const base = {
  openTarget: { type: "category" as const, id: "list-1" },
  folderView: "icons" as const,
  currentDisplay: "icons" as const,
  location: "items:list-1",
  entryKeys: [],
  onFolderViewChange: vi.fn(),
  onListDisplayChange: vi.fn(),
  onAutoOrganize: vi.fn(),
  listIconsDesktop: true,
  onListDesktopOrganize: vi.fn(),
  onPileUp: vi.fn(),
  onListIconsGravityChange: vi.fn(),
  onGravityReset: vi.fn(),
  onGravitySettle: vi.fn(),
}

describe("ViewModeControls Gravity toggle", () => {
  it("reserves desk keys when Icons is on but Desktop is off (no velvet floor jump)", () => {
    const { container } = render(<ViewModeControls {...base} listIconsDesktop={false} />)
    const bay = container.querySelector(".fm-desktop-desk-keys")
    expect(bay).toBeTruthy()
    expect(bay).toHaveAttribute("data-desktop-ready", "off")
    expect(bay).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByRole("button", { name: "PILE UP", hidden: true })).toBeDisabled()
  })

  it("shows dark LED language when Gravity is off (not pressed)", () => {
    render(<ViewModeControls {...base} listIconsGravity={false} />)
    const btn = screen.getByRole("button", { name: "Gravity off" })
    expect(btn).toHaveAttribute("aria-pressed", "false")
    expect(btn).not.toHaveClass("active")
    expect(btn.querySelector(".fm-view-key-led")).toBeTruthy()
    expect(btn.querySelector(".fm-gravity-key-state")?.textContent).toBe("Off")
  })

  it("shows lit LED language when Gravity is on (pressed)", () => {
    render(<ViewModeControls {...base} listIconsGravity={true} />)
    const btn = screen.getByRole("button", { name: "Gravity on" })
    expect(btn).toHaveAttribute("aria-pressed", "true")
    expect(btn).toHaveClass("active")
    expect(btn.querySelector(".fm-view-key-led")).toBeTruthy()
    expect(btn.querySelector(".fm-gravity-key-state")?.textContent).toBe("On")
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Skip to stable" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "PILE UP" })).toBeInTheDocument()
  })

  it("hides Skip to stable when Gravity is off", () => {
    render(<ViewModeControls {...base} listIconsGravity={false} />)
    expect(screen.queryByRole("button", { name: "Skip to stable" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull()
  })

  it("calls onGravitySettle when Skip to stable is clicked", () => {
    const onGravitySettle = vi.fn()
    render(<ViewModeControls {...base} listIconsGravity={true} onGravitySettle={onGravitySettle} />)
    screen.getByRole("button", { name: "Skip to stable" }).click()
    expect(onGravitySettle).toHaveBeenCalledTimes(1)
  })

  it("settings gear opens settings without flipping Gravity on/off", () => {
    const onGravitySettings = vi.fn()
    const onListIconsGravityChange = vi.fn()
    render(
      <ViewModeControls
        {...base}
        listIconsGravity={false}
        onGravitySettings={onGravitySettings}
        onListIconsGravityChange={onListIconsGravityChange}
      />,
    )
    screen.getByRole("button", { name: "Gravity settings" }).click()
    expect(onGravitySettings).toHaveBeenCalledTimes(1)
    expect(onListIconsGravityChange).not.toHaveBeenCalled()
  })
})
