import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { format } from "date-fns"
import { formatLocalMonthKey } from "@/lib/date-utils"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"
import { MonthView } from "./month-view"

vi.mock("./planned-tasks-sidebar", () => ({
  PlannedTasksSidebar: () => <div data-testid="planned-sidebar">Planned Sidebar</div>,
}))

describe("MonthView", () => {
  const currentDate = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    resetAllStores()
  })

  afterEach(() => {
    vi.useRealTimers()
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
        onOpenDay={vi.fn()}
      />,
    )
    expect(screen.getByText(format(currentDate, "MMMM yyyy"))).toBeInTheDocument()
    expect(screen.getByText("Sun")).toBeInTheDocument()
    expect(screen.getByTestId("planned-sidebar")).toBeInTheDocument()
    expect(document.querySelector(".plan-cal")).toHaveAttribute("data-ui-name", "Month calendar")
    const monthPlan = document.querySelector(".plan-group")
    expect(monthPlan).toHaveAttribute("data-ui-name", "Month Plan")
    expect(monthPlan?.getAttribute("data-ui-help") ?? "").toMatch(/not the calendar/)
  })

  it("reloads typed month plan text after remount even when the key was an empty tombstone", async () => {
    const user = userEvent.setup()
    const september = new Date(2026, 8, 21, 15)
    localStorage.setItem(`monthPlan-${formatLocalMonthKey(september)}`, "")
    const props = {
      currentDate: september,
      setCurrentDate: vi.fn(),
      events: [] as const,
      setEvents: vi.fn(),
      onTaskClick: vi.fn(),
      onEventClick: vi.fn(),
      onOpenDay: vi.fn(),
    }
    const { unmount } = render(<MonthView {...props} events={[]} />)
    const textarea = screen.getByPlaceholderText(/Write your month plan/i)
    await user.type(textarea, "September shipping")
    unmount()

    render(<MonthView {...props} events={[]} />)
    expect(screen.getByPlaceholderText(/Write your month plan/i)).toHaveValue("September shipping")
    expect(JSON.parse(localStorage.getItem("monthPlan-2026-09")!).draft).toBe("September shipping")
  })

  it("persists month plan text as a stamped entry on submit", async () => {
    const user = userEvent.setup()
    render(
      <MonthView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onOpenDay={vi.fn()}
      />,
    )

    const textarea = screen.getByPlaceholderText(/Write your month plan/i)
    await user.type(textarea, "Focus on shipping")
    await user.click(screen.getByRole("button", { name: /Submit plan/i }))
    const stored = JSON.parse(localStorage.getItem("monthPlan-2026-06")!)
    expect(stored.entries[0].text).toBe("Focus on shipping")
  })

  it("shows overflow +N more with a tooltip of hidden titles", () => {
    const day = new Date(2026, 5, 20)
    const events = [1, 2, 3, 4].map((n) => ({
      id: `ev-${n}`,
      title: `Event ${n}`,
      startTime: `${(8 + n).toString().padStart(2, "0")}:00`,
      endTime: `${(9 + n).toString().padStart(2, "0")}:00`,
      date: day,
      type: "event" as const,
      isScheduled: true,
      color: "#8cd4a5",
    }))

    render(
      <MonthView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={events}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onOpenDay={vi.fn()}
      />,
    )

    expect(screen.getByText("Event 1")).toBeInTheDocument()
    expect(screen.getByText("Event 3")).toBeInTheDocument()
    expect(screen.queryByText("Event 4")).not.toBeInTheDocument()
    const more = screen.getByText("+1 more")
    expect(more).toBeInTheDocument()
    expect(more.getAttribute("title")).toMatch(/Event 4/)
    expect(screen.getByText("09:00–10:00")).toBeInTheDocument()
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
        onOpenDay={vi.fn()}
      />,
    )

    expect(screen.getAllByText("WRITING TRIP")).toHaveLength(4)
  })

  it("mutes elapsed days with data-past and leaves today and future days live", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-20T12:00:00"))

    render(
      <MonthView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onOpenDay={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /Open June 19, 2026/ })).toHaveAttribute("data-past", "true")
    expect(screen.getByRole("button", { name: /Open June 20, 2026/ })).toHaveAttribute("data-past", "false")
    expect(screen.getByRole("button", { name: /Open June 20, 2026/ })).toHaveAttribute("data-today", "true")
    expect(screen.getByRole("button", { name: /Open June 21, 2026/ })).toHaveAttribute("data-past", "false")
    expect(screen.getByRole("button", { name: /Open May 31, 2026/ })).toHaveAttribute("data-outside", "true")
    expect(screen.getByRole("button", { name: /Open May 31, 2026/ })).toHaveAttribute("data-past", "true")

    vi.useRealTimers()
  })

  it("opens Day view for the clicked date instead of creating an event", async () => {
    const user = userEvent.setup()
    const onOpenDay = vi.fn()

    render(
      <MonthView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onOpenDay={onOpenDay}
      />,
    )

    await user.click(screen.getByRole("button", { name: /Open June 15, 2026/ }))
    expect(onOpenDay).toHaveBeenCalledTimes(1)
    expect(onOpenDay.mock.calls[0][0]).toEqual(expect.any(Date))
    expect(format(onOpenDay.mock.calls[0][0] as Date, "yyyy-MM-dd")).toBe("2026-06-15")
  })

  it("does not open Day view when an event chip is clicked", async () => {
    const user = userEvent.setup()
    const onOpenDay = vi.fn()
    const onEventClick = vi.fn()
    const day = new Date(2026, 5, 20)

    render(
      <MonthView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[
          {
            id: "ev-1",
            title: "Solo event",
            startTime: "09:00",
            endTime: "10:00",
            date: day,
            type: "event",
            isScheduled: true,
            color: "#8cd4a5",
          },
        ]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={onEventClick}
        onOpenDay={onOpenDay}
      />,
    )

    await user.click(screen.getByRole("button", { name: /Solo event/ }))
    expect(onEventClick).toHaveBeenCalledTimes(1)
    expect(onOpenDay).not.toHaveBeenCalled()
  })

  it("keeps chip listing on past days when gem mode is off", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-20T12:00:00"))
    const past = new Date(2026, 5, 19)
    useTaskStore.getState().setTasks([
      {
        id: "brief",
        description: "Write brief",
        title: "Write brief",
        stage: "completed",
        createdAt: past,
        completed: true,
        completedDate: past,
        scheduledDate: past,
        lists: [],
      },
    ])

    render(
      <MonthView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onOpenDay={vi.fn()}
      />,
    )

    const pastCell = screen.getByRole("button", { name: /Open June 19, 2026/ })
    expect(pastCell.querySelector('[data-plan-day-body="chips"]')).toBeTruthy()
    expect(screen.getByText("Write brief")).toBeInTheDocument()
    vi.useRealTimers()
  })

  it("shows gems on past days in gem mode and leaves today as chips", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-20T12:00:00"))
    const onTaskClick = vi.fn()
    const past = new Date(2026, 5, 19)
    const today = new Date(2026, 5, 20)

    useHabitsStore.getState().setTasks([
      {
        id: "water",
        name: "Drink water",
        type: TaskType.BOOLEAN,
        frequency: "daily",
        gem: "/gems-removebackground/gem5.png",
      },
    ])
    useHabitsStore.getState().setWeeklyData({
      "2026-06-19": { water: { completed: true } },
    })
    useTaskStore.getState().setTasks([
      {
        id: "today-task",
        description: "Ship it",
        title: "Ship it",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        scheduledDate: today,
        lists: [],
      },
    ])

    render(
      <MonthView
        currentDate={currentDate}
        setCurrentDate={vi.fn()}
        events={[
          {
            id: "past-ev",
            title: "Yesterday standup",
            startTime: "09:00",
            endTime: "09:30",
            date: past,
            type: "event",
            isScheduled: true,
            color: "#8cd4a5",
          },
        ]}
        setEvents={vi.fn()}
        onTaskClick={onTaskClick}
        onEventClick={vi.fn()}
        onOpenDay={vi.fn()}
        gemMode
      />,
    )

    const pastCell = screen.getByRole("button", { name: /Open June 19, 2026/ })
    const todayCell = screen.getByRole("button", { name: /Open June 20, 2026/ })
    expect(pastCell.querySelector('[data-plan-day-body="gems"]')).toBeTruthy()
    expect(todayCell.querySelector('[data-plan-day-body="chips"]')).toBeTruthy()
    expect(screen.getByText("Yesterday standup")).toBeInTheDocument()
    expect(screen.getByText("Ship it")).toBeInTheDocument()
    expect(screen.queryByText("Drink water")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Drink water" }))
    expect(onTaskClick).toHaveBeenCalled()
    expect(pastCell.querySelector(".plan-gem-day-token")).toBeTruthy()
    vi.useRealTimers()
  })

  it("does not darken days between local today and a selected future day", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-21T15:00:00"))
    const selected = new Date(2026, 8, 25, 12)

    render(
      <MonthView
        currentDate={selected}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onOpenDay={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /Open September 20, 2026/ })).toHaveAttribute("data-past", "true")
    expect(screen.getByRole("button", { name: /Open September 21, 2026/ })).toHaveAttribute("data-past", "false")
    expect(screen.getByRole("button", { name: /Open September 22, 2026/ })).toHaveAttribute("data-past", "false")
    expect(screen.getByRole("button", { name: /Open September 23, 2026/ })).toHaveAttribute("data-past", "false")
    expect(screen.getByRole("button", { name: /Open September 24, 2026/ })).toHaveAttribute("data-past", "false")
    expect(screen.getByRole("button", { name: /Open September 25, 2026/ })).toHaveAttribute("data-past", "false")
    expect(screen.getByRole("button", { name: /Open September 25, 2026/ })).toHaveAttribute("data-selected", "true")
    vi.useRealTimers()
  })

  it("marks days before local today as past even when viewing another month", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-21T15:00:00"))

    render(
      <MonthView
        currentDate={new Date(2026, 7, 10, 12)}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onOpenDay={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /Open August 10, 2026/ })).toHaveAttribute("data-past", "true")
    expect(screen.getByRole("button", { name: /Open August 31, 2026/ })).toHaveAttribute("data-past", "true")
    vi.useRealTimers()
  })

  it("keeps a today indicator when another day is selected", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-21T15:00:00"))

    render(
      <MonthView
        currentDate={new Date(2026, 8, 25, 12)}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onOpenDay={vi.fn()}
      />,
    )

    const todayCell = screen.getByRole("button", { name: /Open September 21, 2026/ })
    const selectedCell = screen.getByRole("button", { name: /Open September 25, 2026/ })
    expect(todayCell).toHaveAttribute("data-today", "true")
    expect(todayCell).toHaveAttribute("aria-current", "date")
    expect(todayCell.querySelector(".plan-day-today-mark")).toHaveTextContent("today")
    expect(todayCell).toHaveAttribute("data-selected", "false")
    expect(selectedCell).toHaveAttribute("data-today", "false")
    expect(selectedCell).toHaveAttribute("data-selected", "true")
    expect(selectedCell.querySelector(".plan-day-today-mark")).toBeNull()
    vi.useRealTimers()
  })

  it("keeps gem bodies on past-of-today only when a future day is selected", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-21T15:00:00"))
    const past = new Date(2026, 8, 19)
    useTaskStore.getState().setTasks([
      {
        id: "brief",
        description: "Write brief",
        title: "Write brief",
        stage: "completed",
        createdAt: past,
        completed: true,
        completedDate: past,
        scheduledDate: past,
        lists: [],
      },
    ])

    render(
      <MonthView
        currentDate={new Date(2026, 8, 25, 12)}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onOpenDay={vi.fn()}
        gemMode
      />,
    )

    expect(screen.getByRole("button", { name: /Open September 19, 2026/ }).querySelector('[data-plan-day-body="gems"]')).toBeTruthy()
    expect(screen.getByRole("button", { name: /Open September 21, 2026/ }).querySelector('[data-plan-day-body="chips"]')).toBeTruthy()
    expect(screen.getByRole("button", { name: /Open September 22, 2026/ }).querySelector('[data-plan-day-body="chips"]')).toBeTruthy()
    vi.useRealTimers()
  })
})
