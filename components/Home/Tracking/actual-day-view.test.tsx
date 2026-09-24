import { fireEvent, render, screen } from "@testing-library/react"
import { format } from "date-fns"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ActualDayView } from "./actual-day-view"

vi.mock("@/components/Home/Plan/agenda-grid", () => ({
  AgendaGrid: ({
    trackedBlocks,
  }: {
    trackedBlocks?: { id: string; label: string }[]
  }) => (
    <div data-testid="agenda-grid">
      {trackedBlocks?.map((block) => (
        <div key={block.id}>{block.label}</div>
      ))}
    </div>
  ),
}))

describe("ActualDayView", () => {
  const currentDate = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    resetAllStores()
  })

  it("renders date navigation and the plan vs tracked grid", () => {
    render(<ActualDayView currentDate={currentDate} />)
    expect(screen.getByText(format(currentDate, "EEEE, MMMM d, yyyy"))).toBeInTheDocument()
    expect(screen.getByText("Plan vs tracked")).toBeInTheDocument()
    expect(screen.getByTestId("agenda-grid")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute("aria-pressed", "true")
  })

  it("does not nest a second Activity Log tab", () => {
    render(<ActualDayView currentDate={currentDate} />)
    expect(screen.queryByRole("tab", { name: "Activity Log" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Agenda" })).not.toBeInTheDocument()
  })

  // The strip read a UTC date key while the grid writes local ones, so an
  // evening in a negative-offset zone showed "nothing painted" for a full day.
  it("shows the same painted total as the Time Grid, late in the day", () => {
    const evening = new Date("2026-06-20T21:30:00")
    useTimeTrackingStore.setState({
      entries: [
        {
          id: "e1",
          date: formatLocalDateKey(evening),
          scopeId: "activity",
          penId: "act-work",
          startMin: 540,
          endMin: 660,
        },
      ],
    })

    render(<ActualDayView currentDate={evening} />)

    expect(screen.getByText("2h")).toBeInTheDocument()
    expect(screen.queryByText("nothing painted yet")).not.toBeInTheDocument()
  })

  it("overlays painted tracking blocks on the agenda", () => {
    const evening = new Date("2026-06-20T21:30:00")
    useTimeTrackingStore.getState().paintMinutes(formatLocalDateKey(evening), "activity", 540, 660, "act-work")

    render(<ActualDayView currentDate={evening} />)

    expect(screen.getByTestId("agenda-grid")).toHaveTextContent("Work")
    expect(screen.queryByText("nothing painted yet")).not.toBeInTheDocument()
  })

  it("week switch shows seven day columns", () => {
    render(<ActualDayView currentDate={currentDate} />)
    fireEvent.click(screen.getByRole("button", { name: "Week" }))

    expect(screen.getByTestId("daylog-week")).toBeInTheDocument()
    expect(screen.queryByTestId("agenda-grid")).not.toBeInTheDocument()

    const weekDates = getWeekDates(getWeekStartDate(currentDate))
    for (const date of weekDates) {
      expect(screen.getByRole("button", { name: `Open ${format(date, "EEEE, MMM d")}` })).toBeInTheDocument()
    }

    const weekStart = getWeekStartDate(currentDate)
    expect(
      screen.getByText(`${format(weekStart, "MMM d")} – ${format(weekDates[6], "MMM d, yyyy")}`),
    ).toBeInTheDocument()
  })

  it("previous and next week change the visible range", () => {
    const setCurrentDate = vi.fn()
    render(<ActualDayView currentDate={currentDate} setCurrentDate={setCurrentDate} />)
    fireEvent.click(screen.getByRole("button", { name: "Week" }))

    fireEvent.click(screen.getByRole("button", { name: "Previous week" }))
    expect(setCurrentDate).toHaveBeenCalled()
    const prev = setCurrentDate.mock.calls.at(-1)?.[0] as Date
    expect(formatLocalDateKey(prev)).toBe(
      formatLocalDateKey(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7)),
    )

    fireEvent.click(screen.getByRole("button", { name: "Next week" }))
    const next = setCurrentDate.mock.calls.at(-1)?.[0] as Date
    expect(formatLocalDateKey(next)).toBe(
      formatLocalDateKey(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7)),
    )
  })

  it("activating a day heading returns to that day's day view", () => {
    const setCurrentDate = vi.fn()
    render(<ActualDayView currentDate={currentDate} setCurrentDate={setCurrentDate} />)
    fireEvent.click(screen.getByRole("button", { name: "Week" }))

    const weekDates = getWeekDates(getWeekStartDate(currentDate))
    const tuesday = weekDates[1]
    fireEvent.click(screen.getByRole("button", { name: `Open ${format(tuesday, "EEEE, MMM d")}` }))

    expect(setCurrentDate).toHaveBeenCalled()
    expect(formatLocalDateKey(setCurrentDate.mock.calls.at(-1)?.[0] as Date)).toBe(formatLocalDateKey(tuesday))
    expect(screen.getByTestId("agenda-grid")).toBeInTheDocument()
    expect(screen.queryByTestId("daylog-week")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Day" })).toHaveAttribute("aria-pressed", "true")
  })
})
