import { describe, it, expect } from "vitest"
import { parseEventText } from "./parse-event-text"

const SAMPLE = `
July 10th: DRIVE DAY

July 11th: WRITING TRIP

July 14th: WRITING TRIP
MEETING - Foxtide x Position Weekly @ 2PM PST

July 25th: SHOW - South Jordan, UT @ The Cove House

August 2026
August 1st: Elijah Traveling

August 8th:Elijah Traveling

August 13th: SHOW - Santa Ana, CA @ Constellation Room

September 1st: SHOW - Wilmington, NC @ Reggie's 42nd St Tavern
GOAL - LP3 sent to master
MEETING - Foxtide x Position Weekly @ 2PM PST

October 13th: RECORDING - Album Recording
October 13th: MEETING - Foxtide x Position Weekly @ 2PM PST

November 1st: SHOW - Madison, WI @ Majestic Theatre (supporting Winyah)
November 1st: OFF

December 31st: GOAL - LP3 content shot
`

function expectDate(d: Date, year: number, monthIndex: number, day: number) {
  expect(d.getFullYear()).toBe(year)
  expect(d.getMonth()).toBe(monthIndex)
  expect(d.getDate()).toBe(day)
}

describe("parseEventText", () => {
  it("parses dated all-day events and uses year from later month headers", () => {
    const { events } = parseEventText(SAMPLE)
    const drive = events.find((e) => e.title === "DRIVE DAY")
    expect(drive).toBeDefined()
    expect(drive!.isAllDay).toBe(true)
    expectDate(drive!.date, 2026, 6, 10)
  })

  it("attaches undated continuation lines to the last date", () => {
    const { events } = parseEventText(SAMPLE)
    const meeting = events.find(
      (e) => e.title === "MEETING - Foxtide x Position Weekly" && e.date.getMonth() === 6 && e.date.getDate() === 14,
    )
    expect(meeting).toBeDefined()
    expect(meeting!.isAllDay).toBe(false)
    expect(meeting!.startTime).toBe("14:00")
    expect(meeting!.endTime).toBe("15:00")
    expect(meeting!.description).toBe("Timezone: PST")
  })

  it("extracts SHOW venue as location", () => {
    const { events } = parseEventText(SAMPLE)
    const show = events.find((e) => e.title === "SHOW - South Jordan, UT")
    expect(show).toBeDefined()
    expect(show!.location).toBe("The Cove House")
    expect(show!.isAllDay).toBe(true)
  })

  it("handles missing space after colon", () => {
    const { events } = parseEventText(SAMPLE)
    const traveling = events.find(
      (e) => e.title === "Elijah Traveling" && e.date.getMonth() === 7 && e.date.getDate() === 8,
    )
    expect(traveling).toBeDefined()
  })

  it("creates multiple events on the same day from repeated dated lines", () => {
    const { events } = parseEventText(SAMPLE)
    const oct13 = events.filter((e) => e.date.getMonth() === 9 && e.date.getDate() === 13)
    expect(oct13.map((e) => e.title)).toEqual([
      "RECORDING - Album Recording",
      "MEETING - Foxtide x Position Weekly",
    ])
  })

  it("creates multiple events when the same date is listed twice", () => {
    const { events } = parseEventText(SAMPLE)
    const nov1 = events.filter((e) => e.date.getMonth() === 10 && e.date.getDate() === 1)
    expect(nov1.map((e) => e.title).sort()).toEqual(["OFF", "SHOW - Madison, WI"])
    const show = nov1.find((e) => e.title.startsWith("SHOW"))
    expect(show?.location).toBe("Majestic Theatre (supporting Winyah)")
  })

  it("parses GOAL continuation under a dated SHOW day", () => {
    const { events } = parseEventText(SAMPLE)
    const goal = events.find((e) => e.title === "GOAL - LP3 sent to master")
    expect(goal).toBeDefined()
    expectDate(goal!.date, 2026, 8, 1)
  })

  it("skips lines before any date context", () => {
    const { events, skipped } = parseEventText("Random note\nJuly 10th: DRIVE DAY", {
      defaultYear: 2026,
    })
    expect(skipped).toContain("Random note")
    expect(events).toHaveLength(1)
  })

  it("ignores empty lines and month headers", () => {
    const { events, skipped } = parseEventText("August 2026\n\nAugust 1st: OFF\n\n", {
      defaultYear: 2025,
    })
    expect(events).toHaveLength(1)
    expect(skipped).toEqual([])
    expectDate(events[0].date, 2026, 7, 1)
  })

  it("assigns category colors", () => {
    const { events } = parseEventText("July 25th: SHOW - Austin, TX @ Stubbs\nMEETING - Sync @ 3PM", {
      defaultYear: 2026,
    })
    expect(events[0].color).toBe("#e89b6c")
    expect(events[1].color).toBe("#b89fbf")
  })

  it("merges consecutive identical all-day titles into a multi-day event", () => {
    const { events } = parseEventText(
      `
July 11th: WRITING TRIP
July 12th: WRITING TRIP
July 13th: WRITING TRIP
July 14th: WRITING TRIP
MEETING - Foxtide x Position Weekly @ 2PM PST
July 15th: WRITING TRIP
`,
      { defaultYear: 2026 },
    )

    const trips = events.filter((e) => e.title === "WRITING TRIP")
    expect(trips).toHaveLength(1)
    expectDate(trips[0].date, 2026, 6, 11)
    expectDate(trips[0].endDate!, 2026, 6, 15)
    expect(trips[0].isAllDay).toBe(true)

    const meeting = events.find((e) => e.title === "MEETING - Foxtide x Position Weekly")
    expect(meeting).toBeDefined()
    expect(meeting!.isAllDay).toBe(false)
    expectDate(meeting!.date, 2026, 6, 14)
  })

  it("does not merge non-consecutive identical titles", () => {
    const { events } = parseEventText(
      `
July 11th: WRITING TRIP
July 14th: WRITING TRIP
`,
      { defaultYear: 2026 },
    )
    const trips = events.filter((e) => e.title === "WRITING TRIP")
    expect(trips).toHaveLength(2)
    expect(trips.every((e) => !e.endDate)).toBe(true)
  })

  it("does not merge timed events across days", () => {
    const { events } = parseEventText(
      `
July 14th: MEETING - Sync @ 2PM PST
July 21st: MEETING - Sync @ 2PM PST
`,
      { defaultYear: 2026 },
    )
    expect(events).toHaveLength(2)
    expect(events.every((e) => !e.endDate && !e.isAllDay)).toBe(true)
  })
})
