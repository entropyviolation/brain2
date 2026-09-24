import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useUiNamesStore } from "@/lib/ui-names-store"
import { UiNamesHost } from "./UiNamesHost"

describe("UiNamesHost", () => {
  beforeEach(() => {
    localStorage.clear()
    useUiNamesStore.setState({ mode: "off" })
    document.documentElement.removeAttribute("data-ui-mode")
  })

  afterEach(() => {
    useUiNamesStore.setState({ mode: "off" })
    document.documentElement.removeAttribute("data-ui-mode")
  })

  it("stamps data-ui-mode on html while Names is on and clears it when off", () => {
    const { rerender } = render(<UiNamesHost />)
    expect(document.documentElement).not.toHaveAttribute("data-ui-mode")

    useUiNamesStore.getState().setMode("names")
    rerender(<UiNamesHost />)
    expect(document.documentElement).toHaveAttribute("data-ui-mode", "names")

    useUiNamesStore.getState().setMode("off")
    rerender(<UiNamesHost />)
    expect(document.documentElement).not.toHaveAttribute("data-ui-mode")
  })

  it("shows a nameplate from data-ui-name and a quieter help line", () => {
    useUiNamesStore.getState().setMode("names")
    render(
      <>
        <UiNamesHost />
        <div data-ui-name="Time grid">plot</div>
        <div data-ui-name="Habits control panel" data-ui-help="Grades and gems.">
          panel
        </div>
      </>,
    )

    fireEvent.pointerOver(screen.getByText("plot"))
    const plate = screen.getByTestId("ui-nameplate")
    expect(plate).toHaveTextContent("Time grid")
    expect(plate.querySelector(".ui-nameplate-help")).toBeNull()

    fireEvent.pointerOver(screen.getByText("panel"))
    expect(screen.getByTestId("ui-nameplate")).toHaveTextContent("Habits control panel")
    expect(screen.getByTestId("ui-nameplate")).toHaveTextContent("Grades and gems.")
  })

  it("lets the deepest named ancestor win", () => {
    useUiNamesStore.getState().setMode("names")
    render(
      <>
        <UiNamesHost />
        <div data-ui-name="Plan">
          plan window
          <div
            data-ui-name="Month Plan"
            data-ui-help="Monthly written plan log. Submit stamps an entry — not the calendar and not the event chips."
          >
            composer
            <div data-ui-name="Plan log">history</div>
          </div>
        </div>
      </>,
    )
    fireEvent.pointerOver(screen.getByText("composer"))
    const plate = screen.getByTestId("ui-nameplate")
    expect(plate).toHaveTextContent("Month Plan")
    expect(plate).toHaveTextContent("Monthly written plan log")
    expect(plate).not.toHaveTextContent(/^Plan$/)

    fireEvent.pointerOver(screen.getByText("history"))
    expect(screen.getByTestId("ui-nameplate")).toHaveTextContent("Plan log")
    expect(screen.getByTestId("ui-nameplate")).not.toHaveTextContent("Month Plan")
  })

  it("logs the name and docs path on click without stopping the event", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    useUiNamesStore.getState().setMode("names")
    const onClick = vi.fn()
    render(
      <>
        <UiNamesHost />
        <button
          type="button"
          data-ui-name="Lists"
          data-ui-docs="components/Lists/README.md"
          data-ui-docs-anchor="architecture"
          onClick={onClick}
        >
          lists
        </button>
      </>,
    )

    fireEvent.click(screen.getByText("lists"))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith("[ui-names]", "Lists", {
      docs: "components/Lists/README.md",
      anchor: "architecture",
    })
    info.mockRestore()
  })

  it("portals the nameplate to document.body above a dialog-like overlay", () => {
    useUiNamesStore.getState().setMode("names")
    const overlay = document.createElement("div")
    overlay.setAttribute("data-testid", "dialog-like-overlay")
    overlay.style.cssText = "position:fixed;inset:0;z-index:50"
    const named = document.createElement("button")
    named.type = "button"
    named.setAttribute("data-ui-name", "Settings")
    named.setAttribute("data-ui-docs", "components/Settings/README.md")
    named.textContent = "settings body"
    overlay.appendChild(named)
    document.body.appendChild(overlay)

    render(<UiNamesHost />)
    fireEvent.pointerOver(named)

    const layer = screen.getByTestId("ui-names-layer")
    expect(layer.parentElement).toBe(document.body)
    expect(layer).toHaveStyle({ zIndex: "310", pointerEvents: "none" })
    expect(screen.getByTestId("ui-nameplate")).toHaveTextContent("Settings")
    expect(document.body.contains(screen.getByTestId("ui-nameplate"))).toBe(true)

    overlay.remove()
  })
})
