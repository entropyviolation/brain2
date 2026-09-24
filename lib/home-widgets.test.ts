import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_PERCENT_LED_TINT } from "@/lib/habit-led"
import { DEFAULT_GRADE_TUBE_COLOR, DEFAULT_OUTPUT_TUBE_COLOR } from "@/lib/habit-tube"
import { resetAllStores } from "@/tests/test-utils"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"
import { writeAliasedLocal } from "@/lib/storage-keys"
import {
  DEFAULT_HOME_WIDGET_HIDDEN,
  DEFAULT_HOME_WIDGET_ORDER,
  HOME_WIDGET_IDS,
  affirmationLinesForHome,
  dayLampWord,
  daysUntilCount,
  daysUntilFace,
  homeInstrumentColorVars,
  homeWellGradient,
  migrateHomeWidgetPersist,
  moveHomeWidget,
  petPose,
  pickHomeNext,
  pickDailyAffirmation,
  pickWeatherDayStrip,
  weatherHourLabel,
  weatherIconKind,
  weatherIconKindFromCode,
  weatherLaterGlance,
  weatherNeedleDeg,
  weatherSparkPath,
  weatherTideHint,
  sanitizeHomeWidgetHidden,
  sanitizeHomeWidgetOrder,
  visibleHomeWidgets,
} from "@/lib/home-widgets"

describe("home widget catalog", () => {
  it("fills missing ids and drops unknowns", () => {
    expect(sanitizeHomeWidgetOrder(["points", "bogus", "points", "progress"])).toEqual([
      "points",
      "progress",
      ...HOME_WIDGET_IDS.filter((id) => id !== "points" && id !== "progress"),
    ])
  })

  it("hides only known ids and defaults when the blob is missing", () => {
    expect(sanitizeHomeWidgetHidden(["points", "nope"])).toEqual(["points"])
    expect(sanitizeHomeWidgetHidden(undefined)).toEqual(DEFAULT_HOME_WIDGET_HIDDEN)
  })

  it("lists visible widgets in order", () => {
    expect(visibleHomeWidgets(DEFAULT_HOME_WIDGET_ORDER, ["points", "weather"])).toEqual([
      "review",
      "award",
      "progress",
      "affirmation",
      "pet",
      "next",
      "daylamp",
      "daysuntil",
      "solar",
      "tracking",
      "night",
      "harvest",
      "inbox",
    ])
  })

  it("names the day lamp and the screen pet from today's counts", () => {
    expect(dayLampWord({ habitPercent: 0, habitTotal: 0, todoPercent: 0, todoTotal: 0 })).toBe("Quiet")
    expect(dayLampWord({ habitPercent: 0, habitTotal: 4, todoPercent: 0, todoTotal: 2 })).toBe("Dim")
    expect(dayLampWord({ habitPercent: 40, habitTotal: 4, todoPercent: 0, todoTotal: 0 })).toBe("Warm")
    expect(dayLampWord({ habitPercent: 80, habitTotal: 4, todoPercent: 50, todoTotal: 2 })).toBe("Bright")
    expect(dayLampWord({ habitPercent: 100, habitTotal: 4, todoPercent: 100, todoTotal: 2 })).toBe("Full")
    expect(petPose(0, 0)).toBe("idle")
    expect(petPose(0, 3)).toBe("asleep")
    expect(petPose(40, 3)).toBe("idle")
    expect(petPose(100, 3)).toBe("pleased")
  })

  it("picks the next event, then an open to-do", () => {
    const day = new Date(2026, 8, 21, 15, 0)
    const events = [
      { title: "Morning", startTime: "09:00", endTime: "10:00", date: day },
      { title: "Evening", startTime: "18:00", endTime: "19:00", date: day },
    ]
    expect(
      pickHomeNext({ now: day, clock: day, events, todos: [{ title: "Write", footer: "To Do" }] })?.title,
    ).toBe("Evening")
    expect(
      pickHomeNext({
        now: day,
        clock: new Date(2026, 8, 21, 20, 0),
        events,
        todos: [{ title: "Write", footer: "Inbox" }],
      }),
    ).toEqual({ tab: "todo", title: "Write", footer: "Inbox" })
    expect(pickHomeNext({ now: day, events: [], todos: [] })).toBeNull()
  })

  it("tucks Next and Day lamp when migrating a v1 blob", () => {
    expect(migrateHomeWidgetPersist({ order: ["today"], hidden: ["affirmation", "weather"] }, 1).hidden).toEqual(
      ["affirmation", "weather", "next", "daylamp", "solar", "tracking", "night", "harvest", "inbox"],
    )
    expect(migrateHomeWidgetPersist({ hidden: ["next", "pet"] }, 2).hidden).toEqual([
      "pet",
      "next",
      "solar",
      "tracking",
      "night",
      "harvest",
      "inbox",
    ])
  })

  it("folds four points wells into one tile", () => {
    const folded = migrateHomeWidgetPersist(
      {
        order: ["review", "alltime", "today", "week", "month", "progress"],
        hidden: ["alltime", "today", "week", "month"],
      },
      2,
    )
    expect(folded.order).toEqual(["review", "points", "award", "progress"])
    expect(folded.hidden).toContain("points")
    expect(folded.hidden).not.toContain("today")
    const kept = migrateHomeWidgetPersist(
      { order: ["review", "today", "progress"], hidden: ["weather"] },
      2,
    )
    expect(kept.order?.slice(0, 4)).toEqual(["review", "points", "award", "progress"])
    expect(kept.hidden).not.toContain("points")
  })

  it("counts calendar days until a label", () => {
    const from = new Date(2026, 8, 21)
    expect(daysUntilCount("2026-10-01", from)).toBe(10)
    expect(daysUntilCount("2026-09-21", from)).toBe(0)
    expect(daysUntilCount("2026-09-19", from)).toBe(-2)
    expect(daysUntilCount("", from)).toBeNull()
    expect(daysUntilFace(10, "Birthday")).toEqual({ crt: "10", footer: "Days Until Birthday" })
    expect(daysUntilFace(0, "Birthday")).toEqual({ crt: "0", footer: "Birthday is today" })
    expect(daysUntilFace(-2, "Birthday")).toEqual({ crt: "2", footer: "Days since Birthday" })
    expect(daysUntilFace(null, "")).toEqual({ crt: "—", footer: "Set a date" })
  })

  it("moves a widget within the order", () => {
    const next = moveHomeWidget(["review", "points", "progress"], "points", -1)
    expect(next.slice(0, 3)).toEqual(["points", "review", "progress"])
  })

  it("wires the three Habits colors into the well gradient", () => {
    expect(homeWellGradient("#112233", "#445566", "#778899")).toBe(
      "linear-gradient(90deg, #112233, #445566, #778899)",
    )
    expect(homeInstrumentColorVars("nope", "nope", "nope")).toEqual({
      "--home-grad-led": DEFAULT_PERCENT_LED_TINT,
      "--home-grad-grade": DEFAULT_GRADE_TUBE_COLOR,
      "--home-grad-output": DEFAULT_OUTPUT_TUBE_COLOR,
    })
  })

  it("maps weather copy to sun / cloud / rain glyphs", () => {
    expect(weatherIconKind("68°–76°F, Clear")).toBe("sun")
    expect(weatherIconKind("Mainly clear")).toBe("sun")
    expect(weatherIconKind("68°–75°F, Drizzle")).toBe("rain")
    expect(weatherIconKind("Heavy rain")).toBe("rain")
    expect(weatherIconKind("Partly cloudy")).toBe("cloud")
    expect(weatherIconKind("Overcast")).toBe("cloud")
    expect(weatherIconKind("Fog")).toBe("cloud")
    expect(weatherIconKind(undefined)).toBe("cloud")
  })

  it("maps WMO codes to the same three glyphs", () => {
    expect(weatherIconKindFromCode(0)).toBe("sun")
    expect(weatherIconKindFromCode(1)).toBe("sun")
    expect(weatherIconKindFromCode(2)).toBe("cloud")
    expect(weatherIconKindFromCode(61)).toBe("rain")
    expect(weatherIconKindFromCode(95)).toBe("rain")
    expect(weatherIconKindFromCode(undefined)).toBe("cloud")
  })

  it("builds a 3-hour day strip from morning to evening", () => {
    const hours = [6, 9, 12, 15, 18, 21].map((hour, i) => ({
      hour,
      tempF: 60 + i * 3,
      weatherCode: hour === 21 ? 61 : 0,
    }))
    const strip = pickWeatherDayStrip(hours, 12)
    expect(strip.map((c) => c.label)).toEqual(["6a", "9a", "12", "3p", "6p", "9p"])
    expect(strip.map((c) => c.tempF)).toEqual([60, 63, 66, 69, 72, 75])
    expect(strip[2]!.now).toBe(true)
    expect(strip[5]!.kind).toBe("rain")
    expect(weatherHourLabel(0)).toBe("12a")
    expect(weatherHourLabel(15)).toBe("3p")
  })

  it("draws a sparkline and analog needle from the day range", () => {
    const path = weatherSparkPath([60, 70, 80], 100, 10)
    expect(path.startsWith("M")).toBe(true)
    expect(path).toContain(" L")
    expect(weatherSparkPath([70], 100, 10)).toBe("")
    expect(weatherNeedleDeg(70, 60, 80)).toBe(0)
    expect(weatherNeedleDeg(60, 60, 80)).toBe(-70)
    expect(weatherNeedleDeg(80, 60, 80)).toBe(70)
  })

  it("summarizes later-today change in one glance", () => {
    const hours = [
      { hour: 6, tempF: 61, weatherCode: 0 },
      { hour: 12, tempF: 72, weatherCode: 0 },
      { hour: 15, tempF: 76, weatherCode: 0 },
      { hour: 21, tempF: 64, weatherCode: 61 },
    ]
    expect(weatherLaterGlance(hours, { nowHour: 12, condition: "Clear", tempF: 72 })).toBe(
      "Clear · 76° by 3p, then rain",
    )
    expect(weatherLaterGlance(hours, { condition: "Clear" })).toBe("Clear · 61° morning to 76°")
    expect(weatherTideHint({ nextHigh: { heightFt: 5.1, timeCompact: "7:14p" } })).toBe("↑ 5.1' 7:14p")
    expect(weatherTideHint(null)).toBe("")
  })

  it("picks a stable daily affirmation", () => {
    const lines = ["Alpha.", "Beta.", "Gamma."]
    expect(pickDailyAffirmation(lines, "2026-09-21")).toBe(pickDailyAffirmation(lines, "2026-09-21"))
    expect(affirmationLinesForHome([], [])).toContain("I am focused and follow through on what matters.")
  })
})

describe("home widgets store persist", () => {
  beforeEach(() => {
    resetAllStores()
    useHomeWidgetsStore.getState().resetWidgets()
  })

  it("hides a widget and writes localStorage", () => {
    useHomeWidgetsStore.getState().hideWidget("points")
    expect(useHomeWidgetsStore.getState().hidden).toContain("points")
    const raw = localStorage.getItem("cogs-home-widgets")
    expect(raw).toBeTruthy()
    expect(raw).toContain("points")
  })

  it("restores hidden widgets after a fresh store read", async () => {
    useHomeWidgetsStore.getState().showWidget("affirmation")
    useHomeWidgetsStore.getState().showWidget("weather")
    useHomeWidgetsStore.getState().hideWidget("progress")
    useHomeWidgetsStore.getState().hideWidget("points")
    const snap = localStorage.getItem("cogs-home-widgets")
    expect(snap).toBeTruthy()

    useHomeWidgetsStore.getState().resetWidgets()
    expect(useHomeWidgetsStore.getState().hidden).toEqual(DEFAULT_HOME_WIDGET_HIDDEN)

    writeAliasedLocal("cogs-home-widgets", snap!)
    await useHomeWidgetsStore.persist.rehydrate()
    expect(useHomeWidgetsStore.getState().hidden).toEqual([
      "points",
      "progress",
      "next",
      "daylamp",
      "solar",
      "tracking",
      "night",
      "harvest",
      "inbox",
    ])
  })

  it("shows a hidden widget again", () => {
    useHomeWidgetsStore.getState().hideWidget("affirmation")
    useHomeWidgetsStore.getState().showWidget("affirmation")
    expect(useHomeWidgetsStore.getState().hidden).not.toContain("affirmation")
  })
})
