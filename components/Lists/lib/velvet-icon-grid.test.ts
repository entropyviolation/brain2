import { describe, expect, it } from "vitest"
import {
  formatInspectorDate,
  freezeVelvetPositions,
  iconBoxesOverlap,
  inferIconLayoutMode,
  layoutVelvetIconGrid,
  listDisplayCaption,
  positionsForLocation,
  resolveVelvetIconPositions,
  savedPositionsLookLikeAutoGrid,
  velvetGridColumns,
  VELVET_ICON_CELL,
} from "./velvet-icon-grid"

function expectPacked(keys: string[], width: number, laid: Record<string, { x: number; y: number }>) {
  const { w, h, pad } = VELVET_ICON_CELL
  const cols = velvetGridColumns(width)
  expect(cols).toBe(Math.max(1, Math.floor((width - pad) / w)))

  keys.forEach((key, i) => {
    expect(laid[key]).toEqual({
      x: pad + (i % cols) * w,
      y: pad + Math.floor(i / cols) * h,
    })
  })

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      expect(iconBoxesOverlap(laid[keys[i]], laid[keys[j]])).toBe(false)
    }
  }

  const occupiedCols = Math.min(keys.length, cols)
  if (keys.length > 0) {
    const xs = keys.slice(0, occupiedCols).map((k) => laid[k].x)
    expect(new Set(xs).size).toBe(occupiedCols)
    expect(Math.max(...xs)).toBe(pad + (occupiedCols - 1) * w)
  }

  const remainder = width - pad - cols * w
  expect(remainder).toBeLessThan(w)
}

describe("velvetGridColumns", () => {
  it("is floor((W − pad) / C) and at least 1", () => {
    const { w, pad } = VELVET_ICON_CELL
    expect(velvetGridColumns(pad + 5 * w)).toBe(5)
    expect(velvetGridColumns(pad + 5 * w + w - 1)).toBe(5)
    expect(velvetGridColumns(pad + 6 * w)).toBe(6)
    expect(velvetGridColumns(10)).toBe(1)
  })
})

describe("layoutVelvetIconGrid", () => {
  it("spreads seven orbs across a wide canvas instead of a 4+3 pile", () => {
    const keys = ["a", "b", "c", "d", "e", "f", "g"]
    const laid = layoutVelvetIconGrid(keys, 840)
    expect(velvetGridColumns(840)).toBeGreaterThanOrEqual(6)
    expect(laid.a).toEqual({ x: 16, y: 16 })
    expect(laid.g.x).toBeGreaterThan(laid.d.x)
    expect(laid.g.y).toBe(16)
    expect(Math.max(...keys.map((k) => laid[k].x))).toBeGreaterThan(500)
    expectPacked(keys, 840, laid)
  })

  it("wraps when the canvas is narrow", () => {
    const keys = ["a", "b", "c", "d"]
    const laid = layoutVelvetIconGrid(keys, 280)
    expect(velvetGridColumns(280)).toBe(2)
    expect(laid.c.y).toBeGreaterThan(laid.a.y)
    expectPacked(keys, 280, laid)
  })

  it("fills every column when there are enough items (no empty right columns)", () => {
    const width = 1400
    const cols = velvetGridColumns(width)
    const keys = Array.from({ length: cols + 3 }, (_, i) => `k${i}`)
    const laid = layoutVelvetIconGrid(keys, width)
    expectPacked(keys, width, laid)
    expect(keys.slice(0, cols).every((k) => laid[k].y === VELVET_ICON_CELL.pad)).toBe(true)
    expect(laid[keys[cols]].y).toBe(VELVET_ICON_CELL.pad + VELVET_ICON_CELL.h)
  })
})

describe("savedPositionsLookLikeAutoGrid", () => {
  it("treats a fresh folder (no saved coords) as auto", () => {
    expect(savedPositionsLookLikeAutoGrid(["a", "b"], {})).toBe(true)
  })

  it("treats a velvet-packed snapshot as auto so resize can re-pack", () => {
    const keys = ["a", "b", "c", "d", "e"]
    const saved = layoutVelvetIconGrid(keys, 840)
    expect(savedPositionsLookLikeAutoGrid(keys, saved)).toBe(true)
  })

  it("treats the legacy 8-column 96px pile as auto (broken default)", () => {
    const keys = ["a", "b", "c"]
    const saved = {
      a: { x: 16, y: 16 },
      b: { x: 112, y: 16 },
      c: { x: 208, y: 16 },
    }
    expect(savedPositionsLookLikeAutoGrid(keys, saved)).toBe(true)
  })

  it("keeps an explicit freeform scatter", () => {
    const saved = {
      a: { x: 16, y: 16 },
      b: { x: 420, y: 240 },
    }
    expect(savedPositionsLookLikeAutoGrid(["a", "b"], saved)).toBe(false)
  })

  it("a single off-lattice drag is freeform, not a sparse auto-pack", () => {
    const saved = { b: { x: 400, y: 90 } }
    expect(savedPositionsLookLikeAutoGrid(["a", "b", "c"], saved)).toBe(false)
  })
})

describe("inferIconLayoutMode", () => {
  it("lets a stored freeform flag win even when coords look like a lattice", () => {
    const keys = ["a", "b"]
    const packed = layoutVelvetIconGrid(keys, 840)
    expect(inferIconLayoutMode(keys, packed, "freeform")).toBe("freeform")
    expect(inferIconLayoutMode(keys, packed, "auto")).toBe("auto")
    expect(inferIconLayoutMode(keys, packed)).toBe("auto")
  })
})

describe("freezeVelvetPositions", () => {
  it("moves only the dragged key; siblings stay bit-identical", () => {
    const keys = ["a", "b", "c", "d"]
    const current = layoutVelvetIconGrid(keys, 840)
    const next = freezeVelvetPositions(current, "b", { x: 333, y: 77 })
    expect(next.a).toEqual(current.a)
    expect(next.c).toEqual(current.c)
    expect(next.d).toEqual(current.d)
    expect(next.b).toEqual({ x: 333, y: 77 })
  })
})

describe("resolveVelvetIconPositions", () => {
  it("re-packs a stale 840-wide auto layout into a wider canvas", () => {
    const keys = ["a", "b", "c", "d", "e", "f", "g", "h"]
    const stale = layoutVelvetIconGrid(keys, 840)
    const wide = 1400
    const next = resolveVelvetIconPositions(keys, wide, stale)
    expect(next).toEqual(layoutVelvetIconGrid(keys, wide))
    expect(velvetGridColumns(wide)).toBeGreaterThan(velvetGridColumns(840))
    expectPacked(keys, wide, next)
  })

  it("does not destroy a user-arranged cluster", () => {
    const keys = ["a", "b", "c"]
    const saved = {
      a: { x: 40, y: 80 },
      b: { x: 300, y: 90 },
      c: { x: 70, y: 260 },
    }
    const next = resolveVelvetIconPositions(keys, 1400, saved)
    expect(next).toEqual(saved)
  })

  it("drops new keys into the live pack when the rest are freeform", () => {
    const keys = ["a", "b", "new"]
    const saved = {
      a: { x: 40, y: 80 },
      b: { x: 300, y: 90 },
    }
    const next = resolveVelvetIconPositions(keys, 840, saved)
    expect(next.a).toEqual(saved.a)
    expect(next.b).toEqual(saved.b)
    expect(next.new).toEqual(layoutVelvetIconGrid(keys, 840).new)
  })

  it("does not re-pack siblings after one icon is dragged, even on a wider canvas", () => {
    const keys = ["a", "b", "c"]
    const packed = layoutVelvetIconGrid(keys, 840)
    const saved = freezeVelvetPositions(packed, "b", { x: 410, y: 64 })
    const next = resolveVelvetIconPositions(keys, 1400, saved, "freeform")
    expect(next.a).toEqual(packed.a)
    expect(next.c).toEqual(packed.c)
    expect(next.b).toEqual({ x: 410, y: 64 })
    expect(next).not.toEqual(layoutVelvetIconGrid(keys, 1400))
  })

  it("auto-arrange still packs to width when mode is auto", () => {
    const keys = ["a", "b", "c", "d", "e", "f"]
    const scattered = {
      a: { x: 40, y: 80 },
      b: { x: 300, y: 90 },
      c: { x: 70, y: 260 },
      d: { x: 500, y: 10 },
      e: { x: 12, y: 400 },
      f: { x: 800, y: 20 },
    }
    const next = resolveVelvetIconPositions(keys, 1400, scattered, "auto")
    expect(next).toEqual(layoutVelvetIconGrid(keys, 1400))
    expectPacked(keys, 1400, next)
  })

  it("default pack still fills width when there are no manual positions", () => {
    const keys = ["a", "b", "c", "d", "e", "f", "g"]
    const next = resolveVelvetIconPositions(keys, 1400, {}, "auto")
    expect(next).toEqual(layoutVelvetIconGrid(keys, 1400))
    expectPacked(keys, 1400, next)
  })
})

describe("positionsForLocation", () => {
  it("strips the location prefix", () => {
    expect(
      positionsForLocation(
        { "home:list-1": { x: 1, y: 2 }, "all:list-1": { x: 9, y: 9 } },
        "home",
        ["list-1"],
      ),
    ).toEqual({ "list-1": { x: 1, y: 2 } })
  })
})

describe("listDisplayCaption", () => {
  it("names the inner caption after the display mode", () => {
    expect(listDisplayCaption("default")).toBe("Default")
    expect(listDisplayCaption("table")).toBe("Details")
    expect(listDisplayCaption("spreadsheet")).toBe("Spreadsheet")
  })
})

describe("formatInspectorDate", () => {
  it("renders a bureaucratic short date", () => {
    expect(formatInspectorDate(new Date("2026-09-20T12:00:00Z"))).toMatch(/2026/)
    expect(formatInspectorDate(undefined)).toBe("—")
  })
})
