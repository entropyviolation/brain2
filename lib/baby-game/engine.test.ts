import { describe, expect, it } from "vitest"
import { RESIDENTS, approachDistance, temper, type Condition } from "./cast"
import {
  advance, approach, ask, askBlocks, chat, conditionMet, craft, DAY_LIMIT, favor, fish, gather, gift, hearts, makeErrands, newGame,
  placePart, sleep, spook, talk, turnIn, weatherFor, type GameState,
} from "./engine"
import { LAMP_PARTS } from "./items"
import { scriptedReply } from "./llm"

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
    expect(new Set(Array.from({ length: 40 }, (_, i) => weatherFor(i + 1))).size).toBe(2)
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

  it("holds Pippin to the morning", () => {
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
  it("can be finished: all twenty keepsakes, five parts, a lit lamp", () => {
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
    expect(s.stats.keepsakes).toBe(20)
  })

  it("makes errands from friends whose zone is open", () => {
    for (let day = 1; day < 30; day++) {
      for (const e of makeErrands(day, 2)) expect(RESIDENTS.find((r) => r.id === e.who)!.act).toBeLessThanOrEqual(2)
    }
  })
})
