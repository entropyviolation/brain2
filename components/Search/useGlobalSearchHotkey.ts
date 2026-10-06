"use client"

/**
 * components/Search/useGlobalSearchHotkey.ts
 *
 * A self-contained hook that owns the open/closed state of the global search
 * palette and toggles it on Cmd/Ctrl-K. Shift and Alt stay free (Cmd/Ctrl-Shift-K
 * is quick capture). Key repeat does not toggle. It only attaches a single
 * `keydown` listener while mounted — it does NOT render or mount anything
 * globally, so the caller stays in control of where `<GlobalSearch>` lives.
 *
 * Usage:
 *   const { open, setOpen } = useGlobalSearchHotkey()
 *   return <GlobalSearch open={open} onOpenChange={setOpen} onSelect={...} />
 */
import { useEffect, useState, useCallback } from "react"

export interface UseGlobalSearchHotkey {
  open: boolean
  setOpen: (open: boolean) => void
}

export function useGlobalSearchHotkey(): UseGlobalSearchHotkey {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Hold-repeat must not flap the palette open and shut.
      if (e.repeat) return
      // Leave Shift (quick capture) and Alt chords alone.
      if (e.shiftKey || e.altKey) return
      // Cmd-K (mac) / Ctrl-K (win/linux) toggles the palette.
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const setOpenStable = useCallback((next: boolean) => setOpen(next), [])

  return { open, setOpen: setOpenStable }
}
