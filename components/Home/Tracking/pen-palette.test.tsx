import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { PenPalette } from "./pen-palette"
import { getTrackingViewPrefs, resetTrackingViewPrefs, setTrackingViewPrefs } from "./tracking-view-prefs"

beforeEach(() => {
  resetAllStores()
  resetTrackingViewPrefs()
})

describe("PenPalette tray", () => {
  it("keeps the pen container plain steel, with no photograph", () => {
    render(<PenPalette embedded />)
    const root = document.querySelector(".trk95")
    expect(root).not.toHaveAttribute("data-pen-tray")
    expect((root as HTMLElement).style.getPropertyValue("--pen-tray-photo")).toBe("")
    const well = document.querySelector(".trk-pen-well") as HTMLElement
    expect(well).toBeTruthy()
    expect(["", "none"]).toContain(getComputedStyle(well).backgroundImage)
  })
})

describe("PenPalette bead well", () => {
  it("clips beads to one row until Expand (right of Tree) unwraps them", () => {
    render(<PenPalette embedded />)

    const well = document.querySelector(".trk-pen-well")
    expect(well).toHaveClass("trk-pen-well-collapsed")
    expect(well).toHaveAttribute("data-expanded", "false")

    const sort = screen.getByRole("button", { name: "Sort pens Recent" })
    const expand = screen.getByRole("button", { name: "Expand" })
    expect(expand).toHaveAttribute("aria-pressed", "false")
    expect(sort.compareDocumentPosition(expand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole("option", { name: "Sort pens Tree" })).not.toBeInTheDocument()
    fireEvent.click(sort)
    const tree = screen.getByRole("option", { name: "Sort pens Tree" })
    expect(sort.compareDocumentPosition(tree) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(tree)
    expect(screen.getByRole("button", { name: "Sort pens Tree" })).toBeInTheDocument()

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
  it("keeps + New pen at the bottom while the well is expanded", () => {
    setTrackingViewPrefs({ penWellExpanded: true })
    render(<PenPalette embedded />)

    expect(screen.queryByRole("button", { name: "New pen" })).not.toBeInTheDocument()
    const add = screen.getByRole("button", { name: "+ New pen" })
    const well = document.querySelector(".trk-pen-well")
    expect(well).toBeTruthy()
    expect(well!.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const name = screen.getByLabelText("New pen name")
    fireEvent.change(name, { target: { value: "Sketching" } })
    fireEvent.click(add)

    expect(screen.getByRole("button", { name: /^Sketching$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "+ New pen" })).toBeInTheDocument()
  })

  it("offers Create new pen from a collapsed search that matches nothing, using the query as the name", () => {
    render(<PenPalette embedded />)
    expect(screen.queryByRole("button", { name: "+ New pen" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Create new pen" })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Search pens"), { target: { value: "Sketching" } })
    const name = screen.getByLabelText("New pen name")
    expect(name).toHaveValue("Sketching")
    fireEvent.click(screen.getByRole("button", { name: "Create new pen" }))

    expect(screen.getByRole("button", { name: /^Sketching$/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Create new pen" })).not.toBeInTheDocument()
  })
})
