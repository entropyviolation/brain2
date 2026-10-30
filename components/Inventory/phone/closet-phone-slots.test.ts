import { describe, expect, it } from "vitest"
import { phoneCompositionSlots } from "./closet-phone-slots"

describe("phoneCompositionSlots", () => {
  it("places tapped pieces on an even grid inside the board", () => {
    expect(phoneCompositionSlots([])).toEqual([])
    expect(phoneCompositionSlots(["a"])).toEqual([{ pieceId: "a", x: 0.5, y: 0.5 }])
    expect(phoneCompositionSlots(["a", "b"])).toEqual([
      { pieceId: "a", x: 0.25, y: 0.5 },
      { pieceId: "b", x: 0.75, y: 0.5 },
    ])
    const four = phoneCompositionSlots(["a", "b", "c", "d"])
    expect(four[3]).toEqual({ pieceId: "d", x: 0.5 / 3, y: 0.75 })
    expect(four.every((slot) => slot.x >= 0 && slot.x <= 1 && slot.y >= 0 && slot.y <= 1)).toBe(true)
  })
})
