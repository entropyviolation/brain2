/**
 * sheet-fullscreen — commit-on-close helpers for the in-app spreadsheet window.
 */
import { afterEach, describe, expect, it } from "vitest"
import { commitFocusedSheetEdit, isEditingField } from "./sheet-fullscreen"

describe("isEditingField", () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it("detects inputs, textareas, selects, and contenteditable", () => {
    const input = document.createElement("input")
    const area = document.createElement("textarea")
    const select = document.createElement("select")
    const div = document.createElement("div")
    const edit = document.createElement("div")
    edit.setAttribute("contenteditable", "true")
    document.body.appendChild(edit)
    expect(isEditingField(input)).toBe(true)
    expect(isEditingField(area)).toBe(true)
    expect(isEditingField(select)).toBe(true)
    expect(isEditingField(edit)).toBe(true)
    expect(isEditingField(div)).toBe(false)
    expect(isEditingField(null)).toBe(false)
  })
})

describe("commitFocusedSheetEdit", () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it("blurs a focused input so onBlur can commit", () => {
    const input = document.createElement("input")
    let blurred = false
    input.addEventListener("blur", () => {
      blurred = true
    })
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)
    commitFocusedSheetEdit()
    expect(blurred).toBe(true)
    expect(document.activeElement).not.toBe(input)
  })

  it("is a no-op when the focused node is not a field", () => {
    const btn = document.createElement("button")
    document.body.appendChild(btn)
    btn.focus()
    commitFocusedSheetEdit()
    expect(document.activeElement).toBe(btn)
  })
})
