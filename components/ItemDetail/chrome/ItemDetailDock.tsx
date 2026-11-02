/**
 * components/ItemDetail/chrome/ItemDetailDock.tsx — Minimized item detail
 *
 * A minimized item detail window stays mounted, so its draft stays. The dock
 * holds either a short bar (orb, title, close) or the item's icon (orb, open,
 * close), both on the same silver plate of keycaps. The orb switches between
 * the two. The title or the open key opens the window again. Close asks about
 * unsaved changes. Drag a plate by its bare metal (not a key) to reorder the
 * dock. `data-no95` keeps the app's metal button skin off the keys.
 *
 * _Last mapped: 2026-11-01_
 */
"use client"

import { useEffect, useId, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { createPortal } from "react-dom"
import { create } from "zustand"

/** Dock order, shared by every window's chip. Chips portal in mount order; CSS `order` follows this. */
const useDockOrder = create<{ keys: string[] }>(() => ({ keys: [] }))

function moveKey(key: string, before: string): void {
  useDockOrder.setState(({ keys }) => {
    const from = keys.indexOf(key)
    const to = keys.indexOf(before)
    if (from < 0 || to < 0 || from === to) return { keys }
    const next = keys.filter((k) => k !== key)
    next.splice(to, 0, key)
    return { keys: next }
  })
}

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
  const key = useId()
  const order = useDockOrder((s) => s.keys.indexOf(key))
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
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
  useEffect(() => {
    useDockOrder.setState(({ keys }) => ({ keys: [...keys, key] }))
    return () => useDockOrder.setState(({ keys }) => ({ keys: keys.filter((k) => k !== key) }))
  }, [key])
  if (!root) return null

  // Grab the plate, not a key. Past a few pixels, hovering another chip takes its place.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest("button")) return
    drag.current = { x: event.clientX, y: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    if (!d.moved) {
      if (Math.hypot(event.clientX - d.x, event.clientY - d.y) < 4) return
      d.moved = true
      setDragging(true)
    }
    const over = document
      .elementsFromPoint(event.clientX, event.clientY)
      .map((el) => el.closest<HTMLElement>("[data-dock-key]"))
      .find((el) => el && el.dataset.dockKey !== key)
    if (over?.dataset.dockKey) moveKey(key, over.dataset.dockKey)
  }
  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }

  const iconMode = shape === "icon"
  const chip = (
    <div
      className={["id-dock-bar", iconMode && "id-dock-icon", dragging && "is-dragging"].filter(Boolean).join(" ")}
      data-dock-key={key}
      style={{ order }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <button
        type="button"
        className="id-dock-orb"
        data-no95
        aria-label={iconMode ? "Show as a bar" : "Show as an icon"}
        title={iconMode ? title : "Show as an icon"}
        onClick={() => onShape(iconMode ? "bar" : "icon")}
      >
        <img src={iconSrc} alt="" />
      </button>
      {iconMode ? (
        <button type="button" className="id-dock-open" data-no95 aria-label={`Open ${title}`} title="Open" onClick={onRestore}>
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
            <path d="M5 2H2v8h8V7M7 1.5h3.5V5M10.5 1.5 5.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
      ) : (
        <button type="button" className="id-dock-title" data-no95 onClick={onRestore}>
          {title}
        </button>
      )}
      <button type="button" className="id-dock-x" data-no95 aria-label={`Close ${title}`} onClick={onClose}>
        ×
      </button>
    </div>
  )

  return createPortal(chip, root)
}
