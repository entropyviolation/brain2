import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { GoodDaysDialog } from "./good-days-dialog"
import type { GoodDaySummary } from "@/lib/habit-accomplishment"

const summary: GoodDaySummary = {
  threshold: 80,
  bonus: 50,
  streak: 3,
  longestStreak: 5,
  last30Count: 8,
  todayRaw: 100,
  todayGood: true,
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
