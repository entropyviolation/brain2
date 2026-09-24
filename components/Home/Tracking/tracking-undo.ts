/**
 * components/Home/Tracking/tracking-undo.ts — Cmd/Ctrl-Z on the Tracking tab
 *
 * Tracking writes already push onto `lib/action-history.ts` (paint, erase,
 * edit, split, move, delete, clear, week fill, pen/tag edits, companions).
 * This module does not invent a second stack. It is the capture-phase chord
 * that pops that stack while Home → Tracking is showing (or the header
 * Tracking dialog is open), so a focused timegrid still reverses the last
 * stroke. Text fields keep the browser's own undo.
 *
 * The app shell also mounts `hooks/useUndoHotkey.ts` on bubble. This listener
 * runs first (capture) and stops the event after it handles a chord, so one
 * key press cannot pop two steps.
 */
"use client"

import { useEffect } from "react"
import { redoLastAction, undoLastAction } from "@/lib/action-history"
import { isNativeUndoTarget, isRedoChord, isUndoChord } from "@/hooks/useUndoHotkey"

/**
 * Labels `rememberWorld` / `runAsAction` push for Tracking-origin writes.
 * The hotkey pops whatever is on top of the shared stack — these names are
 * the stroke kinds this surface itself records.
 */
export const TRACKING_ACTION_LABELS = [
  "paint",
  "erase",
  "edit block",
  "split block",
  "move block",
  "delete block",
  "clear day",
  "fill days",
  "attach companion",
  "add pen",
  "update pen",
  "remove pen",
  "set pen parent",
  "add variant",
  "update variant",
  "remove variant",
  "add tag",
  "update tag",
  "remove tag",
  "set pen tags",
  "set pen links",
  "add scope",
  "remove scope",
  "rename scope",
] as const

const consumed = new WeakSet<KeyboardEvent>()

/**
 * If this keydown is Cmd/Ctrl-Z (or the redo chord) and the target is not a
 * text field, pop action history. Returns true when a step was restored.
 */
export function handleTrackingUndoKey(e: KeyboardEvent): boolean {
  if (consumed.has(e)) return false
  if (e.repeat) return false
  if (isNativeUndoTarget(e.target)) return false

  if (isUndoChord(e)) {
    consumed.add(e)
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    return undoLastAction()
  }
  if (isRedoChord(e)) {
    consumed.add(e)
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    return redoLastAction()
  }
  return false
}

/**
 * Capture-phase Cmd/Ctrl-Z for Tracking. Pass `enabled` so Home can arm it
 * only while the Tracking tab is the active Home tab.
 */
export function useTrackingUndoHotkey(enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      handleTrackingUndoKey(e)
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [enabled])
}
