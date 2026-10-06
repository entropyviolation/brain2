import { beforeEach, describe, expect, it } from "vitest"
import { persistKey } from "@/lib/storage-keys"
import { DEFAULT_PEN_TRAY } from "./pen-tray-bg"
import {
  DEFAULT_TRACKING_VIEW_PREFS,
  getTrackingViewPrefs,
  resetTrackingViewPrefs,
  resolveSuperimposeScopeId,
  setScopeSuperimpose,
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

  it("remembers superimpose per view and leaves the other views alone", () => {
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({})
    setScopeSuperimpose("activity", "location")
    setScopeSuperimpose("company", "mood")
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({ activity: "location", company: "mood" })
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}").superimposeByScope).toEqual({
      activity: "location",
      company: "mood",
    })

    setTrackingViewPrefs({ fillFrom: "07:00" })
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({ activity: "location", company: "mood" })

    setScopeSuperimpose("activity", null)
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({ company: "mood" })

    const ids = ["activity", "location", "mood", "company"]
    const prefs = getTrackingViewPrefs()
    expect(resolveSuperimposeScopeId("activity", ids, prefs)).toBeNull()
    expect(resolveSuperimposeScopeId("company", ids, prefs)).toBe("mood")
    expect(resolveSuperimposeScopeId("location", ids, { superimposeByScope: { activity: "location" } })).toBeNull()
    expect(resolveSuperimposeScopeId("activity", ids, { superimposeByScope: {} })).toBeNull()
    expect(resolveSuperimposeScopeId("activity", ["activity"], { superimposeByScope: { activity: "location" } })).toBeNull()
    expect(resolveSuperimposeScopeId("activity", ids, { superimposeByScope: { activity: "activity" } })).toBeNull()
    expect(resolveSuperimposeScopeId("activity", ids, { superimposeByScope: { activity: "gone" } })).toBeNull()
  })

  it("drops a self-overlay without clearing the other views", () => {
    setTrackingViewPrefs({
      superimposeByScope: { activity: "location", location: "location", company: "mood" },
    })
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({ activity: "location", company: "mood" })
    setScopeSuperimpose("activity", "activity")
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({ company: "mood" })
  })

  it("treats an older blob without the per-view map as all-off", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ fillFrom: "08:00", fillTo: "09:30", superimpose: true, superimposeScopeId: "location" }),
    )
    resetTrackingViewPrefs()
    expect(getTrackingViewPrefs().superimposeByScope).toEqual({})
    expect(getTrackingViewPrefs().fillFrom).toBe("08:00")
    expect(resolveSuperimposeScopeId("activity", ["activity", "location"], getTrackingViewPrefs())).toBeNull()

    setScopeSuperimpose("activity", "mood")
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as {
      superimpose?: boolean
      superimposeScopeId?: string
      superimposeByScope?: Record<string, string>
    }
    expect(stored.superimposeByScope).toEqual({ activity: "mood" })
    expect(stored.superimpose).toBeUndefined()
    expect(stored.superimposeScopeId).toBeUndefined()
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
