import { describe, it, expect } from "vitest"
import {
  daylightMinutesPresent,
  formatSunClock,
  inferTravelPresenceWindows,
  minutesFromHhmm,
  overlapMinutes,
} from "./weather-client"

describe("sun / daylight helpers", () => {
  it("formats sun clocks", () => {
    expect(formatSunClock("2026-07-20T06:29")).toEqual({ display: "6:29 AM", hhmm: "06:29" })
    expect(formatSunClock("2026-07-20T17:59")).toEqual({ display: "5:59 PM", hhmm: "17:59" })
  })

  it("computes daylight presence overlap", () => {
    // Sunrise 6:00 sunset 18:00; present 00:00–10:00 → 4h daylight
    expect(daylightMinutesPresent("06:00", "18:00", "00:00", "10:00")).toBe(4 * 60)
    // Present 16:00–23:59 → 2h daylight
    expect(daylightMinutesPresent("06:00", "18:00", "16:00", "23:59")).toBe(2 * 60)
  })

  it("overlapMinutes", () => {
    expect(overlapMinutes(0, 100, 50, 150)).toBe(50)
    expect(minutesFromHhmm("14:30")).toBe(14 * 60 + 30)
  })

  it("infers travel windows from flights", () => {
    const w = inferTravelPresenceWindows({
      date: "2026-07-27",
      cityMode: "travel",
      city: "",
      fromCity: "Tijuana",
      toCity: "Lima",
      schedule: [
        {
          kind: "flight",
          time: "16:27",
          text: "leg1",
          flight: {
            segments: [
              { departTime: "16:27", arriveTime: "20:50" },
              { departTime: "22:00", arriveTime: "05:01" },
            ],
          },
        },
      ],
    })
    expect(w.leaveOriginHhmm).toBe("16:27")
    // Overnight final arrive → not counted on departure day; same-day arrive (20:50) used
    expect(w.arriveDestHhmm).toBe("20:50")
  })
})
