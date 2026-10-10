/**
 * components/Home/home-widget-catalog.tsx — Browser for every overview square
 *
 * Opened from the Widgets menu. One entry at a time: name, showing or hidden,
 * a static example of the tile, what it shows, and when it is useful.
 * Add and hide use the same store. Hide still asks Are you sure?
 */
"use client"

import { useEffect, useState } from "react"
import { HideWidgetConfirm, HomeWidgetDialog } from "@/components/Home/home-widget-dialog"
import { HOME_WIDGET_CATALOG, HOME_WIDGET_LABEL, type HomeWidgetId } from "@/lib/home-widgets"
import { useHomeDaysUntilStore } from "@/lib/home-days-until-store"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"

export function HomeWidgetCatalog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const order = useHomeWidgetsStore((s) => s.order)
  const hidden = useHomeWidgetsStore((s) => s.hidden)
  const showWidget = useHomeWidgetsStore((s) => s.showWidget)
  const hideWidget = useHomeWidgetsStore((s) => s.hideWidget)
  const addDaysUntil = useHomeDaysUntilStore((s) => s.addCountdown)
  const [index, setIndex] = useState(0)
  const [pendingHide, setPendingHide] = useState<HomeWidgetId | null>(null)
  const tucked = new Set(hidden)
  const entries = order
    .map((id) => HOME_WIDGET_CATALOG.find((entry) => entry.id === id))
    .filter((entry): entry is (typeof HOME_WIDGET_CATALOG)[number] => entry != null)
  const safeIndex = entries.length === 0 ? 0 : ((index % entries.length) + entries.length) % entries.length
  const entry = entries[safeIndex]

  useEffect(() => {
    if (!open) setIndex(0)
  }, [open])

  useEffect(() => {
    if (!open || pendingHide || entries.length === 0) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowUp") {
        return
      }
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return
      event.preventDefault()
      const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1
      setIndex((current) => {
        const base = ((current % entries.length) + entries.length) % entries.length
        return (base + step + entries.length) % entries.length
      })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, pendingHide, entries.length])

  useEffect(() => {
    if (!open) return
    const node = document.querySelector<HTMLButtonElement>(`[data-catalog-id="${entry?.id ?? ""}"]`)
    node?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [open, entry?.id])

  const step = (direction: -1 | 1) => {
    if (entries.length === 0) return
    setIndex((current) => {
      const base = ((current % entries.length) + entries.length) % entries.length
      return (base + direction + entries.length) % entries.length
    })
  }

  return (
    <>
      <HomeWidgetDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Widget catalog"
        className="home-widget-catalog"
      >
        <div className="home-catalog" data-testid="home-widget-catalog">
          <div className="home-catalog-nav">
            <button type="button" className="home-review-key" aria-label="Previous widget" onClick={() => step(-1)}>
              ◀
            </button>
            <p className="home-catalog-count">
              {entries.length === 0 ? "0" : safeIndex + 1} of {entries.length}
            </p>
            <button type="button" className="home-review-key" aria-label="Next widget" onClick={() => step(1)}>
              ▶
            </button>
          </div>
          <div className="home-catalog-body">
            <div className="home-catalog-list" role="listbox" aria-label="All widgets">
              {entries.map((item, itemIndex) => {
                const showing = !tucked.has(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={itemIndex === safeIndex}
                    data-catalog-id={item.id}
                    className="home-catalog-pick"
                    onClick={() => setIndex(itemIndex)}
                  >
                    <span className="home-widgets-lamp" data-on={showing ? "true" : "false"} aria-hidden="true" />
                    <span>{item.name}</span>
                  </button>
                )
              })}
            </div>
            {entry ? (
              <article className="home-catalog-detail" aria-live="polite">
                <header className="home-catalog-head">
                  <h3>{entry.name}</h3>
                  <p className="home-catalog-state">{tucked.has(entry.id) ? "Hidden" : "Showing"}</p>
                </header>
                <p className="home-catalog-example">Example</p>
                <div className="home-catalog-sample" aria-hidden="true">
                  <div className="home-catalog-sample-caption">
                    <span className="home-widgets-lamp" data-on="true" />
                    <span>{entry.preview.caption}</span>
                  </div>
                  <div className="home-catalog-sample-crt">{entry.preview.crt}</div>
                  <div className="home-catalog-sample-foot">{entry.preview.footer}</div>
                </div>
                <p className="home-widget-note">{entry.shows}</p>
                <p className="home-widget-note">{entry.useful}</p>
                {tucked.has(entry.id) ? (
                  <button
                    type="button"
                    className="home-review-key"
                    onClick={() => showWidget(entry.id)}
                  >
                    Add {HOME_WIDGET_LABEL[entry.id]}
                  </button>
                ) : entry.id === "daysuntil" ? (
                  <div className="home-widget-actions">
                    <button
                      type="button"
                      className="home-review-key"
                      onClick={() => addDaysUntil()}
                    >
                      Add another
                    </button>
                    <button
                      type="button"
                      className="home-review-key"
                      onClick={() => setPendingHide(entry.id)}
                    >
                      Hide {HOME_WIDGET_LABEL[entry.id]}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="home-review-key"
                    onClick={() => setPendingHide(entry.id)}
                  >
                    Hide {HOME_WIDGET_LABEL[entry.id]}
                  </button>
                )}
              </article>
            ) : null}
          </div>
        </div>
      </HomeWidgetDialog>
      <HideWidgetConfirm
        open={pendingHide != null}
        label={pendingHide ? HOME_WIDGET_LABEL[pendingHide] : "this widget"}
        onCancel={() => setPendingHide(null)}
        onConfirm={() => {
          if (pendingHide) hideWidget(pendingHide)
          setPendingHide(null)
        }}
      />
    </>
  )
}
