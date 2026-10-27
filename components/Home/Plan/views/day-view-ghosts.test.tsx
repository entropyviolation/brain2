import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { fetchDayClimate } from "@/lib/weather-client"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import type { TimeEntry } from "@/lib/time-entries"
import { DayView } from "./day-view"
import { WeekView } from "./week-view"
import { HOUR_HEIGHT } from "./agenda-grid"

vi.mock("./planned-tasks-sidebar", () => ({
  PlannedTasksSidebar: () => <div data-testid="planned-sidebar" />,
}))

vi.mock("@/lib/weather-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/weather-client")>()
  return {
    ...actual,
    fetchDayClimate: vi.fn(),
  }
})

function entry(partial: Partial<TimeEntry> & Pick<TimeEntry, "id" | "date" | "startMin" | "endMin">): TimeEntry {
  return {
    scopeId: "activity",
    penId: "act-work",
    ...partial,
  }
}

describe("Plan day view tracked ghosts", () => {
  const noon = new Date(2026, 5, 20, 12, 0, 0)

  beforeEach(() => {
    resetAllStores()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(noon)
    useUserSettingsStore.getState().resetHomeLocation()
    vi.mocked(fetchDayClimate).mockResolvedValue({
      weather: "Clear",
      sunrise: "5:41 AM",
      sunset: "7:59 PM",
      sunriseHhmm: "05:41",
      sunsetHhmm: "19:59",
      cityName: "San Diego",
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function paint() {
    useTimeTrackingStore.setState({
      entries: [
        entry({
          id: "morning",
          date: "2026-06-20",
          title: "Recorded stroll",
          startMin: 9 * 60,
          endMin: 10 * 60,
        }),
        entry({
          id: "afternoon",
          date: "2026-06-20",
          title: "Later errand",
          startMin: 14 * 60,
          endMin: 15 * 60,
        }),
      ],
    })
  }

  function renderDay(currentDate: Date) {
    return render(
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
  }

  it("draws a ghost outline for a past tracked block and leaves later hours clear", () => {
    paint()
    renderDay(noon)

    const ghost = document.querySelector('[data-kind="tracked-ghost"]')
    expect(ghost).toBeTruthy()
    expect(ghost).toHaveClass("agenda-tracked-ghost")
    expect(ghost).not.toHaveAttribute("role", "button")
    expect((ghost as HTMLElement).style.pointerEvents).toBe("none")
    expect(ghost).toHaveTextContent("Recorded stroll")
    expect(screen.queryByText("Later errand")).not.toBeInTheDocument()
    expect((ghost as HTMLElement).style.top).toBe(`${9 * HOUR_HEIGHT}px`)
    expect((ghost as HTMLElement).style.height).toBe(`${HOUR_HEIGHT}px`)
  })

  it("draws nothing when the day has no tracking", () => {
    renderDay(noon)
    expect(document.querySelector('[data-kind="tracked-ghost"]')).toBeNull()
  })

  it("draws nothing for a future day", () => {
    useTimeTrackingStore.setState({
      entries: [
        entry({
          id: "tomorrow",
          date: "2026-06-21",
          title: "Recorded stroll",
          startMin: 9 * 60,
          endMin: 10 * 60,
        }),
      ],
    })
    renderDay(new Date(2026, 5, 21, 9, 0, 0))
    expect(document.querySelector('[data-kind="tracked-ghost"]')).toBeNull()
    expect(screen.queryByText("Recorded stroll")).not.toBeInTheDocument()
  })

  it("keeps a scheduled chip clickable when a ghost shares that hour", () => {
    paint()
    const task: Task = {
      id: "task-1",
      description: "Write docs",
      stage: "scheduled",
      createdAt: noon,
      completed: false,
      scheduledDate: noon,
      scheduledTime: "09:30",
      estimatedDuration: 30,
      lists: [],
      urgency: 3,
      importance: 3,
      cognitiveLoad: 2,
      dependencies: [],
      context: "@work",
      entropy: 0.5,
      rewardValue: 5,
      allowPartialCompletion: false,
      minimumChunkSize: 15,
    }
    useTaskStore.getState().addTask(task)
    const onTaskClick = vi.fn()
    render(
      <DayView
        currentDate={noon}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={onTaskClick}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )
    expect(screen.getByText("Write docs")).toBeInTheDocument()
    expect(document.querySelector('[data-kind="tracked-ghost"]')).toHaveTextContent("Recorded stroll")
    fireEvent.click(screen.getByText("Write docs"))
    expect(onTaskClick).toHaveBeenCalledWith("task-1")
  })

  it("does not paint tracking ghosts on the week agenda", () => {
    paint()
    render(
      <WeekView
        currentDate={noon}
        setCurrentDate={vi.fn()}
        events={[]}
        setEvents={vi.fn()}
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    )
    expect(document.querySelector('[data-kind="tracked-ghost"]')).toBeNull()
    expect(document.querySelector(".agenda-tracked-ghost")).toBeNull()
    expect(screen.queryByText("Recorded stroll")).not.toBeInTheDocument()
  })
})
