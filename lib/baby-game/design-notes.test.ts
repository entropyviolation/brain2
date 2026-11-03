import { describe, expect, it } from "vitest"
import { designBrief, redoBriefs, redoCount, withNote } from "./design-notes"

describe("design notes", () => {
  it("changes one note and leaves the rest", () => {
    const a = withNote({}, "otter", { text: "rounder tail", status: "redo" }, 5)
    const b = withNote(a, "fox", { text: "bigger ears" }, 6)
    expect(a.otter).toEqual({ text: "rounder tail", status: "redo", at: 5 })
    expect(b.otter).toBe(a.otter)
    expect(b.fox).toEqual({ text: "bigger ears", status: "keep", at: 6 })
  })

  it("counts redos and writes briefs", () => {
    const n = withNote(withNote({}, "otter", { status: "redo", text: "rounder tail" }), "fox", { status: "done" })
    expect(redoCount(n)).toBe(1)
    expect(designBrief("otter", "Pip", n.otter)).toContain("Notes: rounder tail")
    expect(redoBriefs(n, { otter: "Pip" })).toContain("Pip (otter)")
    expect(redoBriefs(n, { otter: "Pip" })).not.toContain("fox")
  })
})
