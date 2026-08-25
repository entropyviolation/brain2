import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { format } from "date-fns"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { DayView } from "./day-view"

vi.mock("./planned-tasks-sidebar", () => ({
  PlannedTasksSidebar: () => <div data-testid="planned-sidebar">Planned Sidebar</div>,
}))

vi.mock("./agenda-grid", () => ({
  AgendaGrid: () => <div data-testid="agenda-grid">Agenda Grid</div>,
}))

describe("DayView", () => {
  const currentDate = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    resetAllStores()
  })

  it("renders day title and schedule section", () => {
    render(
      <DayView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )
    expect(screen.getByText(format(currentDate, "EEEE, MMMM d, yyyy"))).toBeInTheDocument()
    expect(screen.getByText("Schedule")).toBeInTheDocument()
    expect(screen.getByTestId("agenda-grid")).toBeInTheDocument()
  })

  it("persists day plan text to localStorage", async () => {
    const user = userEvent.setup()
    render(
      <DayView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )

    await user.type(screen.getByPlaceholderText(/Write your day plan/i), "Deep work AM")
    expect(localStorage.getItem(`dayPlan-${formatLocalDateKey(currentDate)}`)).toBe("Deep work AM")
  })

  it("renders an expandable day plan area", () => {
    render(
      <DayView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )
    const textarea = screen.getByPlaceholderText(/Write your day plan/i)
    expect(textarea.className).toMatch(/min-h-\[280px\]/)
    expect(textarea.className).not.toMatch(/resize-none/)
    expect(textarea).toHaveAttribute("rows", "12")
  })

  it("shows a multi-day event on a middle day of its span", () => {
    const multiDay = {
      id: "trip-1",
      title: "WRITING TRIP",
      startTime: "00:00",
      endTime: "23:59",
      date: new Date(2026, 5, 18),
      endDate: new Date(2026, 5, 22),
      type: "event" as const,
      isScheduled: true,
      isAllDay: true,
      color: "#8cd4a5",
    }

    render(
      <DayView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[multiDay]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )

    expect(screen.getByText("WRITING TRIP")).toBeInTheDocument()
    expect(screen.getByText(/Jun 18 – Jun 22/)).toBeInTheDocument()
  })
})
