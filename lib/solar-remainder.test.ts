import { describe, expect, it } from "vitest"
import { clockMinutesOnDay, formatRemainSpan, solarRemainderFace } from "./solar-remainder"

const SUN = {
  sunriseMinutes: 6 * 60 + 40,
  sunsetMinutes: 18 * 60 + 55,
  sunriseLabel: "6:40 AM",
  sunsetLabel: "6:55 PM",
}

describe("solar remainder", () => {
  it("formats a span", () => {
    expect(formatRemainSpan(0)).toBe("0m")
    expect(formatRemainSpan(47)).toBe("47m")
    expect(formatRemainSpan(60)).toBe("1h")
    expect(formatRemainSpan(134)).toBe("2h 14m")
  })

  it("walks midnight → sunrise → sunset → midnight", () => {
    expect(solarRemainderFace(0, SUN)).toEqual({
      phase: "until-sunrise",
      crt: "6h 40m",
      footer: "until sunrise · 6:40 AM",
    })
    expect(solarRemainderFace(6 * 60 + 39, SUN).phase).toBe("until-sunrise")
    expect(solarRemainderFace(6 * 60 + 40, SUN)).toEqual({
      phase: "sunrise",
      crt: "Sunrise",
      footer: "6:40 AM",
    })
    expect(solarRemainderFace(12 * 60, SUN)).toEqual({
      phase: "to-sunset",
      crt: "6h 55m",
      footer: "to sunset · 6:55 PM",
    })
    expect(solarRemainderFace(18 * 60 + 55, SUN)).toEqual({
      phase: "sunset",
      crt: "Sunset",
      footer: "6:55 PM",
    })
    expect(solarRemainderFace(20 * 60, SUN)).toEqual({
      phase: "after-sunset",
      crt: "1h 5m",
      footer: "after sunset · 6:55 PM",
    })
    expect(solarRemainderFace(23 * 60 + 59, SUN).phase).toBe("after-sunset")
  })

  it("has no face without a sun", () => {
    expect(solarRemainderFace(720, null)).toEqual({ phase: "none", crt: "—", footer: "No sun clock" })
  })

  it("reads clock minutes from a Date", () => {
    expect(clockMinutesOnDay(new Date(2026, 8, 23, 15, 7))).toBe(15 * 60 + 7)
  })
})
