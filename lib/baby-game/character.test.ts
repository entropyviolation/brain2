import { describe, expect, it } from "vitest"
import { RESIDENTS } from "./cast"
import { characterBrief, createCharacters, MEMORY_MAX, refreshCharacters, remember } from "./character"
import { gift, knock, newGame, talk } from "./engine"
import { ITEMS } from "./items"
import { QUESTS } from "./quests"

describe("the character contract", () => {
  it("creates the whole cast when a new game starts", () => {
    const s = newGame()
    expect(Object.keys(s.characters).sort()).toEqual(RESIDENTS.map((r) => r.id).sort())
  })

  it("gives every character looks, a name, a personality, a role, goals, quests, likes, a home and an empty memory", () => {
    for (const c of Object.values(createCharacters())) {
      expect(c.name, c.id).toBeTruthy()
      expect(c.looks.species).toBe(c.id)
      expect(c.looks.marks.length, `${c.name} looks`).toBeGreaterThan(15)
      expect(c.personality.tone && c.personality.cadence && c.personality.bio, `${c.name} personality`).toBeTruthy()
      expect(c.role.title && c.role.act >= 1, `${c.name} role`).toBeTruthy()
      expect(c.goals.length, `${c.name} goals`).toBeGreaterThan(0)
      for (const g of c.goals) for (const id of [...g.needs, g.gives]) expect(ITEMS[id], `${c.name} goal item ${id}`).toBeTruthy()
      expect(c.quests.length, `${c.name} quests`).toBeGreaterThan(0)
      for (const q of c.quests) expect(QUESTS.some((x) => x.id === q && x.giver === c.id)).toBe(true)
      expect(c.likes.tags.length, `${c.name} likes`).toBeGreaterThan(0)
      expect(c.home.name, `${c.name} home`).toBeTruthy()
      expect(c.memory).toEqual([])
    }
  })

  it("names exactly one keeper per act", () => {
    const cast = Object.values(createCharacters())
    for (let act = 1; act <= 5; act++) expect(cast.filter((c) => c.role.act === act && c.role.kind === "keeper")).toHaveLength(1)
  })

  it("remembers what happens, capped, and keeps memories across a reload", () => {
    let s = newGame()
    s = talk(s, "chick", 0).s
    s = gift({ ...s, inv: { ...s.inv, jam: 1 } }, "chick", "jam").s
    s = knock(s, "chick")
    expect(knock(s, "chick")).toBe(s)
    const kinds = s.characters.chick!.memory.map((m) => m.kind)
    expect(kinds).toEqual(["met", "gift", "visit"])
    const reloaded = refreshCharacters(JSON.parse(JSON.stringify(s.characters)))
    expect(reloaded.chick!.memory).toEqual(s.characters.chick!.memory)
    for (let i = 0; i < MEMORY_MAX + 5; i++) remember(reloaded, "chick", 1, "chat", `line ${i}`)
    expect(reloaded.chick!.memory).toHaveLength(MEMORY_MAX)
  })

  it("keeps a character the code does not know, so a generated cast survives a reload", () => {
    const stranger = { ...createCharacters().chick!, id: "heron", name: "Ursula" }
    expect(refreshCharacters({ heron: stranger }).heron).toEqual(stranger)
  })

  it("briefs the model with looks, role, home, goals and recent memory", () => {
    const cast = createCharacters()
    remember(cast, "owl", 3, "gift", "was given a Feather Quill and loved it")
    const brief = characterBrief(cast.owl!)
    expect(brief).toContain(cast.owl!.home.name)
    expect(brief).toContain("Feather Quill")
    expect(brief).toContain("look like")
  })
})
