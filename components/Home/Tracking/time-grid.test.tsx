import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useSleepStore } from "@/lib/sleep-store"
import { fetchDayClimate } from "@/lib/weather-client"
import { useSunTimesStore } from "@/lib/sun-times-store"
import { TimeGrid } from "./time-grid"

vi.mock("@/lib/weather-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/weather-client")>()
  return {
    ...actual,
    fetchDayClimate: vi.fn(),
  }
})

const fetchDayClimateMock = vi.mocked(fetchDayClimate)

describe("TimeGrid", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-20T12:00:00"))
    resetAllStores()
    fetchDayClimateMock.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("offers scissors, view settings and log activity", () => {
    render(<TimeGrid />)
    expect(screen.getByRole("button", { name: /Scissors/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^View$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Log activity/ })).toBeInTheDocument()
  })

  it("places Log activity on the grid rail with view modes, below the pen tray", () => {
    render(<TimeGrid />)
    const log = screen.getByRole("button", { name: /Log activity/ })
    expect(log.className).toMatch(/trk-latch-log/)
    expect(log.closest(".trk-grid-rail")).toBeTruthy()
    expect(log.closest(".trk-toolbar-row")).toBeNull()
    expect(log.closest(".trk-mode-bar")).toBeNull()
    expect(log.closest(".trk-pen-tray")).toBeNull()
    expect(document.querySelector(".trk-toolbar-row")?.className).not.toMatch(/wrap/)

    const tray = document.querySelector(".trk-pen-tools-row")
    const mode = screen.getByRole("toolbar", { name: "Tracking view modes" })
    const span = screen.getByRole("toolbar", { name: "Time grid span" })
    expect(tray).toBeTruthy()
    expect(tray!.compareDocumentPosition(mode) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(tray!.compareDocumentPosition(log) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(mode.compareDocumentPosition(span) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(log.compareDocumentPosition(span) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(mode.closest(".trk-pen-tray")).toBeNull()
    expect(mode.closest(".trk-toolbar")).toBeNull()
    expect(mode.parentElement).toBe(log.closest(".trk-grid-rail"))
  })

  it("renders scope tabs and pen palette", () => {
    render(<TimeGrid />)
    expect(screen.getByRole("button", { name: /^Activity$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Work/ })).toBeInTheDocument()
    expect(screen.getByText("Clear day")).toBeInTheDocument()
  })

  it("offers 1m 5m 10m cell size on the grid chrome, not only in View settings", () => {
    render(<TimeGrid />)
    expect(screen.getByRole("button", { name: "1m" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "5m" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "10m" })).toBeInTheDocument()
    const five = screen.getByRole("button", { name: "5m" })
    expect(five).toHaveAttribute("aria-pressed", "true")
    expect(five).toHaveClass("trk-cell-size-btn")
    expect(five).toHaveClass("trk-cell-size-btn-on")
    fireEvent.click(screen.getByRole("button", { name: "10m" }))
    expect(useTimeTrackingStore.getState().gridStep).toBe(10)
    const ten = screen.getByRole("button", { name: "10m" })
    expect(ten).toHaveAttribute("aria-pressed", "true")
    expect(ten).toHaveClass("trk-cell-size-btn-on")
    expect(five).toHaveAttribute("aria-pressed", "false")
    expect(five).not.toHaveClass("trk-cell-size-btn-on")
    fireEvent.click(screen.getByRole("button", { name: /^View$/ }))
    expect(screen.getByLabelText("Day fill starts")).toHaveValue("09:00")
    expect(screen.getByLabelText("Day fill ends")).toHaveValue("10:00")
    expect(screen.getByRole("button", { name: /^OK$/ })).toBeInTheDocument()
  })

  it("opens the grid on the first unpainted waking hour, not midnight", () => {
    useSleepStore.setState({
      nights: {
        "2026-06-20": {
          date: "2026-06-20",
          sleptMin: -60,
          wokeMin: 7 * 60,
          wokePrecision: "definite",
        },
      },
    })
    render(<TimeGrid />)
    expect(document.querySelector("[data-start-hour]")).toHaveAttribute("data-start-hour", "7")
    expect(document.querySelector("[data-hour='0']")).toBeInTheDocument()
    expect(document.querySelector("[data-hour='7']")).toBeInTheDocument()
  })

  it("skips already-painted waking hours when choosing where to open", () => {
    useSleepStore.setState({
      nights: {
        "2026-06-20": {
          date: "2026-06-20",
          sleptMin: -60,
          wokeMin: 7 * 60,
          wokePrecision: "definite",
        },
      },
    })
    useTimeTrackingStore.getState().paintMinutes("2026-06-20", "activity", 7 * 60, 9 * 60, "act-work")
    render(<TimeGrid />)
    expect(document.querySelector("[data-start-hour]")).toHaveAttribute("data-start-hour", "9")
  })

  it("clears painted time for the current day", () => {
    const store = useTimeTrackingStore.getState()
    store.setSelectedPen("act-work")
    store.paintMinutes("2026-06-20", "activity", 540, 600, "act-work")
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)

    render(<TimeGrid />)
    screen.getByRole("button", { name: "Clear day" }).click()

    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
  })

  it("shows the day total and the pen breakdown from the shared summary", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-06-20", "activity", 540, 660, "act-work")
    render(<TimeGrid />)
    expect(screen.getByText(/2h tracked/)).toBeInTheDocument()
    expect(document.querySelector(".trk-occ-pct")?.textContent).toMatch(/%/)
    // Once as the "Work" pen total, once as the "Work" tag total — the pen is
    // seeded carrying that tag, and both rows read the same shared summary.
    expect(screen.getAllByText("Work:")).toHaveLength(2)
    expect(screen.getAllByText("2h")).not.toHaveLength(0)
  })

  it("shows Company as its own view", () => {
    render(<TimeGrid />)
    expect(screen.getByRole("button", { name: /^Company$/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Company$/ }))
    expect(screen.getByTitle("Alone")).toBeInTheDocument()
    expect(screen.getByTitle("In conversation")).toBeInTheDocument()
  })

  it("adds a new view from the inline field instead of window.prompt", () => {
    render(<TimeGrid />)
    fireEvent.click(screen.getByTitle("Add view"))
    fireEvent.change(screen.getByLabelText("New view name"), { target: { value: "Frame" } })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    expect(screen.getByRole("button", { name: /^Frame$/ })).toBeInTheDocument()
    expect(useTimeTrackingStore.getState().scopes.some((s) => s.name === "Frame")).toBe(true)
  })

  it("lists recently painted pens first", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-06-20", "activity", 540, 600, "act-rest")
    render(<TimeGrid />)
    const names = [...document.querySelectorAll(".trk-pen-well .trk-pen-name")].map((el) => el.textContent)
    expect(names[0]).toBe("Rest")
    fireEvent.click(screen.getByRole("button", { name: "Sort pens A–Z" }))
    const az = [...document.querySelectorAll(".trk-pen-well .trk-pen-name")].map((el) => el.textContent)
    expect(az[0]).toBe("Chores")
  })

  it("toggles one Infinite scroll from the grid chrome, not View settings", () => {
    render(<TimeGrid />)
    expect(screen.getByRole("button", { name: "Infinite scroll" })).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(screen.getByRole("button", { name: /^View$/ }))
    expect(screen.queryByLabelText("Infinite day scroll")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Infinite week scroll")).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })

    fireEvent.click(screen.getByRole("button", { name: "Infinite scroll" }))
    expect(screen.getByRole("button", { name: "Infinite scroll" })).toHaveAttribute("aria-pressed", "true")
    expect(document.querySelector("[data-infinite='week']")).toBeTruthy()
    expect(screen.queryByText("Clear day")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Infinite day" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Infinite week" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Infinite scroll" }))
    expect(screen.getByRole("button", { name: "Infinite scroll" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("Clear day")).toBeInTheDocument()
  })

  it("returns to the paged week when Infinite scroll is on and you pick Week", () => {
    render(<TimeGrid />)
    fireEvent.click(screen.getByRole("button", { name: "Infinite scroll" }))
    expect(document.querySelector("[data-infinite='week']")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "week" }))
    expect(screen.getByRole("button", { name: "Infinite scroll" })).toHaveAttribute("aria-pressed", "false")
    expect(document.querySelector("[data-infinite]")).toBeNull()
  })

  it("double-clicks a day tile in Infinite scroll to open that paged day", () => {
    render(<TimeGrid currentDate={new Date(2026, 8, 16, 12, 0, 0)} />)
    fireEvent.click(screen.getByRole("button", { name: "Infinite scroll" }))
    const row = document.querySelector("[data-day-row]") as HTMLElement
    expect(row).toBeTruthy()
    fireEvent.doubleClick(row.querySelector(".trk-day-gutter")!)
    expect(screen.getByRole("button", { name: "Infinite scroll" })).toHaveAttribute("aria-pressed", "false")
    expect(useTimeTrackingStore.getState().gridSpan).toBe("day")
    expect(useTimeTrackingStore.getState().infiniteScroll).toBe(false)
    expect(screen.getByText("Clear day")).toBeInTheDocument()
  })

  it("double-clicks a week band in Infinite scroll to open that paged week", () => {
    render(<TimeGrid currentDate={new Date(2026, 8, 16, 12, 0, 0)} />)
    fireEvent.click(screen.getByRole("button", { name: "Infinite scroll" }))
    const band = document.querySelector("[data-week-band]") as HTMLElement
    expect(band).toBeTruthy()
    fireEvent.doubleClick(band)
    expect(screen.getByRole("button", { name: "Infinite scroll" })).toHaveAttribute("aria-pressed", "false")
    expect(useTimeTrackingStore.getState().gridSpan).toBe("week")
    expect(screen.getByLabelText("Previous week")).toBeInTheDocument()
  })

  it("packs TIME/DIV, Cell, and Fill on one plot-strip and grows the plot region", () => {
    render(<TimeGrid />)
    const strip = document.querySelector(".trk-plot-strip") as HTMLElement
    const region = document.querySelector(".trk-plot-region") as HTMLElement
    const grid = document.querySelector(".trk-grid-full-day") as HTMLElement
    const span = screen.getByRole("toolbar", { name: "Time grid span" })
    const five = screen.getByRole("button", { name: "5m" })
    const fill = screen.getByRole("button", { name: /Fill .* with / })
    expect(strip).toBeTruthy()
    expect(region).toBeTruthy()
    expect(strip.contains(span)).toBe(true)
    expect(strip.contains(five)).toBe(true)
    expect(strip.contains(fill)).toBe(true)
    expect(region.contains(grid)).toBe(true)
    expect(getComputedStyle(region).flexGrow).toBe("1")
    expect(getComputedStyle(document.querySelector(".trk-plot-bezel") as HTMLElement).display).toBe(
      "flex",
    )
    expect(grid.style.maxHeight).toBe("")
  })

  it("fills the View-settings clock range with the selected pen", () => {
    useTimeTrackingStore.getState().setSelectedPen("act-work")
    render(<TimeGrid />)
    fireEvent.click(screen.getByRole("button", { name: /Fill 9:00 AM–10:00 AM with Work/ }))
    const entries = useTimeTrackingStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0].startMin).toBe(9 * 60)
    expect(entries[0].endMin).toBe(10 * 60)
    expect(entries[0].penId).toBe("act-work")
  })

  it("defaults Fill to the longest empty hole and still writes a block", () => {
    const store = useTimeTrackingStore.getState()
    store.setSelectedPen("act-work")
    store.paintMinutes("2026-06-20", "activity", 0, 9 * 60, "act-sleep")
    store.paintMinutes("2026-06-20", "activity", 10 * 60, 12 * 60, "act-sleep")
    store.paintMinutes("2026-06-20", "activity", 15 * 60, 24 * 60, "act-sleep")
    render(<TimeGrid />)
    expect(screen.getByRole("button", { name: /Fill 12:00 PM–3:00 PM with Work/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Fill 12:00 PM–3:00 PM with Work/ }))
    const filled = useTimeTrackingStore.getState().entries.filter((e) => e.penId === "act-work")
    expect(filled.some((e) => e.startMin === 12 * 60 && e.endMin === 15 * 60)).toBe(true)
  })

  it("reads hover on a phosphor probe in the plot strip, not a tooltip", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-06-20", "activity", 14 * 60 + 10, 14 * 60 + 28, "act-work")
    render(<TimeGrid />)
    fireEvent.mouseEnter(document.querySelector('[data-minute="850"]') as HTMLElement)
    const probe = document.querySelector(".trk-plot-strip .trk-probe") as HTMLElement
    expect(probe).toBeTruthy()
    expect(probe.getAttribute("role")).toBe("status")
    expect(probe.title).toBe("")
    expect(probe.textContent).toMatch(/2:10 PM/)
    expect(probe.textContent).toMatch(/Work/)
  })

  it("draws the now line on today as a horizontal marker across the day", () => {
    render(<TimeGrid />)
    const now = document.querySelector(".trk-day-clock-markers .trk-marker-now") as HTMLElement
    expect(now).toBeTruthy()
    expect(now.className).toMatch(/trk-marker-y/)
    expect(now.style.top).toBe("50%")
    expect(now.style.left).toBe("0px")
    expect(now.style.right).toBe("0px")
    expect(now.style.height).toBe("2px")
    expect(now.querySelector(".trk-marker-label")?.textContent).toMatch(/Now/)
  })

  it("draws sunrise and sunset as horizontal markers across the day", async () => {
    useSunTimesStore.getState().rememberIfAbsent({
      date: "2026-06-20",
      lat: 32.7157,
      lng: -117.1611,
      sunriseMinutes: 6 * 60 + 36,
      sunsetMinutes: 18 * 60 + 46,
      sunriseHhmm: "06:36",
      sunsetHhmm: "18:46",
      sunriseLabel: "6:36 AM",
      sunsetLabel: "6:46 PM",
    })
    render(<TimeGrid />)
    await act(async () => {
      await Promise.resolve()
    })
    const sunrise = document.querySelector(".trk-day-clock-markers .trk-marker-sunrise") as HTMLElement
    const sunset = document.querySelector(".trk-day-clock-markers .trk-marker-sunset") as HTMLElement
    expect(sunrise).toBeTruthy()
    expect(sunset).toBeTruthy()
    expect(sunrise.className).toMatch(/trk-marker-y/)
    expect(sunset.className).toMatch(/trk-marker-y/)
    expect(sunrise.style.left).toBe("0px")
    expect(sunrise.style.right).toBe("0px")
    expect(sunrise.style.height).toBe("2px")
    expect(sunset.style.left).toBe("0px")
    expect(sunset.style.right).toBe("0px")
    expect(sunset.style.height).toBe("2px")
    expect(sunrise.style.top).toBe(`${((6 * 60 + 36) / (24 * 60)) * 100}%`)
    expect(sunset.style.top).toBe(`${((18 * 60 + 46) / (24 * 60)) * 100}%`)
    expect(sunrise.querySelector(".trk-marker-label")?.textContent).toBe("Sunrise 6:36 AM")
    expect(sunset.querySelector(".trk-marker-label")?.textContent).toBe("Sunset 6:46 PM")
  })

  it("keeps discrete events as vertical labeled ticks at the exact minute", () => {
    useTimeTrackingStore.getState().paintMinutes(
      "2026-06-20",
      "activity",
      12 * 60 + 17,
      12 * 60 + 17,
      "act-work",
      undefined,
      undefined,
      undefined,
      { kind: "instant", title: "smoked weed" },
    )
    render(<TimeGrid />)
    const tick = document.querySelector(".trk-instant") as HTMLButtonElement
    expect(tick).toBeTruthy()
    expect(tick.className).not.toMatch(/trk-marker/)
    expect(tick.style.left).toBe(`${(17 / 60) * 100}%`)
    expect(tick).toHaveAttribute("aria-label", "12:17 PM · smoked weed")
    expect(tick.closest(".trk-day-clock-markers")).toBeNull()
  })

  it("uses a plan-style period bar with Today and Clear day trailing", () => {
    render(<TimeGrid />)
    const period = document.querySelector(".trk-period") as HTMLElement
    expect(period).toBeTruthy()
    const title = period.querySelector(".trk-period-title") as HTMLElement
    const name = title.querySelector("h3") as HTMLElement
    expect(name.textContent).toMatch(/20/)
    const today = screen.getByRole("button", { name: "Today" })
    expect(today).toHaveClass("trk-period-today")
    expect(period.contains(today)).toBe(true)
    expect(name.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    const clear = screen.getByRole("button", { name: "Clear day" })
    expect(clear).toHaveClass("trk-period-aux")
    expect(clear.closest(".trk-period-title")).toBeNull()
    expect(clear.closest(".trk-period-trailing")).toBeTruthy()
  })

  it("moves the viewed day with previous, next, and Today", () => {
    render(<TimeGrid />)
    const name = () => document.querySelector(".trk-period h3") as HTMLElement
    const start = name().textContent
    expect(start).toMatch(/20/)
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }))
    expect(name().textContent).toMatch(/19/)
    expect(name().textContent).not.toBe(start)
    fireEvent.click(screen.getByRole("button", { name: "Next day" }))
    expect(name().textContent).toBe(start)
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }))
    fireEvent.click(screen.getByRole("button", { name: "Today" }))
    expect(name().textContent).toBe(start)
  })

  it("paints filled cells with a left hairline, not a four-side gray inset", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-06-20", "activity", 0, 60, "act-sleep")
    render(<TimeGrid currentDate={new Date("2026-06-20T12:00:00")} />)
    const painted = document.querySelector(".trk-cell-painted") as HTMLElement
    const empty = [...document.querySelectorAll(".trk-cell")].find(
      (el) => !el.classList.contains("trk-cell-painted"),
    ) as HTMLElement
    expect(painted).toBeTruthy()
    expect(empty).toBeTruthy()
    const paintedShadow = getComputedStyle(painted).boxShadow
    const emptyShadow = getComputedStyle(empty).boxShadow
    expect(paintedShadow).toMatch(/inset 1px 0(?:px)? 0(?:px)?/)
    expect(paintedShadow).not.toMatch(/inset 0(?:px)? 0(?:px)? 0(?:px)? 1px/)
    const alpha = (s: string) =>
      Number(/\/\s*([0-9.]+)\)/.exec(s)?.[1] ?? /rgba?\([^)]+,\s*([0-9.]+)\)/.exec(s)?.[1] ?? 1)
    expect(alpha(paintedShadow)).toBeLessThan(alpha(emptyShadow))
  })

  it("opens the block editor when a Sleep cell is clicked", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-06-20", "activity", 0, 7 * 60, "act-sleep")
    const sleep = useTimeTrackingStore.getState().entriesFor("2026-06-20", "activity")[0]
    useTimeTrackingStore.setState({
      entries: [{ ...sleep, generatedBy: { kind: "sleep", id: "2026-06-20" } }],
    })
    render(<TimeGrid currentDate={new Date("2026-06-20T12:00:00")} />)
    fireEvent.mouseDown(document.querySelector('[data-minute="60"]') as HTMLElement)
    expect(screen.getByLabelText("Fell asleep")).toBeInTheDocument()
    expect(screen.getByLabelText("Woke up")).toBeInTheDocument()
  })
})
