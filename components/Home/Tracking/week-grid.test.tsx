import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { undoLastAction } from "@/lib/action-history"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TimeGrid } from "./time-grid"
import { WeekGrid } from "./week-grid"

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
  useTimeTrackingStore.getState().setSelectedPen("act-work")
})

afterEach(() => {
  vi.useRealTimers()
})

describe("WeekGrid", () => {
  it("shows the Monday–Sunday week around the date it is given", () => {
    renderWeek()
    expect(screen.getByText("Sep 14 – Sep 20")).toBeInTheDocument()
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

  it("opens the block editor when a painted cell is clicked", () => {
    useTimeTrackingStore.getState().paintMinutes(TUE, "activity", 540, 600, "act-work")
    renderWeek()
    fireEvent.mouseDown(cell(TUE, 540))
    fireEvent.mouseUp(window)

    expect(screen.getByRole("dialog")).toHaveTextContent("Work")
    expect(screen.getByLabelText("Start")).toHaveValue("09:00")
  })

  it("hands one day back to the day view when its heading is clicked", () => {
    const { onOpenDay } = renderWeek()
    fireEvent.click(screen.getByRole("button", { name: "Open Friday, Sep 18" }))
    expect(onOpenDay.mock.calls[0][0]).toBeInstanceOf(Date)
    expect(onOpenDay.mock.calls[0][0].getDate()).toBe(18)
  })

  it("clears a single day from its footer chip", () => {
    useTimeTrackingStore.getState().paintMinutes(TUE, "activity", 540, 600, "act-work")
    renderWeek()
    fireEvent.click(screen.getByRole("button", { name: "Clear Tuesday" }))
    expect(entriesFor(TUE)).toHaveLength(0)
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
    expect(screen.getByText(/Monday, Sep 14/)).toBeInTheDocument()
  })
})
