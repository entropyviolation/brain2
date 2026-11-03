import { describe, expect, it } from "vitest"
import { RESIDENTS, resident } from "./cast"
import { DEFAULT_ECONOMY, ECONOMIES, economyOf, inferEconomy, lovesGems, parseEconomy } from "./economy"
import { drawLimit, freeRiding, gift, newGame, payOut, setEconomy, tasteOf, thanksLabel } from "./engine"

describe("economy presets", () => {
  it("defaults to a gift economy with no market", () => {
    const e = economyOf(newGame())
    expect(e.id).toBe(DEFAULT_ECONOMY)
    expect(e.market).toBe("none")
    expect(e.rewards).toBe("gifts")
  })

  it("leans to gifts: only one baked preset keeps a market", () => {
    expect(Object.values(ECONOMIES).filter((e) => e.market === "remnant").map((e) => e.id)).toEqual(["mixed"])
    for (const e of Object.values(ECONOMIES)) expect(parseEconomy(e, e)).toEqual(e)
  })
})

describe("gems are a gift, not money", () => {
  it("thanks arrive as gems in the bag, and buttons stay at zero", () => {
    const n = newGame()
    const words = payOut(n, 12)
    expect(words).toBe("4 gems")
    expect(n.inv.gem).toBe(3 + 4)
    expect(n.buttons).toBe(0)
    expect(thanksLabel(newGame(), 0)).toBe("")
  })

  it("only a market remnant pays scrip", () => {
    const n = setEconomy(newGame(), ECONOMIES.mixed!)
    expect(n.buttons).toBe(12)
    expect(payOut(n, 5)).toBe("5 buttons")
    expect(n.buttons).toBe(17)
  })

  it("most friends love a gem, picked stably by gemLove", () => {
    const lovers = RESIDENTS.filter((r) => lovesGems(r.id, ECONOMIES["gift-commons"]!.gemLove))
    expect(lovers.length).toBeGreaterThan(RESIDENTS.length / 2)
    expect(lovers.length).toBeLessThan(RESIDENTS.length)
    expect(RESIDENTS.filter((r) => lovesGems(r.id, 0))).toHaveLength(0)
    const fan = lovers.find((r) => r.hates !== "shiny")!
    expect(tasteOf(fan, "gem")).toBe("love")
    expect(gift(newGame(), fan.id, "gem").s.animals[fan.id]!.trust).toBeGreaterThanOrEqual(8)
    expect(resident(fan.id)).toBeTruthy()
  })
})

describe("the shelf follows the economy", () => {
  it("a mutual aid world never mirrors and gives more by need", () => {
    const s = { ...newGame(), economy: ECONOMIES["mutual-aid"], commons: { ...newGame().commons, took: 50, gave: 0, lastGave: -5 } }
    expect(freeRiding(s)).toBe(false)
    expect(freeRiding({ ...s, economy: undefined })).toBe(true)
    expect(drawLimit({ ...s, energy: 10 })).toBe(4 + 2)
  })
})

describe("generated economies", () => {
  it("clamps anything a model returns to the closed shape", () => {
    const e = parseEconomy({ name: "X", market: "casino", rewards: "scrip", gemRate: 50, shelf: { share: -3, mirrorGap: null }, population: { size: 9000, labor: "slavery" } })
    expect(e.market).toBe("none")
    expect(e.rewards).toBe("gifts")
    expect(e.gemRate).toBe(1)
    expect(e.shelf.share).toBe(1)
    expect(e.shelf.mirrorGap).toBeNull()
    expect(e.population.size).toBe(60)
    expect(e.population.labor).toBe("by ability")
    expect(parseEconomy(null).id).toBe(DEFAULT_ECONOMY)
  })

  it("reads the player's words, leaning toward gifts", () => {
    expect(inferEconomy("a cozy village").market).toBe("none")
    expect(inferEconomy("from each according to ability, an assembly decides").population.decisions).toBe("assembly")
    expect(inferEconomy("Kropotkin mutual aid, no strings").shelf.mirrorGap).toBeNull()
    expect(inferEconomy("a tiny hamlet with a giveaway festival").population.size).toBe(10)
    expect(inferEconomy("a tiny hamlet with a giveaway festival").festival).toBe("giveaway")
    expect(inferEconomy("a world without money").market).toBe("none")
    expect(inferEconomy("a market town where you buy and sell").market).toBe("remnant")
    expect(inferEconomy("30 residents who love gems").population.size).toBe(30)
  })
})
