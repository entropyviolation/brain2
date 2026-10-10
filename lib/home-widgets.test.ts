import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_PERCENT_LED_TINT } from "@/lib/habit-led"
import { DEFAULT_GRADE_TUBE_COLOR, DEFAULT_OUTPUT_TUBE_COLOR } from "@/lib/habit-tube"
import { resetAllStores } from "@/tests/test-utils"
import { alreadyFlowingFace, flowingCounts, livedPaintMinutes, planAndLivedFace } from "@/lib/home-glances"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"
import { writeAliasedLocal } from "@/lib/storage-keys"
import {
  DEFAULT_HOME_WIDGET_HIDDEN,
  DEFAULT_HOME_WIDGET_ORDER,
  HOME_WIDGET_CATALOG,
  HOME_WIDGET_IDS,
  HOME_WIDGET_LABEL,
  affirmationLinesForHome,
  dayLampWord,
  daysUntilCount,
  daysUntilFace,
  daysUntilLiveFace,
  daysUntilRemainingMs,
  formatCountdownDecimal,
  formatCountdownSpan,
  homeInstrumentColorVars,
  homeWellGradient,
  homeWidgetDate,
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
  homeWidgetBlurb,
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
      "progress",
      "review",
      "award",
      "pet",
      "affirmation",
      "next",
      "daylamp",
      "harvest",
      "inbox",
      "flow",
      "paint",
      "tracking",
      "night",
      "solar",
      "moon",
      "daysuntil",
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
    expect(petPose(40, 3, 23)).toBe("asleep")
    expect(petPose(100, 3, 23)).toBe("pleased")
    expect(petPose(0, 0, 2)).toBe("asleep")
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
      ["affirmation", "weather", "next", "daylamp", "solar", "tracking", "night", "harvest", "inbox", "flow", "paint"],
    )
    expect(migrateHomeWidgetPersist({ hidden: ["next", "pet"] }, 2).hidden).toEqual([
      "pet",
      "next",
      "solar",
      "tracking",
      "night",
      "harvest",
      "inbox",
      "flow",
      "paint",
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
    expect(folded.order).toEqual(["review", "points", "award", "progress", "moon", "flow", "paint"])
    expect(folded.hidden).toContain("points")
    expect(folded.hidden).not.toContain("today")
    const kept = migrateHomeWidgetPersist(
      { order: ["review", "today", "progress"], hidden: ["weather"] },
      2,
    )
    expect(kept.order?.slice(0, 4)).toEqual(["review", "points", "award", "progress"])
    expect(kept.hidden).not.toContain("points")
  })

  it("keeps overview squares on the selected day unless they follow the clock", () => {
    const selected = new Date(2026, 0, 2, 15, 0)
    const now = new Date(2026, 5, 20, 14, 30)
    expect(homeWidgetDate(selected, now, false)).toBe(selected)
    expect(homeWidgetDate(selected, now, true)).toBe(now)
  })

  it("leaves Follow the clock off when migrating a v7 blob", () => {
    const next = migrateHomeWidgetPersist(
      { order: ["review", "moon"], hidden: ["solar"], widgetsFollowClock: true },
      7,
    )
    expect(next.widgetsFollowClock).toBe(false)
    expect(next.hidden).toEqual(["solar", "flow", "paint"])
  })

  it("tucks Already flowing and Plan and lived when migrating a v8 blob", () => {
    const next = migrateHomeWidgetPersist(
      { order: ["review", "points", "moon"], hidden: ["solar"], widgetsFollowClock: true },
      8,
    )
    expect(next.widgetsFollowClock).toBe(true)
    expect(next.order.slice(-2)).toEqual(["flow", "paint"])
    expect(next.hidden).toEqual(["solar", "flow", "paint"])
    const kept = migrateHomeWidgetPersist(
      { order: ["review", "flow", "paint"], hidden: ["paint"], widgetsFollowClock: false },
      9,
    )
    expect(kept.order).toEqual(["review", "flow", "paint"])
    expect(kept.hidden).toEqual(["paint"])
    expect(kept.widgetsFollowClock).toBe(false)
  })

  it("places Moon after Days Until and leaves it showing", () => {
    const next = migrateHomeWidgetPersist(
      { order: ["review", "points", "award", "daysuntil", "solar"], hidden: ["solar"] },
      6,
    )
    expect(next.order).toEqual(["review", "points", "award", "daysuntil", "moon", "solar", "flow", "paint"])
    expect(next.hidden).not.toContain("moon")
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

  it("formats a live countdown in unit and decimal forms", () => {
    const day = 86_400_000
    const hour = 3_600_000
    const min = 60_000
    expect(formatCountdownSpan(day + 3 * hour, "unit")).toBe("01 day 3 hours")
    expect(formatCountdownSpan(3 * hour + 30 * min, "unit")).toBe("03 hours 30 min")
    expect(formatCountdownSpan(1.25 * day, "decimal")).toBe("1.25 days")
    expect(formatCountdownSpan(3.5 * hour, "decimal")).toBe("3.5 hours")
    expect(formatCountdownDecimal(1.5)).toBe("1.5")
    expect(formatCountdownDecimal(1.25)).toBe("1.25")
    expect(daysUntilLiveFace({
      remainingMs: day + 3 * hour,
      label: "Launch",
      format: "unit",
      hasTime: true,
    })).toEqual({ crt: "01 day 3 hours", footer: "Until Launch" })
    expect(daysUntilLiveFace({
      remainingMs: 3 * hour + 30 * min,
      label: "Launch",
      format: "unit",
      hasTime: true,
    })).toEqual({ crt: "03 hours 30 min", footer: "Until Launch" })
    expect(daysUntilLiveFace({
      remainingMs: -(day + 3 * hour),
      label: "Launch",
      format: "unit",
      hasTime: true,
      mode: "countdown",
    })).toEqual({ crt: "0", footer: "Launch passed" })
    expect(daysUntilLiveFace({
      remainingMs: day,
      label: "Trip",
      format: "unit",
      hasTime: true,
      mode: "countup",
    })).toEqual({ crt: "0", footer: "Trip ahead" })
    expect(daysUntilLiveFace({
      remainingMs: -(3 * hour),
      label: "Trip",
      format: "unit",
      hasTime: true,
      mode: "countup",
    })).toEqual({ crt: "03 hours 00 min", footer: "Since Trip" })
    expect(daysUntilRemainingMs("2026-09-28", "15:00", new Date(2026, 8, 27, 15, 0))).toBe(day)
    expect(daysUntilRemainingMs("2026-09-28", "", new Date(2026, 8, 27, 12, 0))).toBe(12 * hour)
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

  it("describes every widget once in the catalog", () => {
    expect(HOME_WIDGET_CATALOG.map((entry) => entry.id)).toEqual([...HOME_WIDGET_IDS])
    for (const entry of HOME_WIDGET_CATALOG) {
      expect(entry.name).toBe(HOME_WIDGET_LABEL[entry.id])
      if (entry.id !== "weather" && entry.id !== "pet") {
        expect(entry.preview.caption).toBe(HOME_WIDGET_LABEL[entry.id])
      }
      expect(homeWidgetBlurb(entry.id).shows.length).toBeGreaterThan(20)
      expect(entry.useful.length).toBeGreaterThan(10)
      expect(entry.preview.crt.length).toBeGreaterThan(0)
      expect(entry.preview.footer.length).toBeGreaterThan(0)
    }
  })

  it("reads finished work as already in motion or new today", () => {
    const day = new Date(2026, 9, 6, 15, 0)
    const counts = flowingCounts(
      [
        { completed: true, createdAt: new Date(2026, 9, 1), completedDate: day },
        { completed: true, createdAt: day, completedDate: day },
        { completed: true, createdAt: day, completedDate: new Date(2026, 9, 5) },
        { completed: false, createdAt: day, completedDate: day },
      ],
      day,
      2,
    )
    expect(counts).toEqual({ flowing: 3, pushed: 1 })
    expect(alreadyFlowingFace(3, 1)).toMatchObject({ crt: "Flowing", footer: "3 already · 1 new" })
    expect(alreadyFlowingFace(0, 2).crt).toBe("Pushed")
    expect(alreadyFlowingFace(1, 1).crt).toBe("Mixed")
    expect(alreadyFlowingFace(0, 0)).toMatchObject({ crt: "Quiet", footer: "Nothing finished" })
  })

  it("compares planned minutes with painted minutes and skips sleep", () => {
    expect(planAndLivedFace(0, 0)).toMatchObject({ crt: "Open", footer: "Nothing planned or tracked" })
    expect(planAndLivedFace(120, 0)).toMatchObject({ crt: "Planned", footer: "plan 2h · nothing tracked" })
    expect(planAndLivedFace(0, 90)).toMatchObject({ crt: "Tracked", footer: "nothing planned · lived 1h 30m" })
    expect(planAndLivedFace(300, 180)).toMatchObject({ crt: "Short", footer: "plan 5h · lived 3h" })
    expect(planAndLivedFace(100, 100).crt).toBe("Close")
    expect(planAndLivedFace(60, 120).crt).toBe("Over")
    const lived = livedPaintMinutes(
      [
        { id: "a", date: "2026-10-06", scopeId: "activity", penId: "act-work", startMin: 9 * 60, endMin: 10 * 60 },
        { id: "b", date: "2026-10-06", scopeId: "location", penId: "loc", startMin: 9 * 60, endMin: 10 * 60 },
        {
          id: "c",
          date: "2026-10-06",
          scopeId: "activity",
          penId: "act-sleep",
          startMin: 0,
          endMin: 7 * 60,
          generatedBy: { kind: "sleep", id: "2026-10-05" },
        },
        { id: "d", date: "2026-10-05", scopeId: "activity", penId: "act-work", startMin: 0, endMin: 60 },
      ],
      "2026-10-06",
    )
    expect(lived).toBe(60)
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
      "flow",
      "paint",
    ])
  })

  it("persists Follow the clock, default off", async () => {
    expect(useHomeWidgetsStore.getState().widgetsFollowClock).toBe(false)
    useHomeWidgetsStore.getState().setWidgetsFollowClock(true)
    const snap = localStorage.getItem("cogs-home-widgets")
    expect(snap).toContain('"widgetsFollowClock":true')

    useHomeWidgetsStore.setState({ widgetsFollowClock: false })
    writeAliasedLocal("cogs-home-widgets", snap!)
    await useHomeWidgetsStore.persist.rehydrate()
    expect(useHomeWidgetsStore.getState().widgetsFollowClock).toBe(true)

    writeAliasedLocal(
      "cogs-home-widgets",
      JSON.stringify({
        state: { order: ["review", "points"], hidden: ["solar"] },
        version: 7,
      }),
    )
    await useHomeWidgetsStore.persist.rehydrate()
    expect(useHomeWidgetsStore.getState().widgetsFollowClock).toBe(false)
    expect(useHomeWidgetsStore.getState().order).toContain("moon")
  })

  it("shows a hidden widget again", () => {
    useHomeWidgetsStore.getState().hideWidget("affirmation")
    useHomeWidgetsStore.getState().showWidget("affirmation")
    expect(useHomeWidgetsStore.getState().hidden).not.toContain("affirmation")
  })
})
