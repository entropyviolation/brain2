import { describe, expect, it } from "vitest"
import { PLACEMENTS, furnitureSolids } from "./casa-furniture"
import { MADE_PAINTERS } from "../../components/BabyGame/casa-made"
import { MADE, pieceSize } from "./casa-pieces"
import { blockedAt, CEIL, CT, FLOOR_TOP, FLOORS, floorOf, newWalker, spotNear, stepWalker, takeStairs, type FloorId } from "./casa"

function reach(id: FloorId, from: [number, number]) {
  const f = floorOf(id)
  const seen = new Set<string>([from.join(",")])
  const queue = [from]
  while (queue.length) {
    const [x, y] = queue.shift()!
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const ny = y + dy
      if (blockedAt(f, nx * CT + 8, ny * CT + 8) || seen.has(`${nx},${ny}`)) continue
      seen.add(`${nx},${ny}`)
      queue.push([nx, ny])
    }
  }
  return seen
}

describe("casa", () => {
  it("has a free spawn on every floor", () => {
    for (const f of FLOORS) expect(blockedAt(f, f.spawn[0] * CT + 8, f.spawn[1] * CT + 8)).toBe(false)
  })

  it("lets you walk to every spot, or to a tile beside it", () => {
    for (const f of FLOORS) {
      const open = reach(f.id, f.spawn)
      for (const s of f.spots) {
        const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]].some(([dx, dy]) => open.has(`${s.x + dx!},${s.y + dy!}`))
        expect(near, `${f.name}: ${s.id}`).toBe(true)
      }
    }
  })

  it("lands every staircase on open floor, and the stairs come back", () => {
    for (const f of FLOORS) {
      for (const s of f.spots.filter((x) => x.to)) {
        const to = floorOf(s.to!.floor)
        expect(blockedAt(to, s.to!.x * CT + 8, s.to!.y * CT + 8), `${f.name}: ${s.id}`).toBe(false)
        expect(reach(to.id, to.spawn).has(`${s.to!.x},${s.to!.y}`), `${f.name}: ${s.id} lands somewhere you can leave`).toBe(true)
      }
    }
    const stair = floorOf(0).spots.find((x) => x.kind === "up")!
    const w = newWalker(0, [stair.x, stair.y])
    const up = spotNear(w)!
    expect(up.kind).toBe("up")
    takeStairs(w, up)
    expect(w.floor).toBe(1)
  })

  it("has the exit on the Hall, the bed in the Loft, and nothing else of either", () => {
    const kinds = (id: FloorId) => floorOf(id).spots.map((s) => s.kind)
    expect(kinds(0)).toContain("exit")
    expect(kinds(2)).toContain("bed")
    expect(kinds(1)).not.toContain("exit")
    expect(kinds(1)).not.toContain("bed")
  })

  it("stops a walker at the back wall and at a column", () => {
    const w = newWalker(1, [14, 9 + CEIL])
    for (let i = 0; i < 60; i++) stepWalker(w, { dx: 0, dy: -1, run: false }, 0.05)
    expect(w.y).toBeGreaterThanOrEqual(FLOOR_TOP * CT)
    const c = newWalker(1, [10, 9 + CEIL])
    for (let i = 0; i < 60; i++) stepWalker(c, { dx: 1, dy: 0, run: true }, 0.05)
    expect(c.x).toBeLessThan(11 * CT)
  })

  it("has six rooms, the three new ones reached by a door that comes back", () => {
    expect(FLOORS.map((f) => f.name)).toEqual(["The Hall", "The Noble Floor", "The Loft", "The Sunken Lounge", "The Glasshouse", "The Boudoir"])
    for (const id of [3, 4, 5] as const) {
      const out = floorOf(id).spots.find((x) => x.kind === "door")!
      const back = floorOf(out.to!.floor).spots.find((x) => x.kind === "door" && x.to!.floor === id)!
      expect(back, `${floorOf(id).name} has a door in`).toBeTruthy()
    }
  })

  it("furnishes every room from sprites that exist, and keeps the way through open", () => {
    for (const pl of PLACEMENTS) expect(pieceSize(pl.id), `${pl.floor}:${pl.id} has a sprite or a painter`).toBeTruthy()
    for (const f of FLOORS) {
      expect(furnitureSolids(f.id).length).toBeGreaterThan(0)
      const open = reach(f.id, f.spawn)
      expect(open.size, `${f.name}: you can still walk about`).toBeGreaterThan(60)
    }
  })

  it("puts a look on every piece that has something to say", () => {
    for (const pl of PLACEMENTS.filter((x) => x.look)) {
      const f = floorOf(pl.floor)
      expect(f.spots.some((s) => s.label === (pl.label ?? pl.id)), pl.id).toBe(true)
    }
  })

  it("has a painter for every piece that is made in code, and a size for every painter", () => {
    expect(Object.keys(MADE).sort()).toEqual([...MADE_PAINTERS].sort())
  })
})
