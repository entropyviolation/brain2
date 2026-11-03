import { describe, expect, it } from "vitest"
import {
  answerFact,
  matchFact,
  parseBareWhen,
  parseClock,
  parseDuration,
  parseInstantStatement,
  parseNoteStatement,
  rememberFact,
  type Fact,
} from "./bim-facts"

const at = (h: number, m = 0, day = 2) => new Date(2026, 10, day, h, m)

function told(text: string, now: Date): Fact {
  const draft = parseInstantStatement(text, now)!
  return { ...draft, id: "f1", toldAt: now.getTime() }
}

describe("parseDuration / parseClock", () => {
  it("reads spans", () => {
    expect(parseDuration("2 hours")).toBe(2 * 3_600_000)
    expect(parseDuration("an hour and a half")).toBe(90 * 60_000)
    expect(parseDuration("1h 30m")).toBe(90 * 60_000)
    expect(parseDuration("soon")).toBeNull()
  })
  it("takes the next time the clock reads", () => {
    expect(parseClock("at 2:00am", at(0))?.getHours()).toBe(2)
    expect(parseClock("at 2:00am", at(3))?.getDate()).toBe(3)
    expect(parseClock("at 2", at(13))?.getHours()).toBe(14)
    expect(parseClock("nonsense", at(0))).toBeNull()
  })
})

describe("the Claude limit example", () => {
  it("answers in minutes with the clock time, then forgets it the next day", () => {
    const night = at(0)
    const f = told("Claude limit resets at 2:00am", night)
    expect(f.kind).toBe("instant")
    const asked = at(1, 5)
    expect(matchFact([f], "how long until claude limit resets?")).toBe(f)
    expect(answerFact(f, asked).text).toBe("In 55 minutes (at 2:00 am).")
    const nextDay = at(1, 5, 3)
    const a = answerFact(f, nextDay)
    expect(a.state).toBe("unknown")
    expect(a.text).toContain("I don't know")
    expect(a.text).toContain("I'll remember")
  })
  it("resolves 'in 2 hours' when told", () => {
    const f = told("Claude limit resets in 2 hours", at(0))
    expect(new Date(f.at!).getHours()).toBe(2)
    expect(answerFact(f, at(1, 5)).text).toBe("In 55 minutes (at 2:00 am).")
  })
  it("says it already happened soon after, not later", () => {
    const f = told("Claude limit resets at 2:00am", at(0))
    expect(answerFact(f, at(2, 30)).state).toBe("just-passed")
    expect(answerFact(f, at(6)).state).toBe("unknown")
  })
})

describe("matching and notes", () => {
  it("does not match an unrelated question", () => {
    const f = told("Claude limit resets at 2:00am", at(0))
    expect(matchFact([f], "when did I last shower?")).toBeNull()
    expect(matchFact([f], "how many hours of work this week?")).toBeNull()
  })
  it("ignores questions and non-times as statements", () => {
    expect(parseInstantStatement("when does the claude limit reset?", at(0))).toBeNull()
    expect(parseInstantStatement("the sale ends at some point", at(0))).toBeNull()
  })
  it("keeps a plain note", () => {
    const draft = parseNoteStatement("remember that the gate code is 4412")!
    const f: Fact = { ...draft, id: "n", toldAt: at(9).getTime() }
    expect(matchFact([f], "what is the gate code?")).toBe(f)
    expect(answerFact(f, at(9, 5)).text).toContain("4412")
  })
  it("a newer fact replaces one about the same thing", () => {
    const a = told("Claude limit resets at 2:00am", at(0))
    const b = parseInstantStatement("Claude limit resets at 7am", at(3))!
    const out = rememberFact([a], { ...b, toldAt: at(3).getTime() }, "f2")
    expect(out).toHaveLength(1)
    expect(out[0]!.id).toBe("f2")
  })
  it("reads a bare answer to 'when'", () => {
    expect(new Date(parseBareWhen("it resets at 3am", at(1))!).getHours()).toBe(3)
    expect(parseBareWhen("hello there", at(1))).toBeNull()
  })
})
