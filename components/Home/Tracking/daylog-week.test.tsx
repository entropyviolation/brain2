import { fireEvent, render, screen } from "@testing-library/react"
import { format } from "date-fns"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { DayLogWeek } from "./daylog-week"

describe("DayLogWeek", () => {
  const currentDate = new Date("2026-06-17T12:00:00") // Wednesday
  const weekDates = getWeekDates(getWeekStartDate(currentDate))

  beforeEach(() => {
    resetAllStores()
  })

  it("renders seven day columns for the week of the selected date", () => {
    render(
      <div className="trk95">
        <DayLogWeek
          currentDate={currentDate}
          onOpenDay={vi.fn()}
          onTrackedBlockClick={vi.fn()}
          onTaskClick={vi.fn()}
          onEventClick={vi.fn()}
        />
      </div>,
    )

    expect(screen.getByTestId("daylog-week")).toBeInTheDocument()
    for (const date of weekDates) {
      expect(screen.getByRole("button", { name: `Open ${format(date, "EEEE, MMM d")}` })).toBeInTheDocument()
    }
  })

  it("calls onOpenDay when a day heading is activated", () => {
    const onOpenDay = vi.fn()
    render(
      <div className="trk95">
        <DayLogWeek
          currentDate={currentDate}
          onOpenDay={onOpenDay}
          onTrackedBlockClick={vi.fn()}
          onTaskClick={vi.fn()}
          onEventClick={vi.fn()}
        />
      </div>,
    )

    fireEvent.click(screen.getByRole("button", { name: `Open ${format(weekDates[2], "EEEE, MMM d")}` }))
    expect(onOpenDay).toHaveBeenCalledTimes(1)
    expect(formatLocalDateKey(onOpenDay.mock.calls[0][0])).toBe(formatLocalDateKey(weekDates[2]))
  })

  it("shows painted tracking blocks for days in the week", () => {
    const monday = weekDates[0]
    useTimeTrackingStore.getState().paintMinutes(formatLocalDateKey(monday), "activity", 540, 660, "act-work")

    render(
      <div className="trk95">
        <DayLogWeek
          currentDate={currentDate}
          onOpenDay={vi.fn()}
          onTrackedBlockClick={vi.fn()}
          onTaskClick={vi.fn()}
          onEventClick={vi.fn()}
        />
      </div>,
    )

    expect(screen.getByText("Work")).toBeInTheDocument()
  })
})
