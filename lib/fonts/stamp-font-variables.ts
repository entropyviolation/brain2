/**
 * lib/fonts/stamp-font-variables.ts — Put next/font variable classes on <html>
 *
 * A dialog portals to document.body, so a class on the screen root does not
 * reach it. Stamping the same classes onto <html> before paint keeps
 * `--font-*` in scope for that portal. Classes stay for the session.
 */
"use client"

import { useLayoutEffect } from "react"

export function useStampFontVariables(className: string) {
  useLayoutEffect(() => {
    const names = className.split(/\s+/).filter(Boolean)
    if (names.length === 0) return
    document.documentElement.classList.add(...names)
  }, [className])
}
