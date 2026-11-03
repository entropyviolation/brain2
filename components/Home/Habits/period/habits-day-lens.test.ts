import { describe, expect, it } from "vitest"
import { habitsDayViewDate } from "@/components/Home/Habits/period/habits-day-lens"
import { formatLocalDateKey } from "@/lib/date-utils"

const key = (date: Date) => formatLocalDateKey(date)
// Sunday Nov 1 2026; its week opens Monday Oct 26.
const today = new Date(2026, 10, 1, 15, 30)

describe("habitsDayViewDate", () => {
  it("shows today when the viewed week holds it", () => {
    expect(key(habitsDayViewDate(new Date(2026, 9, 26), null, today))).toBe("2026-11-01")
  })

  it("shows Monday for a past or future week", () => {
    expect(key(habitsDayViewDate(new Date(2026, 9, 12), null, today))).toBe("2026-10-12")
    expect(key(habitsDayViewDate(new Date(2026, 10, 2), null, today))).toBe("2026-11-02")
  })

  it("keeps a picked day only inside its own week", () => {
    expect(key(habitsDayViewDate(new Date(2026, 9, 26), new Date(2026, 9, 28), today))).toBe("2026-10-28")
    expect(key(habitsDayViewDate(new Date(2026, 10, 2), new Date(2026, 9, 28), today))).toBe("2026-11-02")
  })
})
