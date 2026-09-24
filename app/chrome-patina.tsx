/**
 * app/chrome-patina.tsx — Apply the live gunmetal to `:root`
 *
 * Recalculates on mount, when the Settings set-point changes, and once a
 * minute so the metal can breathe. Not a CSS animation.
 */
"use client"

import { useEffect } from "react"
import { applyChromePatina, CHROME_PATINA_TICK_MS } from "@/lib/chrome-patina"
import { useThemeStore } from "@/lib/theme-store"

export function ChromePatina() {
  const setpoint = useThemeStore((s) => s.chromeFace)

  useEffect(() => {
    const root = document.documentElement
    const paint = () => applyChromePatina(root, useThemeStore.getState().chromeFace)
    paint()
    const id = window.setInterval(paint, CHROME_PATINA_TICK_MS)
    const unsub = useThemeStore.persist.onFinishHydration(paint)
    return () => {
      window.clearInterval(id)
      unsub()
    }
  }, [setpoint])

  return null
}
