import { describe, it, expect } from "vitest"
import {
  CHECKLIST_RELATION,
  eventDeadline,
  getMustBeDoneBefore,
  withMustBeDoneBefore,
  clearMustBeDoneBefore,
  attachToEvent,
  detachFromEvent,
  isChecklistTaskFor,
  getChecklistTasks,
  getEventChecklist,
  isMultiDayEvent,
  eventCoversDay,
  getBannerEvents,
} from "@/lib/event-links"
import type { CalendarEvent, Task } from "@/lib/types"

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t1",
    description: "Task",
    stage: "clarified",
    createdAt: new Date("2026-06-20T00:00:00"),
    completed: false,
    lists: [],
    ...overrides,
  }
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    title: "Flight",
    startTime: "09:30",
    endTime: "10:30",
    date: new Date(2026, 5, 25), // local midnight, Jun 25 2026
    type: "event",
    isScheduled: true,
    ...overrides,
  }
}

describe("eventDeadline", () => {
  it("combines the event date with its start time for timed events", () => {
    const d = eventDeadline(makeEvent({ startTime: "09:30" }))
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(25)
    expect(d.getHours()).toBe(9)
    expect(d.getMinutes()).toBe(30)
  })

  it("resolves all-day events to local midnight on the start date", () => {
    const d = eventDeadline(makeEvent({ isAllDay: true, startTime: "00:00" }))
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getDate()).toBe(25)
  })

  it("tolerates serialized (string) dates", () => {
    const d = eventDeadline(makeEvent({ date: "2026-06-25T00:00:00" as unknown as Date }))
    expect(d.getDate()).toBe(25)
    expect(d.getHours()).toBe(9)
  })
})

describe("mustBeDoneBefore accessors", () => {
  it("sets the constraint while preserving sibling constraints", () => {
    const task = makeTask({ schedulingConstraints: { mustBeDoneAfter: new Date(2026, 5, 1) } })
    const before = new Date(2026, 5, 25, 9, 30)
    const next = withMustBeDoneBefore(task, before)
    expect(next.schedulingConstraints?.mustBeDoneBefore).toBe(before)
    expect(next.schedulingConstraints?.mustBeDoneAfter).toEqual(new Date(2026, 5, 1))
    expect(task.schedulingConstraints?.mustBeDoneBefore).toBeUndefined() // immutable
  })

  it("reads the constraint back, coercing strings to Dates", () => {
    const task = makeTask({
      schedulingConstraints: { mustBeDoneBefore: "2026-06-25T09:30:00" as unknown as Date },
    })
    expect(getMustBeDoneBefore(task)).toBeInstanceOf(Date)
    expect(getMustBeDoneBefore(makeTask())).toBeUndefined()
  })

  it("clears only the mustBeDoneBefore constraint", () => {
    const task = makeTask({
      schedulingConstraints: { mustBeDoneBefore: new Date(), timeOfDayPreference: "morning" },
    })
    const next = clearMustBeDoneBefore(task)
    expect(next.schedulingConstraints?.mustBeDoneBefore).toBeUndefined()
    expect(next.schedulingConstraints?.timeOfDayPreference).toBe("morning")
  })

  it("clearing is a no-op when there is no constraint", () => {
    const task = makeTask()
    expect(clearMustBeDoneBefore(task)).toBe(task)
  })
})

describe("attach / detach", () => {
  it("attaches the checklist-of link and derives the constraint", () => {
    const event = makeEvent()
    const next = attachToEvent(makeTask(), event)
    expect(next.links).toHaveLength(1)
    expect(next.links?.[0]).toMatchObject({ relation: CHECKLIST_RELATION, targetId: event.id })
    expect(next.schedulingConstraints?.mustBeDoneBefore).toEqual(eventDeadline(event))
  })

  it("is idempotent — re-attaching does not duplicate the link", () => {
    const event = makeEvent()
    const once = attachToEvent(makeTask(), event)
    const twice = attachToEvent(once, event)
    expect(twice.links).toHaveLength(1)
  })

  it("detach removes the link and clears the derived constraint", () => {
    const event = makeEvent()
    const attached = attachToEvent(makeTask(), event)
    const detached = detachFromEvent(attached, event.id)
    expect(detached.links).toHaveLength(0)
    expect(detached.schedulingConstraints?.mustBeDoneBefore).toBeUndefined()
  })

  it("detach leaves links to other events intact", () => {
    const e1 = makeEvent({ id: "e1" })
    const e2 = makeEvent({ id: "e2" })
    let task = attachToEvent(makeTask(), e1)
    task = attachToEvent(task, e2)
    const detached = detachFromEvent(task, e1.id)
    expect(isChecklistTaskFor(detached, "e1")).toBe(false)
    expect(isChecklistTaskFor(detached, "e2")).toBe(true)
  })
})

describe("checklist listing & completion", () => {
  const event = makeEvent({ id: "ev" })
  const a = attachToEvent(makeTask({ id: "a" }), event)
  const b = { ...attachToEvent(makeTask({ id: "b" }), event), completed: true }
  const unrelated = makeTask({ id: "c" })
  const tasks = [a, b, unrelated]

  it("lists only tasks linked to the event", () => {
    const list = getChecklistTasks(tasks, "ev")
    expect(list.map((t) => t.id).sort()).toEqual(["a", "b"])
  })

  it("summarizes completion", () => {
    const summary = getEventChecklist(tasks, "ev")
    expect(summary.total).toBe(2)
    expect(summary.completed).toBe(1)
    expect(summary.remaining).toBe(1)
    expect(summary.allComplete).toBe(false)
  })

  it("allComplete is true only when every item is done", () => {
    const done = [{ ...a, completed: true }, b]
    expect(getEventChecklist(done, "ev").allComplete).toBe(true)
  })

  it("allComplete is false for an empty checklist", () => {
    expect(getEventChecklist(tasks, "missing").allComplete).toBe(false)
    expect(getEventChecklist(tasks, "missing").total).toBe(0)
  })
})

describe("multi-day / banner helpers", () => {
  it("detects multi-day events", () => {
    expect(isMultiDayEvent(makeEvent({ endDate: new Date(2026, 5, 27) }))).toBe(true)
    expect(isMultiDayEvent(makeEvent({ endDate: new Date(2026, 5, 25) }))).toBe(false)
    expect(isMultiDayEvent(makeEvent())).toBe(false)
  })

  it("eventCoversDay is inclusive across the span", () => {
    const e = makeEvent({ date: new Date(2026, 5, 25), endDate: new Date(2026, 5, 27) })
    expect(eventCoversDay(e, new Date(2026, 5, 24))).toBe(false)
    expect(eventCoversDay(e, new Date(2026, 5, 25))).toBe(true)
    expect(eventCoversDay(e, new Date(2026, 5, 26, 14))).toBe(true)
    expect(eventCoversDay(e, new Date(2026, 5, 27))).toBe(true)
    expect(eventCoversDay(e, new Date(2026, 5, 28))).toBe(false)
  })

  it("getBannerEvents returns all-day and multi-day events covering the day", () => {
    const allDay = makeEvent({ id: "allday", isAllDay: true, date: new Date(2026, 5, 26) })
    const multi = makeEvent({ id: "multi", date: new Date(2026, 5, 25), endDate: new Date(2026, 5, 27) })
    const timed = makeEvent({ id: "timed", date: new Date(2026, 5, 26) })
    const banners = getBannerEvents([allDay, multi, timed], new Date(2026, 5, 26))
    expect(banners.map((e) => e.id).sort()).toEqual(["allday", "multi"])
  })
})
