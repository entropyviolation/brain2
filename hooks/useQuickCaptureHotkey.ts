"use client"

/**
 * hooks/useQuickCaptureHotkey.ts — Quick-capture hotkey (Feature 10, Worker J)
 *
 * A self-contained hook that owns the open/closed state of Quick Add and
 * toggles it on Cmd/Ctrl+Shift+A (distinct from the search palette on
 * Cmd/Ctrl-K). A highlighted selection is returned as `seed` so Quick Add can
 * prefill. The chord is ignored while focus is inside the Quick Add dialog,
 * so typing there is not stolen. Key repeat does not toggle.
 *
 * It only attaches a single `keydown` listener while mounted; it does NOT
 * register an OS-level shortcut itself. The coordinator mounts this from
 * `app/page.tsx` and wires the Electron `globalShortcut` (see
 * `QUICK_CAPTURE_GLOBAL_ACCELERATOR`) during the integration pass.
 *
 * Usage:
 *   const { open, setOpen, seed } = useQuickCaptureHotkey()
 *   return <QuickAdd open={open} onOpenChange={setOpen} seed={seed} />
 */
import { useCallback, useEffect, useState } from "react"

/**
 * Electron `globalShortcut.register(...)` accelerator the integration pass uses
 * for OS-wide capture. Kept here so the combo lives next to its hook owner.
 */
export const QUICK_CAPTURE_GLOBAL_ACCELERATOR = "CommandOrControl+Alt+Space"

/** IPC channel the renderer listens on when the global accelerator fires. */
export const QUICK_CAPTURE_IPC_CHANNEL = "quick-capture:open"

export interface UseQuickCaptureHotkeyOptions {
  /** Disable the in-app listener (e.g. while another modal owns the keyboard). */
  enabled?: boolean
  /** Called whenever capture is requested (chord pressed or `open()` toggled on). */
  onOpen?: () => void
}

export interface UseQuickCaptureHotkey {
  open: boolean
  setOpen: (open: boolean) => void
  /** Highlighted page text captured when the chord opened Quick Add. Empty otherwise. */
  seed: string
}

/** True when the event matches the in-app capture chord (Cmd/Ctrl+Shift+A). */
export function isCaptureChord(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.altKey) return false
  return e.code === "KeyA" || e.key === "a" || e.key === "A"
}

/** Focus inside the Quick Add dialog — the chord must not close it or rewrite the draft. */
export function isQuickAddField(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-ui-name='Quick Add']"))
}

/** Highlighted text in the focused field, or the page selection. */
export function readCaptureSelection(): string {
  const active = document.activeElement
  if (
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLInputElement &&
      active.type !== "button" &&
      active.type !== "checkbox" &&
      active.type !== "radio" &&
      active.type !== "submit" &&
      active.type !== "reset" &&
      active.type !== "file")
  ) {
    const start = active.selectionStart
    const end = active.selectionEnd
    if (start != null && end != null && end > start) return active.value.slice(start, end).trim()
  }
  const sel = typeof window.getSelection === "function" ? window.getSelection() : null
  if (!sel || sel.isCollapsed) return ""
  return sel.toString().trim()
}

export function useQuickCaptureHotkey(options: UseQuickCaptureHotkeyOptions = {}): UseQuickCaptureHotkey {
  const { enabled = true, onOpen } = options
  const [open, setOpen] = useState(false)
  const [seed, setSeed] = useState("")

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return
      if (!isCaptureChord(e)) return
      if (isQuickAddField(e.target) || isQuickAddField(document.activeElement)) return
      e.preventDefault()
      if (open) {
        setSeed("")
        setOpen(false)
        return
      }
      setSeed(readCaptureSelection())
      setOpen(true)
      onOpen?.()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, onOpen, open])

  // Bridge the Electron global accelerator → renderer, when available. The
  // preload exposes `window.electron?.onQuickCapture(cb)` during integration;
  // this is a no-op in the browser build.
  useEffect(() => {
    const api = (window as unknown as {
      electron?: { onQuickCapture?: (cb: () => void) => (() => void) | void }
    }).electron
    if (!api?.onQuickCapture) return
    const dispose = api.onQuickCapture(() => {
      setSeed(readCaptureSelection())
      setOpen(true)
      onOpen?.()
    })
    return () => {
      if (typeof dispose === "function") dispose()
    }
  }, [onOpen])

  const setOpenStable = useCallback((next: boolean) => {
    setOpen(next)
    if (next) onOpen?.()
    else setSeed("")
  }, [onOpen])

  return { open, setOpen: setOpenStable, seed }
}
