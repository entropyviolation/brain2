/**
 * CognitiveState — header tracking quick-entry dialog.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { CognitiveState } from "./cognitive-state"

vi.mock("@/components/Home/Tracking/time-grid", () => ({
  TimeGrid: ({ compact }: { compact?: boolean }) => (
    <div data-testid="time-grid">{compact ? "compact grid" : "full grid"}</div>
  ),
}))

describe("CognitiveState", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("renders the Tracking trigger button", () => {
    render(<CognitiveState />)
    expect(screen.getByRole("button", { name: /Tracking/i })).toBeInTheDocument()
  })

  it("opens the time tracking dialog with TimeGrid", async () => {
    const user = userEvent.setup()
    render(<CognitiveState />)
    expect(screen.getByRole("button", { name: /Tracking/i })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Tracking/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Time Tracking")).toBeInTheDocument()
    expect(await screen.findByTestId("time-grid")).toHaveTextContent("compact grid")
  })
})
