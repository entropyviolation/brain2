import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ColorSwatch } from "./color-swatch"

describe("ColorSwatch", () => {
  it("fills a beveled control instead of a cramped native chip", () => {
    render(<ColorSwatch value="#2563eb" onChange={() => {}} aria-label="New pen color" />)
    const input = screen.getByLabelText("New pen color")
    expect(input).toHaveAttribute("type", "color")
    expect(input).toHaveValue("#2563eb")
    expect(input.parentElement).toHaveClass("cogs-color-swatch")
  })

  it("reports the picked hex", () => {
    const onChange = vi.fn()
    render(<ColorSwatch value="#10b981" onChange={onChange} aria-label="Pen color" />)
    fireEvent.change(screen.getByLabelText("Pen color"), { target: { value: "#ef4444" } })
    expect(onChange).toHaveBeenCalledWith("#ef4444")
  })
})
