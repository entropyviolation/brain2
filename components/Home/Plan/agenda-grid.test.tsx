import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CalendarEvent, Task } from "@/lib/types"
import { fetchDayClimate } from "@/lib/weather-client"
import { DEFAULT_HOME_CITY, useUserSettingsStore } from "@/lib/user-settings-store"
import { beginPlanDrag, finishPlanPointerDrag, notePlanPointerMove, resetPlanDrag, writePlanDrag } from "@/lib/plan-drag"
import { AgendaGrid, HOUR_HEIGHT, planAgendaScrollTop } from "./agenda-grid"

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
    resetPlanDrag()
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

  it("draws a tracked stretch as one continuous block, not a title per hour", () => {
    const onTracked = vi.fn()
    render(
      <AgendaGrid
        date={date}
        events={[]}
        tasks={[]}
        mode="log"
        trackedBlocks={[
          {
            id: "te-sleep",
            label: "Sleep",
            startMinutes: 7 * 60,
            durationMinutes: 5 * 60,
            color: "#1e3a5c",
            sublabel: "7:00 AM–12:00 PM",
          },
        ]}
        onTrackedBlockClick={onTracked}
      />,
    )
    const blocks = screen.getAllByRole("button", { name: /Sleep/ })
    expect(blocks).toHaveLength(1)
    expect(blocks[0].className).toMatch(/agenda-span/)
    expect(blocks[0].style.height).toBe(`${5 * HOUR_HEIGHT}px`)
    expect(blocks[0].style.top).toBe(`${7 * HOUR_HEIGHT}px`)
    fireEvent.click(blocks[0])
    expect(onTracked).toHaveBeenCalledWith("te-sleep")
  })

  it("lands the agenda two hour-rows above the target minute", () => {
    expect(planAgendaScrollTop(0)).toBe(0)
    expect(planAgendaScrollTop(7 * 60)).toBe(5 * HOUR_HEIGHT)
  })

  function transfer(data: Record<string, string>) {
    return {
      setData: (type: string, value: string) => {
        data[type] = value
      },
      getData: (type: string) => data[type] ?? "",
      dropEffect: "move",
      effectAllowed: "move",
      preventDefault() {},
    }
  }

  it("schedules a to-do from text/plain when custom taskId was stripped", () => {
    const onScheduleTask = vi.fn()
    const onScheduleHabit = vi.fn()
    render(
      <AgendaGrid
        date={date}
        events={[]}
        tasks={[]}
        mode="plan"
        onScheduleTask={onScheduleTask}
        onScheduleHabit={onScheduleHabit}
      />,
    )
    const slot = document.querySelectorAll(".agenda-slot")[9]
    fireEvent.drop(slot, {
      dataTransfer: transfer({ "text/plain": "brain2-plan:task:rail-todo" }),
    })
    expect(onScheduleTask).toHaveBeenCalledWith("rail-todo", 9, expect.any(Number))
    expect(onScheduleHabit).not.toHaveBeenCalled()
  })

  it("plans a habit drop on the same agenda seam", () => {
    const onScheduleHabit = vi.fn()
    render(
      <AgendaGrid
        date={date}
        events={[]}
        tasks={[]}
        mode="plan"
        onScheduleHabit={onScheduleHabit}
      />,
    )
    fireEvent.drop(document.querySelectorAll(".agenda-slot")[9], {
      dataTransfer: transfer({ "text/plain": "brain2-plan:habit:habit-walk" }),
    })
    expect(onScheduleHabit).toHaveBeenCalledWith("habit-walk", 9, expect.any(Number))
  })

  it("click-drag creates a planned action, not an event", () => {
    const onCreateEvent = vi.fn()
    const onCreatePlannedAction = vi.fn()
    render(
      <AgendaGrid
        date={date}
        events={[]}
        tasks={[]}
        mode="plan"
        onCreateEvent={onCreateEvent}
        onCreatePlannedAction={onCreatePlannedAction}
      />,
    )
    const two = document.querySelectorAll(".agenda-slot")[14]
    const three = document.querySelectorAll(".agenda-slot")[15]
    fireEvent.mouseDown(two)
    fireEvent.mouseEnter(three)
    fireEvent.mouseUp(three)
    expect(onCreatePlannedAction).toHaveBeenCalled()
    expect(onCreateEvent).not.toHaveBeenCalled()
  })

  it("plans from the live payload when drop DataTransfer is empty", () => {
    const onScheduleTask = vi.fn()
    render(
      <AgendaGrid
        date={date}
        events={[]}
        tasks={[]}
        mode="plan"
        onScheduleTask={onScheduleTask}
      />,
    )
    writePlanDrag(transfer({}) as unknown as DataTransfer, "task", "rail-todo")
    fireEvent.drop(document.querySelectorAll(".agenda-slot")[9], {
      dataTransfer: transfer({}),
    })
    expect(onScheduleTask).toHaveBeenCalledWith("rail-todo", 9, expect.any(Number))
  })

  it("plans a pointer drop onto an hour slot", () => {
    const onScheduleHabit = vi.fn()
    render(
      <AgendaGrid
        date={date}
        events={[]}
        tasks={[]}
        mode="plan"
        onScheduleHabit={onScheduleHabit}
      />,
    )
    const slot = document.querySelectorAll(".agenda-slot")[11] as HTMLElement
    slot.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 0,
        width: 200,
        height: HOUR_HEIGHT,
        bottom: HOUR_HEIGHT,
        right: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect
    Object.defineProperty(document, "elementsFromPoint", {
      value: () => [slot],
      configurable: true,
      writable: true,
    })
    beginPlanDrag("habit", "habit-walk", "Walk")
    notePlanPointerMove(20, 40, 0, 0)
    act(() => {
      finishPlanPointerDrag(20, 40)
    })
    expect(onScheduleHabit).toHaveBeenCalledWith("habit-walk", 11, expect.any(Number))
  })
})
