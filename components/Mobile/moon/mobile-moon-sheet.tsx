/**
 * components/Mobile/moon/mobile-moon-sheet.tsx — Phone Moon detail
 *
 * The desktop detail is the sky chart (`HomeWidgetDialog` + `is-sky`).
 * On the iOS shell that chart is a full-viewport sheet: the close key sits
 * under the island, the scrim is covered, and the chart swallows the scroll.
 * This sheet is the phase and the three lines, with Close in the safe area.
 */
"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { MoonPhaseDisk } from "@/components/Home/moon/home-moon-phase"
import { formatMajorWhen, type MoonGlance } from "@/lib/lunar"

import "./mobile-moon.css"

export function MobileMoonSheet({
  open,
  onClose,
  face,
}: {
  open: boolean
  onClose: () => void
  face: MoonGlance
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="mobile-moon-root">
      <button type="button" className="mobile-moon-scrim" aria-label="Dismiss" onClick={onClose} />
      <div className="mobile-moon-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-moon-title" data-testid="mobile-moon-sheet">
        <header className="mobile-moon-bar">
          <h2 id="mobile-moon-title">Moon</h2>
          <button type="button" className="mobile-moon-close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="mobile-moon-body">
          <div className="mobile-moon-phase">
            <MoonPhaseDisk cycle={face.cycle} />
          </div>
          <p className="mobile-moon-label">{face.label}</p>
          <ul>
            <li>{face.illuminationLine}</li>
            <li>
              Next major phase: {face.nextMajor.label} on {formatMajorWhen(face.nextMajor.at)}
            </li>
            <li>
              Previous major phase: {face.previousMajor.label} on {formatMajorWhen(face.previousMajor.at)}
            </li>
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  )
}
