import { describe, expect, it } from "vitest"
import { RESIDENTS } from "./cast"
import { newGame } from "./engine"
import { itemNamesIn, keepsFacts, lineKind, voiceLine } from "./llm"
import { lifeBrief } from "./life"

describe("voicing a scripted line", () => {
  const r = RESIDENTS.find((x) => x.id === "duckling")!

  it("keeps a rewrite only if every item name and number survives", () => {
    const script = "Bring me a Shell Chime and 2 Clover."
    expect(itemNamesIn(script)).toEqual(expect.arrayContaining(["Shell Chime", "Clover"]))
    expect(keepsFacts(script, "Please! A shell chime and 2 clover, if you can.")).toBe(true)
    expect(keepsFacts(script, "I'd love a chime.")).toBe(false)
    expect(keepsFacts(script, "A Shell Chime and Clover please.")).toBe(false)
    expect(keepsFacts("Short.", "x".repeat(200))).toBe(false)
  })

  it("names what a line is, from the cast's own text", () => {
    expect(lineKind(r, r.hello)).toMatch(/hello/)
    expect(lineKind(r, r.story[1])).toMatch(/story/)
    expect(lineKind(r, r.quest)).toMatch(/need/)
    expect(lineKind(r, "nice weather")).toMatch(/everyday/)
  })

  it("returns null with no model, and uses a model's rewrite when it keeps the facts", async () => {
    const s = newGame()
    expect(await voiceLine(r, s, r.quest, "asking", null)).toBeNull()
    const good = await voiceLine(r, s, r.quest, "asking", async () => ({ say: r.quest }))
    expect(good).toBe(r.quest)
    const bad = await voiceLine(r, s, r.quest, "asking", async () => ({ say: "hm" }))
    expect(bad).toBeNull()
    const broken = await voiceLine(r, s, r.quest, "asking", async () => {
      throw new Error("down")
    })
    expect(broken).toBeNull()
  })

  it("turns real-life context into one gentle brief, or nothing", () => {
    expect(lifeBrief()).toBe("")
    expect(lifeBrief({})).toBe("")
    expect(lifeBrief({ habits: ["walk daily"], wishes: ["more rest"] })).toContain("walk daily")
  })
})
