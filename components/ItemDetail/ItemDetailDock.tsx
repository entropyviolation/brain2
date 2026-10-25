/**
 * components/ItemDetail/ItemDetailDock.tsx — Minimized item detail
 *
 * A minimized item detail popup stays mounted, so its draft stays. The dock
 * holds either a short bar (title and close) or the item's icon. Close asks
 * about unsaved changes. Click the title or the icon to open the popup again.
 *
 * _Last mapped: 2026-10-24_
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

  const chip =
    shape === "icon" ? (
      <div className="id-dock-icon">
        <button type="button" className="id-dock-orb" title={title} aria-label={`Open ${title}`} onClick={onRestore}>
          <img src={iconSrc} alt="" />
        </button>
        <button type="button" className="id-dock-shape" aria-label="Show as a bar" title="Show as a bar" onClick={() => onShape("bar")}>
          ▭
        </button>
        <button type="button" className="id-dock-x" aria-label={`Close ${title}`} onClick={onClose}>
          ×
        </button>
      </div>
    ) : (
      <div className="id-dock-bar">
        <button type="button" className="id-dock-orb" aria-label="Show as an icon" title="Show as an icon" onClick={() => onShape("icon")}>
          <img src={iconSrc} alt="" />
        </button>
        <button type="button" className="id-dock-title" onClick={onRestore}>
          {title}
        </button>
        <button type="button" className="id-dock-x" aria-label={`Close ${title}`} onClick={onClose}>
          ×
        </button>
      </div>
    )

  return createPortal(chip, root)
}
