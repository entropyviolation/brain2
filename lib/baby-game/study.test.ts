import { describe, expect, it } from "vitest"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import { RESIDENTS } from "./cast"
import { applyTalk, pitchWithModel, scriptedPitch } from "./chatter"
import { newGame, type GameState } from "./engine"
import { chunkBook, hasQuote, searchLibrary, type Library } from "./passages"
import { shelveBook } from "./shelf"
import {
  activeManifesto, adoptTopic, announceManifestos, applyOutline, applyPitch, applySection, applyStudy, canWrite, giveCopy, hasCopy, manifestoDone, manifestoText, nextSection,
  pitchTarget, SESSIONS_FOR_TOPIC, shelfActivity, studyOf, syncCopies, topicDue, WORKBOOK_SESSIONS_FOR_OUTLINE, type SessionResult,
} from "./study"
import { outlineWithModel, runStudySession, scriptedOutline, scriptedSection, scriptedTopic, sectionWithModel, topicWithModel } from "./study-llm"

const OWL = RESIDENTS.find((r) => r.id === "owl")!.name

const TEXTS: Record<string, string> = {
  b1: "Courage is not the absence of fear but the choice to act while afraid. ".repeat(3) + "A pond keeps its stillness because nothing in it is forced. ".repeat(8) + "Gardens teach patience because seeds cannot be hurried by wanting. ".repeat(8),
  b2: "Friendship grows when two people share small kindnesses over many seasons. ".repeat(10) + "A fire is warm because many small sticks burn together. ".repeat(6),
}

const withBooks = (): GameState => {
  let s = newGame()
  for (const [id, text] of Object.entries(TEXTS)) s = shelveBook(s, "owl", { id, title: id === "b1" ? "On Courage" : "Small Kindnesses", fileUri: "f", textUri: "t", chars: text.length, pageStarts: [0, Math.floor(text.length / 2)] })
  return s
}
const lib = (s: GameState, id = "owl"): Library => ({ books: s.shelves[id]!, text: async (b) => TEXTS[b.id] ?? null })

const fake = (note: { idea: string; quote: string }): ModelCall => {
  let step = 0
  return async ({ schema }) => {
    const props = Object.keys((schema as { properties: Record<string, unknown> }).properties)
    if (props.includes("good")) return { good: true, worthy: true, truthful: true, why: "fine" }
    if (props.includes("action")) {
      step++
      const base = { theme: "courage", thought: "", query: "courage and fear", book: "", idea: "", quote: "" }
      if (step === 1) return { ...base, action: "search_shelf" }
      if (step === 2) return { ...base, action: "take_note", idea: "Courage invented from nothing", quote: "Bravery is a shiny hat that no one ever wore" }
      if (step === 3) return { ...base, action: "take_note", idea: note.idea, quote: note.quote }
      return { ...base, action: "finish" }
    }
    return { summary: "I studied courage and kept one note about acting while afraid." }
  }
}

describe("passages: searching the shelf", () => {
  it("cuts books into passages that remember their page, and finds the right one by words", async () => {
    const s = withBooks()
    const ps = chunkBook(s.shelves.owl![0]!, TEXTS.b1!)
    expect(ps.length).toBeGreaterThan(1)
    expect(ps.every((p) => p.page >= 1)).toBe(true)
    const got = await searchLibrary(lib(s), "patience seeds hurried", { k: 2 })
    expect(got[0]!.text).toMatch(/patience/)
    const only = await searchLibrary(lib(s), "kindnesses seasons", { only: s.shelves.owl![1]!, k: 1 })
    expect(only[0]!.bookId).toBe("b2")
  })

  it("re-ranks the shortlist by meaning when an embedding model answers, and keeps keyword order when it does not", async () => {
    const s = withBooks()
    const wants = (t: string) => (t.includes("fire") ? [1, 0] : [0, 1])
    const embed = async (texts: string[]) => texts.map((t, i) => (i === 0 ? [1, 0] : wants(t)))
    const got = await searchLibrary({ ...lib(s), embed }, "kindnesses", { k: 1 })
    expect(got).toHaveLength(1)
    const dead = await searchLibrary({ ...lib(s), embed: async () => null }, "patience", { k: 1 })
    expect(dead[0]!.text).toMatch(/patience/)
  })

  it("checks a quote word for word", () => {
    expect(hasQuote(TEXTS.b1!, "Courage is not the absence of fear but the choice to act while afraid.")).toBe(true)
    expect(hasQuote(TEXTS.b1!, "Courage is the presence of fear and a shiny hat.")).toBe(false)
  })
})

describe("study: the habit", () => {
  it("reads by default, studies a little more rarely, and only when there are books", () => {
    expect(shelfActivity(newGame(), "owl", 10)).toBe("read")
    const s = withBooks()
    const acts = Array.from({ length: 120 }, (_, d) => shelfActivity({ ...s, day: d + 1 }, "owl", 14))
    const study = acts.filter((a) => a === "study").length
    const read = acts.filter((a) => a === "read").length
    expect(study).toBeGreaterThan(15)
    expect(read).toBeGreaterThan(study)
    expect(acts).not.toContain("write")
  })

  it("studies instead of reading once every book is finished", () => {
    const s = withBooks()
    s.shelves.owl = s.shelves.owl!.map((b) => ({ ...b, at: b.chars }))
    for (let d = 1; d < 30; d++) expect(shelfActivity({ ...s, day: d }, "owl", 14)).toBe("study")
  })
})

describe("study: a session", () => {
  it("scripted: searches the shelf and keeps a note whose quote is really in the pages", async () => {
    const s = withBooks()
    const res = (await runStudySession(s, "owl", lib(s), null))!
    expect(res.session.by).toBe("scripted")
    expect(res.session.searches.length).toBeGreaterThan(0)
    for (const n of res.notes) expect(hasQuote(TEXTS[n.bookId]!, n.quote)).toBe(true)
    expect(res.session.summary.length).toBeGreaterThan(10)
  })

  it("does nothing when no book has words", async () => {
    const s = withBooks()
    expect(await runStudySession(s, "owl", { books: s.shelves.owl!, text: async () => null }, null)).toBeNull()
  })

  it("model: refuses a made-up quote, keeps only the note with a real one, and caps the session off", async () => {
    const s = withBooks()
    const real = "Courage is not the absence of fear but the choice to act while afraid."
    const res = (await runStudySession(s, "owl", lib(s), fake({ idea: "Being brave means acting even while you are afraid.", quote: real })))!
    expect(res.session.by).toBe("model")
    expect(res.session.refused).toBe(1)
    expect(res.notes).toHaveLength(1)
    expect(res.notes[0]).toMatchObject({ quote: real, book: "On Courage" })
    expect(res.session.summary).toMatch(/courage/i)
  })

  it("model: a note the second look rejects is not written down", async () => {
    const s = withBooks()
    const agent = fake({ idea: "Being brave means acting even while you are afraid.", quote: "Courage is not the absence of fear but the choice to act while afraid." })
    const call: ModelCall = async (req) => {
      const props = Object.keys((req.schema as { properties: Record<string, unknown> }).properties)
      if (props.includes("good")) return { good: true, worthy: false, truthful: true, why: "trivial" }
      return agent(req)
    }
    const res = (await runStudySession(s, "owl", lib(s), call))!
    expect(res.notes).toHaveLength(0)
    expect(res.session.refused).toBeGreaterThan(0)
  })
})

const session = (theme: string, n = 1): SessionResult => ({
  session: { day: 1, minute: 600, theme, summary: `studied ${theme}`, searches: [{ tool: "shelf", query: theme }], kept: n, refused: 0, by: "scripted" },
  notes: Array.from({ length: n }, (_, i) => ({ day: 1, idea: `${theme} idea ${i} about patience and gardens`, quote: `a real quote ${theme} ${i} from the book`, book: "On Courage", bookId: "b1", page: 1, theme })),
})

describe("study: from notebook to manifesto", () => {
  it("notes go to the notebook, and after ten sessions a topic is due; it is announced the next morning", () => {
    let s = withBooks()
    for (let i = 0; i < SESSIONS_FOR_TOPIC - 1; i++) s = applyStudy(s, "owl", session(`patience ${i}`))
    expect(topicDue(s, "owl")).toBe(false)
    s = applyStudy(s, "owl", session("patience 9"))
    expect(studyOf(s, "owl").notebook).toHaveLength(SESSIONS_FOR_TOPIC)
    expect(topicDue(s, "owl")).toBe(true)
    s = adoptTopic(s, "owl", scriptedTopic(s, "owl"))
    expect(topicDue(s, "owl")).toBe(false)
    expect(activeManifesto(s, "owl")).toBeNull()
    expect(announceManifestos(s).news).toHaveLength(0)
    const morning = announceManifestos({ ...s, day: s.day + 1 })
    expect(morning.news[0]).toMatch(new RegExp(`${OWL} has decided to write a manifesto about patience`))
    expect(activeManifesto(morning.s, "owl")).not.toBeNull()
    expect(announceManifestos(morning.s).news).toHaveLength(0)
  })

  function announced() {
    let s = withBooks()
    for (let i = 0; i < SESSIONS_FOR_TOPIC; i++) s = applyStudy(s, "owl", session(`patience ${i}`))
    s = adoptTopic(s, "owl", scriptedTopic(s, "owl"))
    return announceManifestos({ ...s, day: s.day + 1 }).s
  }

  it("after the announcement notes go to the workbook, and writing unlocks after three sessions", () => {
    let s = announced()
    expect(canWrite(s, "owl")).toBe(false)
    for (let i = 0; i < WORKBOOK_SESSIONS_FOR_OUTLINE; i++) s = applyStudy(s, "owl", session(`manifesto work ${i}`, 2))
    expect(studyOf(s, "owl").workbook).toHaveLength(6)
    expect(studyOf(s, "owl").notebook).toHaveLength(SESSIONS_FOR_TOPIC)
    expect(canWrite(s, "owl")).toBe(true)
    const writes = Array.from({ length: 120 }, (_, d) => shelfActivity({ ...s, day: d + 1 }, "owl", 14)).filter((a) => a === "write").length
    expect(writes).toBeGreaterThan(20)
  })

  it("writes an outline, then each section, until it is done", async () => {
    let s = announced()
    for (let i = 0; i < WORKBOOK_SESSIONS_FOR_OUTLINE; i++) s = applyStudy(s, "owl", session(`manifesto work ${i}`, 2))
    const outline = await outlineWithModel(s, "owl", null)
    expect(outline.sections.length).toBeGreaterThanOrEqual(5)
    expect(outline).toEqual(scriptedOutline(s, "owl"))
    s = applyOutline(s, "owl", outline)
    expect(applyOutline(s, "owl", outline)).toBe(s)
    const m = () => studyOf(s, "owl").manifesto!
    expect(m().outline.every((x) => !x.body)).toBe(true)
    while (!manifestoDone(m())) {
      const at = nextSection(m())
      s = applySection(s, "owl", at, await sectionWithModel(s, "owl", at, null))
    }
    expect(canWrite(s, "owl")).toBe(false)
    expect(scriptedSection(s, "owl", 2)).toMatch(/real quote/)
    const text = manifestoText(s, "owl")!
    expect(text.pageStarts.length).toBe(m().outline.length + 2)
    expect(text.text).toContain(m().title)
  })

  it("the model writes the outline and a section when it answers well, else the script stands", async () => {
    let s = announced()
    for (let i = 0; i < 3; i++) s = applyStudy(s, "owl", session(`manifesto work ${i}`, 2))
    const call: ModelCall = async ({ schema }) => {
      const props = Object.keys((schema as { properties: Record<string, unknown> }).properties)
      if (props.includes("sections")) return { title: "Patience, Plainly", thesis: "Patience is a way of seeing.", sections: ["One", "Two", "Three", "Four", "Five"].map((t) => ({ title: t, summary: `The ${t} part argues something.` })) }
      return { body: "x".repeat(260) }
    }
    const o = await outlineWithModel(s, "owl", call)
    expect(o.title).toBe("Patience, Plainly")
    s = applyOutline(s, "owl", o)
    expect(studyOf(s, "owl").manifesto!.title).toBe("Patience, Plainly")
    expect(await sectionWithModel(s, "owl", 0, call)).toHaveLength(260)
    expect(await sectionWithModel(s, "owl", 0, async () => ({ body: "short" }))).toBe(scriptedSection(s, "owl", 0))
    expect((await topicWithModel(s, "owl", async () => ({ topic: "patience", title: "Slow Seeds" }))).title).toBe("Slow Seeds")
  })
})

describe("study: sharing the manifesto", () => {
  async function written() {
    let s = withBooks()
    for (let i = 0; i < SESSIONS_FOR_TOPIC; i++) s = applyStudy(s, "owl", session(`patience ${i}`))
    s = adoptTopic(s, "owl", scriptedTopic(s, "owl"))
    s = announceManifestos({ ...s, day: s.day + 1 }).s
    for (let i = 0; i < 3; i++) s = applyStudy(s, "owl", session(`manifesto work ${i}`, 2))
    return s
  }

  it("nobody is asked before there is an outline", async () => {
    const s = await written()
    for (let p = 1; p < 7; p++) expect(pitchTarget(s, "owl", "fox", p)).toBeNull()
  })

  it("a friend who says yes gets a readable copy on their shelf, once; one who says no is asked again later", async () => {
    let s = applyOutline(await written(), "owl", scriptedOutline(await written(), "owl"))
    const ask = [1, 2, 4, 5].map((p) => pitchTarget(s, "owl", "fox", p)).find(Boolean)!
    expect(ask).toEqual({ author: "owl", reader: "fox" })
    const no = applyPitch(s, { author: "owl", reader: "fox", yes: false })
    expect(hasCopy(no, "fox", "owl")).toBe(false)
    expect([1, 2, 4, 5].map((p) => pitchTarget(no, "owl", "fox", p)).find(Boolean)).toBeUndefined()
    expect([1, 2, 4, 5].map((p) => pitchTarget({ ...no, day: no.day + 5 }, "owl", "fox", p)).find(Boolean)).toBeTruthy()
    s = applyPitch(s, { author: "owl", reader: "fox", yes: true })
    const copy = s.shelves.fox!.find((b) => b.manifestoBy === "owl")!
    expect(copy.title).toMatch(new RegExp(`^${OWL}: `))
    expect(copy.inline).toContain("A manifesto on")
    expect(copy.chars).toBe(copy.inline!.length)
    expect(giveCopy(s, "owl", "fox")).toBe(s)
    expect([1, 2, 4, 5].map((p) => pitchTarget(s, "owl", "fox", p)).find(Boolean)).toBeUndefined()
    // a copy follows the author's draft as sections are written, and keeps how far the reader got
    s.shelves.fox = s.shelves.fox!.map((b) => (b.manifestoBy ? { ...b, at: 50 } : b))
    const grown = applySection(s, "owl", 0, "A long first part. ".repeat(30))
    const after = grown.shelves.fox!.find((b) => b.manifestoBy === "owl")!
    expect(after.chars).toBeGreaterThan(copy.chars)
    expect(after.at).toBe(50)
    expect(syncCopies(grown)).toEqual(grown)
  })

  it("a pitch is a talk: the lines are written and a yes puts the book on the shelf", async () => {
    const s = applyOutline(await written(), "owl", scriptedOutline(await written(), "owl"))
    const yes = [0, 2, 3, 5, 6, 7].map((p) => scriptedPitch(s, "owl", "fox", "the meadow", p)).find((t) => t.pitch?.yes)!
    expect(yes.lines.length).toBeGreaterThanOrEqual(3)
    const after = applyTalk(s, yes)
    expect(hasCopy(after, "fox", "owl")).toBe(true)
    expect(after.chatter.at(-1)!.changed.join(" ")).toMatch(/will read/)
    const model = await pitchWithModel(s, "owl", "fox", "the meadow", async ({ schema }) => ((schema as { properties: Record<string, unknown> }).properties.yes ? { say: "Yes, I'd like to.", yes: true } : { say: "Please read it." }), 1)
    expect(model.by).toBe("model")
    expect(model.pitch).toEqual({ author: "owl", reader: "fox", yes: true })
  })
})
