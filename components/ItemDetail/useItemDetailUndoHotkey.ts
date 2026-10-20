/**
 * components/ItemDetail/useItemDetailUndoHotkey.ts — Cmd/Ctrl+Z on item detail
 *
 * Undoes the last edit to the open draft (a moved or unnested step, a delete,
 * a tag, a link) and Cmd/Ctrl+Shift+Z / Ctrl+Y redoes it. Taken in the capture
 * phase so the app-wide stack in `hooks/useUndoHotkey.ts` never also pops
 * while this surface is in front. Text fields keep the browser's own undo,
 * a dialog stacked above keeps the chord, and with nothing to undo here the
 * chord falls through.
 */
"use client"

import { useEffect, type RefObject } from "react"
import { isNativeUndoTarget, isRedoChord, isUndoChord } from "@/hooks/useUndoHotkey"
import { itemDetailIsFront } from "@/components/ItemDetail/useItemDetailSaveHotkey"

export function useItemDetailUndoHotkey(
  rootRef: RefObject<HTMLElement | null>,
  undo: () => boolean,
  redo: () => boolean,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return
    function onKey(e: KeyboardEvent) {
      const isUndo = isUndoChord(e)
      if (!isUndo && !isRedoChord(e)) return
      if (isNativeUndoTarget(e.target) || isNativeUndoTarget(document.activeElement)) return
      if (!itemDetailIsFront(rootRef.current)) return
      if (isUndo ? undo() : redo()) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [enabled, undo, redo, rootRef])
}
