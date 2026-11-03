import { describe, expect, it } from "vitest"
import { GAME_SPECIES, playerGrid, SPRITE_PALETTE, SPRITE_SIZE, spriteGrid, type SpriteView } from "./sprites"
import { walkGrid, type WalkFrame } from "./walk"

const FRAMES: WalkFrame[] = [0, 1, 2, 3]
const VIEWS: SpriteView[] = ["front", "side", "back"]

describe("walk cycles", () => {
  it("keeps every frame square, on the palette, with a clear top and bottom margin", () => {
    for (const view of VIEWS) {
      for (const id of [...GAME_SPECIES, "__player"]) {
        const base = id === "__player" ? playerGrid(view) : spriteGrid(id, view)
        for (const f of FRAMES) {
          const g = walkGrid(base, view, f)
          expect(g, `${id} ${view} ${f}`).toHaveLength(SPRITE_SIZE)
          for (const row of g) {
            expect(row).toHaveLength(SPRITE_SIZE)
            for (const ch of row) expect(ch === "." || SPRITE_PALETTE[ch]).toBeTruthy()
          }
          expect(g[0]!.replace(/[.k]/g, ""), `${id} ${view} ${f}`).toBe("")
          expect(g[SPRITE_SIZE - 1]!.replace(/[.k]/g, ""), `${id} ${view} ${f}`).toBe("")
        }
      }
    }
  }, 30000)

  it("moves the feet: the four frames are not all the same", () => {
    for (const view of VIEWS) {
      for (const id of [...GAME_SPECIES, "__player"]) {
        const base = id === "__player" ? playerGrid(view) : spriteGrid(id, view)
        const seen = new Set(FRAMES.map((f) => walkGrid(base, view, f).join("")))
        expect(seen.size, `${id} ${view}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it("keeps the pixel count roughly the same (feet move, nothing is lost)", () => {
    const count = (g: string[]) => g.join("").replace(/[.k]/g, "").length
    for (const id of GAME_SPECIES) {
      const base = spriteGrid(id, "side")
      for (const f of FRAMES) expect(Math.abs(count(walkGrid(base, "side", f)) - count(base))).toBeLessThan(count(base) * 0.15)
    }
  })
})
