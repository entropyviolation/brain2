/**
 * components/Home/Habits/PriorityReasonDialog.tsx — Optional why this habit
 * is being prioritized.
 *
 * Opens after Prioritize habit has already refreshed the star. Skip, the
 * title-bar close, and a blank Save resolve with no note. A saved note is
 * trimmed. The window sits above the habit form (z-120), in the same milled
 * face as that form.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function PriorityReasonDialog({
  open,
  subject,
  onResolve,
}: {
  open: boolean
  subject: string
  /** Called once. `undefined` means they skipped, closed, or left it blank. */
  onResolve: (text: string | undefined) => void
}) {
  const [note, setNote] = useState("")
  const resolved = useRef(false)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      resolved.current = false
      setNote("")
    }
    wasOpen.current = open
  }, [open])

  const finish = (text: string | undefined) => {
    if (resolved.current) return
    resolved.current = true
    onResolve(text)
  }

  const save = () => {
    const trimmed = note.trim()
    finish(trimmed || undefined)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && finish(undefined)}>
      <DialogContent
        className="habit95-dialog habit95-reason-dialog z-[120] max-h-[calc(100dvh-2rem)] overflow-y-auto"
        overlayClassName="z-[120]"
        hideClose
        data-ui-name="Why prioritize this"
      >
        <DialogHeader className="habit95-title-bar flex-row items-center space-y-0 text-left">
          <DialogTitle className="habit95-title-text">Why prioritize this?</DialogTitle>
          <button
            type="button"
            className="habit95-title-btn b2-close-key"
            aria-label="Close"
            onClick={() => finish(undefined)}
          >
            ×
          </button>
        </DialogHeader>
        <div className="habit95-body">
          <p className="habit95-reason-subject">{subject}</p>
          <label className="habit95-reason-field" htmlFor="priority-reason-note">
            Note
            <textarea
              id="priority-reason-note"
              className="habit95-reason-note"
              rows={6}
              value={note}
              autoFocus
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <p className="habit95-hint">Optional. You can skip this.</p>
          <div className="habit95-actions">
            <button type="button" className="habit95-btn" onClick={() => finish(undefined)}>
              Skip
            </button>
            <button type="button" className="habit95-btn habit95-btn-default" onClick={save}>
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
