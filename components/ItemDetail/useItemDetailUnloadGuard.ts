/**
 * components/ItemDetail/useItemDetailUnloadGuard.ts — Browser "leave site?" while dirty
 *
 * While an item detail surface is open, a reload or window close with an
 * unsaved draft asks the browser to confirm. The dirty check is read live.
 */
"use client"

import { useEffect } from "react"

export function useItemDetailUnloadGuard(active: boolean, isDirty: () => boolean): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty()) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [active, isDirty])
}
