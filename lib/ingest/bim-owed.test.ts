import { describe, expect, it } from "vitest"
import type { TextRow } from "@/lib/bim-flow/texts"
import { owedRows, owedText, parseOwedAsk, parseTextedBack, todoName } from "./bim-owed"

const NOW = new Date(2026, 10, 24, 8, 12)
const row = (who: string, dir: "in" | "out", at: string, text: string, extra: Partial<TextRow> = {}): TextRow => ({
  who, dir, at: new Date(at).toISOString(), thread: `t-${who}`, group: false, text, handle: `+1555000${who.length}${who.length}${who.length}${who.length}`, ...extra,
})

describe("asking", () => {
  it("reads the question in its forms", () => {
    for (const q of ["who do i need to text back?", "Who should I reply to", "who's waiting on a text from me", "do I owe anyone a text?", "who am I ignoring lol", "who haven't I texted back"]) expect(parseOwedAsk(q), q).toBe(true)
    for (const q of ["text ruggles back", "what did Matt text me last?", "who is coming saturday"]) expect(parseOwedAsk(q), q).toBe(false)
  })
})

describe("reply to-dos", () => {
  it("names the person", () => {
    expect(todoName("text ruggles back")).toBe("ruggles")
    expect(todoName("Reply to Linda about saturday")).toBe("linda")
    expect(todoName("get back to mary lou")).toBe("mary lou")
    expect(todoName("call the dentist")).toBeNull()
    expect(todoName("Book arkansas tickets")).toBeNull()
  })
})

describe("who is waiting", () => {
  const texts: TextRow[] = [
    row("Matt Smith", "out", "2026-11-20T10:00", "see you then"),
    row("Matt Smith", "in", "2026-11-22T18:00", "are you still coming saturday?"),
    row("Linda", "in", "2026-11-23T20:00", "call me when you can"),
    row("Linda", "in", "2026-11-23T20:05", "it's about the car"),
    row("Jo", "in", "2026-11-23T09:00", "how was it"),
    row("Jo", "out", "2026-11-23T09:30", "so good"),
    row("Kim", "in", "2026-11-23T09:00", "Loved “so good”"),
    row("Old", "in", "2026-10-01T09:00", "hello?"),
    row("Group", "in", "2026-11-23T09:00", "who's in?", { group: true }),
  ]
  const todos = [{ id: "r", title: "text ruggles back" }, { id: "m", title: "Text Matt back" }, { id: "x", title: "Book arkansas tickets" }]

  it("lists unanswered direct threads and reply to-dos, questions first", () => {
    const rows = owedRows(texts, todos, NOW, {}, (h) => `fmt ${h}`)
    expect(rows.map((r) => r.who)).toEqual(["Matt Smith", "Linda", "Ruggles"])
    expect(rows[0]!.todos.map((t) => t.id)).toEqual(["m"])
    expect(rows[1]!.unanswered).toBe(2)
    expect(rows[1]!.contact).toMatch(/^fmt \+1555/)
    const said = owedText(rows, NOW, true)
    expect(said).toMatch(/^You seem to need to text back Matt, Linda, and Ruggles\./)
    expect(said).toContain("Ruggles · no unanswered text, to-do only · to-do: text ruggles back")
  })
  it("leaves off someone you said you answered, until they text again", () => {
    const rows = owedRows(texts, [], NOW, { linda: "2026-11-24T07:00:00.000Z" })
    expect(rows.map((r) => r.who)).toEqual(["Matt Smith"])
  })
  it("still lists to-dos when texts cannot be reached", () => {
    const rows = owedRows(null, todos, NOW)
    expect(rows.map((r) => r.who)).toEqual(["Ruggles", "Matt"])
    expect(owedText(rows, NOW, false)).toContain("Texts not reachable")
  })
})

describe("already texted", () => {
  it("reads names and when", () => {
    expect(parseTextedBack("oh I already texted ruggles", NOW)).toMatchObject({ names: ["ruggles"], told: false, all: false })
    const at3 = parseTextedBack("replied to matt and linda at 3pm", NOW)!
    expect(at3.names).toEqual(["matt", "linda"])
    expect(at3.at.getHours()).toBe(15)
    expect(at3.at.getDate()).toBe(23)
    expect(parseTextedBack("texted ruggles back this morning", NOW)!.at.getHours()).toBe(8)
    expect(parseTextedBack("just texted matt 2 hours ago", NOW)!.at.getHours()).toBe(6)
    expect(parseTextedBack("texted them all", NOW)).toMatchObject({ all: true })
    expect(parseTextedBack("need to text ruggles", NOW)).toBeNull()
  })
})

describe("not waiting on you", () => {
  it("skips unnamed numbers you never wrote to, and machines", () => {
    const rows = owedRows(
      [
        row("+1 (555) 222-3333", "in", "2026-11-23T09:00", "hey is this sam?"),
        row("Bank", "in", "2026-11-23T09:00", "Your code is 551234. Do not share it."),
        row("Pharmacy", "in", "2026-11-23T09:00", "Your order is ready. Reply STOP to opt out"),
      ],
      [],
      NOW,
    )
    expect(rows).toEqual([])
  })
})
