import { describe, expect, it } from "vitest"
import { RESIDENTS } from "./cast"
import { bestBrief, collectMail, postLetters, scriptedLetter, unreadLetters } from "./bestie"
import { chat, isBestFriend, newGame, type GameState } from "./engine"
import { cleanSpec, forgeItem, nearestShape, registerCustom, scoreRows, toneOf } from "./forge"
import { applyLetterPatch, penLetter } from "./letters"
import { item } from "./items"
import { chatSystem } from "./llm"

const R = RESIDENTS[0]!
const withTrust = (trust: number): GameState => {
  const s = newGame()
  s.animals[R.id] = { ...(s.animals[R.id] ?? { trust: 0, mood: 0, stage: "new", talked: false, gifted: false, approached: false, favored: false, chats: 0, spooked: false, fed: false, played: false, heard: 0, cluedAt: 0 }), trust }
  return s
}
const always = () => 0

describe("best friends", () => {
  it("only a friend at 10 hearts counts, and only then are they told to say C and ask things", () => {
    expect(isBestFriend(withTrust(95), R.id)).toBe(false)
    expect(bestBrief(withTrust(95), R.id)).toBe("")
    expect(isBestFriend(withTrust(100), R.id)).toBe(true)
    expect(bestBrief(withTrust(100), R.id)).toContain("Call them C")
    expect(chatSystem(R, withTrust(100), 10)).toContain("Call them C")
    expect(chatSystem(R, withTrust(40), 4)).not.toContain("Call them C")
  })

  it("lets a best friend know what C said, and remembers the questions they asked", () => {
    const s = withTrust(100)
    const r = chat(s, R.id, { say: "Do you ever get lonely?", trust: 0, reveal: "none", by: "scripted" }, "I moved here alone last spring and I miss my sister")
    expect(r.s.aboutC?.[0]).toContain("my sister")
    expect(bestBrief(r.s, R.id)).toContain("my sister")
    const mem = r.s.characters[R.id]!.memory
    expect(mem.some((m) => m.kind === "told")).toBe(true)
    expect(mem.some((m) => m.kind === "asked")).toBe(true)
    // a friend who is not a best friend remembers it but does not file it under C
    expect(chat(withTrust(40), R.id, { say: "Hi.", trust: 0, reveal: "none", by: "scripted" }, "I moved here alone last spring").s.aboutC).toBeUndefined()
  })
})

describe("letters", () => {
  it("are posted overnight by best friends only, never over an unread one, and not every day", () => {
    expect(postLetters(withTrust(60), always).posted).toHaveLength(0)
    const first = postLetters(withTrust(100), always)
    expect(first.posted.length).toBeGreaterThan(0)
    expect(first.posted.every((l) => !l.read)).toBe(true)
    expect(postLetters(first.s, always).posted).toHaveLength(0)
    const read = { ...first.s, mail: first.s.mail!.map((l) => ({ ...l, read: true })), day: first.s.day + 1 }
    expect(postLetters(read, always).posted).toHaveLength(0)
    expect(postLetters({ ...read, day: first.s.day + 2 }, always).posted.length).toBeGreaterThan(0)
  })

  it("every kind has a scripted letter that says C", () => {
    for (const kind of ["question", "reading", "note", "gift"] as const) expect(scriptedLetter(withTrust(100), R.id, kind, always).text, kind).toContain("C")
    expect(scriptedLetter(withTrust(100), R.id, "reading", always).text).toContain("books")
  })

  it("are collected at the mailbox: read once, with the gift going into the bag", () => {
    const s = withTrust(100)
    s.mail = [{ id: "a", from: R.id, day: 1, kind: "gift", text: "C, for you.", gift: "pebble", read: false, by: "scripted" }]
    const n = structuredClone(s)
    const msgs = collectMail(n)
    expect(msgs.length).toBe(2)
    expect(n.inv.pebble).toBe((s.inv.pebble ?? 0) + 1)
    expect(unreadLetters(n)).toHaveLength(0)
    expect(collectMail(n)).toHaveLength(0)
  })

  it("a model's gift tools: invent_item is forged and kept, an unknown give_item is ignored", async () => {
    const s = withTrust(100)
    s.mail = [{ id: "g1", from: R.id, day: 1, kind: "gift", text: "draft", gift: "pebble", read: false, by: "scripted" }]
    const drawn = ["..kkkk..", ".kLLMMk.", "kLwMMMDk", "kLMMMMDk", "kMMMMMDk", ".kMMMDk.", "..kDDk..", "...kk..."]
    const call = async (req: { schema: Record<string, unknown> }) =>
      "tool" in (req.schema.properties as object)
        ? { text: "C, I made you a lantern of moonlight.", tool: "invent_item", invent_name: "Moon Lantern", invent_description: "A blue lantern with a soft glow", invent_kind: "trinket", invent_tags: ["shiny"], invent_color: "blue" }
        : { rows: drawn }
    const patch = await penLetter(s, s.mail[0]!, call)
    expect(patch?.made?.name).toBe("Moon Lantern")
    expect(patch?.made?.rows).toEqual(drawn)
    const out = applyLetterPatch(s, "g1", patch!)
    expect(out.custom?.["gift-g1"]).toBeTruthy()
    expect(out.mail![0]!.gift).toBe("gift-g1")
    expect(item("gift-g1").name).toBe("Moon Lantern")
    const bad = await penLetter(s, s.mail[0]!, async () => ({ text: "C!", tool: "give_item", give_item: "keepsake-nonsense" }))
    expect(bad?.gift).toBeUndefined()
    expect(await penLetter(s, s.mail[0]!, null)).toBeNull()
  })
})

describe("the item forge", () => {
  const good = ["..kkkk..", ".kLLMMk.", "kLwMMMDk", "kLMMMMDk", "kMMMMMDk", ".kMMMDk.", "..kDDk..", "...kk..."]

  it("scores a clean picture high and rubbish at zero", () => {
    expect(scoreRows(good)).toBeGreaterThan(0.7)
    expect(scoreRows(["........", "........", "........", "........", "........", "........", "........", "........"])).toBe(0)
    expect(scoreRows(["kkkk"])).toBe(0)
    expect(scoreRows(good.map((r) => r.replace(/M/g, "Z")))).toBe(0)
    expect(scoreRows(good.map(() => "kkkkkkkk"))).toBe(0)
  })

  it("cleans a spec to the closed shape", () => {
    const c = cleanSpec({ name: "<b>Sun Orb</b>!!", description: "x".repeat(400), kind: "weapon", tags: ["shiny", "evil", "SOFT"] })
    expect(c.name).toBe("bSun Orbb")
    expect(c.description.length).toBe(160)
    expect(c.kind).toBe("material")
    expect(c.tags).toEqual(["shiny", "soft"])
  })

  it("picks a shape and a colour from the words", () => {
    expect(nearestShape("a little glass lantern")).toBe("bulb")
    expect(nearestShape("something odd")).toBe("round")
    expect(toneOf("green", "")).toEqual(["g", "G", "h"])
  })

  it("draws with the model when a picture scores, and falls back to a nearby shape when none does", async () => {
    const spec = { name: "Moss Lantern", description: "a green lantern", kind: "trinket", tags: ["green"] }
    const a = await forgeItem(spec, "x1", async () => ({ rows: good }))
    expect(a.drawn).toBe("model")
    expect(a.def.rows).toEqual(good)
    const b = await forgeItem(spec, "x2", async () => ({ rows: ["nonsense"] }))
    expect(b.drawn).toBe("nearest")
    expect(b.def.shape).toBe("bulb")
    expect(b.def.tones).toEqual(["g", "G", "h"])
    expect((await forgeItem(spec, "x3", null)).drawn).toBe("nearest")
    registerCustom({ x2: b.def })
    expect(item("x2").name).toBe("Moss Lantern")
  })
})
