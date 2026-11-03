import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_PCB_MODE, PCB_MODES, PCB_MODE_META } from "@/lib/pcb-backdrop"
import { useThemeStore } from "@/lib/theme-store"
import { PcbBackdropField } from "./PcbBackdropField"

describe("PcbBackdropField", () => {
  beforeEach(() => {
    localStorage.clear()
    useThemeStore.getState().resetPcbMode()
  })

  afterEach(() => {
    useThemeStore.getState().resetPcbMode()
  })

  it("renders every plate and writes the store", () => {
    render(<PcbBackdropField />)
    expect(screen.getByRole("button", { name: PCB_MODE_META[DEFAULT_PCB_MODE].label })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    for (const id of PCB_MODES) {
      expect(screen.getByRole("button", { name: PCB_MODE_META[id].label })).toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole("button", { name: "X-ray" }))
    expect(useThemeStore.getState().pcbMode).toBe("xray")
    expect(screen.getByRole("button", { name: "X-ray" })).toHaveAttribute("aria-pressed", "true")
  })
})
