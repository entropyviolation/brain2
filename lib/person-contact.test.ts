import { describe, expect, it } from "vitest"
import { personContact } from "./person-contact"

const person = { id: "p1", title: "Ana Ruiz" }
const scopes = [{ id: "iphone-texts", pens: [{ id: "iphone-texts-x", personId: "p1" }] }]
const row = (scopeId: string, penId: string, date: string, startMin: number, title: string) => ({ scopeId, penId, date, startMin, title })

describe("personContact", () => {
  it("is empty with no calls or texts", () => {
    expect(personContact([], scopes, person)).toMatchObject({ call: null, text: null, callBack: false, textBack: false })
  })

  it("flags a text back when theirs is last, and a call back after a missed call", () => {
    const entries = [
      row("iphone-texts", "iphone-texts-x", "2026-10-20", 600, "→ hi"),
      row("iphone-texts", "iphone-texts-x", "2026-10-21", 600, "← hello"),
      row("iphone-calls", "iphone-call-ana-ruiz", "2026-10-22", 60, "missed call"),
      row("iphone-calls", "iphone-call-bo", "2026-10-23", 60, "→ call"),
    ]
    const c = personContact(entries, scopes, person)
    expect(c.text).toMatchObject({ date: "2026-10-21", direction: "in" })
    expect(c.textBack).toBe(true)
    expect(c.call).toMatchObject({ date: "2026-10-22", missed: true })
    expect(c.callBack).toBe(true)
  })

  it("clears the flags once you reply", () => {
    const entries = [
      row("iphone-texts", "iphone-texts-x", "2026-10-21", 600, "← hello"),
      row("iphone-texts", "iphone-texts-x", "2026-10-21", 700, "→ hey"),
      row("iphone-calls", "iphone-call-ana-ruiz", "2026-10-22", 60, "missed call"),
      row("iphone-calls", "iphone-call-ana-ruiz", "2026-10-22", 120, "→ call"),
    ]
    const c = personContact(entries, scopes, person)
    expect(c.textBack).toBe(false)
    expect(c.callBack).toBe(false)
  })
})
