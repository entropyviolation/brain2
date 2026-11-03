import { describe, expect, it } from "vitest"
import { faceless, figureMask, FOOT, GRID, parts, place, snapPart } from "./snap.mjs"

/** A white 60×40 picture with two red squares outlined in black, the second one bigger. */
function sheet() {
  const w = 60
  const h = 40
  const rgba = new Uint8Array(w * h * 4).fill(255)
  const paint = (x0: number, y0: number, size: number) => {
    for (let y = y0; y < y0 + size; y++) {
      for (let x = x0; x < x0 + size; x++) {
        const edge = x === x0 || y === y0 || x === x0 + size - 1 || y === y0 + size - 1
        const i = (y * w + x) * 4
        rgba.set(edge ? [43, 29, 46] : [224, 72, 72], i)
      }
    }
  }
  paint(4, 10, 12)
  paint(30, 4, 24)
  return { rgba, w, h }
}

const palette = { k: "#2b1d2e", R: "#e04848", w: "#ffffff" }

describe("pixel snapper", () => {
  it("finds each figure on a sheet, in reading order", () => {
    const { rgba, w, h } = sheet()
    const found = parts(figureMask(rgba, w, h), w, h)
    expect(found.map((p) => [p.x0, p.y0, p.x1 - p.x0 + 1])).toEqual([
      [4, 10, 12],
      [30, 4, 24],
    ])
  })

  it("snaps a figure to its palette and stands it on the foot row, centered and outlined", () => {
    const { rgba, w, h } = sheet()
    const big = parts(figureMask(rgba, w, h), w, h)[1]!
    const rows = snapPart(rgba, w, big, palette, 8)
    expect(rows).toHaveLength(8)
    expect(rows[4]).toMatch(/^R+$/)
    const grid = place(rows)
    expect(grid).toHaveLength(GRID)
    expect(grid.every((r) => r.length === GRID)).toBe(true)
    expect(grid[FOOT]).toMatch(/^\.+k+\.+$/)
    expect(grid[FOOT + 1]).toMatch(/^\.+$/)
    expect(grid[0]).toMatch(/^\.+$/)
  })

  it("mirrors when asked and refuses a figure too tall for the grid", () => {
    expect(place(["Rk", "Rk"], { flip: true })[FOOT - 1]).toContain("kkR")
    expect(() => place(Array.from({ length: 31 }, () => "R"))).toThrow(/does not fit/)
  })

  it("wipes the face for a back view and keeps the outline and feet", () => {
    const front = place(["RRRRR", "RkRkR", "RRRRR", "RRRRR", "RRRRR", "RRRRR", "RRRRR", "RkRkR"])
    const back = faceless(front)
    expect(back.join("")).not.toBe(front.join(""))
    expect(back[FOOT - 1]).toBe(front[FOOT - 1])
    expect(back[FOOT]).toBe(front[FOOT])
  })
})
