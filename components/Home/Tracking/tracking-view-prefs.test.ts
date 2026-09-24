import { beforeEach, describe, expect, it } from "vitest"
import { persistKey } from "@/lib/storage-keys"
import { DEFAULT_PEN_TRAY } from "./pen-tray-bg"
import {
  DEFAULT_TRACKING_VIEW_PREFS,
  getTrackingViewPrefs,
  resetTrackingViewPrefs,
  setTrackingViewPrefs,
  TRACKING_FILL_CLOCK_LABELS,
} from "./tracking-view-prefs"

const KEY = persistKey("tracking-view-prefs")

beforeEach(() => {
  localStorage.clear()
  resetTrackingViewPrefs()
})

describe("tracking view prefs", () => {
  it("defaults the pen tray to Cat traces, not velvet", () => {
    const prefs = getTrackingViewPrefs()
    expect(prefs.penTray).toBe(DEFAULT_PEN_TRAY)
    expect(prefs.penTray).toBe("cat")
    expect(prefs.penTray).not.toBe("velvet")
    expect(DEFAULT_TRACKING_VIEW_PREFS.penTray).toBe("cat")
  })

  it("persists a curated tray pick and ignores junk", () => {
    setTrackingViewPrefs({ penTray: "pewter" })
    expect(getTrackingViewPrefs().penTray).toBe("pewter")
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { penTray?: string }
    expect(stored.penTray).toBe("pewter")

    setTrackingViewPrefs({ penTray: "velvet" as never })
    expect(getTrackingViewPrefs().penTray).toBe("pewter")
  })

  it("keeps fill clocks when loading an older blob without penTray", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ fillFrom: "08:00", fillTo: "09:30", weekFillFrom: "08:00", weekFillTo: "18:00" }),
    )
    resetTrackingViewPrefs()
    const prefs = getTrackingViewPrefs()
    expect(prefs.fillFrom).toBe("08:00")
    expect(prefs.fillTo).toBe("09:30")
    expect(prefs.weekFillTo).toBe("18:00")
    expect(prefs.penTray).toBe(DEFAULT_PEN_TRAY)
  })

  it("still writes fill range without clobbering the tray", () => {
    setTrackingViewPrefs({ penTray: "bloom" })
    setTrackingViewPrefs({ fillFrom: "07:15" })
    expect(getTrackingViewPrefs()).toMatchObject({ fillFrom: "07:15", penTray: "bloom" })
  })

  it("defaults the bead well to one line and persists Expand", () => {
    expect(getTrackingViewPrefs().penWellExpanded).toBe(false)
    expect(DEFAULT_TRACKING_VIEW_PREFS.penWellExpanded).toBe(false)

    setTrackingViewPrefs({ penWellExpanded: true })
    expect(getTrackingViewPrefs().penWellExpanded).toBe(true)
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { penWellExpanded?: boolean }
    expect(stored.penWellExpanded).toBe(true)

    setTrackingViewPrefs({ fillFrom: "07:00" })
    expect(getTrackingViewPrefs()).toMatchObject({ fillFrom: "07:00", penWellExpanded: true })
  })

  it("defaults the day-notes well to compact and persists Expand", () => {
    expect(getTrackingViewPrefs().notesWellExpanded).toBe(false)
    expect(DEFAULT_TRACKING_VIEW_PREFS.notesWellExpanded).toBe(false)

    setTrackingViewPrefs({ notesWellExpanded: true })
    expect(getTrackingViewPrefs().notesWellExpanded).toBe(true)
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { notesWellExpanded?: boolean }
    expect(stored.notesWellExpanded).toBe(true)

    setTrackingViewPrefs({ fillFrom: "07:00" })
    expect(getTrackingViewPrefs()).toMatchObject({ fillFrom: "07:00", notesWellExpanded: true })
  })

  it("treats a missing notesWellExpanded on an older blob as collapsed", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ fillFrom: "08:00", fillTo: "09:30", weekFillFrom: "08:00", weekFillTo: "18:00", penTray: "fr4" }),
    )
    resetTrackingViewPrefs()
    expect(getTrackingViewPrefs().notesWellExpanded).toBe(false)
    expect(getTrackingViewPrefs().penTray).toBe("fr4")
  })

  it("treats a missing penWellExpanded on an older blob as collapsed", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ fillFrom: "08:00", fillTo: "09:30", weekFillFrom: "08:00", weekFillTo: "18:00", penTray: "fr4" }),
    )
    resetTrackingViewPrefs()
    expect(getTrackingViewPrefs().penWellExpanded).toBe(false)
    expect(getTrackingViewPrefs().penTray).toBe("fr4")
  })

  it("keeps Fill clock labels honest about hours, not dates", () => {
    expect(TRACKING_FILL_CLOCK_LABELS).toEqual({
      fillFrom: "Day fill starts",
      fillTo: "Day fill ends",
      weekFillFrom: "Week fill starts",
      weekFillTo: "Week fill ends",
    })
  })
})
