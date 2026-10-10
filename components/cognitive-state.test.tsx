/**
 * CognitiveState — header Now door.
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { CognitiveState } from "./cognitive-state"

vi.mock("@/components/Home/Tracking/time-grid", () => ({
  TimeGrid: () => <div data-testid="time-grid">day grid</div>,
}))

describe("CognitiveState", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("renders the Now trigger", () => {
    render(<CognitiveState />)
    const key = screen.getByRole("button", { name: "Now" })
    expect(key).toBeInTheDocument()
    expect(key).toHaveAttribute("title", "Now")
  })

  it("opens Recent now, then Upcoming now, with the moment explanation", async () => {
    const user = userEvent.setup()
    render(<CognitiveState />)
    await user.click(screen.getByRole("button", { name: "Now" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("dialog").className).toContain("66rem")
    expect(screen.getByText("Recent now")).toBeInTheDocument()
    expect(screen.getByText(/edge of the current moment/)).toBeInTheDocument()
    expect(screen.queryByText("What is true right now, and the plan for the hours ahead.")).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Tracking" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Plan" })).toBeInTheDocument()
    expect(await screen.findByTestId("time-grid")).toHaveTextContent("day grid")
    expect(screen.getByTestId("htk-current-moment")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Plan" }))
    expect(screen.getByText("Upcoming now")).toBeInTheDocument()
    expect(screen.queryByText("Recent now")).not.toBeInTheDocument()
    expect(screen.getByTestId("htk-current-moment")).toBeInTheDocument()
  })
})
