/**
 * components/Lists/list-content/sheet-fullscreen.ts — Fullscreen spreadsheet helpers
 *
 * In-app maximized child window (not OS fullscreen). Commit in-progress cell /
 * formula-bar edits by blurring the focused field so existing onBlur handlers
 * write through `updateTask` before the overlay closes.
 */

export function isEditingField(el: EventTarget | null | undefined): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  const raw = el.getAttribute("contenteditable")
  return el.isContentEditable === true || raw === "" || raw === "true"
}

/** Blur a focused input so SheetGrid cell / formula-bar `onBlur` commits fire. */
export function commitFocusedSheetEdit(): void {
  const el = document.activeElement
  if (el instanceof HTMLElement && isEditingField(el)) el.blur()
}
