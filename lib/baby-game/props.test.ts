import { describe, expect, it } from "vitest"
import { ECONOMIES } from "./economy"
import { RESIDENTS } from "./cast"
import { DAY_START, newGame, type GameState } from "./engine"
import { propLabel, PROP_SCREEN, tryProp } from "./props"
import { buildWorld, FIRE_SLOTS, FLAT_PROPS, isSolidTile, NODES, PLOTS, PROPS, reachable, STATIONS, tileIndex, T, type PropKind } from "./world"

const world = buildWorld(RESIDENTS.map((r) => r.day))
const open = reachable(world, [24, 22], 5)
const at = (kind: PropKind, nth = 0) => PROPS.map((p, i) => [p.kind, i] as const).filter(([k]) => k === kind)[nth]![1]
const withItems = (s: GameState, items: Record<string, number>) => {
  const n = structuredClone(s)
  for (const [id, q] of Object.entries(items)) n.inv[id] = (n.inv[id] ?? 0) + q
  return n
}
const night = (s: GameState) => ({ ...structuredClone(s), minutes: 21 * 60 })

describe("prop placement", () => {
  it("stands each prop on open ground of its own, clear of nodes, stations, plots and fire seats", () => {
    const used = new Set<number>()
    const taken = new Set<number>([...NODES, ...Object.values(STATIONS), ...PLOTS].map((o) => tileIndex(o.x, o.y)))
    for (const [x, y] of FIRE_SLOTS) taken.add(tileIndex(x, y))
    for (const p of PROPS) {
      const i = tileIndex(p.x, p.y)
      expect(world.tiles[i], `${p.kind} ${p.x},${p.y}`).not.toBe(T.TREE)
      expect([T.WATER, T.ROCK, T.FENCE, T.WALL, T.ROOF, T.GATE, T.STONE, T.ARCH].includes(world.tiles[i] as never), `${p.kind} on a solid tile`).toBe(false)
      expect(used.has(i), `${p.kind} doubled up`).toBe(false)
      expect(taken.has(i), `${p.kind} sits on something`).toBe(false)
      used.add(i)
    }
  })

  it("makes every prop solid except the flat ones, and keeps every prop reachable", () => {
    for (const p of PROPS) {
      const i = tileIndex(p.x, p.y)
      expect(isSolidTile(world, p.x, p.y, 5), p.kind).toBe(!FLAT_PROPS.has(p.kind))
      const neighbor = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => open.has(tileIndex(p.x + dx!, p.y + dy!)))
      expect(neighbor || open.has(i), `${p.kind} ${p.x},${p.y}`).toBe(true)
    }
  })

  it("gives every prop something to do", () => {
    const s = newGame()
    PROPS.forEach((p, i) => expect(propLabel(s, i).length, p.kind).toBeGreaterThan(3))
    for (const kind of Object.keys(PROP_SCREEN)) expect(PROPS.some((p) => p.kind === kind)).toBe(true)
  })
})

describe("using props", () => {
  it("lets a prop be used once a day and again tomorrow", () => {
    const s = { ...newGame(), energy: 50 }
    const a = tryProp(s, at("well"), () => 0.5)
    expect(a.ok).toBe(true)
    expect(a.s.energy).toBe(62)
    expect(tryProp(a.s, at("well"), () => 0.5).ok).toBe(false)
    expect(tryProp({ ...a.s, day: a.s.day + 1 }, at("well"), () => 0.5).ok).toBe(true)
  })

  it("never changes the state it refuses", () => {
    const s = { ...newGame(), minutes: 10 * 60 }
    const r = tryProp(s, at("prism"), () => 0.5)
    expect(r.ok).toBe(true)
    const rain = { ...newGame(), minutes: 10 * 60, weather: "rain" as const }
    const refused = tryProp(rain, at("prism"), () => 0.5)
    expect(refused.ok).toBe(false)
    expect(refused.s).toBe(rain)
  })

  it("waters thirsty crops from the sprinkler, free", () => {
    const s = newGame()
    s.farm["plot-0"] = { tilled: true, crop: "glowbean", grown: 0, watered: false } as GameState["farm"][string]
    const r = tryProp(s, at("sprinkler"), () => 0.5)
    expect(r.s.farm["plot-0"]!.watered).toBe(true)
  })

  it("makes the scarecrow raise tomorrow's harvest luck for the day only", () => {
    const r = tryProp(newGame(), at("scarecrow"), () => 0.5)
    expect(r.s.seen[`scarecrow${r.s.day}`]).toBe(true)
  })

  it("trades kindling for honey at the wasp nest, and stings you without it", () => {
    const smoked = tryProp(withItems(newGame(), { kindling: 1 }), at("wasps"), () => 0.5)
    expect(smoked.s.inv.honey).toBe(2)
    expect(smoked.s.inv.kindling).toBeUndefined()
    const stung = tryProp(newGame(), at("wasps"), () => 0.5)
    expect(stung.s.energy).toBeLessThan(newGame().energy)
    expect(stung.s.inv.honey).toBeUndefined()
  })

  it("lights fireworks only at night, with a kindling, and cheers every friend", () => {
    const kit = withItems(newGame(), { kindling: 1 })
    expect(tryProp(kit, at("fireworks"), () => 0.5).ok).toBe(false)
    expect(tryProp(night(newGame()), at("fireworks"), () => 0.5).ok).toBe(false)
    const lit = tryProp(night(kit), at("fireworks"), () => 0.5)
    expect(lit.ok).toBe(true)
    expect(lit.s.inv.kindling).toBeUndefined()
    expect(lit.s.animals.chick?.trust).toBeGreaterThan(0)
  })

  it("gives back an hour from the clock, once a week, never before dawn", () => {
    const s = { ...newGame(), minutes: DAY_START + 200 }
    const r = tryProp(s, at("clock"), () => 0.5)
    expect(r.s.minutes).toBe(DAY_START + 140)
    expect(tryProp({ ...r.s, day: r.s.day + 1 }, at("clock"), () => 0.5).ok).toBe(false)
    expect(tryProp({ ...newGame(), minutes: DAY_START + 10 }, at("clock"), () => 0.5).ok).toBe(false)
  })

  it("has a picnic from the best food in the bag", () => {
    const hungry = withItems({ ...newGame(), energy: 20 }, { berry: 2, jam: 1 })
    const r = tryProp(hungry, at("blanket"), () => 0.5)
    expect(r.ok).toBe(true)
    expect(r.s.inv.jam).toBeUndefined()
    expect(r.s.energy).toBe(20 + 42)
    expect(tryProp(newGame(), at("blanket"), () => 0.5).ok).toBe(false)
  })

  it("swaps a trinket for a trinket at the thrift rack; only a market remnant sells there", () => {
    expect(tryProp(newGame(), at("thrift"), () => 0.5).ok).toBe(false)
    const r = tryProp(withItems(newGame(), { jam: 1 }), at("thrift"), () => 0.5)
    expect(r.ok).toBe(true)
    expect(r.s.inv.jam ?? 0).toBeLessThanOrEqual(1)
    const sold = tryProp({ ...newGame(), buttons: 10, economy: ECONOMIES.mixed }, at("thrift"), () => 0.5)
    expect(sold.s.buttons).toBe(4)
  })
})
