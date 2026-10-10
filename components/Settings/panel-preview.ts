/**
 * components/Settings/panel-preview.ts — Timed-shift preview on the settings dialog
 *
 * A timed shift lerps only inside `.set95-dialog`. Root tokens stay on the
 * previous chrome until the interval ends (`appDriftPosition` in the painter).
 * Clearing the inline properties hands the dialog back to `:root`.
 */
"use client"

import { useEffect, useRef } from "react"
import { applyChromePatina, chromePatinaTokens } from "@/lib/chrome-patina"
import { applyCornerMix, cornerTokens } from "@/lib/corner-mix"

const WARMTH_PROPS = Object.keys(chromePatinaTokens(50))
const CORNER_PROPS = [...Object.keys(cornerTokens(50)), "--corner-mix"]

function clearProps(el: HTMLElement, names: readonly string[]) {
  for (const name of names) el.style.removeProperty(name)
}

function settingsDialog(node: HTMLElement | null): HTMLElement | null {
  return node?.closest<HTMLElement>(".set95-dialog") ?? null
}

/** Write the in-between warmth onto the settings dialog while `active`. */
export function useWarmthPanelPreview(active: boolean, position: number) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dialog = settingsDialog(ref.current)
    if (!dialog) return
    if (!active) {
      clearProps(dialog, WARMTH_PROPS)
      return
    }
    applyChromePatina(dialog, position)
    return () => clearProps(dialog, WARMTH_PROPS)
  }, [active, position])
  return ref
}

/** Write the in-between corners onto the settings dialog while `active`. */
export function useCornerPanelPreview(active: boolean, position: number) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dialog = settingsDialog(ref.current)
    if (!dialog) return
    if (!active) {
      clearProps(dialog, CORNER_PROPS)
      return
    }
    applyCornerMix(dialog, position)
    return () => clearProps(dialog, CORNER_PROPS)
  }, [active, position])
  return ref
}
