/**
 * components/Reviews/StartRitualDialog.test.tsx — the start rite walks one step at a time.
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useReviewsStore } from "@/lib/reviews-store"
import { StartRitualDialog } from "./StartRitualDialog"

describe("StartRitualDialog steps", () => {
  beforeEach(() => {
    resetAllStores()
    localStorage.clear()
  })

  it("opens on the undone step and saves progress when moving on", () => {
    render(<StartRitualDialog open period="month" periodKey="2026-10" onClose={() => {}} />)
    expect(screen.getByRole("heading", { name: "Undone from last month" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }))
    expect(screen.getByRole("heading", { name: "Priorities" })).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/What matters most/), { target: { value: "the book" } })
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }))
    const saved = useReviewsStore.getState().getStartRitual("month", "2026-10")
    expect(saved?.priorities).toBe("the book")
    expect(saved?.completed).toBe(false)
  })

  it("Finish on the last step submits the start ritual", () => {
    const onClose = vi.fn()
    render(<StartRitualDialog open period="week" periodKey="2026-10-12_2026-10-18" onClose={onClose} />)
    fireEvent.click(screen.getByRole("button", { name: /^Go to Gratitude/ }))
    fireEvent.change(screen.getByPlaceholderText("I'm grateful for…"), { target: { value: "rain" } })
    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    expect(useReviewsStore.getState().getStartRitual("week", "2026-10-12_2026-10-18")?.completed).toBe(true)
    expect(onClose).toHaveBeenCalled()
  })
})
