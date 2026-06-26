"use client"

/**
 * hooks/useQuickCaptureHotkey.ts — Quick-capture hotkey (Feature 10, Worker J)
 *
 * A self-contained hook that owns the open/closed state of the quick-capture
 * surface and toggles it on the in-app capture chord (Cmd/Ctrl+Shift+K by
 * default — distinct from the Wave-1 search palette on Cmd/Ctrl-K). It only
 * attaches a single `keydown` listener while mounted; it does NOT register an
 * OS-level shortcut itself. The coordinator mounts this from `app/page.tsx` and
 * wires the Electron `globalShortcut` (see `QUICK_CAPTURE_GLOBAL_ACCELERATOR`)
 * during the integration pass.
 *
 * Usage:
 *   const { open, setOpen } = useQuickCaptureHotkey()
 *   return <QuickAdd open={open} onOpenChange={setOpen} />
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
}

/** True when the event matches the in-app capture chord (Cmd/Ctrl+Shift+K). */
function isCaptureChord(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "k" || e.key === "K")
}

export function useQuickCaptureHotkey(options: UseQuickCaptureHotkeyOptions = {}): UseQuickCaptureHotkey {
  const { enabled = true, onOpen } = options
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (isCaptureChord(e)) {
        e.preventDefault()
        setOpen((prev) => {
          const next = !prev
          if (next) onOpen?.()
          return next
        })
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, onOpen])

  // Bridge the Electron global accelerator → renderer, when available. The
  // preload exposes `window.electron?.onQuickCapture(cb)` during integration;
  // this is a no-op in the browser build.
  useEffect(() => {
    const api = (window as unknown as {
      electron?: { onQuickCapture?: (cb: () => void) => (() => void) | void }
    }).electron
    if (!api?.onQuickCapture) return
    const dispose = api.onQuickCapture(() => {
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
  }, [onOpen])

  return { open, setOpen: setOpenStable }
}
