/**
 * components/Home/widgets/gallery/widget-gallery.tsx — The Widget gallery
 *
 * A rail of every kind, grouped (Day, Score, Sky, Clock, Capture, Study, Money), with
 * a lamp that is lit while any copy shows and a count of installed copies.
 * The first entry explains how widgets work (`gallery-about.tsx`); each kind
 * has its own page (`gallery-page.tsx`). Arrow keys step through the rail
 * unless a field has focus. Opened by `HomeWidgetCatalog`.
 */
"use client"

import { useEffect, useState } from "react"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import { allWidgetKinds, widgetKind } from "@/lib/widgets/kinds"
import type { WidgetKind } from "@/lib/widgets/types"
import { GalleryAbout } from "@/components/Home/widgets/gallery/gallery-about"
import { GalleryKindPage } from "@/components/Home/widgets/gallery/gallery-page"

const GROUPS: WidgetKind["group"][] = ["Day", "Score", "Clock", "Sky", "Study", "Money", "Capture"]
const ABOUT = "about"

export function WidgetGallery({ open, initialKind }: { open: boolean; initialKind?: string }) {
  const copies = useDashboardStore((s) => s.copies)
  const ensureReady = useDashboardStore((s) => s.ensureReady)
  const style = useDashboardStore((s) => s.style)
  const kinds = allWidgetKinds()
  const grouped = GROUPS.map((group) => ({ group, kinds: kinds.filter((kind) => kind.group === group) })).filter(
    (entry) => entry.kinds.length > 0,
  )
  const pages = [ABOUT, ...grouped.flatMap((entry) => entry.kinds.map((kind) => kind.id))]
  const [page, setPage] = useState<string>(initialKind && widgetKind(initialKind) ? initialKind : ABOUT)

  useEffect(() => {
    if (open) ensureReady()
    else setPage(initialKind && widgetKind(initialKind) ? initialKind : ABOUT)
  }, [open, ensureReady, initialKind])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        return
      }
      if (target?.closest(".vdg-page")) return
      event.preventDefault()
      setPage((current) => {
        const at = Math.max(0, pages.indexOf(current))
        const step = event.key === "ArrowDown" ? 1 : -1
        return pages[(at + step + pages.length) % pages.length]!
      })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, pages])

  useEffect(() => {
    if (!open) return
    document.querySelector<HTMLElement>(`[data-gallery-id="${page}"]`)?.scrollIntoView?.({ block: "nearest", inline: "nearest" })
  }, [open, page])

  const kind = page === ABOUT ? undefined : widgetKind(page)

  return (
    <div className="home-catalog vdg" data-style={style} data-testid="home-widget-catalog">
      <div className="home-catalog-body vdg-body">
        <nav className="home-catalog-list vdg-rail" role="listbox" aria-label="All widgets">
          <button
            type="button"
            role="option"
            aria-selected={page === ABOUT}
            data-gallery-id={ABOUT}
            className="home-catalog-pick vdg-pick vdg-pick-about"
            onClick={() => setPage(ABOUT)}
          >
            <span>How widgets work</span>
          </button>
          {grouped.map((entry) => (
            <div key={entry.group} className="vdg-rail-group" role="presentation">
              <p className="vdg-rail-head" role="presentation">
                {entry.group}
              </p>
              {entry.kinds.map((item) => {
                const mine = copies.filter((copy) => copy.kind === item.id)
                const lit = mine.some((copy) => !copy.hidden)
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={page === item.id}
                    data-gallery-id={item.id}
                    className="home-catalog-pick vdg-pick"
                    onClick={() => setPage(item.id)}
                  >
                    <span className="home-widgets-lamp" data-on={lit ? "true" : "false"} aria-hidden="true" />
                    <span className="vdg-pick-name">{item.name}</span>
                    {mine.length > 1 ? <span className="vdg-pick-count">{mine.length}</span> : null}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="home-catalog-detail vdg-detail">
          {kind ? <GalleryKindPage key={kind.id} kind={kind} /> : <GalleryAbout onOpenKind={setPage} />}
        </div>
      </div>
    </div>
  )
}
