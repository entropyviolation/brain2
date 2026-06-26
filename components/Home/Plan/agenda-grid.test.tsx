import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { CalendarEvent, Task } from "@/lib/types"
import { AgendaGrid } from "./agenda-grid"

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
})
