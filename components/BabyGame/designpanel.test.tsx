import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { DesignPanel } from "./designpanel"
import { loadDesignNotes } from "@/lib/baby-game/design-notes"

describe("design panel", () => {
  beforeEach(() => localStorage.clear())

  it("shows three views, saves a note and a redo mark, and picks another friend", () => {
    render(<DesignPanel initial="otter" onBack={() => {}} />)
    expect(screen.getAllByRole("img")).toHaveLength(3)
    fireEvent.click(screen.getByText("Needs redesign"))
    fireEvent.change(screen.getByPlaceholderText(/Rounder tail/), { target: { value: "bigger eyes" } })
    const saved = loadDesignNotes().otter
    expect(saved?.status).toBe("redo")
    expect(saved?.text).toBe("bigger eyes")
    fireEvent.click(screen.getByText("The Center of The World"))
    expect(screen.getAllByRole("img")[0]!.getAttribute("aria-label")).toContain("The Center of The World")
    expect(screen.getByText(/Copy all redo briefs \(1\)/)).toBeTruthy()
  })
})
