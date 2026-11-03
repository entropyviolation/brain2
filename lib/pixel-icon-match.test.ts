import { describe, expect, it } from "vitest"
import { PIXEL_ICON_GRIDS, PIXEL_PALETTE } from "@/components/friend-details/PixelIcon"
import { pixelateOrb } from "@/components/friend-details/PixelOrb"
import { TASK_ICON_NAMES, matchTaskIcon, stemWord } from "@/lib/pixel-icon-match"

describe("matchTaskIcon", () => {
  it("lands real titles on the closest sprite", () => {
    expect(matchTaskIcon("brush teeth")).toBe("toothbrush")
    expect(matchTaskIcon("make list of robot stuff u need and order it")).toBe("robot")
    expect(matchTaskIcon("Make benefit maxxing spreadsheet with dates")).toBe("chart")
    expect(matchTaskIcon("Clean the kitchen")).toBe("broom")
    expect(matchTaskIcon("Call mom")).toBe("phone")
    expect(matchTaskIcon("Pay rent")).toBe("money")
    expect(matchTaskIcon("Water the plants")).toBe("can")
    expect(matchTaskIcon("Do laundry")).toBe("shirt")
    expect(matchTaskIcon("Take vitamins")).toBe("pill")
  })

  it("falls back to the mission source, then chat", () => {
    expect(matchTaskIcon("zzz qqq", "habit")).toBe("can")
    expect(matchTaskIcon("zzz qqq", "todo")).toBe("clipboard")
    expect(matchTaskIcon("zzz qqq", "nextAction")).toBe("signpost")
    expect(matchTaskIcon("zzz qqq", "whim")).toBe("flower")
    expect(matchTaskIcon("zzz qqq")).toBe("chat")
  })

  it("stems plurals and -ing", () => {
    expect(stemWord("dates")).toBe("date")
    expect(stemWord("cleaning")).toBe("clean")
    expect(stemWord("groceries")).toBe("grocery")
    expect(stemWord("dishes")).toBe("dish")
  })
})

describe("pixel icon grids", () => {
  it("draws every task icon, 12 wide, from the palette", () => {
    for (const name of [...TASK_ICON_NAMES, "gem"]) {
      const rows = PIXEL_ICON_GRIDS[name]
      expect(rows, name).toBeDefined()
      expect(rows.length, name).toBeLessThanOrEqual(12)
      for (const row of rows) {
        expect(row.length, `${name}: ${row}`).toBe(12)
        for (const cell of row) expect(cell === "." || cell in PIXEL_PALETTE, `${name}: ${cell}`).toBe(true)
      }
    }
  })
})

describe("pixelateOrb", () => {
  it("hardens alpha and traces an outline around the shape", () => {
    const size = 4
    const data = new Uint8ClampedArray(size * size * 4)
    const set = (x: number, y: number, a: number) => {
      const at = (y * size + x) * 4
      data[at] = 200
      data[at + 1] = 100
      data[at + 2] = 50
      data[at + 3] = a
    }
    set(1, 1, 200)
    set(2, 2, 60)
    pixelateOrb(data, size)
    expect(data[(1 * size + 1) * 4 + 3]).toBe(255)
    expect(data[(1 * size + 0) * 4 + 3]).toBe(255)
    expect(data[(1 * size + 0) * 4]).toBe(0x2b)
    expect(data[(3 * size + 3) * 4 + 3]).toBe(0)
  })
})
