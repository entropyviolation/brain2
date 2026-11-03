/**
 * components/Home/ToDo/task-card/TaskCardPhone.tsx — The task card's phone shell
 *
 * Pieces only: the sticky nav (grabber, Item, title, close, segmented tabs)
 * and the dock (thumb-reach actions or the mass-edit bar). `TaskCard.tsx` owns
 * every read and write and mounts these only at `max-width: 767px`
 * (`useTodoPhone`). The desktop tree is not touched. Styles: `task-card-phone.css`.
 */
"use client"

import { useRef } from "react"
import type { ReactNode, TouchEvent } from "react"
import { KeycapClose } from "@/components/keycap-close"
import { closeTaskCard } from "@/lib/task-card"

export type PhoneTab = "steps" | "details" | "time" | "notes"

const TABS: { id: PhoneTab; label: string }[] = [
  { id: "steps", label: "Steps" },
  { id: "details", label: "Details" },
  { id: "time", label: "Time" },
  { id: "notes", label: "Notes" },
]

/** Typed text in the card that was not entered yet. */
export function hasUnsavedDraft(): boolean {
  return [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".task-card [data-draft]")].some(
    (el) => el.value.trim() !== (el.dataset.draft ?? "").trim(),
  )
}

/** Pull the sheet down past this many points to close it. */
const DISMISS_PULL = 110

export function PhoneNav({
  title,
  tab,
  onTab,
  badges,
  onItem,
}: {
  title: ReactNode
  tab: PhoneTab
  onTab: (tab: PhoneTab) => void
  /** A small count or dot per tab (steps open, notes due). */
  badges: Partial<Record<PhoneTab, string>>
  onItem: () => void
}) {
  const start = useRef<number | null>(null)
  const sheet = (e: TouchEvent) => (e.currentTarget as HTMLElement).closest<HTMLElement>(".task-card")

  const onStart = (e: TouchEvent) => {
    start.current = e.touches[0]?.clientY ?? null
  }
  const onMove = (e: TouchEvent) => {
    if (start.current == null) return
    const dy = (e.touches[0]?.clientY ?? start.current) - start.current
    const el = sheet(e)
    if (el && dy > 0) {
      el.style.transition = "none"
      el.style.translate = `0 ${dy}px`
    }
  }
  const onEnd = (e: TouchEvent) => {
    const el = sheet(e)
    const dy = (e.changedTouches[0]?.clientY ?? 0) - (start.current ?? 0)
    start.current = null
    if (el) {
      el.style.transition = ""
      el.style.translate = ""
    }
    if (dy < DISMISS_PULL) return
    if (hasUnsavedDraft() && !window.confirm("Discard what you typed and close the card?")) return
    closeTaskCard()
  }

  return (
    <nav className="task-card-nav" aria-label="Task card">
      <div className="task-card-nav-bar" onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}>
        <span className="task-card-grabber" aria-hidden />
        <button type="button" className="task-card-nav-item" data-no95="" onClick={onItem}>
          Item
        </button>
        <div className="task-card-nav-title">{title}</div>
        <KeycapClose className="task-card-nav-close" title="Close the card" label="Close the card" onClick={closeTaskCard} />
      </div>
      <div className="task-card-segs" role="tablist" aria-label="Card sections">
        {TABS.map(({ id, label }) => (
          <button key={id} type="button" role="tab" data-no95="" aria-selected={tab === id} className="task-card-segs-tab" onClick={() => onTab(id)}>
            {label}
            {badges[id] ? <i>{badges[id]}</i> : null}
          </button>
        ))}
      </div>
    </nav>
  )
}

/** Sticks to the bottom of the scrolling card, above the home indicator. */
export function PhoneDock({ children }: { children: ReactNode }) {
  return (
    <div className="task-card-dock" role="group" aria-label="Actions">
      {children}
    </div>
  )
}
