/**
 * components/Home/Tracking/save-unfinished-dialog.tsx
 *
 * Stop, with objectives still open, asks once whether to keep them for the
 * next time that pen, task, or subtask is tracked.
 * Yes closes and parks them. No closes without parking. Cancel leaves the
 * clock running.
 */
"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export function SaveUnfinishedDialog({
  count,
  onYes,
  onNo,
  onCancel,
}: {
  count: number
  onYes: () => void
  onNo: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [onCancel])

  if (typeof document === "undefined") return null
  const noun = count === 1 ? "1 objective is still open." : `${count} objectives are still open.`
  return createPortal(
    <div className="trk-now-obj-stop-back" role="presentation">
      <div className="trk-now-obj-stop" role="alertdialog" aria-label="Save unfinished objectives" data-testid="save-unfinished-dialog">
        <p>{noun} Save them for the next time you track this?</p>
        <div className="trk-now-obj-stop-actions">
          <button type="button" className="ops-btn" title="Close and save them" onClick={onYes}>
            Yes
          </button>
          <button type="button" className="ops-btn" title="Close without saving them" onClick={onNo}>
            No
          </button>
          <button type="button" className="ops-btn" title="Go back. The clock stays on." onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Ask when `active` is above zero.
 * Yes stops and parks. No stops without parking. Cancel leaves the clock on.
 */
export function useUnfinishedStop(active: number, onStop: (park: boolean) => void) {
  const [open, setOpen] = useState(false)
  const request = () => {
    if (active > 0) setOpen(true)
    else onStop(false)
  }
  const dialog = open ? (
    <SaveUnfinishedDialog
      count={active}
      onYes={() => {
        setOpen(false)
        onStop(true)
      }}
      onNo={() => {
        setOpen(false)
        onStop(false)
      }}
      onCancel={() => setOpen(false)}
    />
  ) : null
  return { request, dialog }
}
