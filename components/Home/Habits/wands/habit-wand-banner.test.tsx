import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { HabitWandBanner } from "./habit-wand-banner"

describe("HabitWandBanner", () => {
  it("renders nothing for null and one sentence for each wand view", () => {
    const { container, rerender } = render(<HabitWandBanner view={null} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<HabitWandBanner view="exemption" />)
    expect(screen.getByText("EXEMPTION WAND VIEW ON")).toBeInTheDocument()
    rerender(<HabitWandBanner view="missed" />)
    expect(screen.getByText("MISSED OPPORTUNITY WAND VIEW ON")).toBeInTheDocument()
  })
})
