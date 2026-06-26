import { describe, it, expect } from "vitest"
import { parseSmartCapture, type SmartParseResult } from "./smart-parse"

// Fixed reference: Wednesday, June 24 2026, 10:00 local time.
const NOW = new Date(2026, 5, 24, 10, 0, 0)

function parse(input: string): SmartParseResult {
  return parseSmartCapture(input, { now: NOW })
}

function expectDate(d: Date | undefined, year: number, monthIndex: number, day: number) {
  expect(d).toBeInstanceOf(Date)
  expect(d!.getFullYear()).toBe(year)
  expect(d!.getMonth()).toBe(monthIndex)
  expect(d!.getDate()).toBe(day)
  // Always normalized to local midnight.
  expect(d!.getHours()).toBe(0)
  expect(d!.getMinutes()).toBe(0)
}

describe("parseSmartCapture — plain text", () => {
  it("returns the input untouched when nothing is recognized", () => {
    const { suggestion, highlights } = parse("buy milk")
    expect(suggestion.description).toBe("buy milk")
    expect(highlights).toHaveLength(0)
    expect(suggestion.scheduledDate).toBeUndefined()
    expect(suggestion.scheduledTime).toBeUndefined()
    expect(suggestion.category).toBeUndefined()
  })

  it("trims and collapses whitespace in the description", () => {
    const { suggestion } = parse("   call   the   bank   ")
    expect(suggestion.description).toBe("call the bank")
  })
})

describe("parseSmartCapture — categories", () => {
  it("extracts a leading 'Category:' prefix", () => {
    const { suggestion, highlights } = parse("Work: finish the report")
    expect(suggestion.category).toBe("Work")
    expect(suggestion.description).toBe("finish the report")
    expect(highlights[0]).toMatchObject({ type: "category", start: 0 })
  })

  it("handles multi-word category names", () => {
    const { suggestion } = parse("Home Improvement: fix the sink")
    expect(suggestion.category).toBe("Home Improvement")
    expect(suggestion.description).toBe("fix the sink")
  })

  it("supports inline cat:/category: hints", () => {
    expect(parse("do pushups cat:Health").suggestion.category).toBe("Health")
    expect(parse("read paper category:Research").suggestion.category).toBe("Research")
  })

  it("does NOT treat a leading time as a category", () => {
    const { suggestion } = parse("3:30pm standup")
    expect(suggestion.category).toBeUndefined()
    expect(suggestion.scheduledTime).toBe("15:30")
  })
})

describe("parseSmartCapture — relative dates", () => {
  it("parses today / tonight", () => {
    expectDate(parse("ship it today").suggestion.scheduledDate, 2026, 5, 24)
    expectDate(parse("call tonight").suggestion.scheduledDate, 2026, 5, 24)
  })

  it("parses tomorrow", () => {
    expectDate(parse("submit tomorrow").suggestion.scheduledDate, 2026, 5, 25)
  })

  it("parses yesterday", () => {
    expectDate(parse("logged yesterday").suggestion.scheduledDate, 2026, 5, 23)
  })

  it("parses 'in N days/weeks/months'", () => {
    expectDate(parse("review in 3 days").suggestion.scheduledDate, 2026, 5, 27)
    expectDate(parse("renew in 2 weeks").suggestion.scheduledDate, 2026, 6, 8)
    expectDate(parse("checkup in 1 month").suggestion.scheduledDate, 2026, 6, 24)
  })

  it("parses next week/month/year", () => {
    expectDate(parse("plan next week").suggestion.scheduledDate, 2026, 6, 1)
    expectDate(parse("plan next month").suggestion.scheduledDate, 2026, 6, 24)
    expectDate(parse("plan next year").suggestion.scheduledDate, 2027, 5, 24)
  })
})

describe("parseSmartCapture — weekdays", () => {
  it("parses an upcoming weekday (today is Wednesday)", () => {
    expectDate(parse("gym on friday").suggestion.scheduledDate, 2026, 5, 26)
    expectDate(parse("meet monday").suggestion.scheduledDate, 2026, 5, 29)
  })

  it("treats the current weekday as today", () => {
    expectDate(parse("standup wednesday").suggestion.scheduledDate, 2026, 5, 24)
  })

  it("pushes 'next <weekday>' to the following week", () => {
    expectDate(parse("demo next friday").suggestion.scheduledDate, 2026, 6, 3)
    expectDate(parse("retro next wednesday").suggestion.scheduledDate, 2026, 6, 1)
  })

  it("accepts 3-letter abbreviations", () => {
    expectDate(parse("call thu").suggestion.scheduledDate, 2026, 5, 25)
  })
})

describe("parseSmartCapture — absolute dates", () => {
  it("parses ISO YYYY-MM-DD", () => {
    expectDate(parse("launch 2026-12-25").suggestion.scheduledDate, 2026, 11, 25)
  })

  it("parses M/D with the upcoming year", () => {
    // 12/25 is later this year → stays 2026.
    expectDate(parse("party 12/25").suggestion.scheduledDate, 2026, 11, 25)
    // 1/2 already passed in 2026 → rolls to 2027.
    expectDate(parse("invoice 1/2").suggestion.scheduledDate, 2027, 0, 2)
  })

  it("parses M/D/YYYY explicitly", () => {
    expectDate(parse("deadline 3/15/2028").suggestion.scheduledDate, 2028, 2, 15)
  })

  it("parses month-name dates", () => {
    expectDate(parse("trip Jan 5").suggestion.scheduledDate, 2027, 0, 5)
    expectDate(parse("trip January 5th, 2028").suggestion.scheduledDate, 2028, 0, 5)
    expectDate(parse("trip 5 Jan").suggestion.scheduledDate, 2027, 0, 5)
  })
})

describe("parseSmartCapture — times", () => {
  it("parses 12h times", () => {
    expect(parse("call at 3pm").suggestion.scheduledTime).toBe("15:00")
    expect(parse("call at 3:30 pm").suggestion.scheduledTime).toBe("15:30")
    expect(parse("call 9am").suggestion.scheduledTime).toBe("09:00")
    expect(parse("call 12am").suggestion.scheduledTime).toBe("00:00")
    expect(parse("call 12pm").suggestion.scheduledTime).toBe("12:00")
  })

  it("parses 24h times", () => {
    expect(parse("call at 15").suggestion.scheduledTime).toBe("15:00")
    expect(parse("standup 09:30").suggestion.scheduledTime).toBe("09:30")
  })

  it("parses noon and midnight", () => {
    expect(parse("lunch at noon").suggestion.scheduledTime).toBe("12:00")
    expect(parse("deploy at midnight").suggestion.scheduledTime).toBe("00:00")
  })
})

describe("parseSmartCapture — priority", () => {
  it("parses bang markers", () => {
    expect(parse("do it !").suggestion.importance).toBe(4)
    expect(parse("do it !!").suggestion.importance).toBe(5)
    const triple = parse("do it !!!").suggestion
    expect(triple.urgency).toBe(5)
    expect(triple.importance).toBe(5)
  })

  it("parses priority words", () => {
    expect(parse("call dentist urgent").suggestion.urgency).toBe(5)
    expect(parse("review asap").suggestion.urgency).toBe(5)
    expect(parse("important note").suggestion.importance).toBe(5)
  })

  it("does not treat in-sentence punctuation as priority", () => {
    expect(parse("yay done!").suggestion.importance).toBeUndefined()
  })
})

describe("parseSmartCapture — duration", () => {
  it("parses minutes and hours", () => {
    expect(parse("write for 30m").suggestion.estimatedDuration).toBe(30)
    expect(parse("meeting 45 min").suggestion.estimatedDuration).toBe(45)
    expect(parse("workout 2h").suggestion.estimatedDuration).toBe(120)
    expect(parse("nap 1.5 hours").suggestion.estimatedDuration).toBe(90)
  })
})

describe("parseSmartCapture — combined + highlights", () => {
  it("parses a rich multi-token capture", () => {
    const { suggestion, highlights } = parse("Work: call dentist tomorrow at 3pm for 30m !!")
    expect(suggestion.category).toBe("Work")
    expect(suggestion.description).toBe("call dentist")
    expectDate(suggestion.scheduledDate, 2026, 5, 25)
    expect(suggestion.scheduledTime).toBe("15:00")
    expect(suggestion.estimatedDuration).toBe(30)
    expect(suggestion.importance).toBe(5)

    const types = highlights.map((h) => h.type)
    expect(types).toContain("category")
    expect(types).toContain("date")
    expect(types).toContain("time")
    expect(types).toContain("duration")
    expect(types).toContain("priority")
  })

  it("produces non-overlapping highlights sorted by start", () => {
    const { highlights } = parse("Work: call dentist tomorrow at 3pm for 30m !!")
    for (let i = 1; i < highlights.length; i++) {
      expect(highlights[i].start).toBeGreaterThanOrEqual(highlights[i - 1].end)
    }
    // Highlight text matches the original slice.
    const input = "Work: call dentist tomorrow at 3pm for 30m !!"
    for (const h of highlights) {
      expect(h.text).toBe(input.slice(h.start, h.end))
    }
  })

  it("is deterministic and pure (same input → same output)", () => {
    const a = parse("ship it tomorrow at 9am")
    const b = parse("ship it tomorrow at 9am")
    expect(a.suggestion).toEqual(b.suggestion)
  })

  it("keeps an explicit time over a later 'at' anchor (first-wins)", () => {
    const { suggestion } = parse("call 9am then review at 15")
    expect(suggestion.scheduledTime).toBe("09:00")
  })
})
