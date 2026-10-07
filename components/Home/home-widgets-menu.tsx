/**
 * components/Home/home-widgets-menu.tsx — Widgets catalog on the date bar
 *
 * A small key, not a peer tile. The popover keeps Follow the clock, its
 * one-line note, and the widget list in separate bands so they cannot stack.
 * Widget catalog opens the browser for every square. Follow the clock
 * (default off) makes those squares read the wall clock instead of the day
 * being viewed.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { HomeWidgetCatalog } from "@/components/Home/home-widget-catalog"
import { HideWidgetConfirm } from "@/components/Home/home-widget-dialog"
import { CockpitSwitch } from "@/components/Home/Habits/cockpit-switch"
import { HOME_WIDGET_LABEL, type HomeWidgetId } from "@/lib/home-widgets"
import { useHomeWidgetsStore, selectHiddenHomeWidgets } from "@/lib/home-widgets-store"

export function HomeWidgetsMenu() {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState(false)
  const [pendingHide, setPendingHide] = useState<HomeWidgetId | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const order = useHomeWidgetsStore((s) => s.order)
  const hidden = useHomeWidgetsStore((s) => s.hidden)
  const followClock = useHomeWidgetsStore((s) => s.widgetsFollowClock)
  const setWidgetsFollowClock = useHomeWidgetsStore((s) => s.setWidgetsFollowClock)
  const showWidget = useHomeWidgetsStore((s) => s.showWidget)
  const hideWidget = useHomeWidgetsStore((s) => s.hideWidget)
  const moveWidget = useHomeWidgetsStore((s) => s.moveWidget)
  const tucked = new Set(selectHiddenHomeWidgets({ order, hidden }))

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (pendingHide || catalog) return
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open, pendingHide, catalog])

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
        <div className="home-widgets-panel" role="group" aria-label="Home widgets">
          <div className="home-widgets-clock" data-testid="home-widgets-follow-clock">
            <div className="home-widgets-clock-row">
              <CockpitSwitch
                checked={followClock}
                onCheckedChange={setWidgetsFollowClock}
                label="Follow the clock"
                className="home-widgets-clock-rocker"
              />
            </div>
            <p className="home-widgets-clock-note" aria-live="polite">
              {followClock ? "Widgets use right now." : "Widgets use the day you're viewing."}
            </p>
          </div>
          <button
            type="button"
            className="home-widgets-catalog-key"
            onClick={() => {
              setCatalog(true)
              setOpen(false)
            }}
          >
            Widget catalog
          </button>
          <div className="home-widgets-list">
            {order.map((id) => {
              const showing = !tucked.has(id)
              const label = HOME_WIDGET_LABEL[id]
              return (
                <div key={id} className="home-add-row">
                  <button
                    type="button"
                    className="home-add-name"
                    onClick={() => (showing ? setPendingHide(id) : showWidget(id))}
                  >
                    <span className="home-widgets-lamp" data-on={showing ? "true" : "false"} aria-hidden="true" />
                    <span>
                      {showing ? "Hide" : "Add"} {label}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="home-add-move"
                    aria-label={`Move ${label} left`}
                    onClick={() => moveWidget(id, -1)}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    className="home-add-move"
                    aria-label={`Move ${label} right`}
                    onClick={() => moveWidget(id, 1)}
                  >
                    ▶
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <HomeWidgetCatalog open={catalog} onOpenChange={setCatalog} />
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
