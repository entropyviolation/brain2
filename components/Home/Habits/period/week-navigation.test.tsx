/** components/Home/Habits/period/week-navigation.test.tsx */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { WeekNavigation } from "./week-navigation"

describe("WeekNavigation", () => {
  const currentWeekStart = new Date("2026-06-16T00:00:00")
  const weekEndDate = new Date("2026-06-22T00:00:00")

  it("renders week range and navigation controls", () => {
    render(
      <WeekNavigation
        currentWeekStart={currentWeekStart}
        weekEndDate={weekEndDate}
        onPreviousWeek={vi.fn()}
        onNextWeek={vi.fn()}
        onCurrentWeek={vi.fn()}
      />,
    )
    expect(screen.getByText("Today")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Previous Week" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next Week" })).toBeInTheDocument()
  })

  it("parks Today on the current period: hidden, out of the tab order, space kept", () => {
    render(
      <WeekNavigation
        currentWeekStart={currentWeekStart}
        weekEndDate={weekEndDate}
        isCurrentPeriod
        onPreviousWeek={vi.fn()}
        onNextWeek={vi.fn()}
        onCurrentWeek={vi.fn()}
      />,
    )
    expect(screen.queryByRole("button", { name: /Today/ })).toBeNull()
    const today = screen.getByText("Today").closest("button")!
    expect(today.className).toContain("is-parked")
    expect(today).toHaveAttribute("tabindex", "-1")
    expect(today).toBeInTheDocument()
  })

  it("calls onPreviousWeek when previous button is clicked", async () => {
    const user = userEvent.setup()
    const onPreviousWeek = vi.fn()
    render(
      <WeekNavigation
        currentWeekStart={currentWeekStart}
        weekEndDate={weekEndDate}
        onPreviousWeek={onPreviousWeek}
        onNextWeek={vi.fn()}
        onCurrentWeek={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Previous Week" }))
    expect(onPreviousWeek).toHaveBeenCalledOnce()
  })
})
