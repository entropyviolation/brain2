import { describe, expect, it } from "vitest"
import { HYRAX_GRIDS } from "./hyrax"
import { SPRITE_PALETTE } from "./sprites"

const views = ["side", "front"] as const

function box(g: string[]) {
  let x0 = 99, x1 = -1, y0 = 99, y1 = -1
  g.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === ".") return
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  }))
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, y1 }
}

describe("hyrax grids", () => {
  for (const v of views) {
    const g = HYRAX_GRIDS[v]
    it(`${v}: 32x32, palette letters only`, () => {
      expect(g).toHaveLength(32)
      for (const row of g) {
        expect(row).toHaveLength(32)
        for (const c of row) expect(c === "." || c in SPRITE_PALETTE).toBe(true)
      }
    })
    it(`${v}: border is clear or outline`, () => {
      const edge = [g[0]!, g[31]!, g.map((r) => r[0]).join(""), g.map((r) => r[31]).join("")]
      for (const e of edge) expect(e).toMatch(/^[.k]*$/)
    })
    it(`${v}: feet end on row 29, outline on row 30`, () => {
      let low = -1
      g.forEach((row, y) => { if (/[^.k]/.test(row)) low = y })
      expect(low).toBe(29)
      expect(g[30]).toMatch(/k/)
    })
    it(`${v}: tiny: a third of a capybara pup, no wider than tall`, () => {
      const b = box(g)
      expect(b.w).toBeGreaterThanOrEqual(10)
      expect(b.w).toBeLessThanOrEqual(14)
      expect(b.h).toBeGreaterThanOrEqual(9)
      expect(b.h).toBeLessThanOrEqual(12)
      expect(b.w).toBeLessThanOrEqual(b.h + 3)
    })
  }
  it("front is mirror symmetric but for a few detail pixels", () => {
    const rows = HYRAX_GRIDS.front.filter((r) => /[^.]/.test(r)).map((r) => r.replace(/^\.+|\.+$/g, ""))
    let diff = 0
    for (const row of rows) for (let x = 0; x < row.length / 2; x++) if (row[x] !== row[row.length - 1 - x]) diff++
    expect(diff).toBeLessThanOrEqual(4)
  })
})
