/**
 * components/Home/home-widgets-menu.tsx — Widgets catalog on the date bar
 *
 * A small key, not a peer tile. The popover lists every overview module so
 * the strip itself stays a row of instruments.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { HOME_WIDGET_LABEL, type HomeWidgetId } from "@/lib/home-widgets"
import { useHomeWidgetsStore, selectHiddenHomeWidgets } from "@/lib/home-widgets-store"
import { HideWidgetConfirm } from "@/components/Home/home-widget-dialog"

export function HomeWidgetsMenu() {
  const [open, setOpen] = useState(false)
  const [pendingHide, setPendingHide] = useState<HomeWidgetId | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const order = useHomeWidgetsStore((s) => s.order)
  const hidden = useHomeWidgetsStore((s) => s.hidden)
  const showWidget = useHomeWidgetsStore((s) => s.showWidget)
  const hideWidget = useHomeWidgetsStore((s) => s.hideWidget)
  const moveWidget = useHomeWidgetsStore((s) => s.moveWidget)
  const tucked = new Set(selectHiddenHomeWidgets({ order, hidden }))

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (pendingHide) return
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open, pendingHide])

  return (
    <div className="home-title-widgets" ref={rootRef}>
      <button
        type="button"
        className="home-widgets-key"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Widgets
      </button>
      {open && (
        <div className="home-add-menu" role="group" aria-label="Home widgets">
          {order.map((id) => {
            const showing = !tucked.has(id)
            return (
              <div key={id} className="home-add-row">
                <button
                  type="button"
                  className="home-add-name"
                  onClick={() => (showing ? setPendingHide(id) : showWidget(id))}
                >
                  {showing ? "Hide" : "Add"} {HOME_WIDGET_LABEL[id]}
                </button>
                <button
                  type="button"
                  className="home-add-move"
                  aria-label={`Move ${HOME_WIDGET_LABEL[id]} left`}
                  onClick={() => moveWidget(id, -1)}
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="home-add-move"
                  aria-label={`Move ${HOME_WIDGET_LABEL[id]} right`}
                  onClick={() => moveWidget(id, 1)}
                >
                  ▶
                </button>
              </div>
            )
          })}
        </div>
      )}
      <HideWidgetConfirm
        open={pendingHide != null}
        label={pendingHide ? HOME_WIDGET_LABEL[pendingHide] : "this widget"}
        onCancel={() => setPendingHide(null)}
        onConfirm={() => {
          if (pendingHide) hideWidget(pendingHide)
          setPendingHide(null)
        }}
      />
    </div>
  )
}
