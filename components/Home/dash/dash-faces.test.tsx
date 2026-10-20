import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { usePointsStore } from "@/lib/points-store"
import { useHomeDaysUntilStore } from "@/lib/home-days-until-store"
import { useSleepStore } from "@/lib/sleep-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { fetchHomeDayWeather } from "@/lib/weather-client"
import { DASH_FACES, type DashFaceProps } from "./dash-faces"
import { DASH_SIZES, type DashSize } from "./dash-sizes"
import { DashReading, SegDigits, segDrawable } from "./dash-primitives"

vi.mock("@/lib/weather-client", async (orig) => {
  const actual = await orig<typeof import("@/lib/weather-client")>()
  return { ...actual, fetchHomeDayWeather: vi.fn() }
})

const DAY = new Date(2026, 9, 20, 12, 0, 0)

const WX = {
  cityName: "San Diego, CA",
  date: "2026-10-20",
  condition: "Clear",
  weatherCode: 0,
  tempF: 72,
  highF: 76,
  lowF: 61,
  precipChance: 10,
  sunrise: "7:00 AM",
  sunset: "6:10 PM",
  sunriseHhmm: "07:00",
  sunsetHhmm: "18:10",
  hourly: [],
  week: [],
}

function face(kind: string, size: DashSize, settings: Record<string, unknown> = {}, copy: Partial<DashFaceProps["copy"]> = {}) {
  const Face = DASH_FACES[kind]!
  return render(
    <Face size={size} currentDate={DAY} settings={settings} copy={{ id: `${kind}-1`, kind, lamp: "phosphor", showFoot: true, ...copy }} />,
  )
}

function html(kind: string, size: DashSize, settings: Record<string, unknown> = {}, copy: Partial<DashFaceProps["copy"]> = {}) {
  const { container, unmount } = face(kind, size, settings, copy)
  const out = container.innerHTML
  unmount()
  return out
}

beforeEach(() => {
  resetAllStores()
  vi.mocked(fetchHomeDayWeather).mockResolvedValue(WX as never)
  const today = formatLocalDateKey(DAY)
  usePointsStore.setState({
    pointsHistory: [
      { date: "2026-10-19", taskId: "a", points: 8, taskDescription: "Run" },
      { date: today, taskId: "b", points: 12, taskDescription: "Read" },
    ],
  })
  useHomeDaysUntilStore.setState({
    items: [
      { id: "trip", label: "Trip", date: "2026-11-01", time: "", format: "unit", mode: "countdown", eventId: "", scheduleAllDay: false },
      { id: "quit", label: "Quit", date: "2026-01-01", time: "", format: "unit", mode: "countup", eventId: "", scheduleAllDay: false },
    ],
  })
  useSleepStore.setState({ nights: { [today]: { date: today, sleptMin: -30, wokeMin: 420 } } })
})

describe("segment digits", () => {
  it("lights the right segments and keeps ghosts", () => {
    const { container } = render(<SegDigits value="8" />)
    expect(container.querySelectorAll(".dash-seg-on")).toHaveLength(7)
    const one = render(<SegDigits value="1" />)
    expect(one.container.querySelectorAll(".dash-seg-on")).toHaveLength(2)
    expect(one.container.querySelectorAll(".dash-seg-off")).toHaveLength(5)
  })

  it("pads with ghost cells", () => {
    const { container } = render(<SegDigits value="7" cells={3} />)
    expect(container.querySelectorAll("g > polygon")).toHaveLength(21)
  })

  it("splits a reading into digits and printed units", () => {
    const { container } = render(<DashReading text="7h 30m" />)
    expect(container.querySelectorAll(".dash-seg")).toHaveLength(2)
    expect([...container.querySelectorAll(".dash-unit")].map((n) => n.textContent)).toEqual(["h", "m"])
    expect(segDrawable("12:05")).toBe(true)
    expect(segDrawable("Done")).toBe(false)
  })
})

describe("every kind draws every size it lists", () => {
  for (const [kind, sizes] of Object.entries(DASH_SIZES)) {
    for (const size of sizes) {
      it(`${kind} at ${size}`, () => {
        const { container } = face(kind, size)
        const root = container.querySelector(".dash-face")
        expect(root).not.toBeNull()
        expect(root!.getAttribute("data-size")).toBe(size)
        expect(root!.getAttribute("data-kind")).toBe(kind)
        expect(container.querySelector(".dash-legend")?.textContent?.trim()).toBeTruthy()
        // A face is a glance: no keys on it.
        expect(container.querySelector("button, input, select, a")).toBeNull()
        if (size === "1x1") expect(container.querySelector(".dash-foot")).toBeNull()
      })
    }
  }

  it("every registered face has sizes", () => {
    expect(Object.keys(DASH_FACES).sort()).toEqual(Object.keys(DASH_SIZES).sort())
  })
})

describe("copy settings change the face", () => {
  it("title replaces the legend", () => {
    const { container } = face("award", "2x1", {}, { title: "Last win" })
    expect(container.querySelector(".dash-legend")?.textContent).toContain("Last win")
  })

  it("lamp sets the ink", () => {
    const { container } = face("award", "1x1", {}, { lamp: "violet" })
    expect(container.querySelector(".dash-face")?.getAttribute("data-lamp")).toBe("violet")
  })

  it("showFoot off hides the foot", () => {
    expect(html("award", "2x1")).toContain("dash-foot")
    expect(html("award", "2x1", {}, { showFoot: false })).not.toContain("dash-foot")
  })
})

describe("kind settings change the face", () => {
  const differs = (kind: string, size: DashSize, a: Record<string, unknown>, b: Record<string, unknown>) =>
    expect(html(kind, size, a)).not.toEqual(html(kind, size, b))

  it("points: period, chart, keys", () => {
    differs("points", "2x2", { period: "day" }, { period: "week" })
    differs("points", "2x2", { chart: true }, { chart: false })
    differs("points", "2x1", { keys: true }, { keys: false })
  })

  it("progress: periods", () => differs("progress", "2x1", { periods: "today" }, { periods: "all" }))
  it("pet: caption and name", () => {
    differs("pet", "2x1", { caption: "clock" }, { caption: "mood" })
    expect(html("pet", "2x1", { caption: "name", name: "Mochi" })).toContain("Mochi")
  })
  it("moon: readout and sprite", () => {
    differs("moon", "1x2", { readout: "phase" }, { readout: "light" })
    differs("moon", "1x2", { sprite: true }, { sprite: false })
  })
  it("affirmation: pips", () => differs("affirmation", "2x1", { pips: true }, { pips: false }))
  it("next: sources", () => differs("next", "2x1", { sources: "both" }, { sources: "events" }))
  it("day lamp: bars", () => {
    // No scheduled work either way, so both read Quiet; the foot still names what is counted.
    expect(html("daylamp", "2x1", { bars: "habits" })).toContain("Quiet")
  })
  it("harvest: readout", () => {
    usePointsStore.setState({ getPossibleDayPoints: () => 30 } as never)
    differs("harvest", "1x1", { readout: "points" }, { readout: "percent" })
  })
  it("night: format", () => differs("night", "1x1", { format: "hm" }, { format: "decimal" }))
  it("flow: readout", () => differs("flow", "2x1", { readout: "word" }, { readout: "counts" }))
  it("paint: readout", () => differs("paint", "2x1", { readout: "word" }, { readout: "plan" }))
  it("tracking: lane", () => differs("tracking", "2x1", { lane: "activity" }, { lane: "mood" }))
  it("solar: target", () => differs("solar", "2x1", { target: "sunset" }, { target: "sunrise" }))
  it("inbox: foot", () => {
    expect(html("inbox", "2x1", { foot: "oldest" })).toContain("dash-foot")
  })

  it("weather: units", async () => {
    const f = face("weather", "1x1", { units: "f" })
    await waitFor(() => expect(f.container.querySelector("[aria-label='72°F']")).not.toBeNull())
    f.unmount()
    const c = face("weather", "1x1", { units: "c" })
    await waitFor(() => expect(c.container.querySelector("[aria-label='22°C']")).not.toBeNull())
  })

  it("countdown: markId picks the mark", () => {
    expect(html("daysuntil", "2x1", { markId: "trip" })).toContain("Trip")
    expect(html("daysuntil", "2x1", { markId: "quit" })).toContain("Quit")
    expect(html("daysuntil", "2x1", { markId: "quit" })).toContain("SINCE")
  })

  it("language study: face, role and level", () => {
    differs("vocab", "2x1", { face: "word" }, { face: "level" })
    expect(html("vocab", "1x1", { role: "studied", cefr: "B1", face: "level" }, { key: "fr" })).toContain("B1")
    expect(html("vocab", "2x1", { role: "studied" }, { key: "fr" })).toContain("FR")
  })
})
