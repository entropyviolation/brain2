import { describe, expect, it } from "vitest"
import { RESIDENTS } from "./cast"
import {
  blankFlags, DEV_GEMS, devAllHearts, devFreshDay, devGems, devGive, devGiveAll, devPlaces, devQuestDone, devQuestReady, devQuestReset, devRipen, devSetAct, devSetHearts, devSetTime, devSkills, nextSpeed, openTileNear,
} from "./dev"
import { act, hearts, newGame, skillLevel, talk } from "./engine"
import { CROPS, isRipe } from "./farm"
import { QUESTS } from "./quests"
import { ITEMS, LAMP_PARTS } from "./items"
import { newSim, stepSim, teleport } from "./sim"
import { inValley, residentsOfAct, setRevealAll } from "./cast"
import { buildWorld, FIRE_SLOTS, isSolidTile, TILE } from "./world"

const world = buildWorld([...RESIDENTS.map((r) => r.day), ...FIRE_SLOTS])

describe("dev mode teleport", () => {
  it("lands every place on an open tile", () => {
    const places = devPlaces(world)
    expect(places.length).toBeGreaterThan(30)
    for (const p of places) expect(isSolidTile(world, p.tile[0], p.tile[1], 99), p.label).toBe(false)
  })

  it("finds the nearest open tile around a solid one", () => {
    const [x, y] = openTileNear(world, [0, 0])
    expect(isSolidTile(world, x, y, 99)).toBe(false)
  })

  it("teleport moves the player and the companion", () => {
    const sim = newSim([21, 18], newGame())
    teleport(sim, [40, 30])
    expect([Math.floor(sim.px / TILE), Math.floor(sim.py / TILE)]).toEqual([40, 30])
    expect(Math.abs(sim.pet.x - sim.px)).toBeLessThan(20)
  })

  it("noclip walks through a solid tile; play does not", () => {
    const s = newGame()
    // find a solid tile with open ground to its left
    let at: [number, number] | null = null
    for (let y = 2; y < 50 && !at; y++) for (let x = 2; x < 60 && !at; x++) if (isSolidTile(world, x, y, 1) && !isSolidTile(world, x - 1, y, 1)) at = [x - 1, y]
    const walk = (noclip: boolean) => {
      const sim = newSim([21, 18], s)
      teleport(sim, at!)
      for (let i = 0; i < 40; i++) stepSim(sim, world, s, { dx: 1, dy: 0, run: false, noclip }, 0.05, () => 0.5)
      return Math.floor(sim.px / TILE)
    }
    expect(walk(false)).toBe(at![0])
    expect(walk(true)).toBeGreaterThan(at![0] + 1)
  })
})

describe("dev mode powers", () => {
  it("sets the act by placing lamp parts, and 6 lights the lamp", () => {
    expect(act(devSetAct(newGame(), 4))).toBe(4)
    expect(devSetAct(newGame(), 4).parts).toEqual(LAMP_PARTS.slice(0, 3))
    const lit = devSetAct(newGame(), 6)
    expect(lit.ended).toBe(true)
    expect(devSetAct(lit, 2).ended).toBe(false)
  })

  it("sets the clock inside one day", () => {
    expect(devSetTime(newGame(), 18 * 60).minutes).toBe(18 * 60)
    expect(devSetTime(newGame(), 99999).minutes).toBe(24 * 60 - 1)
  })

  it("gives items and marks them found; ignores unknown ids", () => {
    const s = devGive(newGame(), "pebble", 10)
    expect(s.inv.pebble).toBe(10)
    expect(s.found.pebble).toBe(true)
    expect(devGive(s, "no-such-thing", 3)).toBe(s)
    const all = devGiveAll(newGame(), 2, "seed")
    for (const d of Object.values(ITEMS)) if (d.kind === "seed") expect(all.inv[d.id]).toBeGreaterThanOrEqual(2)
  })

  it("sets hearts, for one friend or all", () => {
    const id = RESIDENTS[0]!.id
    expect(hearts(devSetHearts(newGame(), id, 7), id)).toBe(7)
    expect(hearts(devSetHearts(newGame(), id, 40), id)).toBe(10)
    const all = devAllHearts(newGame(), 5)
    for (const r of RESIDENTS) expect(hearts(all, r.id)).toBe(5)
  })

  it("a fresh day lets you talk again and keeps milestones", () => {
    const id = RESIDENTS[0]!.id
    const talked = talk(newGame(), id, 0).s
    talked.seen.log5 = true
    talked.seen[`fire${talked.day}`] = true
    const fresh = devFreshDay(talked)
    expect(fresh.animals[id]!.talked).toBe(false)
    expect(fresh.seen.log5).toBe(true)
    expect(fresh.seen[`fire${talked.day}`]).toBeUndefined()
  })

  it("ripens what is planted", () => {
    const s = newGame()
    s.farm["plot-0"] = { tilled: true, crop: "glowbean", grown: 0, watered: false }
    expect(isRipe(devRipen(s).farm["plot-0"])).toBe(true)
    expect(CROPS.glowbean).toBeTruthy()
  })

  it("adds gems (saved as buttons) and never goes below zero; unlimited gems starts off", () => {
    expect(devGems(newGame(), 100).buttons).toBe(newGame().buttons + 100)
    expect(devGems(newGame(), -1000).buttons).toBe(0)
    expect(blankFlags().gems).toBe(false)
    expect(DEV_GEMS).toBeGreaterThan(1000)
  })

  it("sets every skill level", () => {
    const s = devSkills(newGame(), 5)
    expect(skillLevel(s, "farming")).toBe(5)
    expect(skillLevel(devSkills(s, 1), "fishing")).toBe(1)
    expect(skillLevel(devSkills(s, 3), "crafting")).toBe(3)
  })
})

describe("dev mode story jumps", () => {
  it("readies and completes every quest from a fresh save", () => {
    for (const q of QUESTS) {
      const s = newGame()
      expect(visibleReady(devQuestReady(s, q), q.id)).toBe(true)
      const done = devQuestDone(s, q)
      expect(done.questsDone[q.id]).toBe(true)
      expect(devQuestReset(done, q.id).questsDone[q.id]).toBeUndefined()
    }
  })

  it("cycles the walk speed and wraps", () => {
    expect(nextSpeed(1)).toBe(2)
    expect(nextSpeed(8)).toBe(1)
  })

  it("reveal puts later-act friends in the valley", () => {
    const late = residentsOfAct(5)[0]!
    expect(inValley(late, 1)).toBe(false)
    setRevealAll(true)
    expect(inValley(late, 1)).toBe(true)
    setRevealAll(false)
  })
})

import { questProgress } from "./engine"
function visibleReady(s: ReturnType<typeof newGame>, id: string) {
  const q = QUESTS.find((x) => x.id === id)!
  return questProgress(s, q).ready
}
