import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { OrbPickerDialog } from "../OrbPickerDialog"

vi.mock("@/lib/remove-background", () => ({
  removeBackground: vi.fn(),
}))

describe("OrbPickerDialog", () => {
  it("renders the gallery with orbs", () => {
    render(<OrbPickerDialog open={true} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText("Choose an Icon")).toBeInTheDocument()
    expect(screen.getAllByRole("img").length).toBeGreaterThan(0)
  })

  it("calls onSelect when an orb is clicked", () => {
    const onSelect = vi.fn()
    render(<OrbPickerDialog open={true} onSelect={onSelect} onClose={vi.fn()} />)
    const firstOrb = screen.getAllByRole("img")[0]
    fireEvent.click(firstOrb.closest("button")!)
    expect(onSelect).toHaveBeenCalled()
  })

  it("filters orbs by search", () => {
    render(<OrbPickerDialog open={true} onSelect={vi.fn()} onClose={vi.fn()} />)
    const searchInput = screen.getByPlaceholderText("Search orbs...")
    fireEvent.change(searchInput, { target: { value: "zzzznonexistent" } })
    expect(screen.queryAllByRole("img")).toHaveLength(0)
  })
})
