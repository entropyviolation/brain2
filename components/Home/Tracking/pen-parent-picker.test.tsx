import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PenParentPicker } from "./pen-parent-picker"
import type { TrackPen } from "@/lib/time-tracking-store"

const mexico: TrackPen = { id: "mexico", name: "Mexico", color: "#800000" }
const sanDiego: TrackPen = { id: "sd", name: "San Diego", color: "#2563eb", parentId: "mexico" }
const ocean: TrackPen = { id: "ob", name: "Ocean Beach", color: "#60a5fa", parentId: "sd" }
const homeOb: TrackPen = { id: "home", name: "Home", color: "#94a3b8", parentId: "ob" }
const homeMx: TrackPen = { id: "home-mx", name: "Home", color: "#f59e0b", parentId: "mexico" }
const balboa: TrackPen = { id: "balboa", name: "Balboa Park", color: "#16a34a", parentId: "sd" }

const tree = [mexico, sanDiego, ocean, homeOb, homeMx, balboa]
const selectable = [sanDiego, ocean, homeOb, homeMx, balboa]

function openPicker(onSelect = vi.fn()) {
  render(
    <div className="trk95">
      <PenParentPicker
        pens={selectable}
        treePens={tree}
        currentName="Mission Beach"
        onSelect={onSelect}
        onCreate={vi.fn()}
      />
    </div>,
  )
  fireEvent.click(screen.getByLabelText("Counts as"))
  return onSelect
}

describe("PenParentPicker", () => {
  it("labels options with the ancestor path so two Homes stay distinct", () => {
    openPicker()
    const homes = screen.getAllByRole("option", { name: /Home/ })
    expect(homes.some((el) => /Ocean Beach/.test(el.textContent ?? ""))).toBe(true)
    expect(homes.some((el) => /Mexico/.test(el.textContent ?? "") && !/Ocean Beach/.test(el.textContent ?? ""))).toBe(
      true,
    )
  })

  it("finds a nested pen when the query matches an ancestor, not the leaf name", () => {
    openPicker()
    fireEvent.change(screen.getByLabelText("Search parent pens"), { target: { value: "Mexico" } })
    expect(screen.getByRole("option", { name: /Balboa Park/ })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: /^Mexico$/ })).not.toBeInTheDocument()
  })
})
