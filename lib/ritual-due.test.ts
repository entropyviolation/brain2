import { describe, expect, it } from "vitest"
import { countdown, dueWithin, overdue, periodList } from "@/lib/ritual-due"
import type { Task } from "@/lib/types"

const now = new Date(2026, 9, 17, 9, 0, 0)
const t = (id: string, extra: Partial<Task>): Task =>
  ({ id, description: id, completed: false, lists: [], createdAt: now, ...extra }) as Task

describe("ritual-due", () => {
  const tasks = [
    t("soon", { deadline: new Date(2026, 9, 18, 12) }),
    t("later", { deadline: new Date(2026, 9, 23, 12) }),
    t("far", { deadline: new Date(2026, 10, 30) }),
    t("late", { deadline: new Date(2026, 9, 10) }),
    t("doneLate", { deadline: new Date(2026, 9, 10), completed: true }),
  ]
  it("lists open tasks due within a week, soonest first", () => {
    expect(dueWithin(tasks, now).map((x) => x.id)).toEqual(["soon", "later"])
  })
  it("lists open tasks past their deadline", () => {
    expect(overdue(tasks, now).map((x) => x.id)).toEqual(["late"])
  })
  it("ranks a month list by importance and skips what is already on today", () => {
    const list = [
      t("a", { scheduledMonth: "2026-10", importance: 2 }),
      t("b", { scheduledMonth: "2026-10", importance: 5 }),
      t("c", { scheduledMonth: "2026-10", importance: 4, scheduledDate: new Date(2026, 9, 17, 12) }),
    ]
    expect(periodList(list, "month", "2026-10", now).map((x) => x.id)).toEqual(["b", "a"])
  })
  it("counts down", () => {
    expect(countdown(new Date(2026, 9, 18, 13), now)).toBe("1d 4h")
    expect(countdown(new Date(2026, 9, 15, 9), now)).toBe("2d late")
  })
})
