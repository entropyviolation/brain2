import { writeFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { GAME_SPECIES, playerGrid, SPRITE_PALETTE, SPRITE_SIZE, spriteGrid } from "./sprites"

describe("baby game sprites", () => {
  it("draws twenty distinct species", () => {
    expect(GAME_SPECIES).toHaveLength(20)
    const seen = new Set(GAME_SPECIES.map((id) => spriteGrid(id).join("")))
    expect(seen.size).toBe(20)
  })

  it("keeps every grid 16×16, on the palette, and inside a 1px margin", () => {
    for (const id of [...GAME_SPECIES, "__player"]) {
      const grid = id === "__player" ? playerGrid() : spriteGrid(id)
      expect(grid).toHaveLength(SPRITE_SIZE)
      for (const row of grid) {
        expect(row).toHaveLength(SPRITE_SIZE)
        for (const ch of row) expect(ch === "." || SPRITE_PALETTE[ch]).toBeTruthy()
      }
      expect(grid[0]!.replace(/[.k]/g, "")).toBe("")
      expect(grid[SPRITE_SIZE - 1]!.replace(/[.k]/g, ""), id).toBe("")
    }
  })

  it("never uses yellow", () => {
    for (const color of Object.values(SPRITE_PALETTE)) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
      expect(r! > 200 && g! > 190 && b! < 120).toBe(false)
    }
  })

  if (process.env.DUMP_SPRITES) {
    it("dumps for preview", () => {
      const out: Record<string, string[]> = { __player: playerGrid() }
      for (const id of GAME_SPECIES) out[id] = spriteGrid(id)
      writeFileSync(process.env.DUMP_SPRITES!, JSON.stringify({ palette: SPRITE_PALETTE, grids: out }))
    })
  }
})
