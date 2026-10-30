/**
 * components/Mobile/keyboard/keyboard-logic.ts — Which board, and how a key writes.
 *
 * The phone shell draws its own keys. This module decides the board from the
 * field, and writes through the native value setter so a React input sees it.
 */

export type ShiftMode = "off" | "once" | "lock"
export type Board = "letters" | "numbers" | "symbols" | "pad"
export type FieldKind = "text" | "email" | "url" | "pad" | "decimal"
export type ReturnAction = "newline" | "submit" | "next" | "blur"

const TEXT_TYPES = new Set(["", "text", "search", "email", "url", "password", "tel", "number"])

export function typingField(target: EventTarget | null): HTMLElement | null {
  const el = fieldOf(target)
  if (!el) return null
  if (!el.dataset.mKbArmed && (el.getAttribute("inputmode") || "").toLowerCase() === "none") return null
  return el
}

function fieldOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null
  if (target instanceof HTMLTextAreaElement) {
    return target.disabled || target.readOnly ? null : target
  }
  if (target instanceof HTMLInputElement) {
    if (target.disabled || target.readOnly) return null
    const type = (target.type || "text").toLowerCase()
    return TEXT_TYPES.has(type) ? target : null
  }
  if (target.isContentEditable && target.getAttribute("contenteditable") !== "false") return target
  return null
}

export function keyboardKind(el: HTMLElement, savedInputMode = ""): FieldKind {
  const mode = savedInputMode.toLowerCase()
  if (el instanceof HTMLInputElement) {
    if (el.type === "tel" || mode === "tel" || mode === "numeric") return "pad"
    if (el.type === "number" || mode === "decimal") return "decimal"
    if (el.type === "email" || mode === "email") return "email"
    if (el.type === "url" || mode === "url") return "url"
  }
  if (mode === "tel" || mode === "numeric") return "pad"
  if (mode === "decimal") return "decimal"
  if (mode === "email") return "email"
  if (mode === "url") return "url"
  return "text"
}

export function boardForKind(kind: FieldKind): Board {
  return kind === "pad" || kind === "decimal" ? "pad" : "letters"
}

export function cycleShift(mode: ShiftMode, quick: boolean): ShiftMode {
  if (mode === "lock") return "off"
  if (mode === "once") return quick ? "lock" : "off"
  return "once"
}

export function afterLetter(mode: ShiftMode): ShiftMode {
  return mode === "once" ? "off" : mode
}

/** True when this letter should go in as a capital without Shift held. */
export function autoCap(el: HTMLElement): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false
  const raw = (el.getAttribute("autocapitalize") || "").toLowerCase()
  if (raw === "off" || raw === "none") return false
  if (raw === "characters") return true
  if (el instanceof HTMLInputElement) {
    const hint = (el.autocomplete || "").toLowerCase()
    if (hint.includes("username") || hint.includes("email")) return false
  }
  const typed = el instanceof HTMLInputElement ? el.type : "text"
  if (["email", "url", "password", "tel", "number"].includes(typed) && raw !== "words" && raw !== "sentences" && raw !== "on") {
    return false
  }
  if (["email", "url", "password", "tel", "number"].includes(typed) && !raw) return false
  const value = el.value
  let start = value.length
  try {
    if (el.selectionStart != null) start = el.selectionStart
  } catch {
    start = value.length
  }
  const before = value.slice(0, start)
  if (raw === "words") return before.length === 0 || /\s$/u.test(before)
  return before.length === 0 || /[.!?]\s+$/u.test(before)
}

export function letterGlyph(letter: string, shift: ShiftMode, cap: boolean): string {
  return shift !== "off" || cap ? letter.toUpperCase() : letter
}

export function returnKey(el: HTMLElement): { label: string; action: ReturnAction } {
  if (el instanceof HTMLTextAreaElement || el.isContentEditable) {
    return { label: "return", action: "newline" }
  }
  if (!(el instanceof HTMLInputElement)) return { label: "done", action: "blur" }
  const hint = (el.enterKeyHint || "").toLowerCase()
  if (hint === "next") return { label: "next", action: "next" }
  if (hint === "search" || el.type === "search") return { label: "search", action: "submit" }
  if (hint === "send") return { label: "send", action: "submit" }
  if (hint === "go" || el.type === "url") return { label: "go", action: "submit" }
  if (el.form) return { label: "return", action: "submit" }
  return { label: "done", action: "blur" }
}

export function insertText(el: HTMLElement, text: string): void {
  if (!text) return
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const value = el.value
    const range = caretOf(el) ?? { start: value.length, end: value.length }
    let chunk = text
    if (el.maxLength >= 0) {
      const room = el.maxLength - (value.length - (range.end - range.start))
      if (room <= 0) return
      chunk = text.slice(0, room)
    }
    const next = value.slice(0, range.start) + chunk + value.slice(range.end)
    writeValue(el, next, range.start + chunk.length, chunk, "insertText")
    return
  }
  if (el.isContentEditable) {
    const wrote = document.execCommand?.("insertText", false, text)
    if (!wrote) insertIntoSelection(text)
  }
}

export function backspace(el: HTMLElement): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const value = el.value
    const range = caretOf(el) ?? { start: value.length, end: value.length }
    const cut = deleteBefore(value, range.start, range.end)
    if (cut.value === value && cut.caret === range.start) return
    writeValue(el, cut.value, cut.caret, null, "deleteContentBackward")
    return
  }
  if (el.isContentEditable) document.execCommand?.("delete", false)
}

export function runReturn(el: HTMLElement, action: ReturnAction): void {
  if (action === "newline") {
    insertText(el, "\n")
    return
  }
  if (action === "next") {
    const root = el.closest("form") ?? document.body
    const fields = [...root.querySelectorAll("input, textarea, [contenteditable='true'], [contenteditable='']")].filter(
      (node): node is HTMLElement => typingField(node) != null || (node instanceof HTMLElement && fieldOf(node) != null),
    )
    const index = fields.indexOf(el)
    const next = fields[index + 1]
    if (next) next.focus()
    else el.blur()
    return
  }
  if (action === "submit" && el instanceof HTMLInputElement && el.form) {
    el.form.requestSubmit()
    return
  }
  el.blur()
}

export function revealField(el: HTMLElement, keyboardHeight: number): void {
  el.style.scrollMarginBottom = `${keyboardHeight + 16}px`
  el.scrollIntoView({ block: "nearest", inline: "nearest" })
}

function caretOf(el: HTMLInputElement | HTMLTextAreaElement): { start: number; end: number } | null {
  try {
    if (el.selectionStart == null || el.selectionEnd == null) return null
    return { start: el.selectionStart, end: el.selectionEnd }
  } catch {
    return null
  }
}

function deleteBefore(value: string, start: number, end: number): { value: string; caret: number } {
  if (start !== end) return { value: value.slice(0, start) + value.slice(end), caret: start }
  if (start <= 0) return { value, caret: 0 }
  const chars = Array.from(value.slice(0, start))
  chars.pop()
  const before = chars.join("")
  return { value: before + value.slice(end), caret: before.length }
}

function writeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  next: string,
  caret: number,
  data: string | null,
  inputType: string,
): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const set = Object.getOwnPropertyDescriptor(proto, "value")?.set
  if (set) set.call(el, next)
  else el.value = next
  try {
    el.setSelectionRange(caret, caret)
  } catch {
    /* type=number has no caret */
  }
  let event: Event
  try {
    event = new InputEvent("input", { bubbles: true, data, inputType })
  } catch {
    event = new Event("input", { bubbles: true })
  }
  el.dispatchEvent(event)
}

function insertIntoSelection(text: string): void {
  const sel = document.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}
