import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { parseAppendLog } from "@/lib/append-log"
import { DAY_NOTES_PERSIST_KEY, getDayNoteEntries, resetDayNotesPersist, setDayNotePersist } from "@/lib/day-notes-persist"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TrackingDayNotes } from "./tracking-day-notes"
import { getTrackingViewPrefs, resetTrackingViewPrefs, setTrackingViewPrefs } from "./tracking-view-prefs"

function at(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0)
}

describe("TrackingDayNotes", () => {
  const day = new Date("2026-06-20T12:00:00")
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

  it("collapsed shows only the Day notes legend and Expand", () => {
    setDayNotePersist(key, "ate something at 1pm")
    const { container } = render(<TrackingDayNotes currentDate={day} />)
    const well = container.querySelector("#trk-day-notes")
    expect(well).toHaveClass("trk-notes")
    expect(well).not.toHaveClass("trk-notes-open")
    expect(screen.getByText("Day notes")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Expand" })).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(container.querySelector(".append-log-history")).toBeNull()
    expect(well?.querySelector(".hab-view-changer")).toBeNull()
    expect(screen.queryByText("ate something at 1pm")).not.toBeInTheDocument()
  })

  it("submits a stamped note against the local calendar day", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setTrackingViewPrefs({ notesWellExpanded: true })
    render(<TrackingDayNotes currentDate={day} />)

    await user.type(
      screen.getByRole("textbox", { name: /Notes for Saturday, Jun 20/ }),
      "went to the zoo from 4-5",
    )
    expect(getDayNoteEntries(key)).toHaveLength(0)
    await user.click(screen.getByRole("button", { name: /Submit note/i }))

    expect(getDayNoteEntries(key)[0]?.text).toBe("went to the zoo from 4-5")
    expect(parseAppendLog(useTimeTrackingStore.getState().dayNotes[key])[0]?.text).toBe("went to the zoo from 4-5")
    expect(screen.getByText("went to the zoo from 4-5")).toBeInTheDocument()
    expect(screen.getByRole("listitem")).toHaveTextContent("6/20 4pm")
  })

  it("shows notes already stored for that day as a frozen earlier entry", () => {
    setTrackingViewPrefs({ notesWellExpanded: true })
    useTimeTrackingStore.getState().setDayNotes(key, "ate something at 1pm")
    render(<TrackingDayNotes currentDate={day} />)
    expect(screen.getByText("ate something at 1pm")).toBeInTheDocument()
    expect(screen.queryByDisplayValue("ate something at 1pm")).not.toBeInTheDocument()
  })

  it("appends a stamped note onto a leftover plaintext jot", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setTrackingViewPrefs({ notesWellExpanded: true })
    setDayNotePersist(key, "ate something at 1pm")
    render(<TrackingDayNotes currentDate={day} />)
    await user.type(screen.getByRole("textbox", { name: /Notes for Saturday, Jun 20/ }), "zoo 4-5")
    await user.click(screen.getByRole("button", { name: /Submit note/i }))
    expect(getDayNoteEntries(key).map((e) => e.text)).toEqual(["ate something at 1pm", "zoo 4-5"])
    expect(screen.getByText("ate something at 1pm")).toBeInTheDocument()
    expect(screen.getByText("zoo 4-5")).toBeInTheDocument()
    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("6/20 4pm")
    expect(items[0]).toHaveTextContent("zoo 4-5")
    expect(items[1]).toHaveTextContent("earlier")
    expect(items[1]).toHaveTextContent("ate something at 1pm")
  })

  it("round-trips through the persist blob so a reload still shows the jot", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setTrackingViewPrefs({ notesWellExpanded: true })
    const { unmount } = render(<TrackingDayNotes currentDate={day} />)
    await user.type(
      screen.getByRole("textbox", { name: /Notes for Saturday, Jun 20/ }),
      "went to the zoo from 4-5",
    )
    await user.click(screen.getByRole("button", { name: /Submit note/i }))
    expect(JSON.parse(localStorage.getItem("cogs-timegrid-store") ?? "{}").state?.dayNotes?.[key]).not.toBe(
      "went to the zoo from 4-5",
    )
    expect(parseAppendLog(JSON.parse(localStorage.getItem(DAY_NOTES_PERSIST_KEY) ?? "{}")[key])[0]?.text).toBe(
      "went to the zoo from 4-5",
    )
    unmount()
    await useTimeTrackingStore.persist.rehydrate()
    setTrackingViewPrefs({ notesWellExpanded: true })
    render(<TrackingDayNotes currentDate={day} />)
    expect(screen.getByText("went to the zoo from 4-5")).toBeInTheDocument()
  })

  it("still shows the jot after a hub-style wipe of timegrid dayNotes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setTrackingViewPrefs({ notesWellExpanded: true })
    const { unmount } = render(<TrackingDayNotes currentDate={day} />)
    await user.type(
      screen.getByRole("textbox", { name: /Notes for Saturday, Jun 20/ }),
      "river otter pup notes 2026-09-21 — stayed after refresh",
    )
    await user.click(screen.getByRole("button", { name: /Submit note/i }))
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
    expect(screen.getByText("river otter pup notes 2026-09-21 — stayed after refresh")).toBeInTheDocument()
    expect(getDayNoteEntries(key)[0]?.text).toBe("river otter pup notes 2026-09-21 — stayed after refresh")
  })

  it("reads a dedicated-key jot even when the timegrid store was never written", () => {
    setTrackingViewPrefs({ notesWellExpanded: true })
    setDayNotePersist(key, "only in the small notes vault")
    useTimeTrackingStore.setState({ dayNotes: {} })
    render(<TrackingDayNotes currentDate={day} />)
    expect(screen.getByText("only in the small notes vault")).toBeInTheDocument()
  })

  it("says so when a full origin kept the note out of storage", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setTrackingViewPrefs({ notesWellExpanded: true })
    render(<TrackingDayNotes currentDate={day} />)
    const real = Storage.prototype.setItem
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation((k: string, v: string) => {
      if (k.endsWith("tracking-day-notes")) throw new DOMException("full", "QuotaExceededError")
      return real.call(localStorage, k, v)
    })
    try {
      await user.type(screen.getByRole("textbox", { name: /Notes for Saturday, Jun 20/ }), "zoo 4-5")
      await user.click(screen.getByRole("button", { name: /Submit note/i }))
    } finally {
      spy.mockRestore()
    }
    expect(screen.getByRole("alert")).toHaveTextContent(/only in memory/i)
    expect(localStorage.getItem(DAY_NOTES_PERSIST_KEY)).toBeNull()
  })

  it("keeps a stable metal-well wrapper under the chrome stack", () => {
    const { container } = render(<TrackingDayNotes currentDate={day} />)
    const well = container.querySelector("#trk-day-notes")
    expect(well).toHaveClass("trk-notes")
    expect(well?.querySelector(".hab-view-changer")).toBeNull()
    expect(screen.getByText("Day notes")).toBeInTheDocument()
  })

  it("keeps earlier notes readable in a history pane that is not the composer", () => {
    setTrackingViewPrefs({ notesWellExpanded: true })
    setDayNotePersist(key, "ate something at 1pm — leftover jot from reconstructing the afternoon")
    const { container } = render(<TrackingDayNotes currentDate={day} />)
    const well = container.querySelector("#trk-day-notes")
    expect(well).toHaveClass("trk-notes-open")
    const history = container.querySelector(".append-log-history")
    expect(history).toBeTruthy()
    expect(history).toHaveTextContent("earlier")
    expect(history).toHaveTextContent("ate something at 1pm — leftover jot from reconstructing the afternoon")
    expect(history?.querySelector(".append-log-body")).toHaveTextContent(
      "ate something at 1pm — leftover jot from reconstructing the afternoon",
    )
    expect(screen.queryByDisplayValue(/ate something at 1pm/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Collapse" })).toHaveAttribute("aria-expanded", "true")
  })

  it("expands the notes well so history can grow, and persists that", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setDayNotePersist(key, "first jot")
    const { container } = render(<TrackingDayNotes currentDate={day} />)
    const well = container.querySelector("#trk-day-notes")
    expect(well).toHaveClass("trk-notes")
    expect(well).not.toHaveClass("trk-notes-open")
    expect(container.querySelector(".append-log-history")).toBeNull()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Expand" }))
    expect(well).toHaveClass("trk-notes-open")
    expect(getTrackingViewPrefs().notesWellExpanded).toBe(true)
    expect(screen.getByRole("button", { name: "Collapse" })).toHaveAttribute("aria-expanded", "true")
    expect(container.querySelector(".append-log-history")).toHaveTextContent("first jot")
    expect(screen.getByRole("textbox", { name: /Notes for Saturday, Jun 20/ })).toBeInTheDocument()
    expect(well?.querySelector(".hab-view-changer")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Collapse" }))
    expect(well).not.toHaveClass("trk-notes-open")
    expect(getTrackingViewPrefs().notesWellExpanded).toBe(false)
    expect(container.querySelector(".append-log-history")).toBeNull()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("restores an expanded notes well from prefs", () => {
    setTrackingViewPrefs({ notesWellExpanded: true })
    const { container } = render(<TrackingDayNotes currentDate={day} />)
    expect(container.querySelector("#trk-day-notes")).toHaveClass("trk-notes-open")
    expect(screen.getByRole("button", { name: "Collapse" })).toBeInTheDocument()
  })

  it("switches List, Bulk, and Latest without changing stored notes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setTrackingViewPrefs({ notesWellExpanded: true })
    setDayNotePersist(key, "ate something at 1pm")
    render(<TrackingDayNotes currentDate={day} />)
    await user.type(screen.getByRole("textbox", { name: /Notes for Saturday, Jun 20/ }), "zoo 4-5")
    await user.click(screen.getByRole("button", { name: /Submit note/i }))
    expect(screen.getAllByRole("listitem")).toHaveLength(2)

    await user.click(screen.getByRole("tab", { name: "Latest" }))
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    expect(screen.getByText("zoo 4-5")).toBeInTheDocument()
    expect(screen.queryByText("ate something at 1pm")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Bulk" }))
    expect((screen.getByRole("textbox", { name: "All day notes, copy only" }) as HTMLTextAreaElement).value).toContain(
      "zoo 4-5",
    )

    await user.click(screen.getByRole("tab", { name: "List" }))
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(getDayNoteEntries(key).map((e) => e.text)).toEqual(["ate something at 1pm", "zoo 4-5"])
  })
})
