import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { undoLastAction } from "@/lib/action-history"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TimeGrid } from "./time-grid"
import { WeekGrid, weekRowBand } from "./week-grid"

/** A Wednesday, so the week runs Mon 15th – Sun 21st. */
const WEDNESDAY = new Date(2026, 8, 16, 12, 0, 0)
const MON = "2026-09-14"
const TUE = "2026-09-15"
const WED = "2026-09-16"
const FRI = "2026-09-18"
const SUN = "2026-09-20"

function renderWeek(onOpenDay = vi.fn()) {
  const onDateChange = vi.fn()
  const view = render(
    <WeekGrid date={WEDNESDAY} onDateChange={onDateChange} onOpenDay={onOpenDay} />,
  )
  return { ...view, onDateChange, onOpenDay }
}

/** A paintable cell, addressed the way the grid addresses it. */
const cell = (day: string, minute: number) =>
  document.querySelector(`[data-day="${day}"][data-minute="${minute}"]`) as HTMLElement

const entriesFor = (date: string) => useTimeTrackingStore.getState().entries.filter((e) => e.date === date)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(WEDNESDAY)
  resetAllStores()
  useTimeTrackingStore.getState().setWeekStep(30)
  useTimeTrackingStore.getState().setSelectedPen("act-work")
})

afterEach(() => {
  vi.useRealTimers()
})

describe("WeekGrid", () => {
  it("shows the Monday–Sunday week around the date it is given", () => {
    renderWeek()
    expect(screen.getByRole("heading", { name: /Sep 14 – Sep 20/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open Monday, Sep 14" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open Sunday, Sep 20" })).toBeInTheDocument()
  })

  it("totals the week and each day from the shared summary", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(MON, "activity", 540, 660, "act-work") // 2h
    store.paintMinutes(WED, "activity", 540, 600, "act-work") // 1h
    renderWeek()

    expect(screen.getByText(/3h tracked/)).toBeInTheDocument()
    expect(screen.getByText(/2 of 7 days logged/)).toBeInTheDocument()
    // Once as the Work pen, once as the Work tag it carries — both rows read
    // the same summary module the day view uses.
    expect(screen.getAllByText("Work:")).toHaveLength(2)
    expect(screen.getByText(/of tracked/)).toBeInTheDocument()
    const tagStrip = document.querySelector(".trk-tag-strip")
    expect(tagStrip).toHaveTextContent("of tagged minutes, all views")
    expect(tagStrip?.querySelector(".trk-ribbon-swatch")).toBeTruthy()
  })

  it("paints a dragged stroke as one block on the day it started", () => {
    renderWeek()
    fireEvent.mouseDown(cell(TUE, 540))
    fireEvent.mouseOver(cell(TUE, 600))
    fireEvent.mouseUp(window)

    const painted = entriesFor(TUE)
    expect(painted).toHaveLength(1)
    expect(painted[0]).toMatchObject({ startMin: 540, endMin: 630, penId: "act-work" })
  })

  it("refuses to spread one stroke across columns", () => {
    renderWeek()
    fireEvent.mouseDown(cell(TUE, 540))
    // Dragging sideways would mean "and also on Wednesday", which no one means.
    fireEvent.mouseOver(cell(WED, 600))
    fireEvent.mouseUp(window)

    expect(entriesFor(TUE)).toHaveLength(1)
    expect(entriesFor(WED)).toHaveLength(0)
  })

  it("fills a typed range across every ticked day at once", () => {
    renderWeek()
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "09:00" } })
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "17:00" } })
    fireEvent.click(screen.getByRole("button", { name: "Mon–Fri" }))
    // The word "days" is one token, not "day" + "s" — that split wrapped as
    // "Fill 5 day s with Work" in the live week view.
    expect(screen.getByRole("button", { name: "Fill 5 days with Work" })).toHaveTextContent(/^Fill 5 days with Work$/)
    fireEvent.click(screen.getByRole("button", { name: "Fill 5 days with Work" }))

    for (const day of [MON, TUE, WED, FRI]) {
      expect(entriesFor(day)).toMatchObject([{ startMin: 540, endMin: 1020, penId: "act-work" }])
    }
    expect(entriesFor(SUN)).toHaveLength(0)

    undoLastAction()
    for (const day of [MON, TUE, WED, FRI]) {
      expect(entriesFor(day)).toHaveLength(0)
    }
  })

  it("defaults the fill to the day you are looking at, not the whole week", () => {
    renderWeek()
    fireEvent.click(screen.getByRole("button", { name: /^Fill 1 day with Work$/ }))
    expect(entriesFor(WED)).toHaveLength(1)
    expect(entriesFor(MON)).toHaveLength(0)
  })

  it("opens the block editor when a painted cell is clicked, even with another pen in hand", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(TUE, "activity", 540, 600, "act-work")
    store.setSelectedPen("act-rest")
    renderWeek()
    fireEvent.mouseDown(cell(TUE, 540))
    fireEvent.mouseUp(window)

    expect(screen.getByRole("dialog")).toHaveTextContent("Work")
    expect(screen.getByLabelText("Start")).toHaveValue("09:00")
    expect(entriesFor(TUE)).toMatchObject([{ startMin: 540, endMin: 600, penId: "act-work" }])
  })

  it("opens a block that fills the cell but starts after the cell's first minute", () => {
    const store = useTimeTrackingStore.getState()
    // 9:10–9:40 sits inside the 9:00 half-hour cell. The cell is painted; minute 9:00 is empty.
    store.paintMinutes(TUE, "activity", 550, 580, "act-work")
    store.setSelectedPen("act-rest")
    renderWeek()
    fireEvent.mouseDown(cell(TUE, 540))
    fireEvent.mouseUp(window)

    expect(screen.getByRole("dialog")).toHaveTextContent("Work")
    expect(screen.getByLabelText("Start")).toHaveValue("09:10")
    expect(entriesFor(TUE)).toMatchObject([{ startMin: 550, endMin: 580, penId: "act-work" }])
  })

  it("paints an empty cell with the active pen", () => {
    renderWeek()
    fireEvent.mouseDown(cell(TUE, 540))
    fireEvent.mouseUp(window)
    expect(entriesFor(TUE)).toMatchObject([{ startMin: 540, endMin: 570, penId: "act-work" }])
  })

  it("keeps a click that slips one row from painting over the block", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(TUE, "activity", 540, 600, "act-work")
    store.setSelectedPen("act-rest")
    renderWeek()
    fireEvent.mouseDown(cell(TUE, 540), { clientY: 100 })
    fireEvent.mouseOver(cell(TUE, 570), { clientY: 103 })
    fireEvent.mouseUp(window)

    expect(screen.getByRole("dialog")).toHaveTextContent("Work")
    expect(entriesFor(TUE)).toMatchObject([{ startMin: 540, endMin: 600, penId: "act-work" }])
  })

  it("paints a one-cell drag once the pointer actually travels", () => {
    renderWeek()
    fireEvent.mouseDown(cell(TUE, 540), { clientY: 100 })
    fireEvent.mouseOver(cell(TUE, 570), { clientY: 120 })
    fireEvent.mouseUp(window)
    expect(entriesFor(TUE)).toMatchObject([{ startMin: 540, endMin: 600, penId: "act-work" }])
  })

  it("hands one day back to the day view when its heading is clicked", () => {
    const { onOpenDay } = renderWeek()
    fireEvent.click(screen.getByRole("button", { name: "Open Friday, Sep 18" }))
    expect(onOpenDay.mock.calls[0][0]).toBeInstanceOf(Date)
    expect(onOpenDay.mock.calls[0][0].getDate()).toBe(18)
  })

  it("does not offer Clear day", () => {
    useTimeTrackingStore.getState().paintMinutes(TUE, "activity", 540, 600, "act-work")
    renderWeek()
    expect(screen.queryByRole("button", { name: /^Clear/ })).not.toBeInTheDocument()
    expect(entriesFor(TUE)).toHaveLength(1)
  })

  it("keeps week division at 15, 30, and 60 minutes", () => {
    renderWeek()
    const group = screen.getByRole("group", { name: "Week cell size" })
    expect(group).toHaveTextContent("15m")
    expect(group).toHaveTextContent("30m")
    expect(group).toHaveTextContent("60m")
    expect(screen.queryByRole("button", { name: "1m" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "5m" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "10m" })).not.toBeInTheDocument()
  })

  it("labels the first cell of a merged run once", () => {
    useTimeTrackingStore.getState().paintMinutes(TUE, "activity", 540, 660, "act-work", undefined, undefined, undefined, {
      title: "Deep work",
    })
    renderWeek()

    const labels = document.querySelectorAll(".trk-block-label")
    expect(labels).toHaveLength(1)
    expect(labels[0]).toHaveTextContent("Deep work")
    expect(labels[0].closest("[data-day]")?.getAttribute("data-day")).toBe(TUE)
    expect(labels[0].closest("[data-minute]")?.getAttribute("data-minute")).toBe("540")
    expect(cell(TUE, 570).querySelector(".trk-block-label")).toBeNull()
    expect(cell(TUE, 630).querySelector(".trk-block-label")).toBeNull()
  })

  it("falls back to the pen name when the block has no display name", () => {
    useTimeTrackingStore.getState().paintMinutes(TUE, "activity", 540, 600, "act-work")
    renderWeek()
    expect(document.querySelector(".trk-block-label")).toHaveTextContent("Work")
  })

  it("opens the editor from a labeled block and does not paint over it", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(TUE, "activity", 540, 660, "act-work", undefined, undefined, undefined, { title: "Deep work" })
    store.setSelectedPen("act-rest")
    renderWeek()

    const label = document.querySelector(".trk-block-label")
    expect(label).toBeTruthy()
    fireEvent.mouseDown(label!)
    fireEvent.mouseUp(window)

    expect(screen.getByRole("dialog")).toHaveTextContent("Deep work")
    expect(entriesFor(TUE)).toMatchObject([{ startMin: 540, endMin: 660, penId: "act-work", title: "Deep work" }])
  })

  it("fades hairlines after now on today's column only", () => {
    renderWeek()
    expect(cell(WED, 750).className).toContain("trk-future")
    expect(cell(WED, 720).className).not.toContain("trk-future")
    expect(cell(WED, 540).className).not.toContain("trk-future")
    expect(cell(TUE, 750).className).not.toContain("trk-future")
    expect(cell(MON, 900).className).not.toContain("trk-future")
  })

  it("steps a week at a time", () => {
    const { onDateChange } = renderWeek()
    fireEvent.click(screen.getByRole("button", { name: "Next week" }))
    expect(onDateChange.mock.calls[0][0].getDate()).toBe(21)
  })

  it("looks up sunrise for the column's date, not only today", () => {
    renderWeek()
    const mon = document.querySelector('[data-day="2026-09-14"] .trk-marker-sunrise .trk-marker-label')
    const sunday = document.querySelector('[data-day="2026-09-20"] .trk-marker-sunrise .trk-marker-label')
    expect(mon?.textContent).toMatch(/Sunrise/)
    expect(sunday?.textContent).toMatch(/Sunrise/)
    expect(mon?.closest("[data-day]")?.getAttribute("data-day")).toBe("2026-09-14")
    expect(sunday?.closest("[data-day]")?.getAttribute("data-day")).toBe("2026-09-20")
  })
})

/**
 * jsdom leaves clientHeight and scrollTop at 0, which mounts the whole day.
 * A real box is what makes the row window visible to the test.
 */
function scrollBox(grid: HTMLElement, clientHeight: number) {
  let top = 0
  Object.defineProperty(grid, "clientHeight", { configurable: true, get: () => clientHeight })
  Object.defineProperty(grid, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = value
    },
  })
  return (scrollTop: number) => {
    top = scrollTop
    fireEvent.scroll(grid)
  }
}

function mountedWeekRows(grid: HTMLElement) {
  return grid.querySelectorAll(".trk-hour-row")
}

describe("week row window", () => {
  it("mounts the visible 30m rows plus overscan, not all 48", () => {
    useTimeTrackingStore.getState().paintMinutes(TUE, "activity", 900, 930, "act-work")
    renderWeek()
    const grid = document.querySelector(".trk-week-plot") as HTMLElement
    const scrollTo = scrollBox(grid, 126)
    const rowHeight = 14
    const rowCount = 48

    scrollTo(0)
    const top = weekRowBand(0, 126, rowHeight, rowCount)
    const topRows = mountedWeekRows(grid)
    expect(top.end - top.start).toBeLessThan(rowCount)
    expect(topRows.length).toBe(top.end - top.start)
    expect(grid.querySelectorAll("[data-minute]").length).toBe(topRows.length * 7)
    expect(grid.querySelectorAll("[data-minute]").length).toBeLessThan(rowCount * 7)
    expect(cell(TUE, 0)).toBeTruthy()
    expect(cell(TUE, 900)).toBeNull()

    const spacerHeight = [...grid.querySelectorAll<HTMLElement>("[data-week-spacer]")].reduce(
      (sum, el) => sum + Number.parseFloat(el.style.height || "0"),
      0,
    )
    expect(spacerHeight + topRows.length * rowHeight).toBe(rowCount * rowHeight)

    fireEvent.mouseDown(cell(TUE, 0), { clientY: 100 })
    expect(document.activeElement).toBe(grid)
    fireEvent.mouseOver(cell(TUE, 30), { clientY: 120 })
    fireEvent.mouseUp(window)
    expect(entriesFor(TUE).some((entry) => entry.startMin === 0 && entry.endMin === 60)).toBe(true)

    const rowOfNoon = 720 / 30
    scrollTo(rowOfNoon * rowHeight)
    const mid = weekRowBand(rowOfNoon * rowHeight, 126, rowHeight, rowCount)
    expect(mountedWeekRows(grid).length).toBe(mid.end - mid.start)
    expect(mountedWeekRows(grid).length).toBeLessThan(rowCount)
    expect(cell(TUE, 0)).toBeNull()
    expect(cell(WED, 750).className).toContain("trk-future")
    expect(cell(WED, 720).className).not.toContain("trk-future")

    fireEvent.mouseDown(cell(TUE, 900))
    fireEvent.mouseUp(window)
    expect(screen.getByRole("dialog")).toHaveTextContent("Work")
    expect(screen.getByLabelText("Start")).toHaveValue("15:00")
    expect(entriesFor(TUE).some((entry) => entry.startMin === 900 && entry.endMin === 930)).toBe(true)
  })

  it("mounts the visible 15m rows plus overscan, not all 96", () => {
    useTimeTrackingStore.getState().setWeekStep(15)
    renderWeek()
    const grid = document.querySelector(".trk-week-plot") as HTMLElement
    const scrollTo = scrollBox(grid, 126)
    const rowHeight = 9
    const rowCount = 96

    scrollTo(0)
    const band = weekRowBand(0, 126, rowHeight, rowCount)
    const rows = mountedWeekRows(grid)
    expect(band.end - band.start).toBeLessThan(rowCount)
    expect(rows.length).toBe(band.end - band.start)
    expect(grid.querySelectorAll("[data-minute]").length).toBe(rows.length * 7)
    expect(grid.querySelectorAll("[data-minute]").length).toBeLessThan(rowCount * 7)
    expect(cell(TUE, 0)).toBeTruthy()
    expect(cell(TUE, 900)).toBeNull()

    scrollTo((900 / 15) * rowHeight)
    expect(cell(TUE, 900)).toBeTruthy()
    expect(cell(TUE, 0)).toBeNull()
    expect(mountedWeekRows(grid).length).toBeLessThan(rowCount)

    fireEvent.mouseDown(cell(TUE, 900), { clientY: 100 })
    fireEvent.mouseUp(window)
    expect(entriesFor(TUE)).toMatchObject([{ startMin: 900, endMin: 915, penId: "act-work" }])
  })
})

describe("week discrete events", () => {
  it("draws a tick for an instant and opens it", () => {
    useTimeTrackingStore.getState().paintMinutes(WED, "activity", 9 * 60 + 7, 9 * 60 + 7, "act-work", undefined, undefined, undefined, {
      kind: "instant",
      title: "sunrise",
    })
    renderWeek()
    const tick = screen.getByRole("button", { name: /sunrise/ })
    expect(tick.className).toContain("trk-instant")
    fireEvent.click(tick)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })
})

describe("the Day/Week switch", () => {
  it("starts on the day view and remembers the choice in the store", () => {
    render(<TimeGrid />)
    expect(screen.getByRole("button", { name: "Clear day" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "week" }))
    expect(useTimeTrackingStore.getState().gridSpan).toBe("week")
    expect(screen.getByText(/of the week/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Clear day" })).not.toBeInTheDocument()
  })

  it("keeps the same pen selected across the switch", () => {
    useTimeTrackingStore.setState({ gridSpan: "week" })
    render(<TimeGrid />)
    // The palette is shared, so the pen picked in either view is the one the
    // other paints with — the week's fill button names it.
    expect(screen.getByRole("button", { name: /^Fill 1 day with Work$/ })).toBeInTheDocument()
  })

  it("lands on the day you opened from the week", () => {
    useTimeTrackingStore.setState({ gridSpan: "week" })
    render(<TimeGrid />)
    fireEvent.click(screen.getByRole("button", { name: "Open Monday, Sep 14" }))

    expect(useTimeTrackingStore.getState().gridSpan).toBe("day")
    expect(screen.getByRole("heading", { name: /Monday, September 14/ })).toBeInTheDocument()
  })
})
