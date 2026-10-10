/**
 * components/Settings/panel-preview.ts — Timed-shift preview on the settings dialog
 *
 * A timed shift lerps only inside the settings `.set95-dialog` that contains
 * the field (`closest`, so a list-settings dialog does not receive it). Root
 * tokens stay on the previous chrome until the interval ends
 * (`appDriftPosition` in the painter). `.set95-drift-preview` lets that one
 * panel ease between samples. Other dialogs do not ease chrome colors
 * (`transition-property: none` in `app/win95.css`). Clearing the inline
 * properties hands the dialog back to `:root`.
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

/** Mark only this settings dialog so its own face may ease between preview samples. */
function setDriftPreview(dialog: HTMLElement, key: "warmth" | "corner", on: boolean) {
  dialog.toggleAttribute(key === "warmth" ? "data-warmth-preview" : "data-corner-preview", on)
  const previewing =
    dialog.hasAttribute("data-warmth-preview") || dialog.hasAttribute("data-corner-preview")
  dialog.classList.toggle("set95-drift-preview", previewing)
}

/** Write the in-between warmth onto the settings dialog while `active`. */
export function useWarmthPanelPreview(active: boolean, position: number) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dialog = settingsDialog(ref.current)
    if (!dialog) return
    if (!active) {
      clearProps(dialog, WARMTH_PROPS)
      setDriftPreview(dialog, "warmth", false)
      return
    }
    setDriftPreview(dialog, "warmth", true)
    applyChromePatina(dialog, position)
    return () => {
      clearProps(dialog, WARMTH_PROPS)
      setDriftPreview(dialog, "warmth", false)
    }
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
      setDriftPreview(dialog, "corner", false)
      return
    }
    setDriftPreview(dialog, "corner", true)
    applyCornerMix(dialog, position)
    return () => {
      clearProps(dialog, CORNER_PROPS)
      setDriftPreview(dialog, "corner", false)
    }
  }, [active, position])
  return ref
}
