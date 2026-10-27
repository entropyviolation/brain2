/**
 * components/Home/Tracking/grids/grid-stroke.test.ts
 */
import { describe, expect, it } from "vitest"
import { ERASE_WASH, strokeCellStyle, strokeOverlapUnchanged, type CellFill } from "./grid-stroke"

const work: CellFill = { background: "#2563eb" }
const rest: CellFill = { background: "#10b981" }

describe("strokeCellStyle", () => {
  it("leaves a cell alone when the pointer is not on it", () => {
    expect(strokeCellStyle({ inStroke: false, erasing: false, samePen: true, existing: work, incoming: rest })).toEqual(work)
  })

  it("keeps paint that already is this pen, so a stroke through it stays one surface", () => {
    expect(strokeCellStyle({ inStroke: true, erasing: false, samePen: true, existing: work, incoming: work })).toEqual(work)
  })

  it("shows the incoming pen on empty minutes and on a different pen", () => {
    expect(strokeCellStyle({ inStroke: true, erasing: false, samePen: false, existing: {}, incoming: work })).toEqual(work)
    expect(strokeCellStyle({ inStroke: true, erasing: false, samePen: false, existing: rest, incoming: work })).toEqual(work)
  })

  it("treats a stroke as unchanged when the clipped overlap with the row is the same", () => {
    expect(strokeOverlapUnchanged(0, 30, 0, 30, 0, 60)).toBe(true)
    expect(strokeOverlapUnchanged(0, 90, 10, 90, 0, 60)).toBe(false)
    expect(strokeOverlapUnchanged(70, 90, 80, 100, 0, 60)).toBe(true)
    expect(strokeOverlapUnchanged(10, 20, 70, 80, 0, 60)).toBe(false)
  })

  it("washes only the minutes an erase stroke covers", () => {
    expect(strokeCellStyle({ inStroke: true, erasing: true, samePen: true, existing: work, incoming: {} })).toEqual({
      background: ERASE_WASH,
    })
    expect(strokeCellStyle({ inStroke: false, erasing: true, samePen: false, existing: work, incoming: {} })).toEqual(work)
  })
})
