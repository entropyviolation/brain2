import { describe, expect, it } from "vitest"
import { newGame } from "./engine"
import { applyReading, goldShots, ideasOf, nextSpan, replaceReading, setReadStyle, shareIdea, shelveBook, CHUNK, GOLD_MAX, type Book } from "./shelf"
import { applyTalk, scriptedTalk, talkSeed, talkWithModel } from "./chatter"
import type { ModelCall } from "@/lib/bim-flow/ollama"

const PAGES = "Rhizomes have no centre. ".repeat(400)
const book = { id: "b1", title: "A Thousand Plateaus", fileUri: "f", textUri: "t", chars: PAGES.length, pageStarts: [0, 4000, 8000] }

function withBook() {
  let s = newGame()
  s = shelveBook(s, "owl", book)
  return s
}
const sitting = (over = {}) => ({ from: 0, to: 4000, pageFrom: 1, pageTo: 2, takeaway: "Deleuze says a rhizome has no centre, unlike a tree. I think my burrow is more like that.", quote: "Rhizomes have no centre.", feeling: "moved", by: "model" as const, ideas: [{ name: "rhizome", gist: "A web with no root or centre." }], question: "Can anything with no centre still be led?", digest: "Rhizome versus tree.", belief: "Nothing needs a centre.", ...over })

describe("shelf: notes that last", () => {
  it("reads in bigger sittings than before", () => {
    expect(CHUNK).toBeGreaterThanOrEqual(4000)
    const span = nextSpan({ at: 0, chars: PAGES.length }, PAGES)
    expect(span.to - span.from).toBeGreaterThan(3000)
  })

  it("keeps ideas, a question and a digest on the book, and the question in memory", () => {
    const s = applyReading(withBook(), "owl", "b1", sitting())
    const b = s.shelves.owl![0]!
    expect(b.digest).toBe("Rhizome versus tree.")
    expect(b.ideas?.[0]).toMatchObject({ name: "rhizome", shared: 0, at: 0 })
    expect(b.readings[0]!.question).toMatch(/led/)
    expect(s.characters.owl!.memory.at(-1)!.text).toMatch(/Still wondering/)
    expect(ideasOf(s, "owl")[0]!.book).toBe("A Thousand Plateaus")
  })

  it("counts an idea as shared so the next talk reaches for another", () => {
    let s = applyReading(withBook(), "owl", "b1", sitting({ ideas: [{ name: "rhizome", gist: "A web." }, { name: "plateau", gist: "A stable intensity." }] }))
    expect(ideasOf(s, "owl")[0]!.shared).toBe(0)
    s = shareIdea(s, "owl", "b1", ideasOf(s, "owl")[0]!.name)
    const order = ideasOf(s, "owl")
    expect(order[0]!.shared).toBe(0)
    expect(order.at(-1)!.shared).toBe(1)
  })
})

describe("shelf: the player's perfect version", () => {
  it("replaces the log, memory, ideas and the belief the model added", () => {
    let s = applyReading(withBook(), "owl", "b1", sitting())
    expect(s.minds.owl!.beliefs).toContain("Nothing needs a centre.")
    s = replaceReading(s, "owl", "b1", 0, { takeaway: "A rhizome connects any point to any other; that is the claim.", quote: "Rhizomes have no centre.", ideas: [{ name: "connection", gist: "Any point joins any other." }], belief: "Connection comes before structure." }, PAGES.slice(0, 4000))
    const b = s.shelves.owl![0]!
    expect(b.readings[0]).toMatchObject({ by: "you", edited: true, takeaway: expect.stringMatching(/connects any point/) })
    expect(b.ideas?.map((i) => i.name)).toEqual(["connection"])
    expect(s.minds.owl!.beliefs).not.toContain("Nothing needs a centre.")
    expect(s.minds.owl!.beliefs).toContain("Connection comes before structure.")
    expect(s.characters.owl!.memory.filter((m) => m.kind === "read")).toHaveLength(1)
    expect(s.characters.owl!.memory.at(-1)!.text).toMatch(/connects any point/)
    expect(s.gold ?? []).toHaveLength(0)
  })

  it("with a note, keeps a gold example and feeds it to the next reading", () => {
    let s = applyReading(withBook(), "owl", "b1", sitting())
    s = replaceReading(s, "owl", "b1", 0, { takeaway: "Perfect.", quote: "Rhizomes have no centre." }, PAGES.slice(0, 4000), "It never said what the author claims.")
    expect(s.gold).toHaveLength(1)
    expect(s.gold![0]).toMatchObject({ friend: "owl", note: "It never said what the author claims.", gold: { takeaway: "Perfect." } })
    const shot = goldShots(s, "owl")[0]!
    expect(shot.passage.length).toBeLessThan(1000)
    expect(shot.passage).toMatch(/Rhizomes/)
  })

  it("caps gold examples", () => {
    let s = applyReading(withBook(), "owl", "b1", sitting())
    for (let i = 0; i < GOLD_MAX + 5; i++) s = replaceReading(s, "owl", "b1", 0, { takeaway: `v${i}`, quote: "Rhizomes" }, "Rhizomes", "n")
    expect(s.gold).toHaveLength(GOLD_MAX)
  })

  it("remembers a friend's reading style", () => {
    expect(setReadStyle(newGame(), "owl", "allatonce").readStyle?.owl).toBe("allatonce")
  })
})

describe("deep talk", () => {
  const read = (s = withBook()) => applyReading(s, "owl", "b1", sitting())

  it("seeds a talk with an idea from a book, and the reader brings it up", () => {
    const seed = talkSeed(read(), "owl", "otter", 0)!
    expect(seed).toMatchObject({ opener: "owl", other: "otter", kind: "book" })
    expect(seed.idea.name).toBe("rhizome")
    expect(talkSeed(read(), "otter", "owl", 0)!.opener).toBe("owl")
  })

  it("falls back to a belief when nobody has read anything", () => {
    const seed = talkSeed(newGame(), "owl", "otter", 0)
    expect(seed === null || seed.kind === "belief").toBe(true)
  })

  it("plays turn by turn as each speaker and records what they learned", async () => {
    const s = read()
    const seen: string[] = []
    const call: ModelCall = async ({ system, schema }) => {
      seen.push(system)
      const props = (schema as { properties: Record<string, unknown> }).properties
      if ("learned" in props) return { mood: "warm", topic: "rhizome", learned: [{ who: "owl", text: "Centres are habits.", adopt: true }, { who: "otter", text: "I should ask what leads a web.", adopt: false }] }
      return { say: `line ${seen.length}` }
    }
    const t = await talkWithModel(s, "owl", "otter", "Moiré Pond", call, 0)
    expect(t.by).toBe("model")
    expect(t.lines.length).toBe(6)
    expect(t.lines.map((l) => l.who)).toEqual(["owl", "otter", "owl", "otter", "owl", "otter"])
    expect(seen[0]).toMatch(/rhizome/i)
    expect(seen[1]).toMatch(/not read "A Thousand Plateaus"|know nothing/)
    expect(seen[1]).toMatch(/line 1/)
    const next = applyTalk(s, t)
    expect(next.shelves.owl![0]!.ideas![0]!.shared).toBe(1)
    expect(next.minds.owl!.beliefs).toContain("Centres are habits.")
    expect(next.characters.otter!.memory.at(-1)!.text).toMatch(/learned from/)
  })

  it("ends where it got to if the model dies mid-talk, and uses the script if it never starts", async () => {
    let n = 0
    const dying: ModelCall = async () => {
      if (++n > 3) throw new Error("gone")
      return { say: "still here" }
    }
    const t = await talkWithModel(read(), "owl", "otter", "Pond", dying, 0)
    expect(t.lines).toHaveLength(3)
    const dead: ModelCall = async () => { throw new Error("gone") }
    const u = await talkWithModel(read(), "owl", "otter", "Pond", dead, 0)
    expect(u.by).toBe("scripted")
    expect(u.lines.length).toBeGreaterThanOrEqual(2)
  })

  it("the scripted talk names the idea and book when the reader opens", () => {
    const t = scriptedTalk(read(), "owl", "otter", "Pond", 0)
    expect(t.lines.some((l) => /rhizome/i.test(l.say))).toBe(true)
  })
})
