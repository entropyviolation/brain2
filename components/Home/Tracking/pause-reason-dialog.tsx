/**
 * components/Home/Tracking/pause-reason-dialog.tsx
 *
 * Pause on a Working-on-now clock asks what the gap is for.
 * A reason pauses. Cancel, Escape, or an empty answer leaves the clock running.
 */
"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

export function PauseReasonDialog({
  onPause,
  onCancel,
}: {
  onPause: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState("")
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    field.current?.focus()
  }, [])

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

  const [layer, setLayer] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const found = document.querySelector("[data-ui-name='Task card']")
    setLayer(found instanceof HTMLElement ? found : document.body)
  }, [])
  if (!layer) return null

  const submit = () => {
    const text = reason.trim()
    if (!text) onCancel()
    else onPause(text)
  }

  return createPortal(
    <div className="trk-now-obj-stop-back" data-task-card-pop="" role="presentation">
      <form
        className="trk-now-obj-stop b2-now"
        role="alertdialog"
        aria-label="Pause"
        data-testid="pause-reason-dialog"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <p>What are you pausing for?</p>
        <input
          ref={field}
          className="trk-pause-reason"
          aria-label="Reason for pausing"
          value={reason}
          placeholder="What you'll do"
          onChange={(event) => setReason(event.target.value)}
        />
        <div className="trk-now-obj-stop-actions">
          <button type="submit" className="todo-cap is-primary" title="Pause and save this reason">
            Pause
          </button>
          <button type="button" className="todo-cap is-mod" title="Go back. The clock stays on." onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>,
    layer,
  )
}

/** One dialog for a Pause key. `ask` resolves to the reason, or null when the clock should keep running. */
export function usePauseReason() {
  const [open, setOpen] = useState(false)
  const resolveRef = useRef<((reason: string | null) => void) | null>(null)

  const finish = (reason: string | null) => {
    setOpen(false)
    const resolve = resolveRef.current
    resolveRef.current = null
    resolve?.(reason)
  }

  const ask = () =>
    new Promise<string | null>((resolve) => {
      resolveRef.current = resolve
      setOpen(true)
    })

  const dialog = open ? <PauseReasonDialog onPause={(reason) => finish(reason)} onCancel={() => finish(null)} /> : null
  return { ask, dialog }
}
