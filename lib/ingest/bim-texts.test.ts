import { describe, expect, it, vi } from "vitest"
import type { TextRow } from "@/lib/bim-flow/texts"
import { answerTextQuestion, parseTextQuestion, pickLastTexts, whenSaid } from "./bim-texts"

const people = [
  { id: "p1", title: "Shelby", names: ["Shelby", "Shelby Ross"], handles: ["+15550001"] },
  { id: "p2", title: "Elijah", names: ["Elijah"], handles: ["+15550002"] },
  { id: "p3", title: "Noor", names: ["Noor"], handles: [] },
]
const now = new Date(2026, 10, 11, 12, 0)
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).toISOString()
const row = (who: string, dir: "in" | "out", when: string, text: string, thread = `t-${who}`, group = false): TextRow => ({ at: when, dir, who, thread, group, text })

const rows: TextRow[] = [
  row("Shelby", "in", at(9, 14), "old news about the car"),
  row("Shelby", "out", at(10, 21, 30), "how was the show?"),
  row("Shelby", "in", at(10, 21, 40), "the show was amazing"),
  row("Shelby", "in", at(10, 21, 42), "also can you bring the blue jacket saturday"),
  row("Shelby", "in", at(11, 9, 0), "group hello", "g1", true),
  row("Elijah", "in", at(11, 8), "tour bus leaves at 6"),
]

const deps = (extra: Partial<Parameters<typeof answerTextQuestion>[2]> = {}) => ({
  snap: { people, secretHandles: [] },
  load: async () => rows,
  ...extra,
})

describe("parseTextQuestion", () => {
  it("reads the asked question", () => {
    const q = parseTextQuestion("what was shelby talking about in her last text to me", people)
    expect(q?.dir).toBe("in")
    expect(q?.people.map((p) => p.id)).toEqual(["p1"])
    expect(q?.verbatim).toBe(false)
  })
  it("my text to them, the exchange, and word for word", () => {
    expect(parseTextQuestion("what did I text Elijah last?", people)?.dir).toBe("out")
    expect(parseTextQuestion("what was my last message to shelby?", people)?.dir).toBe("out")
    expect(parseTextQuestion("what were my last texts with shelby?", people)?.dir).toBe("both")
    expect(parseTextQuestion("what did shelby text me last, word for word?", people)?.verbatim).toBe(true)
  })
  it("leaves commands and lines about no one alone", () => {
    expect(parseTextQuestion("text shelby back about saturday", people)).toBeNull()
    expect(parseTextQuestion("what was my last text?", people)).toBeNull()
    expect(parseTextQuestion("when did I last see Shelby?", people)).toBeNull()
  })
})

describe("pickLastTexts", () => {
  it("takes the direct thread's last run from them, with the text before as context", () => {
    const pick = pickLastTexts(rows, "Shelby", "in")!
    expect(pick.quoted.map((r) => r.text)).toEqual(["the show was amazing", "also can you bring the blue jacket saturday"])
    expect(pick.context.map((r) => r.text)).toEqual(["how was the show?"])
  })
  it("my last text", () => {
    expect(pickLastTexts(rows, "Shelby", "out")!.quoted.map((r) => r.text)).toEqual(["how was the show?"])
  })
})

describe("answerTextQuestion", () => {
  it("sums up without quoting, keeps the texts in evidence, and offers the exact words", async () => {
    const call = vi.fn(async () => ({ about: "Shelby loved the show and asked you to bring the blue jacket on Saturday." }))
    const a = (await answerTextQuestion("what was shelby talking about in her last text to me", now, deps({ model: async () => ({ call, name: "m" }) })))!
    expect(a.text).toContain("blue jacket on Saturday")
    expect(a.text).toContain("Shelby's last texts to you, yesterday at")
    expect(a.text).not.toContain("“")
    expect(a.evidence.some((e) => e.includes("also can you bring the blue jacket saturday"))).toBe(true)
    expect(a.choices?.[0]?.label).toBe("exact words")
    const user = (call.mock.calls[0] as unknown as [{ user: string }])[0].user
    expect(user).toContain("QUOTED:\nShelby: the show was amazing")
    expect(user).not.toContain("old news")
    expect(a.route).toMatch(/^TEXTS · code · m · /)
  })
  it("quotes only when asked", async () => {
    const a = (await answerTextQuestion("what did shelby text me last, word for word?", now, deps()))!
    expect(a.text).toContain("“the show was amazing”\n“also can you bring the blue jacket saturday”")
  })
  it("with no model, says when and offers the exact words instead of guessing", async () => {
    const a = (await answerTextQuestion("what did Elijah text me?", now, deps()))!
    expect(a.text).toMatch(/^Elijah's last text to you, today at 8:00 AM, 1 text\./)
    expect(a.text).not.toContain("tour bus")
  })
  it("says plainly what is missing", async () => {
    expect((await answerTextQuestion("what did noor text me?", now, deps()))!.text).toContain("no phone number or email")
    expect((await answerTextQuestion("what did shelby text me?", now, deps({ load: async () => null })))!.text).toContain("can't reach your texts")
    expect((await answerTextQuestion("what did shelby text me?", now, deps({ load: async () => [] })))!.text).toContain("don't see any texts from Shelby")
  })
  it("is not a text question", async () => {
    expect(await answerTextQuestion("when did I last see Shelby?", now, deps())).toBeNull()
  })
})

describe("whenSaid", () => {
  it("names the day", () => {
    expect(whenSaid(at(11, 21, 5), now)).toBe("today at 9:05 PM")
    expect(whenSaid(at(10, 9), now)).toBe("yesterday at 9:00 AM")
    expect(whenSaid(at(8, 13), now)).toBe("Sun, Nov 8 at 1:00 PM")
  })
})
