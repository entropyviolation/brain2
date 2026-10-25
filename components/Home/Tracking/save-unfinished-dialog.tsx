/**
 * components/Home/Tracking/save-unfinished-dialog.tsx
 *
 * Stop, with objectives still open, asks once whether to keep them for the
 * next time that pen, task, or subtask is tracked.
 */
"use client"

import { useState } from "react"
import { createPortal } from "react-dom"

export function SaveUnfinishedDialog({
  count,
  onYes,
  onNo,
}: {
  count: number
  onYes: () => void
  onNo: () => void
}) {
  if (typeof document === "undefined") return null
  const noun = count === 1 ? "1 objective is still open." : `${count} objectives are still open.`
  return createPortal(
    <div
      className="trk-now-obj-stop-back"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          event.stopPropagation()
          onNo()
        }
      }}
    >
      <div className="trk-now-obj-stop" role="alertdialog" aria-label="Save unfinished objectives" data-testid="save-unfinished-dialog">
        <p>{noun} Save them for the next time you track this?</p>
        <div className="trk-now-obj-stop-actions">
          <button type="button" className="ops-btn" onClick={onYes}>
            Yes
          </button>
          <button type="button" className="ops-btn" onClick={onNo}>
            No
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Ask when `active` is above zero. Yes stops and parks. No stops without parking. */
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
    />
  ) : null
  return { request, dialog }
}
