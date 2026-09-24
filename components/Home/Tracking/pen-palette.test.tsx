import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { PenPalette } from "./pen-palette"
import { getTrackingViewPrefs, resetTrackingViewPrefs, setTrackingViewPrefs } from "./tracking-view-prefs"

beforeEach(() => {
  resetAllStores()
  resetTrackingViewPrefs()
})

describe("PenPalette tray photograph", () => {
  it("stamps the default Cat traces plate on the pen container, not velvet", () => {
    render(<PenPalette embedded />)
    const root = document.querySelector(".trk95")
    expect(root).toHaveAttribute("data-pen-tray", "cat")
    expect(root).toHaveAttribute("data-pen-tray-ink", "light")
    expect(root).not.toHaveAttribute("data-pen-tray", "velvet")
    expect((root as HTMLElement).style.getPropertyValue("--pen-tray-photo")).toBe('url("/pen-tray/cat.jpg")')
  })

  it("follows a persisted tray pick", () => {
    setTrackingViewPrefs({ penTray: "jewel" })
    render(<PenPalette embedded />)
    const root = document.querySelector(".trk95")
    expect(root).toHaveAttribute("data-pen-tray", "jewel")
    expect(root).toHaveAttribute("data-pen-tray-ink", "dark")
  })
})

describe("PenPalette bead well", () => {
  it("clips beads to one row until Expand (right of Tree) unwraps them", () => {
    render(<PenPalette embedded />)

    const well = document.querySelector(".trk-pen-well")
    expect(well).toHaveClass("trk-pen-well-collapsed")
    expect(well).toHaveAttribute("data-expanded", "false")

    const tree = screen.getByRole("button", { name: "Sort pens Tree" })
    const expand = screen.getByRole("button", { name: "Expand" })
    expect(expand).toHaveAttribute("aria-pressed", "false")
    expect(tree.compareDocumentPosition(expand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(expand.compareDocumentPosition(tree) & Node.DOCUMENT_POSITION_FOLLOWING).toBeFalsy()

    fireEvent.click(expand)
    expect(document.querySelector(".trk-pen-well")).not.toHaveClass("trk-pen-well-collapsed")
    expect(document.querySelector(".trk-pen-well")).toHaveAttribute("data-expanded", "true")
    const conceal = screen.getByRole("button", { name: "Conceal" })
    expect(conceal).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: "Expand" })).not.toBeInTheDocument()
    expect(getTrackingViewPrefs().penWellExpanded).toBe(true)

    fireEvent.click(conceal)
    expect(document.querySelector(".trk-pen-well")).toHaveClass("trk-pen-well-collapsed")
    expect(screen.getByRole("button", { name: "Expand" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByRole("button", { name: "Conceal" })).not.toBeInTheDocument()
    expect(getTrackingViewPrefs().penWellExpanded).toBe(false)
  })

  it("restores an expanded well from prefs and captions the key Conceal", () => {
    setTrackingViewPrefs({ penWellExpanded: true })
    render(<PenPalette embedded />)
    expect(document.querySelector(".trk-pen-well")).not.toHaveClass("trk-pen-well-collapsed")
    expect(screen.getByRole("button", { name: "Conceal" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: "Expand" })).not.toBeInTheDocument()
  })

  it("puts detail copy on a steel plate so tray photos cannot wash it out", () => {
    render(<PenPalette embedded />)
    fireEvent.click(screen.getByRole("button", { name: /^Rest$/ }))

    const plate = document.querySelector(".trk-detail-plate")
    expect(plate).toBeTruthy()
    expect(plate).toHaveTextContent(/Detail/i)
    expect(plate).toHaveTextContent(/No detail options yet/i)
    expect(plate).toHaveTextContent(/Add detail/i)
    expect(document.querySelector(".trk-selected-plate")).toBeTruthy()
    expect(document.querySelector(".trk-selected-name")).toHaveTextContent("Rest")
  })
})

describe("PenPalette new pen", () => {
  it("hides the inline creator until New pen, then re-hides after a successful create", () => {
    render(<PenPalette embedded />)

    const newPen = screen.getByRole("button", { name: "New pen" })
    expect(newPen).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByLabelText("New pen name")).not.toBeInTheDocument()

    fireEvent.click(newPen)
    expect(screen.getByRole("button", { name: "New pen" })).toHaveAttribute("aria-pressed", "true")
    const name = screen.getByLabelText("New pen name")
    expect(name).toBeInTheDocument()

    fireEvent.change(name, { target: { value: "Sketching" } })
    fireEvent.click(screen.getByRole("button", { name: "Add pen" }))

    expect(screen.queryByLabelText("New pen name")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New pen" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: /^Sketching$/ })).toBeInTheDocument()
  })

  it("hides the creator again when New pen is clicked a second time", () => {
    render(<PenPalette embedded />)
    fireEvent.click(screen.getByRole("button", { name: "New pen" }))
    expect(screen.getByLabelText("New pen name")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "New pen" }))
    expect(screen.queryByLabelText("New pen name")).not.toBeInTheDocument()
  })

  it("hides the creator on Escape without creating", () => {
    render(<PenPalette embedded />)
    fireEvent.click(screen.getByRole("button", { name: "New pen" }))
    fireEvent.keyDown(screen.getByLabelText("New pen name"), { key: "Escape" })
    expect(screen.queryByLabelText("New pen name")).not.toBeInTheDocument()
  })
})
