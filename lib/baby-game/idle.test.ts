import { describe, expect, it } from "vitest"
import { idleGrid, idlePose, type IdlePose } from "./idle"
import { GAME_SPECIES, playerGrid, SPRITE_PALETTE, SPRITE_SIZE, spriteGrid, type SpriteView } from "./sprites"

const POSES: Array<Exclude<IdlePose, "glance">> = ["blink", "breathe", "earL", "earR"]
const VIEWS: SpriteView[] = ["front", "side", "back"]

describe("idle life", () => {
  it("keeps every pose square, on the palette, with a clear top margin", () => {
    for (const view of VIEWS) {
      for (const id of [...GAME_SPECIES, "__player"]) {
        const base = id === "__player" ? playerGrid(view) : spriteGrid(id, view)
        for (const pose of POSES) {
          const g = idleGrid(base, view, pose)
          expect(g, `${id} ${view} ${pose}`).toHaveLength(SPRITE_SIZE)
          for (const row of g) {
            expect(row).toHaveLength(SPRITE_SIZE)
            for (const ch of row) expect(ch === "." || SPRITE_PALETTE[ch]).toBeTruthy()
          }
          expect(g[0]!.replace(/[.k]/g, ""), `${id} ${view} ${pose}`).toBe("")
        }
      }
    }
  }, 30000)

  it("blinks and breathes on most front-facing bodies", () => {
    let blinks = 0
    let breaths = 0
    for (const id of GAME_SPECIES) {
      const base = spriteGrid(id, "front")
      if (idleGrid(base, "front", "blink").join("") !== base.join("")) blinks++
      if (idleGrid(base, "front", "breathe").join("") !== base.join("")) breaths++
    }
    expect(blinks).toBeGreaterThanOrEqual(GAME_SPECIES.length * 0.7)
    expect(breaths).toBe(GAME_SPECIES.length)
  })

  it("is a pure schedule: same body and time, same pose; bodies differ; most of the time is still or breathing", () => {
    expect(idlePose("fox", 12.3)).toBe(idlePose("fox", 12.3))
    const a = Array.from({ length: 400 }, (_, i) => idlePose("fox", i * 0.1)).join()
    const b = Array.from({ length: 400 }, (_, i) => idlePose("owl", i * 0.1)).join()
    expect(a).not.toBe(b)
    const poses = Array.from({ length: 4000 }, (_, i) => idlePose("fox", i * 0.05))
    for (const p of ["blink", "breathe", "glance"] as const) expect(poses).toContain(p)
    expect(poses.filter((p) => p === "blink").length).toBeLessThan(poses.length * 0.1)
  })
})
