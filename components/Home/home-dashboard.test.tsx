/**
 * HomeDashboard — container behavior tests.
 */
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { format } from "date-fns"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { HomeDashboard } from "./home-dashboard"
import { msUntilLocalMidnight } from "@/lib/use-current-date"

vi.mock("@/components/Home/Habits/habit-tracker", () => ({
  WeeklyTaskTracker: ({ currentDate }: { currentDate?: Date }) => (
    <div data-testid="panel-habits">Habits {currentDate?.toISOString()}</div>
  ),
}))

vi.mock("@/components/Home/Plan/plan-panel", () => ({
  PlanPanel: ({ currentDate }: { currentDate?: Date }) => (
    <div data-testid="panel-plan">Plan {currentDate?.toISOString()}</div>
  ),
}))

vi.mock("@/components/Home/ToDo/todo-panel", () => ({
  TodoPanel: () => <div data-testid="panel-todo">To Do panel</div>,
}))

vi.mock("@/components/Home/Goals/goals-tracker", () => ({
  GoalsTracker: () => <div data-testid="panel-goals">Goals panel</div>,
}))

vi.mock("@/components/Home/Tracking/time-grid", () => ({
  TimeGrid: () => <div data-testid="panel-time-grid">Time Grid panel</div>,
}))

vi.mock("@/components/Home/Tracking/actual-day-view", () => ({
  ActualDayView: ({ currentDate }: { currentDate?: Date }) => (
    <div data-testid="panel-day-log">Day Log {currentDate?.toISOString()}</div>
  ),
}))

const pointsStatsSpy = vi.fn(({ currentDate }: { currentDate: Date }) => (
  <div data-testid="points-stats">Points for {format(currentDate, "yyyy-MM-dd")}</div>
))

vi.mock("@/components/Home/points-stats", () => ({
  PointsStats: (props: { currentDate: Date }) => pointsStatsSpy(props),
}))

const quickviewSpy = vi.fn(({ currentDate }: { currentDate: Date }) => (
  <div data-testid="daily-progress">Progress for {format(currentDate, "yyyy-MM-dd")}</div>
))

vi.mock("@/components/Home/daily-progress-quickview", () => ({
  DailyProgressQuickview: (props: { currentDate: Date }) => quickviewSpy(props),
}))

vi.mock("@/components/Home/home-review-banner", () => ({
  HomeReviewBanner: () => <div data-testid="review-banner">Review banner</div>,
}))

describe("HomeDashboard", () => {
  const fixedNow = new Date("2026-06-20T14:30:00")

  beforeEach(() => {
    resetLocalStorage()
    pointsStatsSpy.mockClear()
    quickviewSpy.mockClear()
  })

  describe("layout and header", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(fixedNow)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("renders the date card with weekday, month/day, and year", () => {
      render(<HomeDashboard />)
      expect(screen.getByText(format(fixedNow, "EEEE, MMMM d"))).toBeInTheDocument()
      expect(screen.getByText(format(fixedNow, "yyyy"))).toBeInTheDocument()
    })

    it("passes the same currentDate to PointsStats and DailyProgressQuickview", () => {
      render(<HomeDashboard />)
      expect(pointsStatsSpy).toHaveBeenCalledWith(expect.objectContaining({ currentDate: fixedNow }))
      expect(quickviewSpy).toHaveBeenCalledWith(expect.objectContaining({ currentDate: fixedNow }))
    })

    it("shows review banner slot", () => {
      render(<HomeDashboard />)
      expect(screen.getByTestId("review-banner")).toBeInTheDocument()
    })
  })

  describe("main sub-tabs", () => {
    it("renders all five main tab triggers", () => {
      render(<HomeDashboard />)
      const tabs = within(screen.getByRole("tablist")).getAllByRole("tab")
      expect(tabs.map((t) => t.textContent)).toEqual(["Habits", "Plan", "To Do", "Goals", "Tracking"])
    })

    it("defaults to the Habits tab", () => {
      render(<HomeDashboard />)
      expect(screen.getByRole("tab", { name: "Habits" })).toHaveAttribute("data-state", "active")
      expect(screen.getByTestId("panel-habits")).toBeVisible()
    })

    it("persists active tab to localStorage", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)
      await user.click(screen.getByRole("tab", { name: "Goals" }))
      expect(localStorage.getItem("cogs-home-tab")).toBe("goals")
    })

    it("restores active tab from localStorage", () => {
      localStorage.setItem("cogs-home-tab", "todo")
      render(<HomeDashboard />)
      expect(screen.getByRole("tab", { name: "To Do" })).toHaveAttribute("data-state", "active")
      expect(screen.getByTestId("panel-todo")).toBeVisible()
    })

    it("switches visible panel when each main tab is clicked", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)

      for (const { label, testId } of [
        { label: "Plan", testId: "panel-plan" },
        { label: "To Do", testId: "panel-todo" },
        { label: "Goals", testId: "panel-goals" },
        { label: "Tracking", testId: "panel-time-grid" },
        { label: "Habits", testId: "panel-habits" },
      ]) {
        await user.click(screen.getByRole("tab", { name: label }))
        expect(screen.getByTestId(testId)).toBeVisible()
      }
    })
  })

  describe("Tracking nested sub-tabs", () => {
    it("persists nested tracking tab", async () => {
      const user = userEvent.setup()
      render(<HomeDashboard />)
      await user.click(screen.getByRole("tab", { name: "Tracking" }))
      await user.click(screen.getByRole("tab", { name: "Day Log" }))
      expect(localStorage.getItem("cogs-home-tracking-tab")).toBe("daylog")
    })

    it("restores nested tracking tab from localStorage", async () => {
      localStorage.setItem("cogs-home-tab", "tracking")
      localStorage.setItem("cogs-home-tracking-tab", "daylog")
      render(<HomeDashboard />)
      expect(screen.getByRole("tab", { name: "Day Log" })).toHaveAttribute("data-state", "active")
      expect(screen.getByTestId("panel-day-log")).toBeVisible()
    })
  })

  describe("date rollover", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 5, 20, 23, 59, 0))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("updates header date at local midnight", async () => {
      const beforeMidnight = new Date(2026, 5, 20, 23, 59, 0)
      const afterMidnight = new Date(2026, 5, 21, 0, 0, 1)

      render(<HomeDashboard />)
      expect(screen.getByText(format(beforeMidnight, "EEEE, MMMM d"))).toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(msUntilLocalMidnight(beforeMidnight) + 1)
      })

      expect(screen.getByText(format(afterMidnight, "EEEE, MMMM d"))).toBeInTheDocument()
    })
  })
})
