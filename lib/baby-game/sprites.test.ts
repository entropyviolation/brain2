import { writeFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { GAME_SPECIES, playerGrid, SPRITE_PALETTE, SPRITE_SIZE, spriteGrid } from "./sprites"

const VIEWS = ["front", "side"] as const

describe("baby game sprites", () => {
  it("draws every species distinct, in both views", () => {
    expect(GAME_SPECIES.length).toBeGreaterThanOrEqual(24)
    for (const view of VIEWS) {
      const seen = new Set(GAME_SPECIES.map((id) => spriteGrid(id, view).join("")))
      expect(seen.size, view).toBe(GAME_SPECIES.length)
    }
    for (const id of GAME_SPECIES) expect(spriteGrid(id, "front").join(""), id).not.toBe(spriteGrid(id, "side").join(""))
  })

  it("keeps every grid square, on the palette, and inside a 1px margin", () => {
    for (const view of VIEWS) {
      for (const id of [...GAME_SPECIES, "__player"]) {
        const grid = id === "__player" ? playerGrid(view) : spriteGrid(id, view)
        expect(grid, `${id} ${view}`).toHaveLength(SPRITE_SIZE)
        for (const row of grid) {
          expect(row).toHaveLength(SPRITE_SIZE)
          for (const ch of row) expect(ch === "." || SPRITE_PALETTE[ch]).toBeTruthy()
        }
        expect(grid[0]!.replace(/[.k]/g, "")).toBe("")
        expect(grid[SPRITE_SIZE - 1]!.replace(/[.k]/g, ""), `${id} ${view}`).toBe("")
      }
    }
  })

  it("stands the Center of The World smaller than a baby capybara, and draws her in both views", () => {
    const height = (grid: string[]) => grid.filter((row) => /[^.k]/.test(row)).length
    expect(height(playerGrid("front"))).toBeLessThanOrEqual(24)
    expect(height(playerGrid("front"))).toBeLessThan(height(spriteGrid("capybara", "front")) + 8)
    expect(playerGrid("front").join("")).not.toBe(playerGrid("side").join(""))
  })

  it("never uses yellow", () => {
    for (const color of Object.values(SPRITE_PALETTE)) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
      expect(r! > 200 && g! > 190 && b! < 120).toBe(false)
    }
  })

  if (process.env.DUMP_SPRITES) {
    it("dumps for preview", () => {
      const out: Record<string, string[]> = {}
      for (const view of VIEWS) {
        out[`__player:${view}`] = playerGrid(view)
        for (const id of GAME_SPECIES) out[`${id}:${view}`] = spriteGrid(id, view)
      }
      writeFileSync(process.env.DUMP_SPRITES!, JSON.stringify({ palette: SPRITE_PALETTE, grids: out }))
    })
  }
})
