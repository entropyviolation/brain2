import { fireEvent, render, screen, within } from "@testing-library/react"
import { format } from "date-fns"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { submitTrackingLog } from "./tracking-log-model"
import { TrackingLogWeek } from "./tracking-log-week"

describe("TrackingLogWeek", () => {
  const currentDate = new Date(2026, 5, 17, 12, 0, 0) // Wednesday
  const weekDates = getWeekDates(getWeekStartDate(currentDate))

  beforeEach(() => {
    resetAllStores()
  })

  it("renders seven day columns for the week of the selected date", () => {
    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={currentDate}
          onOpenDay={vi.fn()}
          onOpenEntry={vi.fn()}
          onRemoveEntry={vi.fn()}
        />
      </div>,
    )

    expect(screen.getByTestId("tracking-log-week")).toBeInTheDocument()
    for (const date of weekDates) {
      expect(screen.getByRole("button", { name: `Open ${format(date, "EEEE, MMM d")}` })).toBeInTheDocument()
    }
  })

  it("calls onOpenDay when a day heading is activated", () => {
    const onOpenDay = vi.fn()
    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={currentDate}
          onOpenDay={onOpenDay}
          onOpenEntry={vi.fn()}
          onRemoveEntry={vi.fn()}
        />
      </div>,
    )

    fireEvent.click(screen.getByRole("button", { name: `Open ${format(weekDates[2], "EEEE, MMM d")}` }))
    expect(onOpenDay).toHaveBeenCalledTimes(1)
    expect(formatLocalDateKey(onOpenDay.mock.calls[0]![0])).toBe(formatLocalDateKey(weekDates[2]!))
  })

  it("places log rows on the correct day column", () => {
    const monday = weekDates[0]!
    const tuesday = weekDates[1]!
    submitTrackingLog({
      date: formatLocalDateKey(monday),
      title: "oatmeal",
      mode: "intake",
      intakeClass: "food",
      clock: "exact",
      minute: 8 * 60,
    })
    submitTrackingLog({
      date: formatLocalDateKey(tuesday),
      title: "left room",
      mode: "event",
      clock: "exact",
      minute: 10 * 60,
    })

    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={currentDate}
          onOpenDay={vi.fn()}
          onOpenEntry={vi.fn()}
          onRemoveEntry={vi.fn()}
        />
      </div>,
    )

    const mondayCol = screen.getByLabelText(`Log for ${format(monday, "EEEE, MMM d")}`)
    const tuesdayCol = screen.getByLabelText(`Log for ${format(tuesday, "EEEE, MMM d")}`)
    expect(within(mondayCol).getByText("oatmeal")).toBeInTheDocument()
    expect(within(mondayCol).getByText("Food")).toBeInTheDocument()
    expect(within(tuesdayCol).getByText("left room")).toBeInTheDocument()
    expect(within(tuesdayCol).getByText("Event")).toBeInTheDocument()
    expect(within(mondayCol).queryByText("left room")).not.toBeInTheDocument()
  })

  it("marks the today column from the wall clock", () => {
    const today = new Date()
    const weekOfToday = getWeekDates(getWeekStartDate(today))
    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={today}
          onOpenDay={vi.fn()}
          onOpenEntry={vi.fn()}
          onRemoveEntry={vi.fn()}
        />
      </div>,
    )

    const todayKey = formatLocalDateKey(today)
    const todayHead = screen.getByRole("button", {
      name: `Open ${format(
        weekOfToday.find((d) => formatLocalDateKey(d) === todayKey) ?? today,
        "EEEE, MMM d",
      )}`,
    })
    expect(todayHead).toHaveAttribute("data-today", "true")
  })

  it("opens an entry when a known-clock row is clicked", () => {
    const onOpenEntry = vi.fn()
    const monday = weekDates[0]!
    const id = submitTrackingLog({
      date: formatLocalDateKey(monday),
      title: "coffee",
      mode: "intake",
      intakeClass: "drink",
      clock: "exact",
      minute: 9 * 60,
    })

    render(
      <div className="trk95">
        <TrackingLogWeek
          currentDate={currentDate}
          onOpenDay={vi.fn()}
          onOpenEntry={onOpenEntry}
          onRemoveEntry={vi.fn()}
        />
      </div>,
    )

    fireEvent.click(screen.getByRole("button", { name: /coffee/ }))
    expect(onOpenEntry).toHaveBeenCalledWith(id)
  })
})
