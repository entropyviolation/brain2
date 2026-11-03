import { describe, expect, it } from "vitest"
import { buildHouse, houseRgba, specFor, HOUSE_W } from "./housegen"
import type { HomeKind } from "@/lib/baby-game/homes"

const KINDS: HomeKind[] = ["nest", "burrow", "den", "hollow", "lodge", "hutch", "stall", "igloo"]

describe("housegen", () => {
  it("is repeatable and every kind draws something that stands on the ground line", () => {
    for (const kind of KINDS) {
      const a = buildHouse(specFor(kind, "fox"), false)
      expect([...a]).toEqual([...buildHouse(specFor(kind, "fox"), false)])
      const rows = new Set<number>()
      a.forEach((c, i) => c !== -1 && rows.add(Math.floor(i / HOUSE_W)))
      expect(Math.max(...rows)).toBeGreaterThan(85)
      expect(Math.min(...rows)).toBeGreaterThanOrEqual(0)
    }
  })
  it("gives different friends different houses, and a lit one differs from a dark one", () => {
    const px = (id: string, lit = false) => [...houseRgba(specFor("hutch", id), lit)].join()
    expect(px("chick")).not.toEqual(px("bunny"))
    expect(px("chick")).not.toEqual(px("chick", true))
  })
})
