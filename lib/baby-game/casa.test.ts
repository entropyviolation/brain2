import { describe, expect, it } from "vitest"
import { blockedAt, CT, FLOORS, floorOf, newWalker, spotNear, stepWalker, takeStairs, type FloorId } from "./casa"

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
    const w = newWalker(0, [24, 11])
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
    const w = newWalker(1, [14, 9])
    for (let i = 0; i < 60; i++) stepWalker(w, { dx: 0, dy: -1, run: false }, 0.05)
    expect(w.y).toBeGreaterThanOrEqual(8 * CT)
    const c = newWalker(1, [10, 9])
    for (let i = 0; i < 60; i++) stepWalker(c, { dx: 1, dy: 0, run: true }, 0.05)
    expect(c.x).toBeLessThan(11 * CT)
  })
})
