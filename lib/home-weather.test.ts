import { describe, expect, it } from "vitest"
import { aqiLabel, parseHomeAirQuality, parseHomeWeekDays, parseHomeDayWeather } from "./weather-client"
import {
  EMPTY_HOME_WEATHER_PLACE,
  resolveWeatherCity,
  sanitizeHomeWeatherPlace,
  weatherAdvisories,
  weatherHumanForecast,
  weatherRainCopy,
  weatherWeekday,
} from "./home-weather"
import { coastPicksNear, pickTideStation, searchCoastPicks } from "./tide-client"

describe("home weather place", () => {
  it("sanitizes the persist blob and falls back to Settings city", () => {
    expect(sanitizeHomeWeatherPlace(null)).toEqual(EMPTY_HOME_WEATHER_PLACE)
    expect(
      sanitizeHomeWeatherPlace({
        cityQuery: "  Portland, Oregon ",
        cityName: "Portland",
        lat: 45.5,
        lng: -122.6,
        stationId: "9432780",
        beachLabel: "South Beach",
      }),
    ).toMatchObject({
      cityQuery: "Portland, Oregon",
      stationId: "9432780",
      beachLabel: "South Beach",
    })
    expect(resolveWeatherCity(EMPTY_HOME_WEATHER_PLACE, "San Diego, California")).toBe(
      "San Diego, California",
    )
    expect(
      resolveWeatherCity(
        { ...EMPTY_HOME_WEATHER_PLACE, cityQuery: "Seattle, Washington" },
        "San Diego, California",
      ),
    ).toBe("Seattle, Washington")
  })
})

describe("weather copy", () => {
  it("puts rain chance in a readable sentence", () => {
    expect(weatherRainCopy(1)).toBe("Dry — only 1% chance of rain")
    expect(weatherRainCopy(10)).toBe("Dry — only 10% chance of rain")
    expect(weatherRainCopy(40)).toBe("Rain chance 40%")
    expect(weatherRainCopy(80)).toBe("Likely rain — 80% chance")
    expect(weatherRainCopy(undefined)).toBe("Rain chance unknown")
  })

  it("flags lightning, wind, UV, and fog", () => {
    expect(weatherAdvisories({ weatherCode: 95 })).toContain("Thunderstorm / lightning risk")
    expect(weatherAdvisories({ gustMph: 42 })).toContain("Wind advisory — gusts 42 mph")
    expect(weatherAdvisories({ uvIndex: 9 })).toContain("High UV 9 — cover up")
    expect(weatherAdvisories({ visibilityMi: 0.4 })).toContain("Low visibility")
    expect(weatherAdvisories({ weatherCode: 0, windMph: 4 })).toEqual([])
  })

  it("writes a human forecast paragraph", () => {
    const line = weatherHumanForecast({
      city: "San Diego",
      condition: "Overcast",
      glance: "Overcast · warmer 75° by 2p",
      precipChance: 1,
      humidity: 72,
      uvIndex: 4,
      beachLabel: "Ocean Beach",
      windMph: 2,
    })
    expect(line).toContain("Overcast around Ocean Beach near San Diego")
    expect(line).toContain("Warmer 75° by 2p")
    expect(line).toContain("Dry — only 1% chance of rain")
    expect(line).toContain("Humidity 72%")
  })

  it("labels weekdays from a local date key", () => {
    expect(weatherWeekday("2026-09-21")).toBe("Mon")
  })
})

describe("week + air parse", () => {
  it("reads seven daily chips from one payload", () => {
    const week = parseHomeWeekDays({
      daily: {
        time: ["2026-09-21", "2026-09-22", "2026-09-23"],
        weather_code: [3, 61, 0],
        temperature_2m_max: [75, 70, 78],
        temperature_2m_min: [60, 58, 61],
        precipitation_probability_max: [1, 80, 5],
      },
    })
    expect(week).toHaveLength(3)
    expect(week[1]).toMatchObject({ date: "2026-09-22", condition: "Rain", highF: 70, precipChance: 80 })
  })

  it("attaches the week onto the home day payload", () => {
    const wx = parseHomeDayWeather(
      {
        current: { time: "2026-09-21T12:00", temperature_2m: 70, weather_code: 3 },
        hourly: {
          time: ["2026-09-21T12:00"],
          temperature_2m: [70],
          weather_code: [3],
          precipitation_probability: [1],
        },
        daily: {
          time: ["2026-09-21", "2026-09-22"],
          weather_code: [3, 0],
          temperature_2m_max: [75, 77],
          temperature_2m_min: [60, 61],
          precipitation_probability_max: [1, 10],
          sunrise: ["2026-09-21T06:36"],
          sunset: ["2026-09-21T18:46"],
        },
      },
      "2026-09-21",
      "San Diego",
    )
    expect(wx?.week).toHaveLength(2)
    expect(wx?.precipChance).toBe(1)
  })

  it("labels US AQI", () => {
    expect(aqiLabel(12)).toBe("Good")
    expect(aqiLabel(160)).toBe("Unhealthy")
    expect(parseHomeAirQuality({ current: { us_aqi: 41.2, pm2_5: 8.8 } })).toEqual({
      usAqi: 41,
      pm25: 9,
      label: "Good",
    })
  })
})

describe("coast picker", () => {
  it("offers Ocean Beach and La Jolla near San Diego", () => {
    const picks = coastPicksNear(32.715, -117.161)
    expect(picks.some((p) => p.beach === "Ocean Beach")).toBe(true)
    expect(picks.some((p) => p.beach === "La Jolla")).toBe(true)
    expect(pickTideStation("Ocean Beach").id).toBe("9410230")
  })

  it("filters beaches by name", () => {
    expect(searchCoastPicks("la jolla").some((p) => p.beach === "La Jolla")).toBe(true)
  })
})
