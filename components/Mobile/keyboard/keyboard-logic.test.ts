/**
 * components/Mobile/keyboard/keyboard-logic.test.ts — Board choice and caret edits.
 */
import { describe, expect, it } from "vitest"
import { afterLetter, autoCap, backspace, cycleShift, insertText, keyboardKind, letterGlyph } from "./keyboard-logic"

describe("keyboard kind", () => {
  it("picks a pad for tel and number, and letters for a password", () => {
    const tel = document.createElement("input")
    tel.type = "tel"
    const num = document.createElement("input")
    num.type = "number"
    const secret = document.createElement("input")
    secret.type = "password"
    expect(keyboardKind(tel)).toBe("pad")
    expect(keyboardKind(num)).toBe("decimal")
    expect(keyboardKind(secret)).toBe("text")
    expect(keyboardKind(document.createElement("textarea"), "email")).toBe("email")
  })
})

describe("shift", () => {
  it("latches once, locks on a quick second tap, and drops after a letter", () => {
    expect(cycleShift("off", false)).toBe("once")
    expect(cycleShift("once", true)).toBe("lock")
    expect(cycleShift("once", false)).toBe("off")
    expect(cycleShift("lock", true)).toBe("off")
    expect(afterLetter("once")).toBe("off")
    expect(afterLetter("lock")).toBe("lock")
    expect(letterGlyph("q", "off", false)).toBe("q")
    expect(letterGlyph("q", "off", true)).toBe("Q")
  })
})

describe("auto capital", () => {
  it("caps the start of a sentence and leaves an email alone", () => {
    const note = document.createElement("textarea")
    expect(autoCap(note)).toBe(true)
    note.value = "hi"
    note.selectionStart = 2
    note.selectionEnd = 2
    expect(autoCap(note)).toBe(false)
    note.value = "hi. "
    note.selectionStart = 4
    note.selectionEnd = 4
    expect(autoCap(note)).toBe(true)

    const mail = document.createElement("input")
    mail.type = "email"
    expect(autoCap(mail)).toBe(false)
  })
})

describe("insert and backspace", () => {
  it("writes at the caret and deletes the character before it", () => {
    const input = document.createElement("input")
    document.body.append(input)
    input.value = "ac"
    input.selectionStart = 1
    input.selectionEnd = 1
    const seen: string[] = []
    input.addEventListener("input", () => seen.push(input.value))
    insertText(input, "b")
    expect(input.value).toBe("abc")
    expect(input.selectionStart).toBe(2)
    expect(seen).toEqual(["abc"])
    backspace(input)
    expect(input.value).toBe("ac")
    expect(input.selectionStart).toBe(1)
    input.remove()
  })

  it("stops at max length and removes a whole selection", () => {
    const input = document.createElement("input")
    input.maxLength = 3
    input.value = "ab"
    input.selectionStart = 2
    input.selectionEnd = 2
    insertText(input, "cd")
    expect(input.value).toBe("abc")
    input.selectionStart = 0
    input.selectionEnd = 2
    backspace(input)
    expect(input.value).toBe("c")
  })
})
