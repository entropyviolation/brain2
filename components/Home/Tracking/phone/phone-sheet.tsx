/**
 * components/Home/Tracking/phone/phone-sheet.tsx — Bottom sheet for phone Tracking
 *
 * A tray of tools stays one row. Pens, Fill, Now, Find, and the recorder
 * open here so they do not eat the day. Escape, the scrim, and Done close it.
 */
"use client"

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

export function PhoneSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
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
  }, [onClose])

  if (typeof document === "undefined") return null

  return createPortal(
    <div className="trk-phone-sheet-root">
      <button type="button" className="trk-phone-sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="trk95 trk-phone-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="trk-phone-sheet-grab" aria-hidden />
        <header className="trk-phone-sheet-bar">
          <h3>{title}</h3>
          <button type="button" className="trk-phone-sheet-done" onClick={onClose}>
            Done
          </button>
        </header>
        <div className="trk-phone-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
