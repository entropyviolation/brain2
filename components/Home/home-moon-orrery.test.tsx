import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { MoonOrrery } from "@/components/Home/home-moon-orrery"
import { DEFAULT_SKY_MOTION, useSkyMotionStore } from "@/lib/sky-motion-store"

describe("moon chart date", () => {
  beforeEach(() => {
    localStorage.clear()
    useSkyMotionStore.setState({ ...DEFAULT_SKY_MOTION })
  })

  afterEach(() => {
    useSkyMotionStore.setState({ ...DEFAULT_SKY_MOTION })
    localStorage.clear()
  })

  it("sets the chart anchor and Now returns to the widget date", () => {
    const widget = new Date(2026, 9, 6, 15, 30, 0, 0)
    render(<MoonOrrery date={widget} />)
    const input = screen.getByLabelText("Date")
    expect(input).toHaveValue("2026-10-06T15:30")
    expect(screen.getByText("October 6, 2026, at 3:30 pm")).toBeInTheDocument()

    fireEvent.change(input, { target: { value: "2020-01-01T00:00" } })
    expect(input).toHaveValue("2020-01-01T00:00")
    expect(screen.getByText("January 1, 2020, at 12:00 am")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Now" }))
    expect(input).toHaveValue("2026-10-06T15:30")
    expect(screen.getByText("October 6, 2026, at 3:30 pm")).toBeInTheDocument()
    expect(screen.getByText("One clock").closest("li")).toHaveAttribute("data-state", "done")
    expect(screen.getByText("Log camera").closest("li")).toHaveAttribute("data-state", "ahead")
    expect(screen.getByText("Stars").closest("li")).toHaveAttribute("data-state", "done")
    expect(screen.getByText("Chrome").closest("li")).toHaveAttribute("data-state", "ahead")
    expect(screen.getByText("Light-time").closest("li")).toHaveAttribute("data-state", "ahead")

    expect(useSkyMotionStore.getState().viewWidthLog).toBe(3.5)
    expect(useSkyMotionStore.getState().rateIndex).toBe(0)
  })

  it("leaves the chosen date when reset clears only the rate", () => {
    const widget = new Date(2026, 9, 6, 12, 0, 0, 0)
    render(<MoonOrrery date={widget} />)
    fireEvent.change(screen.getByLabelText("View width"), { target: { value: "4.4" } })
    fireEvent.change(screen.getByLabelText("Time rate"), { target: { value: "2" } })
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "1999-12-31T23:00" } })

    fireEvent.click(screen.getByRole("button", { name: "Reset to real time" }))
    expect(useSkyMotionStore.getState().rateIndex).toBe(0)
    expect(useSkyMotionStore.getState().viewWidthLog).toBe(4.4)
    expect(screen.getByLabelText("Date")).toHaveValue("1999-12-31T23:00")
    expect(screen.getByText("December 31, 1999, at 11:00 pm")).toBeInTheDocument()
    expect(screen.getByText("real time")).toBeInTheDocument()
  })
})
