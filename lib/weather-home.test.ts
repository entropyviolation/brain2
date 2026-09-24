import { describe, expect, it } from "vitest"
import { parseHomeDayWeather, wmoCondition } from "./weather-client"

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 23]

function fixture(date = "2026-09-21") {
  return {
    current: {
      time: `${date}T12:00`,
      temperature_2m: 72.4,
      weather_code: 0,
      wind_speed_10m: 8.2,
    },
    hourly: {
      time: HOURS.map((h) => `${date}T${String(h).padStart(2, "0")}:00`),
      temperature_2m: [58, 57, 61, 66, 72, 76, 70, 64, 62],
      weather_code: [0, 0, 1, 2, 0, 3, 3, 61, 61],
      precipitation_probability: [0, 0, 0, 5, 10, 15, 20, 40, 35],
      wind_speed_10m: [4, 4, 5, 6, 8, 9, 7, 6, 5],
    },
    daily: {
      time: [date],
      weather_code: [2],
      temperature_2m_max: [76.2],
      temperature_2m_min: [57.4],
      precipitation_probability_max: [40],
      sunrise: [`${date}T06:40`],
      sunset: [`${date}T18:55`],
      wind_speed_10m_max: [9.1],
    },
  }
}

describe("parseHomeDayWeather", () => {
  it("reads current, daily envelope, and same-day hourly evolution", () => {
    const wx = parseHomeDayWeather(fixture(), "2026-09-21", "San Diego")
    expect(wx).toMatchObject({
      cityName: "San Diego",
      date: "2026-09-21",
      condition: "Clear",
      weatherCode: 0,
      tempF: 72,
      highF: 76,
      lowF: 57,
      precipChance: 10,
      windMph: 8,
      sunrise: "6:40 AM",
      sunset: "6:55 PM",
    })
    expect(wx!.hourly).toHaveLength(HOURS.length)
    expect(wx!.hourly[2]).toMatchObject({ hour: 6, tempF: 61, weatherCode: 1 })
    expect(wx!.hourly[7]).toMatchObject({ hour: 21, tempF: 64, weatherCode: 61, precipChance: 40 })
    expect(wx!.week[0]).toMatchObject({ date: "2026-09-21", highF: 76, precipChance: 40 })
  })

  it("ignores other-day hourly rows and still returns the tile payload", () => {
    const data = fixture("2026-09-21")
    data.hourly.time.push("2026-09-22T00:00")
    data.hourly.temperature_2m.push(50)
    data.hourly.weather_code.push(3)
    data.hourly.precipitation_probability.push(0)
    data.hourly.wind_speed_10m.push(1)
    const wx = parseHomeDayWeather(data, "2026-09-21", "San Diego")
    expect(wx!.hourly.every((h) => h.time.startsWith("2026-09-21"))).toBe(true)
  })

  it("returns null on empty or error payloads", () => {
    expect(parseHomeDayWeather({ error: true }, "2026-09-21", "X")).toBeNull()
    expect(parseHomeDayWeather({}, "2026-09-21", "X")).toBeNull()
  })
})

describe("wmoCondition", () => {
  it("labels known codes", () => {
    expect(wmoCondition(0)).toBe("Clear")
    expect(wmoCondition(61)).toBe("Rain")
    expect(wmoCondition(999)).toBe("Weather")
  })
})
