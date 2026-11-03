import { describe, expect, it } from "vitest"
import { holidaysForYears, isHolidayEvent, withHolidays } from "./holidays"

const on = (year: number, slug: string) => {
  const event = holidaysForYears(year, year).find((e) => e.id === `holiday-${slug}-${year}`)!
  return `${event.date.getFullYear()}-${event.date.getMonth() + 1}-${event.date.getDate()}`
}

describe("holidays", () => {
  it("computes floating holidays", () => {
    expect(on(2026, "thanksgiving")).toBe("2026-11-26")
    expect(on(2025, "thanksgiving")).toBe("2025-11-27")
    expect(on(2026, "memorial-day")).toBe("2026-5-25")
    expect(on(2026, "labor-day")).toBe("2026-9-7")
    expect(on(2026, "mothers-day")).toBe("2026-5-10")
    expect(on(2026, "mlk-day")).toBe("2026-1-19")
  })
  it("computes Easter", () => {
    expect(on(2026, "easter")).toBe("2026-4-5")
    expect(on(2027, "easter")).toBe("2027-3-28")
  })
  it("computes Hanukkah (25 Kislev)", () => {
    expect(on(2025, "hanukkah")).toBe("2025-12-15")
    expect(on(2026, "hanukkah")).toBe("2026-12-5")
    expect(on(2027, "hanukkah")).toBe("2027-12-25")
  })
  it("merges without duplicating and marks them", () => {
    const once = withHolidays([], new Date(2026, 5, 1))
    const twice = withHolidays(once, new Date(2026, 5, 1))
    expect(twice).toHaveLength(once.length)
    expect(once.every(isHolidayEvent)).toBe(true)
  })
})
