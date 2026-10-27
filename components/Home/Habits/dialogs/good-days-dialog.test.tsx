import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { GoodDaysDialog } from "./good-days-dialog"
import type { GoodDaySummary, GoodPeriodSummary } from "@/lib/habit-accomplishment"

const summary: GoodDaySummary = {
  threshold: 80,
  bonus: 50,
  streak: 3,
  longestStreak: 5,
  last30Count: 8,
  todayRaw: 100,
  todayCompletionRaw: 100,
  todayGood: true,
  prior30Average: 64,
  prior7Average: 100,
  prior30VsToday: "lower",
  prior7VsToday: "same",
  yesterdayCompletionRaw: 80,
  yesterdayVsToday: "lower",
  weeks: {
    thisWeek: 50,
    lastWeek: 70,
    thisYear: 40,
    allTime: 55,
    lastWeekVs: "higher",
    thisYearVs: "lower",
    allTimeVs: "higher",
  },
  last30: [
    {
      date: new Date(2026, 8, 16),
      dateKey: "2026-09-16",
      raw: 100,
      good: true,
    },
    {
      date: new Date(2026, 8, 17),
      dateKey: "2026-09-17",
      raw: 40,
      good: false,
    },
  ],
}

describe("GoodDaysDialog", () => {
  it("shows streak and last-month counts separate from grade copy", () => {
    render(
      <GoodDaysDialog
        open
        onOpenChange={vi.fn()}
        summary={summary}
        onThresholdChange={vi.fn()}
        onBonusChange={vi.fn()}
      />,
    )
    expect(screen.getByRole("dialog", { name: /Good days/i })).toBeInTheDocument()
    expect(screen.getByText("Good day streak")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText(/Good days in the last month/i)).toBeInTheDocument()
    expect(screen.getByText("8")).toBeInTheDocument()
    expect(screen.getByText("Yes")).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: /Week grade/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Daily perfect threshold/i)).not.toBeInTheDocument()
  })

  it("shows the 30-day and 7-day raw averages against today", () => {
    const { rerender } = render(
      <GoodDaysDialog
        open
        onOpenChange={vi.fn()}
        summary={summary}
        onThresholdChange={vi.fn()}
        onBonusChange={vi.fn()}
      />,
    )
    const month = screen.getByTestId("good-days-avg-30")
    const week = screen.getByTestId("good-days-avg-7")
    expect(month).toHaveTextContent("Last 30 days")
    expect(month).toHaveTextContent("64%")
    expect(month).toHaveTextContent("36 points lower than today")
    expect(month.querySelector("[data-comparison='lower']")).toBeTruthy()
    expect(month.querySelector(".good-days-average-value")).not.toHaveAttribute("data-comparison")
    expect(week).toHaveTextContent("100%")
    expect(week).toHaveTextContent("same as today")
    expect(week.querySelector("[data-comparison='same']")).toBeTruthy()
    expect(screen.getByTestId("good-days-today-raw")).toHaveTextContent("100%")
    expect(screen.getByTestId("good-days-yesterday")).toHaveTextContent("80%")
    expect(screen.getByTestId("good-days-yesterday")).toHaveTextContent("20 points lower than today")
    expect(screen.getByTestId("good-days-this-week-raw")).toHaveTextContent("50%")
    expect(screen.getByTestId("good-days-week-last")).toHaveTextContent("20 points higher than this week")
    expect(screen.getByTestId("good-days-week-year")).toHaveTextContent("10 points lower than this week")
    expect(screen.getByTestId("good-days-week-all")).toHaveTextContent("5 points higher than this week")

    rerender(
      <GoodDaysDialog
        open
        onOpenChange={vi.fn()}
        summary={{ ...summary, prior7Average: 90, prior7VsToday: "higher", todayCompletionRaw: 40 }}
        onThresholdChange={vi.fn()}
        onBonusChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId("good-days-avg-7")).toHaveTextContent("50 points higher than today")
    expect(screen.getByTestId("good-days-avg-7").querySelector("[data-comparison='higher']")).toBeTruthy()
    expect(screen.getByTestId("good-days-today-raw")).toHaveTextContent("40%")
  })

  it("says how many points today still needs, or that the line is met", () => {
    const { rerender } = render(
      <GoodDaysDialog
        open
        onOpenChange={vi.fn()}
        summary={{ ...summary, threshold: 50, todayCompletionRaw: 40 }}
        onThresholdChange={vi.fn()}
        onBonusChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId("good-period-points")).toHaveTextContent("10 needed")
    expect(screen.getByTestId("good-period-points")).toHaveTextContent("good day")

    rerender(
      <GoodDaysDialog
        open
        onOpenChange={vi.fn()}
        summary={{ ...summary, threshold: 50, todayCompletionRaw: 50 }}
        onThresholdChange={vi.fn()}
        onBonusChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId("good-period-points").textContent?.toLowerCase()).toContain("met")
  })

  it("reuses the plate for a good week, with that week's points at the top", () => {
    const period: GoodPeriodSummary = {
      unit: "week",
      noun: "week",
      plural: "weeks",
      threshold: 50,
      bonus: 50,
      streak: 2,
      longestStreak: 2,
      lookbackCount: 2,
      lookbackSize: 12,
      streakLabel: "Good week streak",
      countLabel: "Good weeks in the last 12",
      currentRaw: 40,
      currentGood: false,
      pointsNeeded: 10,
      pointsMet: false,
      pointsPhrase: "10 needed to be a good week",
      lookback: [
        {
          date: new Date(2026, 8, 14),
          dateKey: "2026-09-14",
          label: "Sep 14",
          raw: 50,
          good: true,
        },
      ],
    }
    render(
      <GoodDaysDialog
        open
        onOpenChange={vi.fn()}
        summary={summary}
        period={period}
        onThresholdChange={vi.fn()}
        onBonusChange={vi.fn()}
      />,
    )
    expect(screen.getByRole("dialog", { name: /Good weeks/i })).toBeInTheDocument()
    expect(screen.getByTestId("good-period-points")).toHaveTextContent("10 needed")
    expect(screen.getByTestId("good-period-points")).toHaveTextContent("good week")
    expect(screen.getByText("Good week streak")).toBeInTheDocument()
    expect(screen.getByText("Good weeks in the last 12")).toBeInTheDocument()
    expect(screen.getByTestId("good-period-current-raw")).toHaveTextContent("40%")
    expect(screen.queryByTestId("good-days-today-raw")).not.toBeInTheDocument()
  })

  it("edits accomplishment threshold and bonus", async () => {
    const user = userEvent.setup()
    const onThresholdChange = vi.fn()
    const onBonusChange = vi.fn()
    render(
      <GoodDaysDialog
        open
        onOpenChange={vi.fn()}
        summary={summary}
        onThresholdChange={onThresholdChange}
        onBonusChange={onBonusChange}
      />,
    )
    await user.clear(screen.getByLabelText(/Completion to feel accomplished/i))
    await user.type(screen.getByLabelText(/Completion to feel accomplished/i), "70")
    expect(onThresholdChange).toHaveBeenCalled()
    await user.clear(screen.getByLabelText(/Accomplishment bonus/i))
    await user.type(screen.getByLabelText(/Accomplishment bonus/i), "20")
    expect(onBonusChange).toHaveBeenCalled()
  })
})
