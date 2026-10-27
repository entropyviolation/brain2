import { render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useSleepStore } from "@/lib/sleep-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { SleepNight } from "@/lib/sleep-log"
import { SleepAnalytics } from "./SleepAnalytics"
import { useAnalyticsRangeStore } from "./analytics-range-store"
import { useSunTimesStore } from "@/lib/sun-times-store"

/** Pin "today" so `recentDateKeys` covers the seeded nights. */
const TODAY = new Date(2026, 8, 17, 12, 0, 0)

function night(date: string, sleptMin: number, wokeMin: number, estimated = false): SleepNight {
  return {
    date,
    sleptMin,
    wokeMin,
    sleptPrecision: estimated ? "estimated" : "definite",
    wokePrecision: "definite",
  }
}

/** One of the four headline stat cards, by its label. */
const card = (label: string) => screen.getByText(label).closest("div") as HTMLElement

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  resetAllStores()
  useAnalyticsRangeStore.setState({ days: 30, hydrated: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("SleepAnalytics", () => {
  it("explains where to log a night when there is nothing yet", () => {
    render(<SleepAnalytics />)
    expect(screen.getByText(/No nights tracked in the last 30 days/)).toBeInTheDocument()
    expect(screen.getAllByText(/Home → Tracking/).length).toBeGreaterThan(0)
  })

  it("reports duration, bedtime and wake time across midnight", () => {
    useSleepStore.setState({
      nights: {
        "2026-09-15": night("2026-09-15", -30, 420), // 7h30, asleep 11:30 PM
        "2026-09-16": night("2026-09-16", -30, 420),
        "2026-09-17": night("2026-09-17", -30, 420),
      },
    })
    render(<SleepAnalytics />)

    // Scoped to the headline cards — the same times also appear on the night
    // rows and in the earliest/latest card.
    const average = screen.getByText("Average night").closest("div") as HTMLElement
    expect(within(average).getByText("7h 30m")).toBeInTheDocument()
    // Averaging wall-clock bedtimes naively would land near noon, not 11:30 PM.
    expect(within(card("Usually asleep by")).getByText("11:30 PM")).toBeInTheDocument()
    expect(within(card("Usually up at")).getByText("7:00 AM")).toBeInTheDocument()
  })

  it("counts blank nights rather than quietly shrinking the range", () => {
    useSleepStore.setState({ nights: { "2026-09-17": night("2026-09-17", -30, 420) } })
    render(<SleepAnalytics />)
    expect(screen.getByText(/1 of 30 nights tracked/)).toBeInTheDocument()
    expect(screen.getByText(/29 blank/)).toBeInTheDocument()
  })

  it("says how much of the data was remembered rather than observed", () => {
    useSleepStore.setState({
      nights: {
        "2026-09-16": night("2026-09-16", -30, 420, true),
        "2026-09-17": night("2026-09-17", -30, 420),
      },
    })
    render(<SleepAnalytics />)
    expect(screen.getByText(/50% estimated/)).toBeInTheDocument()
    expect(screen.getAllByText(/est\.|~ estimated/).length).toBeGreaterThan(0)
    expect(screen.queryByText("≈")).not.toBeInTheDocument()
    expect(screen.queryByText("▦")).not.toBeInTheDocument()
  })

  it("measures debt against the target", () => {
    useSleepStore.setState({
      nights: {
        "2026-09-16": night("2026-09-16", 0, 420), // 7h — an hour short
        "2026-09-17": night("2026-09-17", -60, 420), // 8h — on target
      },
    })
    render(<SleepAnalytics />)
    expect(screen.getByText("1h")).toBeInTheDocument()
    expect(screen.getByText(/1 of 2 nights hit the target/)).toBeInTheDocument()
  })

  it("declines to call two nights a trend", () => {
    useSleepStore.setState({ nights: { "2026-09-17": night("2026-09-17", -30, 420) } })
    render(<SleepAnalytics />)
    expect(screen.getByText(/Not enough nights on both halves/)).toBeInTheDocument()
  })

  it("compares the halves of the range once there is enough data", () => {
    const nights: Record<string, SleepNight> = {}
    // First half of the last 7 days: 8 hours. Second half: 7 hours, bed an hour later.
    for (const d of [11, 12, 13]) nights[`2026-09-${d}`] = night(`2026-09-${d}`, -60, 420)
    for (const d of [15, 16, 17]) nights[`2026-09-${d}`] = night(`2026-09-${d}`, 0, 420)
    useSleepStore.setState({ nights })

    useAnalyticsRangeStore.getState().setDays(7)
    render(<SleepAnalytics />)
    expect(screen.getByText("1h less")).toBeInTheDocument()
    expect(screen.getByText("1h later")).toBeInTheDocument()
  })

  it("switches range", () => {
    useSleepStore.setState({ nights: { "2026-09-17": night("2026-09-17", -30, 420) } })
    useAnalyticsRangeStore.getState().setDays(7)
    render(<SleepAnalytics />)
    expect(screen.getByText(/1 of 7 nights tracked/)).toBeInTheDocument()
  })

  it("reports the earliest and latest each end of the night reached", () => {
    useSleepStore.setState({
      nights: {
        "2026-09-15": night("2026-09-15", -120, 400), // asleep 10 PM, up 6:40
        "2026-09-16": night("2026-09-16", -30, 420),
        "2026-09-17": night("2026-09-17", 45, 480), // asleep 12:45 AM, up 8:00
      },
    })
    render(<SleepAnalytics />)

    const asleep = screen.getByText("Asleep").closest("div") as HTMLElement
    expect(within(asleep).getByText("10:00 PM")).toBeInTheDocument()
    expect(within(asleep).getByText("12:45 AM")).toBeInTheDocument()
    expect(within(asleep).getByText(/2h 45m between the two/)).toBeInTheDocument()

    const awake = screen.getByText("Awake").closest("div") as HTMLElement
    expect(within(awake).getByText("6:40 AM")).toBeInTheDocument()
    expect(within(awake).getByText("8:00 AM")).toBeInTheDocument()
  })

  it("counts a night painted on the grid that was never typed into the strip", () => {
    useTimeTrackingStore.setState({
      entries: [
        { id: "e1", date: "2026-09-16", scopeId: "activity", penId: "act-sleep", startMin: 1350, endMin: 1440 },
        { id: "e2", date: "2026-09-17", scopeId: "activity", penId: "act-sleep", startMin: 0, endMin: 450 },
      ],
    })
    render(<SleepAnalytics />)

    expect(screen.getByText(/1 of 30 nights tracked/)).toBeInTheDocument()
    expect(screen.getByText(/· 1 read off the grid/)).toBeInTheDocument()
    expect(screen.getAllByText(/est\./).length).toBeGreaterThan(0)
    expect(screen.queryByText("▦")).not.toBeInTheDocument()
    expect(within(card("Average night")).getByText("9h")).toBeInTheDocument()
    expect(within(card("Usually asleep by")).getByText("10:30 PM")).toBeInTheDocument()
    expect(within(card("Usually up at")).getByText("7:30 AM")).toBeInTheDocument()
  })

  it("prefers a stated time over a painted one for the same night", () => {
    useSleepStore.setState({ nights: { "2026-09-17": night("2026-09-17", -30, 420) } })
    useTimeTrackingStore.setState({
      entries: [
        { id: "e1", date: "2026-09-16", scopeId: "activity", penId: "act-sleep", startMin: 1200, endMin: 1440 },
        { id: "e2", date: "2026-09-17", scopeId: "activity", penId: "act-sleep", startMin: 0, endMin: 600 },
      ],
    })
    render(<SleepAnalytics />)

    expect(within(card("Average night")).getByText("7h 30m")).toBeInTheDocument()
    expect(screen.queryByText(/· \d+ read off the grid/)).not.toBeInTheDocument()
  })

  it("reports a nap rather than letting it vanish or skew the nightly average", () => {
    useSleepStore.setState({ nights: { "2026-09-17": night("2026-09-17", -30, 420) } })
    useTimeTrackingStore.setState({
      // 2–3 PM on the Sleep pen: real sleep, but not a night.
      entries: [{ id: "nap", date: "2026-09-17", scopeId: "activity", penId: "act-sleep", startMin: 840, endMin: 900 }],
    })
    render(<SleepAnalytics />)

    expect(within(card("Average night")).getByText("7h 30m")).toBeInTheDocument()
    expect(screen.getByText(/Plus 1h of sleep painted outside these nights/)).toBeInTheDocument()
  })

  it("borrows only the end the user left blank", () => {
    useSleepStore.setState({ nights: { "2026-09-17": { date: "2026-09-17", wokeMin: 420, wokePrecision: "definite" } } })
    useTimeTrackingStore.setState({
      entries: [{ id: "e1", date: "2026-09-16", scopeId: "activity", penId: "act-sleep", startMin: 1320, endMin: 1440 }],
    })
    render(<SleepAnalytics />)

    // 10 PM from the grid, 7 AM as stated.
    expect(within(card("Average night")).getByText("9h")).toBeInTheDocument()
    expect(within(card("Usually asleep by")).getByText("10:00 PM")).toBeInTheDocument()
  })

  it("reports wake after that morning's stored sunrise, not today's sun on every night", () => {
    useSleepStore.setState({
      nights: {
        "2026-09-14": night("2026-09-14", -30, 7 * 60),
        "2026-09-17": night("2026-09-17", -30, 7 * 60),
      },
    })
    useSunTimesStore.getState().rememberIfAbsent({
      date: "2026-09-13",
      lat: 32.7157,
      lng: -117.1611,
      sunriseMinutes: 6 * 60 + 40,
      sunsetMinutes: 18 * 60 + 50,
      sunriseHhmm: "06:40",
      sunsetHhmm: "18:50",
      sunriseLabel: "6:40 AM",
      sunsetLabel: "6:50 PM",
    })
    useSunTimesStore.getState().rememberIfAbsent({
      date: "2026-09-14",
      lat: 32.7157,
      lng: -117.1611,
      sunriseMinutes: 6 * 60 + 36,
      sunsetMinutes: 18 * 60 + 46,
      sunriseHhmm: "06:36",
      sunsetHhmm: "18:46",
      sunriseLabel: "6:36 AM",
      sunsetLabel: "6:46 PM",
    })
    useSunTimesStore.getState().rememberIfAbsent({
      date: "2026-09-16",
      lat: 32.7157,
      lng: -117.1611,
      sunriseMinutes: 6 * 60 + 40,
      sunsetMinutes: 18 * 60 + 40,
      sunriseHhmm: "06:40",
      sunsetHhmm: "18:40",
      sunriseLabel: "6:40 AM",
      sunsetLabel: "6:40 PM",
    })
    useSunTimesStore.getState().rememberIfAbsent({
      date: "2026-09-17",
      lat: 32.7157,
      lng: -117.1611,
      sunriseMinutes: 6 * 60 + 42,
      sunsetMinutes: 18 * 60 + 38,
      sunriseHhmm: "06:42",
      sunsetHhmm: "18:38",
      sunriseLabel: "6:42 AM",
      sunsetLabel: "6:38 PM",
    })
    render(<SleepAnalytics />)
    expect(screen.getByText("Against the sun")).toBeInTheDocument()
    expect(screen.getByText(/24m after sunrise/)).toBeInTheDocument()
    expect(screen.getByText(/18m after sunrise/)).toBeInTheDocument()
  })
})
