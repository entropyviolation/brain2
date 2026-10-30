import { describe, expect, it } from "vitest"
import { fileFacts, learnFiles, type FileEvent } from "./file-activity"
import type { HistoryEntry } from "./vault-search"

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime()
const ev = (d: number, h: number, m: number, p: string): FileEvent => ({ at: at(d, h, m), k: "mod", p })
const blk = (d: number, pen: string, a: number, b: number): HistoryEntry => ({ date: `2026-10-${String(d).padStart(2, "0")}`, scope: "activity", pen, startMin: a * 60, endMin: b * 60, text: "" })

describe("file activity", () => {
  const events: FileEvent[] = []
  const entries: HistoryEntry[] = []
  for (let d = 1; d <= 10; d++) {
    entries.push(blk(d, "Computer Work", 10, 12), blk(d, "Computer Work", 13, 15), blk(d, "scrolling", 20, 21), blk(d, "walking", 17, 18))
    for (let i = 0; i < 5; i++) events.push(ev(d, 10, i * 10, "brain2/lib/a.ts"), ev(d, 13, i * 10, "brain2/lib/b.ts"))
    for (let i = 0; i < 4; i++) events.push(ev(d, 17, i * 10, "websites/x/build.log"))
    events.push(ev(d, 20, 5, "Desktop/a.png"))
  }
  it("learns work pens and drops a folder whose events land in away blocks", () => {
    const l = learnFiles(events, entries)!
    expect(l.workPens).toEqual(["Computer Work"])
    expect(l.noisy).toContain("websites")
    expect(l.noisy).not.toContain("brain2")
    expect(l.quietNotWork).toBe(l.quietBlocks)
  })
  it("says nothing learned without enough days", () => expect(learnFiles(events.slice(0, 20), entries.slice(0, 8))).toBeNull())
  it("states the declared foxtide rule with no history at all", () => {
    const f = fileFacts([ev(3, 14, 0, "Desktop/Desktop - other’s MacBook Pro/elijah:foxtide/poster.png"), ev(3, 14, 10, "Desktop/Desktop - other’s MacBook Pro/elijah:foxtide/b.png")], [], "2026-10-03")
    expect(f).toHaveLength(1)
    expect(f[0]).toContain("14:00–14:10 (2 files)")
    expect(f[0]).toContain('"Foxtide work"')
  })
  it("writes busy and quiet lines for a day", () => {
    const f = fileFacts([...events, ev(3, 18, 30, "brain2/z.ts")], entries, "2026-10-03").join("\n")
    expect(f).toContain("busy saving or changing files 10:00–10:40")
    expect(f).toContain("none saved or changed")
    expect(f).not.toContain("17:00")
  })
})
