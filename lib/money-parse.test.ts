import { describe, expect, it } from "vitest"
import { parseMoneyPhrase } from "./money-parse"

const day = "2026-10-28"

describe("parseMoneyPhrase", () => {
  it("reads an earning with a cash source", () => {
    expect(parseMoneyPhrase("earned $970 cash", day)).toEqual({
      ok: true,
      phrase: { type: "earning", cents: 97000, name: "Earned", source: "Cash", accountKind: "cash", date: day },
    })
  })

  it("reads a spend and keeps the thing bought", () => {
    expect(parseMoneyPhrase("spent $12 coffee", day)).toEqual({
      ok: true,
      phrase: { type: "spend", cents: 1200, name: "Coffee", source: "Cash", accountKind: "cash", date: day, uncertain: false },
    })
    const card = parseMoneyPhrase("spent $12 coffee on card", day)
    expect(card).toMatchObject({
      ok: true,
      phrase: { type: "spend", name: "Coffee", source: "Card", accountKind: "card", cents: 1200 },
    })
  })

  it("stores a debt owed to a person, not an account", () => {
    expect(parseMoneyPhrase("owe Elijah $40", day)).toEqual({
      ok: true,
      phrase: { type: "debt", direction: "owe", who: "Elijah", cents: 4000 },
    })
    expect(parseMoneyPhrase("Elijah owes me $40", day)).toMatchObject({
      ok: true,
      phrase: { type: "debt", direction: "owed", who: "Elijah", cents: 4000 },
    })
  })

  it("reads a monthly bill, a budget, a plan, and a gig", () => {
    expect(parseMoneyPhrase("bill rent $1400 monthly", day)).toEqual({
      ok: true,
      phrase: { type: "bill", name: "Rent", cents: 140000, cadence: "monthly" },
    })
    expect(parseMoneyPhrase("budget groceries $400", day)).toEqual({
      ok: true,
      phrase: { type: "envelope", name: "Groceries", cents: 40000 },
    })
    expect(parseMoneyPhrase("plan $80 dinner", day)).toEqual({
      ok: true,
      phrase: { type: "plan", name: "Dinner", cents: 8000, date: day },
    })
    expect(parseMoneyPhrase("gig mix $500", day)).toEqual({
      ok: true,
      phrase: { type: "gig", name: "Mix", cents: 50000 },
    })
  })

  it("keeps an amount when the verb is missing", () => {
    expect(parseMoneyPhrase("$15 mystery", day)).toMatchObject({
      ok: true,
      phrase: { type: "spend", cents: 1500, name: "Mystery", uncertain: true },
    })
  })

  it("refuses a line with no amount", () => {
    expect(parseMoneyPhrase("hello", day)).toEqual({ ok: false, reason: "no-amount" })
    expect(parseMoneyPhrase("   ", day)).toEqual({ ok: false, reason: "blank" })
    expect(parseMoneyPhrase("owe $40", day)).toEqual({ ok: false, reason: "no-name" })
  })

  it("names an account without turning it into a debt", () => {
    expect(parseMoneyPhrase("account checking", day)).toEqual({
      ok: true,
      phrase: { type: "account", name: "Checking", kind: "bank" },
    })
  })
})
