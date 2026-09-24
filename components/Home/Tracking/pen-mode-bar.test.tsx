import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { PenModeBar } from "./pen-mode-bar"
import { PenPalette } from "./pen-palette"
import { LogActivityLatch } from "./log-activity-dialog"
import { TrkChromeStack } from "./trk-instrument"

beforeEach(() => {
  resetAllStores()
})

describe("PenModeBar", () => {
  it("renders the seeded views as a pressed trough", () => {
    const scopes = useTimeTrackingStore.getState().scopes
    if (!scopes.some((s) => s.id === "screentime" || s.name === "Screen Time")) {
      useTimeTrackingStore.setState({
        scopes: [...scopes, { id: "screentime", name: "Screen Time", pens: [] }],
      })
    }
    render(<PenModeBar />)
    const bar = screen.getByRole("toolbar", { name: "Tracking view modes" })
    expect(bar).toHaveClass("trk-mode-bar")
    expect(screen.getByRole("button", { name: /^Activity$/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /^Location$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Mood$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Company$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Screen Time$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^iPhone Screen Time$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^iPhone Calls$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^iPhone Texts$/ })).toBeInTheDocument()
  })

  it("switches the active scope and adds a view from the inline field", () => {
    render(<PenModeBar />)
    fireEvent.click(screen.getByRole("button", { name: /^Company$/ }))
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("company")
    expect(screen.getByRole("button", { name: /^Company$/ })).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(screen.getByTitle("Add view"))
    fireEvent.change(screen.getByLabelText("New view name"), { target: { value: "Frame" } })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    expect(screen.getByRole("button", { name: /^Frame$/ })).toBeInTheDocument()
    expect(useTimeTrackingStore.getState().scopes.some((s) => s.name === "Frame")).toBe(true)
  })

  it("sits below the pen tray and above the time grid in the chrome stack", () => {
    render(
      <div className="trk95">
        <TrkChromeStack
          pens={<PenPalette embedded />}
          modeBar={<PenModeBar />}
          gridAction={<LogActivityLatch />}
        >
          <div className="trk-desktop" data-testid="time-plot">
            TIME/DIV
          </div>
        </TrkChromeStack>
      </div>,
    )
    const tray = document.querySelector(".trk-pen-tools-row")
    const mode = screen.getByRole("toolbar", { name: "Tracking view modes" })
    const plot = screen.getByTestId("time-plot")
    expect(tray).toBeTruthy()
    expect(tray!.compareDocumentPosition(mode) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(mode.compareDocumentPosition(plot) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(mode.closest(".trk-pen-tray")).toBeNull()
    expect(mode.closest(".trk-toolbar")).toBeNull()
    const log = screen.getByRole("button", { name: /Log activity/ })
    expect(log.closest(".trk-mode-bar")).toBeNull()
    expect(log.closest(".trk-grid-rail")).toBe(mode.parentElement)
    expect(log.closest(".trk-toolbar-row")).toBeNull()
    expect(tray!.compareDocumentPosition(log) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(log.compareDocumentPosition(plot) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })
})
