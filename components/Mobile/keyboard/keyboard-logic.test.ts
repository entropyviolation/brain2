/**
 * components/Mobile/keyboard/keyboard-logic.test.ts — Board choice and caret edits.
 */
import { describe, expect, it, vi } from "vitest"
import {
  afterLetter,
  autoCap,
  backspace,
  boardForKind,
  cycleShift,
  insertText,
  keyboardKind,
  nearestKey,
  typingFieldsIn,
  letterGlyph,
  returnKey,
  runReturn,
  typingField,
} from "./keyboard-logic"

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

describe("which fields get the deck", () => {
  it("skips disabled, read-only, checkbox, and inputmode=none fields", () => {
    const make = (setup: (el: HTMLInputElement) => void) => {
      const el = document.createElement("input")
      setup(el)
      return typingField(el)
    }
    expect(make(() => {})).not.toBeNull()
    expect(make((el) => (el.disabled = true))).toBeNull()
    expect(make((el) => (el.readOnly = true))).toBeNull()
    expect(make((el) => (el.type = "checkbox"))).toBeNull()
    expect(make((el) => el.setAttribute("inputmode", "none"))).toBeNull()
    // The deck sets inputmode=none itself on a field it armed.
    expect(make((el) => {
      el.setAttribute("inputmode", "none")
      el.dataset.mKbArmed = "1"
    })).not.toBeNull()
    expect(boardForKind("decimal")).toBe("pad")
    expect(boardForKind("email")).toBe("letters")
  })
})

describe("return", () => {
  it("names the key from the field", () => {
    const form = document.createElement("form")
    const inForm = document.createElement("input")
    form.append(inForm)
    const search = document.createElement("input")
    search.type = "search"
    const next = document.createElement("input")
    next.enterKeyHint = "next"
    expect(returnKey(document.createElement("textarea"))).toEqual({ label: "return", action: "newline" })
    expect(returnKey(inForm)).toEqual({ label: "return", action: "submit" })
    expect(returnKey(search)).toEqual({ label: "search", action: "submit" })
    expect(returnKey(next)).toEqual({ label: "next", action: "next" })
    expect(returnKey(document.createElement("input"))).toEqual({ label: "done", action: "blur" })
  })

  it("submits the form, moves to the next field, or hides", () => {
    const form = document.createElement("form")
    const first = document.createElement("input")
    const second = document.createElement("input")
    form.append(first, second)
    document.body.append(form)
    const submitted = vi.fn((e: Event) => e.preventDefault())
    form.addEventListener("submit", submitted)

    runReturn(first, "submit")
    expect(submitted).toHaveBeenCalledTimes(1)

    first.focus()
    runReturn(first, "next")
    expect(document.activeElement).toBe(second)
    runReturn(second, "next")
    expect(document.activeElement).not.toBe(second)

    second.focus()
    runReturn(second, "blur")
    expect(document.activeElement).toBe(document.body)
    form.remove()
  })

  it("a textarea return is a newline at the caret", () => {
    const note = document.createElement("textarea")
    note.value = "ab"
    note.selectionStart = 1
    note.selectionEnd = 1
    runReturn(note, "newline")
    expect(note.value).toBe("a\nb")
  })
})

describe("nearestKey", () => {
  const row = [
    { left: 0, top: 0, right: 30, bottom: 46 },
    { left: 35, top: 0, right: 65, bottom: 46 },
    { left: 0, top: 52, right: 30, bottom: 98 },
  ]
  it("takes the key under the touch", () => {
    expect(nearestKey(row, 50, 20)).toBe(1)
  })
  it("gives a gap tap to the nearest key, never nothing", () => {
    expect(nearestKey(row, 33, 20)).toBe(1)
    expect(nearestKey(row, 31, 20)).toBe(0)
    expect(nearestKey(row, 10, 48)).toBe(0)
    expect(nearestKey(row, 10, 51)).toBe(2)
    expect(nearestKey(row, 200, -10)).toBe(1)
  })
  it("returns -1 with no keys", () => {
    expect(nearestKey([], 0, 0)).toBe(-1)
  })
})

describe("native typing", () => {
  it("types into a focused field through the browser's editor, so the caret moves past a space", () => {
    const input = document.createElement("input")
    input.value = "hi"
    document.body.append(input)
    input.focus()
    input.setSelectionRange(2, 2)
    const exec = vi.fn(() => true)
    const original = document.execCommand
    document.execCommand = exec
    try {
      insertText(input, " ")
      backspace(input)
    } finally {
      document.execCommand = original
      input.remove()
    }
    expect(exec).toHaveBeenCalledWith("insertText", false, " ")
    expect(exec).toHaveBeenCalledWith("delete", false, undefined)
  })

  it("falls back to the value setter when the editor does not take it", () => {
    const input = document.createElement("input")
    document.body.append(input)
    input.focus()
    const original = document.execCommand
    document.execCommand = vi.fn(() => false)
    try {
      insertText(input, "hi ")
    } finally {
      document.execCommand = original
      input.remove()
    }
    expect(input.value).toBe("hi ")
  })
})

describe("typingFieldsIn", () => {
  it("finds text fields and skips checkboxes and read-only ones", () => {
    const root = document.createElement("div")
    root.innerHTML = '<input /><input type="checkbox" /><textarea readonly></textarea><textarea></textarea>'
    expect(typingFieldsIn(root).map((el) => el.tagName)).toEqual(["INPUT", "TEXTAREA"])
  })
})
