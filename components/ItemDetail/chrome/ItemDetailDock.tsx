/**
 * components/ItemDetail/chrome/ItemDetailDock.tsx — Minimized item detail
 *
 * A minimized item detail popup stays mounted, so its draft stays. The dock
 * holds either a short bar (orb, title, close) or the item's icon (orb, open,
 * close), both on the same silver plate. The orb switches between the two.
 * The title or the open key opens the popup again. Close asks about unsaved
 * changes. The orb and the title are silver keycaps (`data-no95` keeps the
 * app's metal button skin off them).
 *
 * _Last mapped: 2026-11-01_
 */
"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export function ItemDetailDock({
  title,
  iconSrc,
  shape,
  onShape,
  onRestore,
  onClose,
}: {
  title: string
  iconSrc: string
  shape: "bar" | "icon"
  onShape: (shape: "bar" | "icon") => void
  onRestore: () => void
  onClose: () => void
}) {
  const [root, setRoot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    let el = document.getElementById("id-detail-dock")
    if (!el) {
      el = document.createElement("div")
      el.id = "id-detail-dock"
      el.className = "id-detail-dock"
      document.body.appendChild(el)
    }
    setRoot(el)
  }, [])
  if (!root) return null

  // Both shapes are one silver plate of keycaps. The orb toggles the shape.
  // In the bar the title opens the popup; as an icon the open key does.
  const chip = (
    <div className={shape === "icon" ? "id-dock-bar id-dock-icon" : "id-dock-bar"}>
      <button
        type="button"
        className="id-dock-orb"
        data-no95
        aria-label={shape === "icon" ? "Show as a bar" : "Show as an icon"}
        title={shape === "icon" ? title : "Show as an icon"}
        onClick={() => onShape(shape === "icon" ? "bar" : "icon")}
      >
        <img src={iconSrc} alt="" />
      </button>
      {shape === "icon" ? (
        <button type="button" className="id-dock-open" aria-label={`Open ${title}`} title="Open" onClick={onRestore}>
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path d="M5 2H2v8h8V7M7 1.5h3.5V5M10.5 1.5 5.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
      ) : (
        <button type="button" className="id-dock-title" data-no95 onClick={onRestore}>
          {title}
        </button>
      )}
      <button type="button" className="id-dock-x" aria-label={`Close ${title}`} onClick={onClose}>
        ×
      </button>
    </div>
  )

  return createPortal(chip, root)
}
