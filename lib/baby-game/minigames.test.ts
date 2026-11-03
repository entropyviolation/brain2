import { describe, expect, it } from "vitest"
import { DIRS, ECHO, echoGrade, echoSequence, fallsGrade, gladeGrade, REWARDS, rotateStair, STAIR_N, stairGrade, stairPuzzle, stairSolved, type StairPuzzle } from "./minigames"
import { ITEMS } from "./items"

describe("mini games", () => {
  it("grades each game from its raw score", () => {
    expect([0, 3, 6, 9].map(gladeGrade)).toEqual([0, 1, 2, 2])
    expect(fallsGrade(false, 0)).toBe(0)
    expect(fallsGrade(true, 0)).toBe(2)
    expect(fallsGrade(true, 2)).toBe(1)
    expect([0, 2, 3, 5, 6].map(echoGrade)).toEqual([0, 0, 1, 1, 2])
  })

  it("plays the same echo tune for the same seed, within the petals", () => {
    expect(echoSequence(7)).toEqual(echoSequence(7))
    expect(echoSequence(7)).not.toEqual(echoSequence(8))
    for (const p of echoSequence(3)) expect(p).toBeLessThan(ECHO.petals)
  })

  it("makes stair puzzles that are never solved at the start and always solvable at par", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const puzzle = stairPuzzle(seed)
      expect(puzzle.arrows).toHaveLength(STAIR_N * STAIR_N)
      expect(stairSolved(puzzle), `seed ${seed} starts solved`).toBe(false)
      // there is a way of `par` turns: try all single-stair turn counts on the cells the walk visits
      let best = Infinity
      const cells = puzzle.arrows.map((_, i) => i)
      const search = (i: number, p: StairPuzzle, turns: number) => {
        if (turns >= best || turns > 12) return
        if (stairSolved(p)) {
          best = turns
          return
        }
        if (i >= cells.length) return
        for (let k = 0; k < 4; k++) {
          let q: StairPuzzle = p
          for (let n = 0; n < k; n++) q = rotateStair(q, cells[i]!)
          search(i + 1, q, turns + k)
        }
      }
      search(0, puzzle, 0)
      expect(best, `seed ${seed}`).toBeLessThanOrEqual(puzzle.par)
    }
  })

  it("grades stairs by turns against par", () => {
    expect([4, 6, 9].map((t) => stairGrade(t, 4))).toEqual([2, 1, 0])
    expect(DIRS).toHaveLength(4)
  })

  it("pays only known items, more for a better grade", () => {
    for (const [id, tiers] of Object.entries(REWARDS)) {
      expect(tiers[0]!.buttons, id).toBe(0)
      expect(tiers[2]!.buttons).toBeGreaterThan(tiers[1]!.buttons)
      for (const t of tiers) if (t.item) expect(ITEMS[t.item[0]], t.item[0]).toBeTruthy()
    }
  })
})
