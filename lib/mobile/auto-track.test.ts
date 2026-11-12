/**
 * lib/mobile/auto-track.test.ts — The sync window, the switches, and the status line
 */
import { beforeEach, describe, expect, it } from "vitest"
import {
  AUTO_TRACK_FIRST_DAYS,
  DEFAULT_AUTO_TRACK,
  autoTrackLine,
  autoTrackMergeOptions,
  autoTrackSince,
  getAutoTrack,
  resetAutoTrackForTests,
  runAutoTrack,
  setAutoTrack,
} from "./auto-track"

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 2, 10, 14, 30).getTime()

beforeEach(() => resetAutoTrackForTests())

describe("autoTrackSince", () => {
  it("starts a week back the first time, at local midnight", () => {
    const since = autoTrackSince(undefined, NOW)
    expect(since).toBe(new Date(2026, 2, 10 - AUTO_TRACK_FIRST_DAYS).getTime())
  })

  it("re-reads two days before the last run", () => {
    expect(autoTrackSince(NOW - 3 * 60 * 60 * 1000, NOW)).toBe(new Date(2026, 2, 8).getTime())
  })

  it("treats a cursor from the future as no cursor", () => {
    expect(autoTrackSince(NOW + DAY, NOW)).toBe(new Date(2026, 2, 3).getTime())
  })
})

describe("switches", () => {
  it("default on, and remembers a change", () => {
    expect(getAutoTrack()).toEqual(DEFAULT_AUTO_TRACK)
    setAutoTrack({ walks: false, walkMinMinutes: 15 })
    expect(JSON.parse(window.localStorage.getItem("brain2-auto-track")!)).toMatchObject({ walks: false, walkMinMinutes: 15 })
    expect(autoTrackMergeOptions(getAutoTrack(), NOW)).toEqual({ walks: false, places: true })
    setAutoTrack({ walks: true })
    expect(autoTrackMergeOptions(getAutoTrack(), NOW)).toEqual({ walks: { minMinutes: 15, nowMs: NOW }, places: true })
  })

  it("does nothing off the phone", async () => {
    expect(await runAutoTrack({ force: true })).toBeNull()
  })
})

describe("autoTrackLine", () => {
  it("names what the last run added", () => {
    const line = autoTrackLine(
      { ...DEFAULT_AUTO_TRACK, last: { at: NOW - 3 * 60000, written: { days: 1, nights: 0, workouts: 1, walks: 2 }, placed: 0 } },
      NOW,
    )
    expect(line).toBe("Synced 3 min ago. Added 2 walks, 1 workout.")
  })

  it("says nothing new, off, and why a run fell short", () => {
    const quiet = { at: NOW, written: { days: 0, nights: 0, workouts: 0 }, placed: 0 }
    expect(autoTrackLine({ ...DEFAULT_AUTO_TRACK, last: quiet }, NOW)).toBe("Synced just now. Nothing new.")
    expect(autoTrackLine({ ...DEFAULT_AUTO_TRACK, on: false }, NOW)).toMatch(/^Off/)
    expect(autoTrackLine({ ...DEFAULT_AUTO_TRACK, last: { ...quiet, note: "Health access is off." } }, NOW)).toBe(
      "Synced just now. Health access is off.",
    )
  })
})
