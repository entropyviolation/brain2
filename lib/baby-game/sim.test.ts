import { describe, expect, it } from "vitest"
import { RESIDENTS } from "./cast"
import { newGame } from "./engine"
import { crowdNear, nearest, newSim, stepSim } from "./sim"
import { buildWorld, FIRE_SLOTS, TILE } from "./world"

const world = buildWorld([...RESIDENTS.map((r) => r.day), ...FIRE_SLOTS])
const noInput = { dx: 0, dy: 0, run: false }

describe("the sim", () => {
  it("friends with nothing to do go looking for each other and talk", () => {
    const s = { ...newGame(), minutes: 11 * 60 }
    const sim = newSim([21, 18], s)
    let seeked = false
    for (let i = 0; i < 6000 && !sim.met.length; i++) {
      stepSim(sim, world, s, noInput, 0.1, Math.random)
      if (Object.values(sim.npcs).some((n) => n.seek)) seeked = true
    }
    expect(seeked).toBe(true)
    expect(sim.met.length).toBeGreaterThan(0)
  })

  it("starts friends where they would be right now", () => {
    const noon = newSim([21, 18], { ...newGame(), minutes: 12 * 60 })
    const chick = RESIDENTS.find((r) => r.id === "chick")!
    expect(Math.floor(noon.npcs.chick!.x / TILE)).toBe(chick.day[0])
    const dusk = newSim([21, 18], { ...newGame(), minutes: 19 * 60 })
    expect(dusk.npcs.chick!.gathering).toBe(true)
    expect(FIRE_SLOTS.some(([x, y]) => Math.floor(dusk.npcs.chick!.x / TILE) === x && Math.floor(dusk.npcs.chick!.y / TILE) === y)).toBe(true)
    expect(newSim([21, 18], { ...newGame(), minutes: 23 * 60 }).npcs.chick!.asleep).toBe(true)
  })

  it("stops the player at a tree, and a closed gate", () => {
    const s = newGame()
    const sim = newSim([21, 18], s)
    for (let i = 0; i < 400; i++) stepSim(sim, world, s, { dx: 0, dy: -1, run: false }, 0.05, Math.random)
    // the door tile can be walked into; the wall behind it cannot
    expect(sim.py).toBeGreaterThan(16 * TILE)
    const east = newSim([30, 19], s)
    for (let i = 0; i < 200; i++) stepSim(east, world, s, { dx: 1, dy: 0, run: false }, 0.05, Math.random)
    expect(east.px).toBeLessThan(32 * TILE)
  })

  it("startles a shy friend who is run at, and not one who is walked up to", () => {
    const s = { ...newGame(), minutes: 12 * 60 }
    const sim = newSim([13, 6], s)
    sim.npcs.fawn!.x = sim.px + 20
    sim.npcs.fawn!.y = sim.py
    expect(stepSim(sim, world, s, { dx: 1, dy: 0, run: true }, 0.05, Math.random)).toContain("fawn")
    const calm = newSim([13, 6], s)
    calm.npcs.fawn!.x = calm.px + 20
    calm.npcs.fawn!.y = calm.py
    expect(stepSim(calm, world, s, { dx: 1, dy: 0, run: false }, 0.05, Math.random)).toEqual([])
  })

  it("finds the nearest thing to act on, friends first", () => {
    const s = { ...newGame(), minutes: 12 * 60 }
    const sim = newSim([23, 19], s)
    expect(nearest(sim, s)?.kind).toBe("station")
    const near = newSim([6, 9], s)
    expect(nearest(near, s)).toMatchObject({ kind: "npc", id: "chick" })
  })

  it("counts friends nearby for the keep-it-private secrets", () => {
    const s = { ...newGame(), minutes: 19 * 60 }
    const sim = newSim([24, 20], s)
    expect(crowdNear(sim, s, "chick")).toBeGreaterThan(0)
    const noon = { ...s, minutes: 12 * 60 }
    expect(crowdNear(newSim([24, 20], noon), noon, "gosling")).toBe(0)
    expect(crowdNear(newSim([24, 20], noon), noon, "fawn")).toBeGreaterThan(0)
  })
})
