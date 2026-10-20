/**
 * components/Home/home-widgets-menu.tsx — Widgets and Edit keys on the date bar
 *
 * Small keys, not peer tiles. Edit turns on edit mode for the Visual
 * dashboard (grip, resize corner, ×); it is never saved, so a reload starts
 * locked. The Widgets popover keeps its bands apart so they cannot stack:
 * Follow the clock and its one-line note, the Milled / Dash style switch,
 * the Widget gallery key, and one row per installed copy in the current
 * style's order (show or hide, step left or right). Countdown rows carry a
 * + that adds another mark, and with it another Countdown copy.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { HomeWidgetCatalog } from "@/components/Home/home-widget-catalog"
import { HideWidgetConfirm } from "@/components/Home/home-widget-dialog"
import { CockpitSwitch } from "@/components/Home/Habits/cockpit-switch"
import { useDashboardEditMode } from "@/components/Home/widgets/edit-mode"
import { useHomeDaysUntilStore } from "@/lib/home-days-until-store"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"
import { VOCAB_LANG_LABEL, type VocabLang } from "@/lib/vocab-words"
import { copyDisplayName, orderedCopies } from "@/lib/widgets/dashboard"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import type { DashboardStyle, WidgetCopy } from "@/lib/widgets/types"

const STYLES: { id: DashboardStyle; label: string; note: string }[] = [
  { id: "milled", label: "Milled", note: "Today's milled squares." },
  { id: "dash", label: "Dash", note: "Small lit faces on a dark dash." },
]

export function HomeWidgetsMenu() {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState(false)
  const [pendingHide, setPendingHide] = useState<WidgetCopy | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const followClock = useHomeWidgetsStore((s) => s.widgetsFollowClock)
  const setWidgetsFollowClock = useHomeWidgetsStore((s) => s.setWidgetsFollowClock)
  const marks = useHomeDaysUntilStore((s) => s.items)
  const addCountdown = useHomeDaysUntilStore((s) => s.addCountdown)
  const style = useDashboardStore((s) => s.style)
  const copies = useDashboardStore((s) => s.copies)
  const milled = useDashboardStore((s) => s.milled)
  const dash = useDashboardStore((s) => s.dash)
  const unknown = useDashboardStore((s) => s.unknown)
  const migrated = useDashboardStore((s) => s.migrated)
  const editing = useDashboardEditMode((s) => s.editing)
  const setEditing = useDashboardEditMode((s) => s.setEditing)

  useEffect(() => {
    if (!migrated) useDashboardStore.getState().ensureReady()
  }, [migrated])

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (pendingHide || catalog) return
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open, pendingHide, catalog])

  const rows = orderedCopies({ style, copies, milled, dash, unknown })
  const nameOf = (copy: WidgetCopy) => {
    if (copy.kind === "daysuntil" && !copy.title.trim()) {
      const mark = marks.find((item) => item.id === copy.settings.markId)
      if (mark?.label.trim()) return `Countdown · ${mark.label.trim()}`
    }
    return copyDisplayName(copy, (key) => VOCAB_LANG_LABEL[key as VocabLang] ?? key)
  }
  const firstCountdown = rows.find((copy) => copy.kind === "daysuntil" && !copy.hidden)?.id
  const store = useDashboardStore.getState

  return (
    <div className="home-title-widgets" ref={rootRef}>
      <button
        type="button"
        className="home-widgets-key home-widgets-edit-key"
        aria-pressed={editing}
        title={editing ? "Stop moving and resizing widgets" : "Move and resize widgets"}
        onClick={() => setEditing(!editing)}
      >
        Edit
      </button>
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
          <div className="home-widgets-style" role="radiogroup" aria-label="Dashboard style">
            {STYLES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={style === entry.id}
                className="home-widgets-style-key"
                title={entry.note}
                onClick={() => store().setStyle(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="home-widgets-catalog-key"
            onClick={() => {
              setCatalog(true)
              setOpen(false)
            }}
          >
            Widget gallery
          </button>
          <div className="home-widgets-list">
            {rows.map((copy) => {
              const showing = !copy.hidden
              const label = nameOf(copy)
              return (
                <div key={copy.id} className="home-add-row" data-copy-id={copy.id}>
                  <button
                    type="button"
                    className="home-add-name"
                    onClick={() => (showing ? setPendingHide(copy) : store().showCopy(copy.id))}
                  >
                    <span className="home-widgets-lamp" data-on={showing ? "true" : "false"} aria-hidden="true" />
                    <span>
                      {showing ? "Hide" : "Add"} {label}
                    </span>
                  </button>
                  {copy.id === firstCountdown ? (
                    <button
                      type="button"
                      className="home-add-move"
                      aria-label="Add another Countdown"
                      title="Add another countdown or count-up"
                      onClick={() => addCountdown()}
                    >
                      +
                    </button>
                  ) : null}
                  {showing ? (
                    <>
                      <button
                        type="button"
                        className="home-add-move"
                        aria-label={`Move ${label} left`}
                        onClick={() => store().stepCopy(copy.id, -1)}
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        className="home-add-move"
                        aria-label={`Move ${label} right`}
                        onClick={() => store().stepCopy(copy.id, 1)}
                      >
                        ▶
                      </button>
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}
      <HomeWidgetCatalog open={catalog} onOpenChange={setCatalog} />
      <HideWidgetConfirm
        open={pendingHide != null}
        label={pendingHide ? nameOf(pendingHide) : "this widget"}
        onCancel={() => setPendingHide(null)}
        onConfirm={() => {
          if (pendingHide) store().hideCopy(pendingHide.id)
          setPendingHide(null)
        }}
      />
    </div>
  )
}
