import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { getWeekDates, getWeekStartDate, getWeekString } from "@/lib/date-utils"
import { format } from "date-fns"
import { WeekView } from "./week-view"

vi.mock("./planned-tasks-sidebar", () => ({
  PlannedTasksSidebar: () => <div data-testid="planned-sidebar">Planned Sidebar</div>,
}))

describe("WeekView", () => {
  const currentDate = new Date("2026-06-20T12:00:00")
  const weekStart = getWeekStartDate(currentDate)
  const weekDates = getWeekDates(weekStart)

  beforeEach(() => {
    resetAllStores()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders week range and time grid header", () => {
    render(
      <WeekView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )
    expect(
      screen.getByText(`${format(weekStart, "MMM d")} - ${format(weekDates[6], "MMM d, yyyy")}`),
    ).toBeInTheDocument()
    expect(screen.getByText("Time")).toBeInTheDocument()
    expect(document.querySelector(".plan-week")).toHaveAttribute("data-ui-name", "Week calendar")
    expect(document.querySelector(".plan-group")).toHaveAttribute("data-ui-name", "Week Plan")
  })

  it("saves week plan text as a stamped entry on submit", async () => {
    const user = userEvent.setup()
    render(
      <WeekView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )

    await user.type(screen.getByPlaceholderText(/Write your week plan/i), "Ship feature")
    await user.click(screen.getByRole("button", { name: /Submit plan/i }))
    const stored = JSON.parse(localStorage.getItem(`weekPlan-${getWeekString(currentDate)}`)!)
    expect(stored.entries[0].text).toBe("Ship feature")
  })

  it("shows multi-day all-day events on every covered day in the week", () => {
    // Week of Mon Jun 15 – Sun Jun 21, 2026
    const multiDay = {
      id: "trip-1",
      title: "Spring Break",
      startTime: "00:00",
      endTime: "23:59",
      date: new Date(2026, 5, 16),
      endDate: new Date(2026, 5, 19),
      type: "event" as const,
      isScheduled: true,
      isAllDay: true,
      color: "#8cd4a5",
    }

    render(
      <WeekView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[multiDay]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )

    expect(screen.getAllByText("Spring Break")).toHaveLength(4)
  })

  it("marks elapsed weekday columns with data-past", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-20T12:00:00"))

    const { container } = render(
      <WeekView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )

    const heads = [...container.querySelectorAll(".plan-week-head")].filter((el) => el.hasAttribute("data-past"))
    const pastHeads = heads.filter((el) => el.getAttribute("data-past") === "true")
    const todayHead = heads.find((el) => el.getAttribute("data-today") === "true")
    expect(pastHeads.length).toBeGreaterThan(0)
    expect(todayHead).toBeTruthy()
    expect(todayHead).toHaveAttribute("data-past", "false")
    expect(container.querySelector(".plan-week-cell[data-past='true']")).toBeTruthy()
    expect(container.querySelector(".plan-week-cell[data-today='true']")).toHaveAttribute("data-past", "false")

    vi.useRealTimers()
  })
})
