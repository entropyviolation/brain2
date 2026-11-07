import { describe, expect, it } from "vitest"
import { RESIDENTS, approachDistance, temper, type Condition } from "./cast"
import {
  advance, approach, ask, canCraft, have, nodeReady, contribute, take, drawLimit, freeRiding, standing, deliverErrand, shelfCount, askBlocks, buy, stocked, chat, conditionMet, craft, DAY_LIMIT, favor, fish, gather, gift, hearts, makeErrands, newGame,
  addRealTask, claimQuest, completeRealTask, enterFestival, harvest, questProgress, urgentCount, visibleQuests, placePart, plant, playMinigame, sleep, sell, sellPrice, skillLevel, spook, starlogCount, talk, till, turnIn, water, waterAll, weatherFor, type GameState,
} from "./engine"
import { CROPS, cycleName, dayOfCycle, festivalOn, levelOf } from "./farm"
import { ITEMS, LAMP_PARTS, shellKindOf } from "./items"
import { NODES } from "./world"
import { councilTalk, scriptedReply } from "./llm"
import { spriteFor } from "./companion"
import { questById } from "./quests"
import { anchorFor } from "./sim"
import { ECONOMIES } from "./economy"

const rand = () => 0.5
const bond = { level: 1, routine: false }

function withItems(s: GameState, items: Record<string, number>): GameState {
  const n = structuredClone(s)
  for (const [id, q] of Object.entries(items)) n.inv[id] = (n.inv[id] ?? 0) + q
  return n
}

function setAnimal(s: GameState, id: string, patch: Partial<GameState["animals"][string]>): GameState {
  const n = structuredClone(s)
  const blank: GameState["animals"][string] = { trust: 0, mood: 0, stage: "new", talked: false, gifted: false, approached: false, favored: false, chats: 0, spooked: false, fed: false, played: false, heard: 0, cluedAt: 0 }
  n.animals[id] = { ...blank, ...(n.animals[id] ?? {}), ...patch }
  return n
}

describe("a day in the hollow", () => {
  it("starts clear and brings rain on a schedule", () => {
    expect(weatherFor(1)).toBe("clear")
    expect(weatherFor(3)).toBe("rain")
    const seen = new Set(Array.from({ length: 80 }, (_, i) => weatherFor(i + 1)))
    expect([...seen].sort()).toEqual(["clear", "fog", "meteor", "rain"])
  })

  it("gives trust for the first talk of the day and not the second", () => {
    const first = talk(newGame(), "chick", 0)
    const t1 = first.s.animals.chick!.trust
    expect(t1).toBeGreaterThan(0)
    expect(first.line).toContain("Peep")
    expect(talk(first.s, "chick", 1).s.animals.chick!.trust).toBe(t1)
    expect(talk(sleep(first.s, 1, bond), "chick", 2).s.animals.chick!.trust).toBeGreaterThan(t1)
  })

  it("tells the best approach from the worst, from the friend's own tone", () => {
    const tone = temper("chick").tone
    const right = approach(newGame(), "chick", tone)
    expect(right.s.animals.chick!.trust).toBe(5)
    const wrongTone = (["gentle", "playful", "direct", "coach"] as const).find((t) => approachDistance(tone, t) === 2)!
    expect(approach(newGame(), "chick", wrongTone).s.animals.chick!.trust).toBe(0)
    expect(approach(right.s, "chick", tone).ok).toBe(false)
  })

  it("reads a gift by tag: loved, liked, plain, or hated", () => {
    const s = withItems(newGame(), { quill: 1, berry: 2, pebble: 1 })
    expect(gift(s, "chick", "quill").s.animals.chick!.trust).toBe(8)
    expect(gift(s, "chick", "berry").s.animals.chick!.trust).toBe(4)
    expect(gift(s, "chick", "pebble").s.animals.chick!.trust).toBe(1)
    expect(gift(withItems(newGame(), { fish: 1 }), "chick", "fish").s.animals.chick!.mood).toBe(-1)
    expect(gift(gift(s, "chick", "berry").s, "chick", "berry").ok).toBe(false)
  })

  it("makes a quiet friend jump when you run, once", () => {
    const first = spook(newGame(), "fawn")
    expect(first.s.animals.fawn!.spooked).toBe(true)
    expect(spook(first.s, "fawn").ok).toBe(false)
    expect(spook(newGame(), "chick").ok).toBe(false)
  })

  it("costs energy for a favor and lets you try it once", () => {
    const done = favor(newGame(), "chick", 2)
    expect(done.s.energy).toBe(92)
    expect(done.s.animals.chick!.played).toBe(true)
    expect(favor(done.s, "chick", 2).ok).toBe(false)
  })

  it("gathers once a day and regrows overnight", () => {
    const s = newGame()
    const first = gather(s, "berry-0", "berry", rand)
    expect(first.ok).toBe(true)
    expect(first.s.inv.berry).toBeGreaterThan(2)
    expect(gather(first.s, "berry-0", "berry", rand).ok).toBe(false)
    expect(gather(sleep(first.s, 1, bond), "berry-0", "berry", rand).ok).toBe(true)
    expect(fish(s, "fish-9", 2, rand).s.inv.fish).toBe(2)
  })

  it("crafts from materials and refuses without them", () => {
    const made = craft(withItems(newGame(), { berry: 3 }), "jam")
    expect(made.s.inv.jam).toBe(1)
    expect(craft(newGame(), "jam").ok).toBe(false)
  })

  it("collapses at two in the morning and wakes on a fresh day", () => {
    const late = advance(newGame(), 100000)
    expect(late.minutes).toBe(DAY_LIMIT)
    const morning = sleep(late, 0.6, { level: 3, routine: true })
    expect(morning.day).toBe(2)
    expect(morning.minutes).toBe(360)
    expect(morning.maxEnergy).toBe(108)
    expect(morning.energy).toBe(Math.round(108 * 0.6) + 15)
  })
})

describe("asking for a keepsake", () => {
  const ctx = { crowd: 0 }
  const ready = (condition?: Condition) => {
    let s = setAnimal(withItems(newGame(), { jam: 1 }), "chick", { trust: 25 })
    s = turnIn(s, "chick").s
    s = setAnimal(s, "chick", { trust: 40 })
    if (condition) expect(RESIDENTS.find((r) => r.id === "chick")!.condition).toBe(condition)
    return s
  }

  it("needs the want turned in first, at two hearts", () => {
    expect(turnIn(setAnimal(withItems(newGame(), { jam: 1 }), "chick", { trust: 10 }), "chick").ok).toBe(false)
    expect(turnIn(setAnimal(newGame(), "chick", { trust: 30 }), "chick").ok).toBe(false)
    expect(turnIn(setAnimal(withItems(newGame(), { jam: 1 }), "chick", { trust: 25 }), "chick").s.animals.chick!.stage).toBe("turned")
  })

  it("holds Ada to the morning", () => {
    const s = ready("morning")
    expect(ask(s, "chick", ctx).s.inv["hatchling-bell"]).toBe(1)
    const noon = advance(s, 6 * 60)
    expect(ask(noon, "chick", ctx).ok).toBe(false)
    expect(askBlocks(noon, "chick", ctx)[0]).toMatch(/isn't right/i)
  })

  it("holds a friend to their heart gate", () => {
    const s = setAnimal(ready(), "chick", { trust: 25 })
    expect(hearts(s, "chick")).toBe(2)
    expect(ask(s, "chick", ctx).ok).toBe(false)
  })

  it("checks every kind of condition", () => {
    const s = newGame()
    const a = setAnimal(s, "chick", {}).animals.chick!
    expect(conditionMet(s, "rain", a, ctx)).toBe(false)
    expect(conditionMet({ ...s, weather: "rain" }, "rain", a, ctx)).toBe(true)
    expect(conditionMet(s, "dry", a, ctx)).toBe(true)
    expect(conditionMet(s, "alone", a, { crowd: 2 })).toBe(false)
    expect(conditionMet(s, "sneak", { ...a, spooked: true }, ctx)).toBe(false)
    expect(conditionMet(s, "fed", { ...a, fed: true }, ctx)).toBe(true)
    expect(conditionMet(s, "played", a, ctx)).toBe(false)
    expect(conditionMet({ ...s, minutes: 19 * 60 }, "evening", a, ctx)).toBe(true)
  })
})

describe("free talk", () => {
  it("clamps a model's nudge and caps it per day, and the facts come from the cast", () => {
    let s = newGame()
    const greedy = { say: "Hi!", trust: 99, reveal: "likes" as const, by: "model" as const }
    const first = chat(s, "chick", greedy)
    expect(first.s.animals.chick!.trust).toBe(2)
    expect(first.msgs.some((m) => /love bookish/i.test(m.text))).toBe(true)
    s = first.s
    for (let i = 0; i < 6; i++) s = chat(s, "chick", greedy).s
    expect(s.animals.chick!.trust).toBe(6)
  })

  it("only shares a clue once you have four hearts", () => {
    const early = chat(setAnimal(newGame(), "fawn", { trust: 10 }), "fawn", { say: "x", trust: 0, reveal: "clue", by: "scripted" })
    expect(early.s.animals.fawn!.cluedAt).toBe(0)
    const later = chat(setAnimal(newGame(), "fawn", { trust: 40 }), "fawn", { say: "x", trust: 0, reveal: "clue", by: "scripted" })
    expect(later.s.animals.fawn!.cluedAt).toBe(1)
  })

  it("answers without a model, from the script", () => {
    const r = RESIDENTS[0]!
    const reply = scriptedReply(r, newGame(), "What do you need? Thank you for talking.", 0)
    expect(reply.by).toBe("scripted")
    expect(reply.reveal).toBe("wants")
    expect(reply.trust).toBe(1)
    expect(scriptedReply(r, newGame(), "you are stupid", 0).trust).toBe(-1)
  })
})

describe("the whole story, played by a patient bot", () => {
  it("can be finished: every keepsake, five parts, a lit lamp", () => {
    let s = newGame()
    for (let act = 1; act <= 5; act++) {
      for (const r of RESIDENTS.filter((x) => x.act === act)) {
        s = setAnimal(s, r.id, { trust: 100 })
        const need: Record<string, number> = {}
        for (const w of r.wants) if (!s.inv[w]) need[w] = 1
        s = withItems(s, need)
        const turned = turnIn(s, r.id)
        expect(turned.ok, `${r.name} turn in`).toBe(true)
        s = turned.s
        // arrange the day to suit their secret
        s = { ...s, minutes: r.condition === "evening" ? 20 * 60 : 8 * 60, weather: r.condition === "rain" ? "rain" : "clear" }
        s = setAnimal(s, r.id, { fed: true, played: true, spooked: false })
        const got = ask(s, r.id, { crowd: 0 })
        expect(got.ok, `${r.name} ask: ${got.msgs[0]?.text}`).toBe(true)
        s = got.s
      }
      expect(s.inv[LAMP_PARTS[act - 1]!]).toBe(1)
      s = placePart(s, LAMP_PARTS[act - 1]!).s
    }
    expect(s.ended).toBe(true)
    expect(s.stats.keepsakes).toBe(RESIDENTS.length)
  })

  it("makes errands from friends whose zone is open", () => {
    for (let day = 1; day < 30; day++) {
      for (const e of makeErrands(day, 2)) expect(RESIDENTS.find((r) => r.id === e.who)!.act).toBeLessThanOrEqual(2)
    }
  })
})


describe("the farm", () => {
  const nights = (s: GameState, n: number) => {
    let cur = s
    for (let i = 0; i < n; i++) cur = sleep(cur, 1, bond)
    return cur
  }

  it("needs tilling, then a seed in its cycle, then water each night", () => {
    let s = newGame()
    expect(plant(s, "plot-0", "glowbean-seed").ok).toBe(false)
    s = till(s, "plot-0").s
    expect(till(s, "plot-0").ok).toBe(false)
    s = plant(s, "plot-0", "glowbean-seed").s
    expect(s.farm["plot-0"]!.crop).toBe("glowbean")
    // an unwatered night grows nothing; a watered one grows a step
    s = { ...sleep(s, 1, bond), weather: "clear" }
    expect(s.farm["plot-0"]!.grown).toBe(0)
    s = water(s, "plot-0").s
    s = sleep(s, 1, bond)
    expect(s.farm["plot-0"]!.grown).toBe(1)
  })

  it("lets rain do the watering and pays out a ripe crop", () => {
    let s = till(newGame(), "plot-1").s
    s = plant(s, "plot-1", "glowbean-seed").s
    s.farm["plot-1"]!.grown = CROPS.glowbean!.days
    const res = harvest(s, "plot-1", () => 1)
    expect(res.ok).toBe(true)
    expect(res.s.inv.glowbean).toBe(CROPS.glowbean!.yield)
    expect(res.s.farm["plot-1"]).toMatchObject({ tilled: true, grown: 0 })
    expect(res.s.skills.farming).toBeGreaterThan(0)
    expect(harvest(res.s, "plot-1", () => 1).ok).toBe(false)
  })

  it("stocks only seeds that can be planted today", () => {
    // only a world with a market remnant sells anything
    const s = { ...newGame(), buttons: 500, economy: ECONOMIES.mixed }
    const bean = buy(s, "glowbean-seed")
    expect(bean.ok).toBe(true)
    const pearl = buy(s, "snowpearl-seed")
    expect(pearl.ok).toBe(false)
    expect(pearl.msgs[0]!.text).toContain("until their cycle")
    expect(stocked(ITEMS["snowpearl-seed"]!, s.day)).toBe(false)
    expect(stocked(ITEMS["snowpearl-seed"]!, 22)).toBe(true)
  })

  it("gives every cycle at least two crops of its own", () => {
    for (let c = 0; c < 4; c++) expect(Object.values(CROPS).filter((x) => x.cycles.length === 1 && x.cycles[0] === c).length).toBeGreaterThanOrEqual(2)
  })

  it("refuses a seed out of its cycle", () => {
    let s = till(newGame(), "plot-2").s
    s = { ...s, inv: { ...s.inv, "snowpearl-seed": 1 } }
    const res = plant(s, "plot-2", "snowpearl-seed")
    expect(res.ok).toBe(false)
    expect(res.msgs[0]!.text).toContain("Deep Yin")
  })

  it("waters everything thirsty and stops when energy runs out", () => {
    let s = newGame()
    for (const id of ["plot-0", "plot-1", "plot-2"]) {
      s = till(s, id).s
      s = { ...s, inv: { ...s.inv, "glowbean-seed": 5 } }
      s = plant(s, id, "glowbean-seed").s
    }
    const res = waterAll({ ...s, energy: 2 })
    expect(res.s.energy).toBe(0)
    expect(Object.values(res.s.farm).filter((p) => p.watered)).toHaveLength(2)
  })

  it("levels skills with use and rewards each level", () => {
    expect(levelOf(0)).toBe(1)
    expect(levelOf(12)).toBe(2)
    expect(levelOf(100)).toBe(5)
    let s = newGame()
    s = { ...s, skills: { ...s.skills, foraging: 11 } }
    const res = gather(s, "berry-0", "berry", rand)
    expect(skillLevel(res.s, "foraging")).toBe(2)
    expect(res.msgs.some((m) => m.text.includes("level 2"))).toBe(true)
    expect(res.s.energy).toBe(s.energy - 3)
    expect(gather({ ...res.s, nodes: {} }, "berry-0", "berry", rand).s.energy).toBe(res.s.energy - 2)
  })

  it("runs a seven-day cycle with a festival on the last day", () => {
    expect(cycleName(1)).toBe("Lotus Bloom")
    expect(cycleName(8)).toBe("High Yang")
    expect(dayOfCycle(7)).toBe(7)
    expect(festivalOn(7)?.name).toBe("Petal Parade")
    expect(festivalOn(6)).toBeNull()
    expect(sellPrice("glowbean", 7)).toBeGreaterThan(sellPrice("glowbean", 6))
    let s = withItems(newGame(), { jam: 1 })
    s = { ...s, day: 7 }
    const res = enterFestival(s, "jam")
    expect(res.ok).toBe(true)
    expect(res.s.stats.ribbons).toBe(1)
    expect(enterFestival(res.s, "jam").ok).toBe(false)
    expect(enterFestival({ ...s, day: 6 }, "jam").ok).toBe(false)
  })

  it("keeps a Starlog of what you have held and pays on every fifth", () => {
    let s = newGame()
    const before = starlogCount(s)
    const res = gather(s, "acorn-0", "acorn", rand)
    expect(starlogCount(res.s)).toBe(before + 1)
    const extra = nights(res.s, 1)
    expect(extra.found.acorn).toBe(true)
  })

  it("lets a lucky crafter make two", () => {
    let s = { ...withItems(newGame(), { berry: 3 }), skills: { farming: 0, foraging: 0, fishing: 0, crafting: 12 } }
    const res = craft(s, "jam", () => 0)
    expect(res.s.inv.jam).toBe(2)
  })
})

describe("mini game rewards", () => {
  it("pays once a day per game, and only after dark for the glade", () => {
    const s = newGame()
    expect(playMinigame(s, "glade", 2).ok).toBe(false)
    const night = { ...s, minutes: 21 * 60 }
    const first = playMinigame(night, "glade", 2)
    expect(first.ok).toBe(true)
    expect(first.s.inv.firefly).toBe(4)
    const second = playMinigame(first.s, "glade", 2)
    expect(second.s.inv.firefly).toBe(4)
    expect(second.s.energy).toBeLessThan(first.s.energy)
    expect(playMinigame(s, "echo", 0).s.inv.echopetal).toBeUndefined()
    expect(playMinigame(s, "echo", 1).s.inv.echopetal).toBe(1)
    expect(playMinigame({ ...s, energy: 1 }, "stairs", 2).ok).toBe(false)
  })
})

describe("quests and the real-life council", () => {
  it("shows a quest once its giver trusts you, and pays it when the objective is met", () => {
    let s = newGame()
    expect(visibleQuests(s).some((q) => q.id === "breakfast-song")).toBe(false)
    s = setAnimal(s, "chick", { trust: 25 })
    expect(visibleQuests(s).some((q) => q.id === "breakfast-song")).toBe(true)
    expect(claimQuest(s, "breakfast-song").ok).toBe(false)
    s = withItems(s, { berry: 3 })
    const res = claimQuest(s, "breakfast-song")
    expect(res.ok).toBe(true)
    expect(res.s.questsDone["breakfast-song"]).toBe(true)
    expect(res.s.inv["glowbean-seed"]).toBe(6)
    expect(claimQuest(res.s, "breakfast-song").ok).toBe(false)
  })

  it("counts crafts, fish, harvests and mini games toward quests", () => {
    let s = newGame()
    s = craft(withItems(s, { reed: 3 }), "basket").s
    expect(questProgress(s, questById("cozy-nest")!).ready).toBe(true)
    s = fish(s, "fish-x", 1, rand).s
    expect(s.stats.fished).toBe(1)
    s = playMinigame(s, "echo", 1).s
    expect(questProgress(s, questById("purr-experiment")!).ready).toBe(true)
  })

  it("holds real-life tasks, rewards finishing them, and pulls friends to the fire when urgent", () => {
    let s = addRealTask(newGame(), "book flights to New York", true).s
    expect(s.real).toHaveLength(1)
    expect(urgentCount(s)).toBe(1)
    expect(addRealTask(s, "   ", false).ok).toBe(false)
    const done = completeRealTask(s, s.real[0]!.id)
    expect(done.ok).toBe(true)
    expect(done.s.inv.gem).toBe((s.inv.gem ?? 0) + Math.round(18 * ECONOMIES["gift-commons"]!.gemRate))
    expect(done.s.buttons).toBe(s.buttons)
    expect(urgentCount(done.s)).toBe(0)
    expect(completeRealTask(done.s, s.real[0]!.id).ok).toBe(false)
    const resident = RESIDENTS.find((r) => r.id === "chick")!
    const sim = anchorFor(resident, { ...s, minutes: 10 * 60 }, 0)
    expect(sim.gathering).toBe(true)
    expect(anchorFor(resident, { ...done.s, minutes: 10 * 60 }, 0).gathering).toBe(false)
  })

  it("answers the council from a script with no model, and keeps to awake friends", async () => {
    const s = addRealTask({ ...newGame(), minutes: 10 * 60 }, "finish the CD designs", true).s
    const reply = await councilTalk(s, s.real[0]!, "I'm stuck", null, 0)
    expect(reply.lines.length).toBeGreaterThan(0)
    expect(reply.plan).toHaveLength(3)
    const fake = await councilTalk(s, s.real[0]!, "hi", async () => ({ lines: [{ who: "chick", say: "We're with you." }, { who: "nobody", say: "x" }], plan: ["Open the file."] }), 0)
    expect(fake.lines).toHaveLength(1)
    expect(fake.lines[0]!.by).toBe("model")
  })
})

describe("the companion's sprite", () => {
  it("uses the hand-drawn hyrax for a friend whose name says so, even when the id does not", () => {
    expect(spriteFor("img-3f9a", "baby hyrax of contentedness")).toBe("hyrax")
    expect(spriteFor("hyrax")).toBe("hyrax")
    expect(spriteFor("bunny", "Thimble")).toBe("bunny")
  })
})


describe("the Commons", () => {
  const bond = { level: 1, routine: false }
  const nights = (s: GameState, n: number) => {
    let cur = s
    for (let i = 0; i < n; i++) cur = sleep(cur, 1, bond)
    return cur
  }
  const known = (s: GameState, id: string, trust = 20): GameState => ({ ...s, animals: { ...s.animals, [id]: { ...(s.animals[id] ?? { trust: 0, mood: 0, stage: "new", talked: false, gifted: false, approached: false, favored: false, chats: 0, spooked: false, fed: false, played: false, heard: 0, cluedAt: 0 }), trust } } })

  it("starts with a stocked shelf you can take from free", () => {
    const s = newGame()
    expect(shelfCount(s)).toBeGreaterThan(0)
    const r = take(s, "berry")
    expect(r.ok).toBe(true)
    expect(r.s.buttons).toBe(s.buttons)
    expect(r.s.inv.berry).toBe((s.inv.berry ?? 0) + 1)
  })

  it("limits the daily share, and refills it at dawn", () => {
    let s = newGame()
    for (let i = 0; i < drawLimit(newGame()); i++) s = take(s, "berry").s
    expect(take(s, "clover").ok).toBe(false)
    expect(sleep(s, 1, bond).commons.drawn).toBe(0)
  })

  it("lets you leave things and rewards giving with standing, not money", () => {
    let s = newGame()
    for (let i = 0; i < 4; i++) s = contribute({ ...s, inv: { ...s.inv, pebble: 1 } }, "pebble").s
    expect(s.commons.gave).toBe(4)
    expect(standing(s).name).toBe("Neighbor")
    expect(drawLimit(s)).toBeGreaterThan(drawLimit(newGame()))
    expect(s.buttons).toBe(newGame().buttons)
  })

  it("refuses what cannot be shared", () => {
    expect(contribute(newGame(), "berry-nonexistent").ok).toBe(false)
    expect(contribute({ ...newGame(), inv: { orb1: 1 } }, "orb1").ok).toBe(false)
  })

  it("has friends who know you stock the shelf each morning", () => {
    const s = known(newGame(), "chick")
    const next = sleep(s, 1, bond)
    expect(next.commons.stock.berry ?? 0).toBeGreaterThan(s.commons.stock.berry ?? 0)
    expect(next.today.join(" ")).toMatch(/stocked the Commons/)
  })

  it("returns a gift in kind next morning (tit for tat)", () => {
    let s = known({ ...newGame(), inv: { berry: 2 } }, "chick")
    s = gift(s, "chick", "berry").s
    const next = sleep(s, 1, bond)
    expect(next.inv.berry ?? 0).toBeGreaterThan(s.inv.berry ?? 0)
    expect(next.today.join(" ")).toMatch(/returned the favor/)
  })

  it("mirrors someone who only takes, and forgives them when they give once", () => {
    let s = known({ ...newGame(), day: 10, inv: { berry: 2 } }, "chick")
    s = { ...s, commons: { ...s.commons, took: 12, gave: 0, lastGave: 0 } }
    expect(freeRiding(s)).toBe(true)
    expect(drawLimit(s)).toBe(1)
    const gifted = gift(s, "chick", "berry").s
    const next = sleep(gifted, 1, bond)
    expect(next.today.join(" ")).toMatch(/did not return/)
    const forgiven = contribute({ ...s, inv: { pebble: 1 } }, "pebble").s
    expect(freeRiding(forgiven)).toBe(false)
  })

  it("thanks an errand in kind: gems and the friend's own offering, never wages", () => {
    const s = newGame()
    const e = s.errands[0]!
    const r = deliverErrand({ ...s, inv: { ...s.inv, [e.item]: e.qty } }, e.id)
    expect(r.ok).toBe(true)
    expect(r.s.buttons).toBe(0)
    expect(r.s.inv.gem).toBeGreaterThan(s.inv.gem ?? 0)
  })

  it("pays scrip only where the economy keeps a market remnant", () => {
    const s = { ...newGame(), economy: ECONOMIES.mixed }
    const e = s.errands[0]!
    const r = deliverErrand({ ...s, inv: { ...s.inv, [e.item]: e.qty } }, e.id)
    expect(r.s.buttons).toBe(s.buttons + Math.ceil(e.reward / 2))
  })

  it("keeps selling to the Stump a way of stocking the shelf", () => {
    expect(sell({ ...newGame(), inv: { pebble: 1 } }, "pebble").ok).toBe(false)
    const s = { ...newGame(), inv: { pebble: 1 }, economy: ECONOMIES.mixed }
    const r = sell(s, "pebble")
    expect(r.s.commons.stock.pebble).toBe((s.commons.stock.pebble ?? 0) + 1)
  })
})

describe("shells", () => {
  const shellNode = NODES.find((n) => n.kind === "shell")!

  it("a shell node gives the kind its id fixes, and every kind counts as a shell", () => {
    const r = gather(newGame(), shellNode.id, "shell", () => 0)
    const id = `shell-${shellKindOf(shellNode.id)}`
    expect(r.s.inv[id]).toBe(1)
    expect(have(r.s, "shell")).toBe(1)
    const two = { ...r.s, inv: { ...r.s.inv, "shell-cowrie": 1 } }
    expect(have(two, "shell")).toBe(2)
    expect(canCraft({ ...two, inv: { ...two.inv, reed: 1 } }, "chime")).toBe(true)
    const crafted = craft({ ...two, inv: { ...two.inv, reed: 1 } }, "chime")
    expect(crafted.s.inv.chime).toBe(1)
    expect(have(crafted.s, "shell")).toBe(0)
  })

  it("a picked node stays picked until the next day", () => {
    const r = gather(newGame(), shellNode.id, "shell", () => 0)
    expect(nodeReady(r.s, shellNode.id)).toBe(false)
    expect(nodeReady({ ...r.s, day: r.s.day + 1 }, shellNode.id)).toBe(true)
  })
})
