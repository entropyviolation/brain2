import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { serializeAppendLog } from "@/lib/append-log"
import { DAY_NOTES_PERSIST_KEY, getDayNote, resetDayNotesPersist, setDayNotePersist } from "@/lib/day-notes-persist"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TrackingDayNotes } from "./tracking-day-notes"
import { getTrackingViewPrefs, resetTrackingViewPrefs, setTrackingViewPrefs } from "./tracking-view-prefs"

function at(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0)
}

describe("TrackingDayNotes", () => {
  const day = new Date(2026, 5, 20, 12)
  const key = formatLocalDateKey(day)

  beforeEach(() => {
    resetAllStores()
    resetDayNotesPersist()
    localStorage.clear()
    resetTrackingViewPrefs()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(at(2026, 6, 20, 16))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("collapsed shows only the Day summary legend and Expand", () => {
    setDayNotePersist(key, "ate something at 1pm")
    const { container } = render(<TrackingDayNotes currentDate={day} />)
    const well = container.querySelector("#trk-day-notes")
    expect(well).toHaveClass("trk-notes")
    expect(well).not.toHaveClass("trk-notes-open")
    expect(screen.getByText("Day summary")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Expand" })).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByText("ate something at 1pm")).not.toBeInTheDocument()
  })

  it("edits the day summary in place and keeps an old append log as prose", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setTrackingViewPrefs({ notesWellExpanded: true })
    setDayNotePersist(
      key,
      serializeAppendLog([
        { id: "a", createdAt: "2026-06-20T17:00:00.000Z", text: "ate something at 1pm" },
        { id: "b", createdAt: "2026-06-20T20:00:00.000Z", text: "zoo from 4-5" },
      ]),
    )
    render(<TrackingDayNotes currentDate={day} />)
    const field = screen.getByRole("textbox", { name: /Day summary · Sat, Jun 20/ })
    expect(field).toHaveValue("ate something at 1pm\n\nzoo from 4-5")
    await user.type(field, " and home by 7")
    expect(getDayNote(key)).toContain("ate something at 1pm")
    expect(getDayNote(key)).toContain("zoo from 4-5")
    expect(getDayNote(key)).toContain("home by 7")
    expect(useTimeTrackingStore.getState().dayNotes[key]).toContain("home by 7")
  })

  it("round-trips through the persist blob so a reload still shows the summary", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setTrackingViewPrefs({ notesWellExpanded: true })
    const { unmount } = render(<TrackingDayNotes currentDate={day} />)
    await user.type(screen.getByRole("textbox", { name: /Day summary · Sat, Jun 20/ }), "went to the zoo from 4-5")
    expect(JSON.parse(localStorage.getItem(DAY_NOTES_PERSIST_KEY) ?? "{}")[key]).toBe("went to the zoo from 4-5")
    unmount()
    await useTimeTrackingStore.persist.rehydrate()
    setTrackingViewPrefs({ notesWellExpanded: true })
    render(<TrackingDayNotes currentDate={day} />)
    expect(screen.getByRole("textbox", { name: /Day summary · Sat, Jun 20/ })).toHaveValue("went to the zoo from 4-5")
  })

  it("still shows the summary after a hub-style wipe of timegrid dayNotes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setTrackingViewPrefs({ notesWellExpanded: true })
    const { unmount } = render(<TrackingDayNotes currentDate={day} />)
    await user.type(
      screen.getByRole("textbox", { name: /Day summary · Sat, Jun 20/ }),
      "river otter pup notes 2026-09-21 — stayed after refresh",
    )
    unmount()

    const raw = localStorage.getItem("cogs-timegrid-store")
    const parsed = JSON.parse(raw ?? "{}") as { state?: Record<string, unknown>; version?: number }
    localStorage.setItem(
      "cogs-timegrid-store",
      JSON.stringify({ ...parsed, state: { ...(parsed.state ?? {}), dayNotes: {} } }),
    )
    useTimeTrackingStore.setState({ dayNotes: {} })

    await useTimeTrackingStore.persist.rehydrate()
    setTrackingViewPrefs({ notesWellExpanded: true })
    render(<TrackingDayNotes currentDate={day} />)
    expect(screen.getByRole("textbox", { name: /Day summary · Sat, Jun 20/ })).toHaveValue(
      "river otter pup notes 2026-09-21 — stayed after refresh",
    )
  })

  it("says so when a full origin kept the summary out of storage", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setTrackingViewPrefs({ notesWellExpanded: true })
    render(<TrackingDayNotes currentDate={day} />)
    const real = Storage.prototype.setItem
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation((k: string, v: string) => {
      if (k.endsWith("tracking-day-notes")) throw new DOMException("full", "QuotaExceededError")
      return real.call(localStorage, k, v)
    })
    try {
      await user.type(screen.getByRole("textbox", { name: /Day summary · Sat, Jun 20/ }), "zoo 4-5")
    } finally {
      spy.mockRestore()
    }
    expect(screen.getByRole("alert")).toHaveTextContent(/only in memory/i)
    expect(localStorage.getItem(DAY_NOTES_PERSIST_KEY)).toBeNull()
  })

  it("opens week, month, season, and year summaries without showing plan text", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setTrackingViewPrefs({ notesWellExpanded: true })
    localStorage.setItem("weekPlan-2026-06-15_2026-06-21", "ship the plan")
    render(<TrackingDayNotes currentDate={day} />)
    expect(screen.queryByText("ship the plan")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Week" }))
    expect(screen.getByRole("region", { name: /Week summary/ })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Day summary ·/ }).length).toBeGreaterThanOrEqual(7)
    const weekField = screen.getByRole("textbox", { name: /Week summary ·/ })
    await user.type(weekField, "A quiet week at the desk")
    expect(getDayNote("week:2026-06-15_2026-06-21")).toBe("A quiet week at the desk")

    await user.click(screen.getByRole("button", { name: /Day summary · Mon, Jun 15/ }))
    expect(screen.getByRole("textbox", { name: "Day summary · Mon, Jun 15" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Month" }))
    expect(screen.getByRole("region", { name: /Month summary June 2026/ })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Month summary · June 2026" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Season" }))
    expect(screen.getByRole("region", { name: /Season summary Summer 2026/ })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Year" }))
    expect(screen.getByRole("region", { name: "Year summary 2026" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Year summary · 2026" })).toBeInTheDocument()
    expect(screen.queryByDisplayValue("ship the plan")).not.toBeInTheDocument()
  })

  it("expands and collapses the well and remembers that", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = render(<TrackingDayNotes currentDate={day} />)
    const well = container.querySelector("#trk-day-notes")
    await user.click(screen.getByRole("button", { name: "Expand" }))
    expect(well).toHaveClass("trk-notes-open")
    expect(getTrackingViewPrefs().notesWellExpanded).toBe(true)
    expect(screen.getByRole("textbox", { name: /Day summary · Sat, Jun 20/ })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Collapse" }))
    expect(well).not.toHaveClass("trk-notes-open")
    expect(getTrackingViewPrefs().notesWellExpanded).toBe(false)
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })
})
