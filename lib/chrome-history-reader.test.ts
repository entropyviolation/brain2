import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { chromeTimeToMs, inboxFileName, listChromeProfiles, syncChromeHistory } from "./chrome-history-reader"
import { safeHistoryId } from "../scripts/chrome-history-api.mjs"

const toChrome = (ms: number) => (ms - Date.UTC(1601, 0, 1)) * 1000

function makeHistory(file: string, visits: { url: string; title: string; ms: number; transition?: number }[]) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite")
  const db = new DatabaseSync(file)
  db.exec("CREATE TABLE IF NOT EXISTS urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT)")
  db.exec("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY, url INTEGER, visit_time INTEGER, transition INTEGER)")
  for (const v of visits) {
    const { lastInsertRowid } = db.prepare("INSERT INTO urls (url, title) VALUES (?, ?)").run(v.url, v.title)
    db.prepare("INSERT INTO visits (url, visit_time, transition) VALUES (?, ?, ?)").run(lastInsertRowid, toChrome(v.ms), v.transition ?? 0x30000000)
  }
  db.close()
}

let root = ""
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-reader-"))
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe("chrome-history-reader", () => {
  it("converts Chrome time to Unix ms", () => {
    expect(chromeTimeToMs(toChrome(1_700_000_000_123))).toBe(1_700_000_000_123)
  })

  it("names inbox files the way the inbox API does", () => {
    expect(inboxFileName("2026-10-31", "Ada/Work")).toBe(safeHistoryId("2026-10-31", "Ada/Work"))
  })

  it("lists profiles by their Chrome names", () => {
    const dir = path.join(root, "Chrome")
    makeHistory(path.join(dir, "Default", "History"), [])
    makeHistory(path.join(dir, "Profile 4", "History"), [])
    fs.mkdirSync(path.join(dir, "System Profile"), { recursive: true })
    fs.writeFileSync(path.join(dir, "Local State"), JSON.stringify({ profile: { info_cache: { "Profile 4": { name: "Ada" } } } }))
    expect(listChromeProfiles(dir).map((p) => p.name).sort()).toEqual(["Ada", "Default"])
  })

  it("writes new visits by day, skips frames, and reads only what is new", () => {
    const dir = path.join(root, "Chrome")
    const inboxDir = path.join(root, "inbox")
    const stateDir = path.join(root, "state")
    const day1 = new Date(2026, 9, 30, 10).getTime()
    const day2 = new Date(2026, 9, 31, 9).getTime()
    const history = path.join(dir, "Default", "History")
    makeHistory(history, [
      { url: "https://a.test/", title: "A", ms: day1 },
      { url: "https://frame.test/", title: "F", ms: day1 + 1, transition: 3 },
      { url: "https://b.test/", title: "B", ms: day2, transition: 1 },
    ])
    const first = syncChromeHistory({ userDataDir: dir, inboxDir, stateDir })
    expect(first).toEqual([{ profile: "Default", read: 2, days: ["2026-10-30", "2026-10-31"], more: false }])
    const d2 = JSON.parse(fs.readFileSync(path.join(inboxDir, "2026-10-31__Default.json"), "utf8"))
    expect(d2).toEqual({
      brain2: "chrome-history",
      profile: "Default",
      day: "2026-10-31",
      visits: [{ url: "https://b.test/", title: "B", visitTime: day2, transition: "typed" }],
    })

    makeHistory(history, [{ url: "https://c.test/", title: "C", ms: day2 + 60_000 }])
    const second = syncChromeHistory({ userDataDir: dir, inboxDir, stateDir })
    expect(second[0]?.read).toBe(1)
    // The app had not taken the day yet: the file keeps B and adds C.
    const merged = JSON.parse(fs.readFileSync(path.join(inboxDir, "2026-10-31__Default.json"), "utf8"))
    expect(merged.visits.map((v: { url: string }) => v.url)).toEqual(["https://b.test/", "https://c.test/"])

    expect(syncChromeHistory({ userDataDir: dir, inboxDir, stateDir })[0]?.read).toBe(0)
  })
})
