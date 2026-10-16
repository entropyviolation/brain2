/**
 * components/ItemDetail/useItemDetailUnloadGuard.ts — Browser "leave site?" while dirty
 *
 * Both detail shells call this while open. Closing the window or reloading
 * with an unsaved draft asks the browser's own leave prompt. The dirty check
 * is a function so it reads the live draft ref, not a render-time boolean.
 */
"use client"

import { useEffect } from "react"

export function useItemDetailUnloadGuard(active: boolean, isDirty: () => boolean): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") return
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty()) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [active, isDirty])
}
