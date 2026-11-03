import { describe, expect, it } from "vitest"
import { macPresence, phoneScroll, screenFacts } from "./screen-presence"
import type { HistoryEntry } from "./vault-search"

const e = (date: string, scope: string, pen: string, a: number, b: number, source?: string): HistoryEntry => ({
  date, scope, pen, startMin: a, endMin: b, text: "", ...(source ? { source, confirmed: false } : {}),
})

describe("screen presence", () => {
  const entries: HistoryEntry[] = []
  for (let d = 1; d <= 10; d++) {
    const date = `2026-10-${String(d).padStart(2, "0")}`
    entries.push(e(date, "activity", "Work", 600, 700), e(date, "screentime", "Zed", 600, 700, "screentime"))
    entries.push(e(date, "activity", "Sleep", 0, 400), e(date, "activity", "scrolling", 1200, 1260), e(date, "iphone-screentime", "Instagram", 1200, 1250, "phone-sync"))
  }
  it("learns which pens the Mac covers", () => {
    const m = macPresence(entries)!
    expect(m.pens.map((p) => p.pen)).toEqual(["Work"])
    expect(m.otherCovered).toBe(0)
  })
  it("learns which pen Instagram lines up with", () => expect(phoneScroll(entries)!.pen).toBe("scrolling"))
  it("says nothing without enough days", () => {
    expect(macPresence(entries.slice(0, 8))).toBeNull()
    expect(phoneScroll(entries.slice(0, 8))).toBeNull()
  })
  it("ignores Chrome-history blocks as Mac use", () => {
    const chrome = entries.map((x) => (x.scope === "screentime" ? { ...x, source: "phone-sync" } : x))
    expect(macPresence(chrome)).toBeNull()
  })
  it("reads Cursor as the person's rule for Computer Work, without learning it", () => {
    const few = [e("2026-10-03", "screentime", "Cursor", 600, 700, "screentime"), e("2026-10-03", "screentime", "Notes", 800, 900, "screentime")]
    const f = screenFacts(few, "2026-10-03")
    expect(f).toHaveLength(1)
    expect(f[0]).toContain("Cursor was open 10:00–11:40")
    expect(f[0]).toContain('"Computer Work"')
  })
  it("reads YouTube from Chrome history as the person's rule for youtube", () => {
    const f = screenFacts([e("2026-10-03", "screentime", "YouTube", 1200, 1300, "phone-sync")], "2026-10-03")
    expect(f[0]).toContain('YouTube was open 20:00–21:40')
    expect(f[0]).toContain('"youtube"')
  })
  it("writes counted facts for a day", () => {
    const f = screenFacts(entries, "2026-10-03")
    expect(f[0]).toContain("10:00–11:40")
    expect(f[1]).toContain("20:00–20:50")
  })
})
