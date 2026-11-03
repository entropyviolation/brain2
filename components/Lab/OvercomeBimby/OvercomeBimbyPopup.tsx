/**
 * components/Lab/OvercomeBimby/OvercomeBimbyPopup.tsx — The Overcome panel as a popup you can close
 *
 * Esc, the backdrop and the ✕ key all close it. Wraps `OvercomeBimbyPanel`, which links to the BIM flow lab's node view.
 */
"use client"

import { useEffect, useRef } from "react"
import { OvercomeBimbyPanel } from "./OvercomeBimbyPanel"

export function OvercomeBimbyPopup({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-3"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      data-testid="overcome-popup"
    >
      <div role="dialog" aria-modal="true" aria-label="Overcome executive dysfunction" className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-neutral-400 bg-white text-neutral-900 shadow-2xl dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100">
        <button
          ref={closeRef}
          type="button"
          aria-label="Close"
          className="absolute right-2 top-2 z-10 min-h-11 min-w-11 rounded border border-neutral-400 text-lg hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
          onClick={onClose}
        >
          ✕
        </button>
        <OvercomeBimbyPanel />
      </div>
    </div>
  )
}
