/**
 * components/quick-add-wrote.tsx — Quick Add "added" confirmation
 *
 * A small floating notice after a successful Quick Add write. Lives outside the
 * dialog chunk so closing Quick Add does not tear it down. Fixed bottom-right
 * with a comfortable inset (`.qa-wrote` in `header-popup-chrome.css`), X to
 * dismiss, auto-dismiss after one minute. Pointer events only on the notice —
 * no layout shift on the page.
 */
"use client"

import { useEffect, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

/** How long the wrote-flag stays if nobody dismisses it (1 minute). */
export const QUICK_ADD_WROTE_MS = 60_000

/** Successful `log:` / `log-` / `log ` write. Not Inbox. */
export const QUICK_ADD_LOG_WROTE = "Item added to the tracking log from Quick Add"

type WroteNotice = { id: number; text: string }

let seq = 0
let notice: WroteNotice | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return notice
}

function getServerSnapshot() {
  return null
}

/** Raise (or replace) the floating "added" confirmation. */
export function raiseQuickAddWrote(text: string) {
  seq += 1
  notice = { id: seq, text }
  emit()
}

/** Clear the confirmation if it is still the current one. */
export function dismissQuickAddWrote(id?: number) {
  if (id != null && notice?.id !== id) return
  if (!notice) return
  notice = null
  emit()
}

function QuickAddWroteFlag({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  if (typeof document === "undefined") return null
  return createPortal(
    <div className="qa-wrote" role="status" data-quick-add-notice="" onClick={onDismiss}>
      <span className="qa-wrote-lamp" aria-hidden />
      <span className="qa-wrote-text" title={text}>
        {text}
      </span>
      <button
        type="button"
        className="qa-wrote-x"
        data-no95=""
        aria-label="Dismiss"
        onClick={(event) => {
          event.stopPropagation()
          onDismiss()
        }}
      >
        ×
      </button>
    </div>,
    document.body,
  )
}

/**
 * Pin-bar host for the added confirmation. Mount beside the Quick Add key so
 * the notice survives dialog close. Tests mount this next to `<QuickAdd />`.
 */
export function QuickAddWroteHost({ wroteMs = QUICK_ADD_WROTE_MS }: { wroteMs?: number } = {}) {
  const wrote = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    if (!wrote) return
    const id = wrote.id
    const timer = window.setTimeout(() => dismissQuickAddWrote(id), wroteMs)
    return () => window.clearTimeout(timer)
  }, [wrote, wroteMs])

  if (!wrote) return null
  return <QuickAddWroteFlag text={wrote.text} onDismiss={() => dismissQuickAddWrote(wrote.id)} />
}
