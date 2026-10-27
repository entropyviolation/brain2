import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { HABITS_CONTROL_PANEL_DEFAULT_WIDTH, HABITS_CONTROL_PANEL_NAME } from "@/lib/habits-control-panel"
import { HabitsControlPanel } from "./habits-control-panel"
import "./habit-chrome.css"

describe("HabitsControlPanel", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("labels the Home Dashboard Habits Tab Control Panel and hosts Willpower gems", () => {
    render(
      <HabitsControlPanel>
        <div className="hab-control-stack">controls</div>
      </HabitsControlPanel>,
    )
    expect(screen.getByLabelText(HABITS_CONTROL_PANEL_NAME)).toBeInTheDocument()
    expect(document.querySelector(".hab-control-panel .hab-control-stack")).toBeTruthy()
    expect(screen.getByText("Willpower gems")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Resize control panel/i })).toBeNull()
    expect(document.querySelector(".hab-control-seam")).toBeNull()
    const panel = document.querySelector(".hab-control-panel") as HTMLElement
    expect(panel.style.width).toBe(`${HABITS_CONTROL_PANEL_DEFAULT_WIDTH}px`)
    expect(panel.style.getPropertyValue("--hab-willpower-scale")).toBe("1")
  })

  it("pins leftover stored widths back to the compact default", () => {
    useHabitsStore.getState().setHabitsControlPanelWidth(320)
    render(<HabitsControlPanel />)
    expect(useHabitsStore.getState().habitsControlPanelWidth).toBe(HABITS_CONTROL_PANEL_DEFAULT_WIDTH)
    const panel = document.querySelector(".hab-control-panel") as HTMLElement
    expect(panel.style.width).toBe(`${HABITS_CONTROL_PANEL_DEFAULT_WIDTH}px`)
    expect(panel.style.getPropertyValue("--hab-willpower-scale")).toBe("1")
  })
})
