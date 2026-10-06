/**
 * hooks/useUndoHotkey.ts — Cmd/Ctrl-Z last-action undo
 *
 * Attaches a window `keydown` listener while mounted and pops
 * `lib/action-history.ts`. Cmd/Ctrl-Z undoes; Cmd/Ctrl-Shift-Z (and Ctrl+Y)
 * redo. Typing targets keep the browser's native undo — reversing a painted
 * block must not steal Cmd+Z from a time field or a notes box.
 *
 * Mounted once from `app/page.tsx` so Home, the header Tracking dialog, and
 * every other tab share the same stack. While Tracking is the active Home tab
 * (or the header dialog is open), `components/Home/Tracking/tracking-undo.ts`
 * also listens in the capture phase so a focused timegrid still pops this
 * stack; that listener stops the event after it handles a chord.
 *
 * A restore that re-enters this handler cannot pop a second step —
 * `undoLastAction` ignores the nested call. A later chord still undoes the
 * previous action; deferred habit bookkeeping is flushed first.
 */
"use client"

import { useEffect } from "react"
import { redoLastAction, undoLastAction } from "@/lib/action-history"

/** True when the event target is a field the browser should undo, not us. */
function isContentEditableElement(target: HTMLElement): boolean {
  if (target.isContentEditable) return true
  // jsdom reports isContentEditable false; the IDL and the attribute still say so.
  const mode = target.contentEditable
  if (mode === "true" || mode === "plaintext-only") return true
  const attr = target.getAttribute("contenteditable")
  if (attr != null && attr.toLowerCase() !== "false") return true
  return Boolean(target.closest("[contenteditable]:not([contenteditable='false'])"))
}

export function isNativeUndoTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (isContentEditableElement(target)) return true
  const tag = target.tagName
  if (tag === "TEXTAREA" || tag === "SELECT") return true
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type
    // Buttons and checkboxes are not text; Cmd+Z should still reverse the click.
    return type !== "button" && type !== "checkbox" && type !== "radio" && type !== "submit" && type !== "reset"
  }
  return false
}

export function isUndoChord(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === "z" || e.key === "Z")
}

export function isRedoChord(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return false
  if (e.shiftKey && (e.key === "z" || e.key === "Z")) return true
  return !e.shiftKey && (e.key === "y" || e.key === "Y")
}

export function useUndoHotkey(enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      if (isNativeUndoTarget(e.target) || isNativeUndoTarget(document.activeElement)) return
      if (isUndoChord(e)) {
        e.preventDefault()
        undoLastAction()
        return
      }
      if (isRedoChord(e)) {
        e.preventDefault()
        redoLastAction()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled])
}
