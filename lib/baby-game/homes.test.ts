import { describe, expect, it } from "vitest"
import { RESIDENTS } from "./cast"
import { newGame } from "./engine"
import { homeDoor, HOMES } from "./homes"
import { bedOf, bedtime, knockLine, newSim } from "./sim"
import { buildWorld, FIRE_SLOTS, isSolidTile, NODES, PLOTS, PROPS, reachable, STATIONS, tileIndex, zoneAt, ZONE_ACT } from "./world"

const world = buildWorld(RESIDENTS.map((r) => r.day))

describe("homes", () => {
  it("gives every friend a home in their own zone", () => {
    for (const r of RESIDENTS) {
      const h = HOMES[r.id]
      expect(h, r.name).toBeTruthy()
      expect(zoneAt(h!.x, h!.y), `${r.name}'s home`).toBe(r.zone)
      expect(h!.name.length).toBeGreaterThan(3)
    }
  })

  it("stands each home on a tile of its own, solid, clear of nodes, props, stations, plots and fire seats", () => {
    const taken = new Set<number>([...NODES, ...PROPS, ...Object.values(STATIONS), ...PLOTS].map((o) => tileIndex(o.x, o.y)))
    for (const [x, y] of FIRE_SLOTS) taken.add(tileIndex(x, y))
    const used = new Set<number>()
    for (const [id, h] of Object.entries(HOMES)) {
      const i = tileIndex(h.x, h.y)
      expect(taken.has(i), `${id} sits on something`).toBe(false)
      expect(used.has(i), `${id} doubled up`).toBe(false)
      expect(isSolidTile(world, h.x, h.y, 5), id).toBe(true)
      used.add(i)
    }
  })

  it("lets each friend walk from their day spot to their door once their act is open", () => {
    for (const r of RESIDENTS) {
      const door = homeDoor(HOMES[r.id]!)
      expect(isSolidTile(world, ...door, ZONE_ACT[r.zone]), `${r.name}'s door`).toBe(false)
      expect(reachable(world, r.day, ZONE_ACT[r.zone]).has(tileIndex(...door)), `${r.name} can get home`).toBe(true)
    }
  })

  it("sends friends home the hour before bed and puts sleepers on their doorstep", () => {
    const ada = RESIDENTS.find((r) => r.id === "chick")!
    expect(bedtime(ada, 21 * 60 + 10)).toBe(true)
    expect(bedtime(ada, 20 * 60)).toBe(false)
    const s = { ...newGame(), minutes: 23 * 60 }
    const sim = newSim([24, 22], s)
    const [x, y] = bedOf(ada)
    expect(sim.npcs.chick!.x).toBe(x * 16 + 8)
    expect(sim.npcs.chick!.y).toBe(y * 16 + 8)
    expect(knockLine(sim, s, "chick")).toMatch(/asleep/)
  })
})
