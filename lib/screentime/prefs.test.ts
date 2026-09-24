import { beforeEach, describe, expect, it } from "vitest"
import { persistKey } from "@/lib/storage-keys"
import { resetLocalStorage } from "@/tests/test-utils"
import {
  DEFAULT_SCREENTIME_PREFS,
  SCREENTIME_PREFS_KEY,
  loadScreenTimePrefs,
  saveScreenTimePrefs,
} from "./prefs"

describe("screen time prefs", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("uses the brain2-screentime-prefs persist key", () => {
    expect(SCREENTIME_PREFS_KEY).toBe("brain2-screentime-prefs")
    expect(persistKey("screentime-prefs")).toBe("brain2-screentime-prefs")
  })

  it("loads factory defaults", () => {
    expect(loadScreenTimePrefs()).toEqual(DEFAULT_SCREENTIME_PREFS)
    expect(DEFAULT_SCREENTIME_PREFS).toMatchObject({
      url: "http://127.0.0.1:5600",
      lookbackDays: 14,
      minDurationSec: 15,
      storeWindowTitles: false,
      includeWebWatcher: true,
    })
  })

  it("writes both persist aliases and keeps a non-loopback url from landing", () => {
    const saved = saveScreenTimePrefs({ lookbackDays: 7, url: "http://evil.example:5600" })
    expect(saved.url).toBe("http://127.0.0.1:5600")
    expect(saved.lookbackDays).toBe(7)
    expect(localStorage.getItem("brain2-screentime-prefs")).toMatch(/lookbackDays/)
    expect(localStorage.getItem("cogs-screentime-prefs")).toMatch(/lookbackDays/)
  })

  it("accepts a loopback url", () => {
    expect(saveScreenTimePrefs({ url: "http://localhost:5600/" }).url).toBe("http://localhost:5600")
  })

  it("persists an honest last-sync note", () => {
    const note = "ActivityWatch is reachable but has no recorded windows yet."
    expect(saveScreenTimePrefs({ lastSyncNote: note }).lastSyncNote).toBe(note)
    expect(loadScreenTimePrefs().lastSyncNote).toBe(note)
  })
})
