import { writeFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { GAME_SPECIES, playerGrid, SPRITE_PALETTE, SPRITE_SIZE, spriteGrid } from "./sprites"

const VIEWS = ["front", "side", "back"] as const

describe("baby game sprites", () => {
  it("draws every species distinct, in every view", () => {
    expect(GAME_SPECIES.length).toBeGreaterThanOrEqual(24)
    for (const view of VIEWS) {
      const seen = new Set(GAME_SPECIES.map((id) => spriteGrid(id, view).join("")))
      expect(seen.size, view).toBe(GAME_SPECIES.length)
    }
    for (const id of GAME_SPECIES) {
      expect(spriteGrid(id, "front").join(""), id).not.toBe(spriteGrid(id, "side").join(""))
      expect(spriteGrid(id, "front").join(""), id).not.toBe(spriteGrid(id, "back").join(""))
    }
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
  }, 60000)

  it("stands the Center of The World as tall as a village-sim girl, and draws her in every view", () => {
    const height = (grid: string[]) => grid.filter((row) => /[^.k]/.test(row)).length
    for (const view of VIEWS) {
      expect(height(playerGrid(view)), view).toBeGreaterThanOrEqual(20)
      expect(height(playerGrid(view)), view).toBeLessThanOrEqual(28)
    }
    expect(playerGrid("front").join("")).not.toBe(playerGrid("side").join(""))
    expect(playerGrid("front").join("")).not.toBe(playerGrid("back").join(""))
  })

  it("uses yellow only for the duckling's down", () => {
    // animal and world letters only: a person brings colors of their own (blonde hair is allowed its yellow)
    const yellow = Object.entries(SPRITE_PALETTE)
      .filter(([letter]) => letter.charCodeAt(0) < 128)
      .filter(([, color]) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
        return r! > 200 && g! > 190 && b! < 120
      })
      .map(([letter]) => letter)
    expect(yellow.every((l) => "iIJ".includes(l))).toBe(true)
    for (const view of VIEWS) {
      for (const id of GAME_SPECIES) {
        if (id === "duckling") continue
        expect(/[iIJ]/.test(spriteGrid(id, view).join("")), `${id} ${view}`).toBe(false)
      }
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
