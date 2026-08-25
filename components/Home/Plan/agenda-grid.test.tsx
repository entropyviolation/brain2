import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CalendarEvent, Task } from "@/lib/types"
import { fetchDayClimate } from "@/lib/weather-client"
import { DEFAULT_HOME_CITY, useUserSettingsStore } from "@/lib/user-settings-store"
import { AgendaGrid } from "./agenda-grid"

vi.mock("@/lib/weather-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/weather-client")>()
  return {
    ...actual,
    fetchDayClimate: vi.fn(),
  }
})

const fetchDayClimateMock = vi.mocked(fetchDayClimate)

describe("AgendaGrid", () => {
  const date = new Date("2026-06-20T12:00:00")
  const events: CalendarEvent[] = [
    {
      id: "ev-1",
      title: "Standup",
      startTime: "09:00",
      endTime: "09:30",
      type: "event",
      date,
      color: "#8cd4a5",
      isScheduled: true,
    },
  ]
  const tasks: Task[] = [
    {
      id: "task-1",
      description: "Write docs",
      stage: "scheduled",
      createdAt: date,
      completed: false,
      scheduledDate: date,
      scheduledTime: "10:00",
      estimatedDuration: 60,
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
    },
  ]

  beforeEach(() => {
    useUserSettingsStore.getState().resetHomeLocation()
    fetchDayClimateMock.mockResolvedValue({
      weather: "Clear",
      sunrise: "5:41 AM",
      sunset: "7:59 PM",
      sunriseHhmm: "05:41",
      sunsetHhmm: "19:59",
      cityName: "San Diego",
    })
  })

  it("renders hour rows for the day", () => {
    render(
      <AgendaGrid
        date={date}
        events={events}
        tasks={tasks}
        mode="plan"
        onTaskClick={vi.fn()}
        onEventClick={vi.fn()}
      />,
    )
    expect(screen.getByText("09:00")).toBeInTheDocument()
    expect(screen.getByText("Standup")).toBeInTheDocument()
  })

  it("shows scheduled task label in plan mode", () => {
    render(
      <AgendaGrid
        date={date}
        events={[]}
        tasks={tasks}
        mode="plan"
        onTaskClick={vi.fn()}
      />,
    )
    expect(screen.getByText("Write docs")).toBeInTheDocument()
  })

  it("draws sunrise and sunset for the home location", async () => {
    render(
      <AgendaGrid
        date={date}
        events={[]}
        tasks={[]}
        mode="plan"
      />,
    )
    expect(await screen.findByText("Sunrise 5:41 AM")).toBeInTheDocument()
    expect(screen.getByText("Sunset 7:59 PM")).toBeInTheDocument()
    await waitFor(() => {
      expect(fetchDayClimateMock).toHaveBeenCalledWith(DEFAULT_HOME_CITY, "2026-06-20")
    })
  })
})
