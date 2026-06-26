import { describe, it, expect } from "vitest"
import { planScheduleSync, readTimeAttr, scheduleEventId, type ScheduleSyncConfig } from "./module-schedule-sync"
import type { Task } from "@/lib/types"

const task = (id: string, attributes: Record<string, unknown>, overrides: Partial<Task> = {}): Task => ({
  id,
  description: `Item ${id}`,
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: ["trip"],
  attributes: attributes as Task["attributes"],
  ...overrides,
})

const config: ScheduleSyncConfig = {
  categoryId: "trip",
  dateAttrId: "day",
  timeAttrId: "time",
  statusAttrId: "status",
  statusValue: "Finalized",
}

describe("readTimeAttr", () => {
  it("reads a bare HH:mm string", () => {
    expect(readTimeAttr(task("t", { time: "8:05" }), "time")).toBe("08:05")
  })

  it("extracts time-of-day from an ISO datetime string", () => {
    expect(readTimeAttr(task("t", { time: "2026-06-01T14:30:00.000Z" }), "time")).toMatch(/^\d{2}:\d{2}$/)
  })

  it("returns undefined for missing attrs / no attr id", () => {
    expect(readTimeAttr(task("t", {}), "time")).toBeUndefined()
    expect(readTimeAttr(task("t", { time: "8:00" }), undefined)).toBeUndefined()
  })
})

describe("planScheduleSync", () => {
  it("schedules only finalized, dated items and mirrors them to events", () => {
    const tasks = [
      task("a", { day: "2026-06-01", time: "09:30", status: "Finalized" }),
      task("b", { day: "2026-06-02", status: "Finalized" }), // no time → all-day
      task("c", { day: "2026-06-03", time: "10:00", status: "Theoretical" }), // gated out
      task("d", { status: "Finalized" }), // no date → skipped
    ]
    const plan = planScheduleSync(config, tasks)
    expect(plan.updates.map((u) => u.id).sort()).toEqual(["a", "b"])

    const a = plan.updates.find((u) => u.id === "a")!
    expect(a.scheduledTime).toBe("09:30")
    expect(a.scheduledDate).toBeInstanceOf(Date)

    const b = plan.updates.find((u) => u.id === "b")!
    expect(b.scheduledTime).toBeUndefined()

    expect(plan.events).toHaveLength(2)
    const ea = plan.events.find((e) => e.taskId === "a")!
    expect(ea.id).toBe(scheduleEventId("a"))
    expect(ea.startTime).toBe("09:30")
    expect(ea.endTime).toBe("10:30")
    expect(ea.isAllDay).toBe(false)

    const eb = plan.events.find((e) => e.taskId === "b")!
    expect(eb.isAllDay).toBe(true)
    expect(eb.startTime).toBe("09:00")
  })

  it("honors a booked gate", () => {
    const tasks = [
      task("a", { day: "2026-06-01", booked: true }),
      task("b", { day: "2026-06-02", booked: false }),
    ]
    const plan = planScheduleSync({ categoryId: "trip", dateAttrId: "day", bookedAttrId: "booked" }, tasks)
    expect(plan.updates.map((u) => u.id)).toEqual(["a"])
  })

  it("can skip event mirroring", () => {
    const tasks = [task("a", { day: "2026-06-01", status: "Finalized" })]
    const plan = planScheduleSync({ ...config, toEvents: false }, tasks)
    expect(plan.updates).toHaveLength(1)
    expect(plan.events).toHaveLength(0)
  })
})
