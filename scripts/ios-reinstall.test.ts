import { describe, expect, it } from "vitest"
import { installAgeDays, isDue, pickDevice, reminderText, shouldRemind } from "./ios-reinstall.mjs"

const NOW = Date.parse("2026-10-22T12:00:00Z")
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString()

describe("ios-reinstall", () => {
  it("is due with no install on record, or once the install is old enough", () => {
    expect(installAgeDays({}, NOW)).toBe(Infinity)
    expect(isDue({}, { now: NOW })).toBe(true)
    expect(isDue({ lastSuccessAt: daysAgo(3.9) }, { now: NOW })).toBe(false)
    expect(isDue({ lastSuccessAt: daysAgo(4) }, { now: NOW })).toBe(true)
    expect(isDue({ lastSuccessAt: daysAgo(1) }, { now: NOW, force: true })).toBe(true)
    expect(isDue({ lastSuccessAt: daysAgo(2) }, { now: NOW, reinstallDays: 2 })).toBe(true)
  })

  it("reminds from day 5, at most every 12 hours", () => {
    expect(shouldRemind({ lastSuccessAt: daysAgo(4.5) }, { now: NOW })).toBe(false)
    expect(shouldRemind({ lastSuccessAt: daysAgo(5) }, { now: NOW })).toBe(true)
    expect(shouldRemind({ lastSuccessAt: daysAgo(6), lastRemindAt: daysAgo(0.25) }, { now: NOW })).toBe(false)
    expect(shouldRemind({ lastSuccessAt: daysAgo(6), lastRemindAt: daysAgo(0.5) }, { now: NOW })).toBe(true)
    expect(shouldRemind({}, { now: NOW })).toBe(true)
  })

  it("says how long the app has left and why the last try failed", () => {
    expect(reminderText({ lastSuccessAt: daysAgo(5.5), lastError: "no iPhone reachable" }, NOW)).toBe(
      "Brain2 iPhone app stops opening in 1 day, and location stops with it. Bring the phone near the Mac on the same Wi-Fi, or plug it in. Last try: no iPhone reachable",
    )
    expect(reminderText({ lastSuccessAt: daysAgo(6.5) }, NOW)).toMatch(/stops opening today/)
    expect(reminderText({}, NOW)).toMatch(/no automatic install has worked yet/)
  })

  it("picks a reachable iPhone, by id or name when asked", () => {
    const json = {
      result: {
        devices: [
          { identifier: "WATCH", hardwareProperties: { platform: "watchOS" }, connectionProperties: { tunnelState: "connected" }, deviceProperties: { name: "Watch" } },
          { identifier: "OLD", hardwareProperties: { platform: "iOS" }, connectionProperties: { tunnelState: "unavailable" }, deviceProperties: { name: "Old" } },
          { identifier: "AAA", hardwareProperties: { platform: "iOS" }, connectionProperties: { tunnelState: "disconnected" }, deviceProperties: { name: "Portal" } },
        ],
      },
    }
    expect(pickDevice(json)).toEqual({ id: "AAA", name: "Portal" })
    expect(pickDevice(json, "portal")).toEqual({ id: "AAA", name: "Portal" })
    expect(pickDevice(json, "Old")).toBeNull()
    expect(pickDevice(null)).toBeNull()
  })
})
