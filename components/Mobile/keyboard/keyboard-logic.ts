/**
 * components/Mobile/keyboard/keyboard-logic.ts — Which board, and how a key writes.
 *
 * The phone shell draws its own keys. This module decides the board from the
 * field. A focused field is written with the browser's own editing command, the
 * same path as a hardware key, so iOS moves its caret (a trailing space shows at
 * once) and undo works. Otherwise it writes through the native value setter, so
 * a React input still sees it.
 */

export type ShiftMode = "off" | "once" | "lock"
export type Board = "letters" | "numbers" | "symbols" | "pad"
export type FieldKind = "text" | "email" | "url" | "pad" | "decimal"
export type ReturnAction = "newline" | "submit" | "next" | "blur"

const TEXT_TYPES = new Set(["", "text", "search", "email", "url", "password", "tel", "number"])

/** Every field under `root` the deck types into, `root` included. */
export function typingFieldsIn(root: Element): HTMLElement[] {
  const found = root.matches(FIELD_SELECTOR) ? [root] : []
  found.push(...root.querySelectorAll(FIELD_SELECTOR))
  return found.map(fieldOf).filter((el): el is HTMLElement => el != null)
}

const FIELD_SELECTOR = "input, textarea, [contenteditable]"

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
    if (!chunk || editNatively(el, "insertText", chunk)) return
    const next = value.slice(0, range.start) + chunk + value.slice(range.end)
    writeValue(el, next, range.start + chunk.length, chunk, "insertText")
    return
  }
  if (el.isContentEditable) {
    const wrote = document.execCommand?.("insertText", false, text)
    if (!wrote) insertIntoSelection(text)
  }
}

/** Dictation spot: where the words go, with a space before them when the text runs on. */
export function dictationAnchor(el: HTMLElement): { start: number; lead: string } {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return { start: 0, lead: "" }
  const start = caretOf(el)?.end ?? el.value.length
  const before = el.value.slice(0, start)
  return { start, lead: before && !/\s$/.test(before) ? " " : "" }
}

/** Swap `removeLength` characters at `start` for `text`. Dictation rewrites its words as they firm up. */
export function spliceText(el: HTMLElement, start: number, removeLength: number, text: string): void {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    if (el.isContentEditable && removeLength === 0) insertText(el, text)
    return
  }
  const value = el.value
  const from = Math.min(start, value.length)
  if (document.activeElement === el) {
    try {
      el.setSelectionRange(from, Math.min(from + removeLength, value.length))
    } catch {
      /* type=number has no caret */
    }
    if (text ? editNatively(el, "insertText", text) : removeLength === 0 || editNatively(el, "delete")) return
  }
  const next = value.slice(0, from) + text + value.slice(from + removeLength)
  writeValue(el, next, from + text.length, text, "insertReplacementText")
}

export function backspace(el: HTMLElement): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const value = el.value
    const range = caretOf(el) ?? { start: value.length, end: value.length }
    const cut = deleteBefore(value, range.start, range.end)
    if (cut.value === value && cut.caret === range.start) return
    if (editNatively(el, "delete")) return
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

/**
 * Lift the field above the deck, and only as far as needed. Only its nearest
 * scrolling box moves; the page itself moves only when the field is not inside a
 * fixed layer (a dialog). `scrollIntoView` scrolled every ancestor, and on iOS
 * that jerked the whole screen down under the status bar.
 */
export function revealField(el: HTMLElement, keyboardHeight: number): void {
  const rect = el.getBoundingClientRect()
  // A tall box only needs its first lines in view, where the caret starts.
  const bottom = Math.min(rect.bottom, rect.top + 64)
  const over = bottom - (window.innerHeight - keyboardHeight - 16)
  if (over <= 0) return
  const box = scrollParent(el)
  if (box) box.scrollBy({ top: over, behavior: "smooth" })
  else if (!inFixedLayer(el)) window.scrollBy({ top: over, behavior: "smooth" })
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

function inFixedLayer(el: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).position === "fixed") return true
  }
  return false
}

/** Type through the browser's editor. Only a focused field; false when it did not take. */
function editNatively(el: HTMLElement, command: "insertText" | "delete", text?: string): boolean {
  if (document.activeElement !== el || typeof document.execCommand !== "function") return false
  try {
    return document.execCommand(command, false, text)
  } catch {
    return false
  }
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

export type KeyRect = { left: number; top: number; right: number; bottom: number }

/**
 * The key a touch belongs to: the one under it, else the nearest one. The
 * gaps between caps and the deck's edges have no dead zone, the same as the
 * system keyboard. Returns -1 with no keys.
 */
export function nearestKey(rects: readonly KeyRect[], x: number, y: number): number {
  let best = -1
  let bestDistance = Infinity
  rects.forEach((rect, index) => {
    const dx = Math.max(rect.left - x, 0, x - rect.right)
    const dy = Math.max(rect.top - y, 0, y - rect.bottom)
    // A row is closer than a column: a slip off a key is usually sideways.
    const distance = dx * dx + 4 * dy * dy
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}
