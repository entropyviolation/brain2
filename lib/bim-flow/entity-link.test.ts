import { describe, expect, it } from "vitest"
import { buildEntityIndex, describeLinks, linkEntities, linkText, normalizeWord } from "./entity-link"
import type { VaultSnapshot } from "./vault-search"

const snap: VaultSnapshot = {
  items: [
    { id: "i1", title: "Garlic confit", listIds: ["cook"] },
    { id: "i2", title: "Macbook charger brick", listIds: ["needed"] },
    { id: "i3", title: "garlic fan account", listIds: ["ig"] },
    { id: "p1", title: "Elijah Gibbins-Croft", type: "person", listIds: ["cook"] },
    { id: "p2", title: "Elijah Moore", type: "person", listIds: [] },
    { id: "p3", title: "Alexis Reed", type: "person", listIds: [] },
  ],
  lists: [
    { id: "cook", name: "cook" },
    { id: "needed", name: "Needed" },
    { id: "ig", name: "People who follow me on Instagram" },
  ],
  habits: [{ id: "h1", title: "Go outside" }],
  scopes: [{ id: "activity", name: "Activity", pens: [{ id: "a1", name: "cooking" }, { id: "a2", name: "walking" }] }],
  skipListIds: new Set(["ig"]),
  people: [
    { id: "p1", title: "Elijah Gibbins-Croft", names: ["Elijah Gibbins-Croft", "Eli G"] },
    { id: "p2", title: "Elijah Moore", names: ["Elijah Moore"] },
    { id: "p3", title: "Alexis Reed", names: ["Alexis Reed", "Lex"] },
  ],
}

describe("entity linking", () => {
  it("folds plurals and possessives", () => {
    expect(normalizeWord("Elijah's")).toBe("elijah")
    expect(normalizeWord("pens")).toBe("pen")
    expect(normalizeWord("glass")).toBe("glass")
  })

  it("links a topic by its longest name, and a person by a nickname", () => {
    const out = linkText(snap, "made garlic confit with Lex")
    const confit = out.find((m) => m.text === "garlic confit")!
    expect(confit.status).toBe("linked")
    expect(confit.best?.label).toBe("Garlic confit")
    expect(confit.kind).toBe("topic")
    const lex = out.find((m) => m.text === "Lex")!
    expect(lex.best?.label).toBe("Alexis Reed")
    expect(lex.kind).toBe("person")
  })

  it("links a pen and a habit as topics", () => {
    const out = linkText(snap, "cooking now, then go outside")
    expect(out.map((m) => m.best?.sub)).toEqual(["pen", "habit"])
  })

  it("returns both people when one first name fits two", () => {
    const out = linkText(snap, "called Elijah")
    expect(out).toHaveLength(1)
    expect(out[0]!.status).toBe("ambiguous")
    expect(out[0]!.candidates.map((c) => c.label).sort()).toEqual(["Elijah Gibbins-Croft", "Elijah Moore"])
  })

  it("lets a full name beat a shared first name", () => {
    const out = linkText(snap, "dinner with Elijah Moore")
    expect(out[0]!.status).toBe("linked")
    expect(out[0]!.best?.label).toBe("Elijah Moore")
  })

  it("uses a shared list to break a tie between people", () => {
    const out = linkText(snap, "garlic confit at Elijah's")
    const eli = out.find((m) => m.text.startsWith("Elijah"))!
    expect(eli.best?.label).toBe("Elijah Gibbins-Croft")
  })

  it("marks a name the vault lacks as NIL", () => {
    const out = linkText(snap, "walking with Priya")
    const priya = out.find((m) => m.text === "Priya")!
    expect(priya.status).toBe("nil")
    expect(priya.best).toBeUndefined()
  })

  it("does not link the first capital of a sentence or stopwords", () => {
    expect(linkText(snap, "Then the walk")).toEqual([])
  })

  it("catches a one-letter typo", () => {
    const out = linkText(snap, "garlik confit done")
    expect(out[0]!.best?.label).toBe("Garlic confit")
  })

  it("skips items that only sit on a noisy list", () => {
    const ix = buildEntityIndex(snap)
    expect([...ix.entities.keys()]).not.toContain("item:i3")
    expect(linkEntities(ix, "garlic fan account")[0]?.best?.label).not.toBe("garlic fan account")
  })

  it("describes links in plain lines", () => {
    const lines = describeLinks(linkText(snap, "called Elijah, then Priya"))
    expect(lines[0]).toContain("could be")
    expect(lines[1]).toContain("not in the vault")
  })
})
