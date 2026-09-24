import { describe, expect, it } from "vitest"
import type { CalendarEvent, Task } from "@/lib/types"
import {
  capacityPipCount,
  eventDurationMinutes,
  formatCapacityLine,
  plannedMinutesForDay,
  wakingWindowMinutes,
} from "./plan-capacity"

const date = new Date("2026-06-20T12:00:00")

function task(partial: Partial<Task> & { id: string; description: string }): Task {
  return {
    stage: "scheduled",
    createdAt: date,
    completed: false,
    lists: [],
    urgency: 3,
    importance: 3,
    estimatedDuration: 30,
    cognitiveLoad: 2,
    dependencies: [],
    context: "@work",
    entropy: 0.5,
    rewardValue: 5,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    ...partial,
  }
}

describe("plan-capacity", () => {
  it("sums timed events and same-day task estimates", () => {
    const events: CalendarEvent[] = [
      {
        id: "e1",
        title: "Standup",
        startTime: "09:00",
        endTime: "10:00",
        date,
        type: "event",
        isScheduled: true,
        color: "#8cd4a5",
      },
      {
        id: "e2",
        title: "Trip",
        startTime: "00:00",
        endTime: "23:59",
        date,
        type: "event",
        isScheduled: true,
        isAllDay: true,
        color: "#8cd4a5",
      },
    ]
    const tasks = [
      task({ id: "t1", description: "Write", scheduledDate: date, estimatedDuration: 600 }),
      task({ id: "t2", description: "Other month", scheduledMonth: "2026-06", estimatedDuration: 120 }),
    ]
    expect(eventDurationMinutes(events[0])).toBe(60)
    expect(eventDurationMinutes(events[1])).toBe(0)
    expect(plannedMinutesForDay(date, tasks, events)).toBe(660)
  })

  it("formats planned minutes against a waking window", () => {
    expect(wakingWindowMinutes({ wake: 8 * 60, bed: 17 * 60 })).toBe(9 * 60)
    expect(wakingWindowMinutes({ wake: 8 * 60 })).toBeNull()
    expect(formatCapacityLine(11 * 60, 9 * 60)).toBe("11h into a 9h window")
    expect(formatCapacityLine(40, null)).toBe("40m planned · waking window unknown")
  })

  it("lights capacity pips from planned / window, empty when unknown", () => {
    expect(capacityPipCount(0, 9 * 60)).toBe(0)
    expect(capacityPipCount(40, null)).toBe(0)
    expect(capacityPipCount(11 * 60, 9 * 60)).toBe(10)
    expect(capacityPipCount(4.5 * 60, 9 * 60)).toBe(5)
  })
})
