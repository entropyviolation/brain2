import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { format } from "date-fns"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { MonthView } from "./month-view"

vi.mock("./planned-tasks-sidebar", () => ({
  PlannedTasksSidebar: () => <div data-testid="planned-sidebar">Planned Sidebar</div>,
}))

describe("MonthView", () => {
  const currentDate = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    resetAllStores()
  })

  it("renders month title and weekday headers", () => {
    render(
      <MonthView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )
    expect(screen.getByText(format(currentDate, "MMMM yyyy"))).toBeInTheDocument()
    expect(screen.getByText("Sun")).toBeInTheDocument()
    expect(screen.getByTestId("planned-sidebar")).toBeInTheDocument()
  })

  it("persists month plan text to localStorage", async () => {
    const user = userEvent.setup()
    render(
      <MonthView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )

    const textarea = screen.getByPlaceholderText(/Write your month plan/i)
    await user.type(textarea, "Focus on shipping")
    expect(localStorage.getItem("monthPlan-2026-06")).toBe("Focus on shipping")
  })

  it("shows multi-day events on every day in the span", () => {
    const multiDay = {
      id: "trip-1",
      title: "WRITING TRIP",
      startTime: "00:00",
      endTime: "23:59",
      date: new Date(2026, 5, 11),
      endDate: new Date(2026, 5, 14),
      type: "event" as const,
      isScheduled: true,
      isAllDay: true,
      color: "#8cd4a5",
    }

    render(
      <MonthView
        currentDate={new Date(2026, 5, 15)}
        setCurrentDate={vi.fn()}
        events={[multiDay]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )

    expect(screen.getAllByText("WRITING TRIP")).toHaveLength(4)
  })
})
