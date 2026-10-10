/**
 * components/ItemDetail/useItemDetailSaveHotkey.ts — Cmd/Ctrl+S on item detail
 *
 * Saves the open draft the same way Save Changes does. The chord is taken
 * only while this surface is in front: a dialog stacked above it (the item
 * type editor, a confirm) keeps the key. Cmd/Ctrl+S still prevents the
 * browser page-save dialog when this view handles it, including from a field.
 */
"use client"

import { useEffect, type RefObject } from "react"

function isItemSaveChord(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && !e.repeat && (e.key === "s" || e.key === "S")
}

/** True when no open dialog sits above this item-detail root. */
function itemDetailIsFront(root: HTMLElement | null): boolean {
  if (!root?.isConnected) return false
  const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"]')
  const top = dialogs[dialogs.length - 1]
  if (!top) return true
  return top === root || root.contains(top)
}

export function useItemDetailSaveHotkey(
  rootRef: RefObject<HTMLElement | null>,
  onSave: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return
    function onKey(e: KeyboardEvent) {
      if (!isItemSaveChord(e)) return
      if (!itemDetailIsFront(rootRef.current)) return
      e.preventDefault()
      onSave()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled, onSave, rootRef])
}
