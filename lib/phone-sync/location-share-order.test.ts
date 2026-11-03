import { beforeEach, describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import {
  IOS_LOCATION_QUIET_MS,
  bimLocationUpdateShouldApply,
  iosLocationShareCovers,
  noteIosLocationShare,
  resetIosLocationShareForTests,
  setIosLocationShareUnavailable,
} from "./location-share-order"

const at = (h: number, m = 0, day = 21) => new Date(2026, 9, day, h, m)

function iosInstant(h: number, m = 0): TimeEntry {
  return {
    id: "ps-loc",
    date: "2026-10-21",
    scopeId: "location",
    penId: "pen",
    kind: "instant",
    startMin: h * 60 + m,
    endMin: h * 60 + m,
    title: "arrived",
    generatedBy: { kind: "phone-sync", id: "location:pt:1:45.50000,-122.60000" },
  }
}

function iosVisit(startMin: number, endMin: number): TimeEntry {
  return {
    id: "ps-visit",
    date: "2026-10-21",
    scopeId: "location",
    penId: "pen",
    startMin,
    endMin,
    title: "visit",
    generatedBy: { kind: "phone-sync", id: "location:visit:1:2:45.50,-122.60" },
  }
}

beforeEach(() => {
  resetIosLocationShareForTests()
})

describe("location share order", () => {
  it("lets a BIM update paint when the iOS app has not shared", () => {
    expect(bimLocationUpdateShouldApply(at(15), [])).toBe(true)
  })

  it("keeps BIM quiet inside an iOS visit and for the quiet window after the last phone share", () => {
    const visit = iosVisit(9 * 60, 17 * 60)
    expect(iosLocationShareCovers([visit], at(12))).toBe(true)
    expect(iosLocationShareCovers([iosInstant(9)], at(15))).toBe(true)
    expect(iosLocationShareCovers([iosInstant(9)], at(9 + 13))).toBe(false)
    expect(IOS_LOCATION_QUIET_MS).toBe(12 * 60 * 60 * 1000)
  })

  it("treats a batch noted in this process as the iOS share, before the row is flushed", () => {
    noteIosLocationShare(at(10).getTime())
    expect(bimLocationUpdateShouldApply(at(10, 5), [])).toBe(false)
  })

  it("lets BIM paint when Settings has the iOS location share turned off", () => {
    setIosLocationShareUnavailable(() => true)
    expect(bimLocationUpdateShouldApply(at(10, 5), [iosInstant(10)])).toBe(true)
  })

  it("ignores phone-sync rows that are not location", () => {
    const text: TimeEntry = {
      ...iosInstant(10),
      scopeId: "iphone-texts",
      generatedBy: { kind: "phone-sync", id: "messages:1" },
    }
    expect(bimLocationUpdateShouldApply(at(10, 5), [text])).toBe(true)
  })
})
