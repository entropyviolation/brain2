/**
 * app/pcb-backdrop.tsx — Stamp the live PCB desktop mode on `<html>`
 *
 * The boot script already painted `brain2-pcb-mode` (then the theme blob).
 * Do not stamp seed teal from the unhydrated store — that is what made a
 * refresh look like a saved photograph never stuck. A plate picked this page
 * (`brain2-pcb-pick`) wins over a late hub rehydrate. After persist hydration,
 * follow `theme-store.pcbMode`. CSS in `pcb-backdrop.css` does the painting.
 */
"use client"

import { useEffect } from "react"
import { applyPcbBackdrop, readSessionPcbMode, readStoredPcbMode } from "@/lib/pcb-backdrop"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import { useThemeStore } from "@/lib/theme-store"

export function PcbBackdrop() {
  const mode = useThemeStore((s) => s.pcbMode)
  const hydrated = usePersistHydrated(useThemeStore.persist)

  useEffect(() => {
    const session = readSessionPcbMode()
    if (session) {
      applyPcbBackdrop(document.documentElement, session)
      return
    }
    if (!hydrated) {
      const pinned = readStoredPcbMode()
      if (pinned) applyPcbBackdrop(document.documentElement, pinned)
      return
    }
    applyPcbBackdrop(document.documentElement, mode)
  }, [mode, hydrated])

  return null
}
