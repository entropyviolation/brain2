/**
 * components/Home/Tracking/helper/tracking-helper-key.tsx — The Chat key on the Tracking fascia
 *
 * Opens the Tracking Helper. The dialog chunk loads on the first press, like the BIM key.
 */
"use client"

import { useEffect, useState, type ComponentType } from "react"
import "./tracking-helper.css"

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

export function TrackingHelperKey() {
  const [open, setOpen] = useState(false)
  const [Dialog, setDialog] = useState<ComponentType<DialogProps> | null>(null)

  useEffect(() => {
    if (!open || Dialog) return
    let live = true
    void import("./tracking-helper-dialog").then((mod) => {
      if (live) setDialog(() => mod.TrackingHelperDialog)
    })
    return () => {
      live = false
    }
  }, [open, Dialog])

  return (
    <>
      <button type="button" className="trk-helper-key" data-no95="" data-ui-name="Tracking Helper" aria-label="Open the Tracking Helper chat" title="Tracking Helper: tell it what you did" onClick={() => setOpen(true)}>
        Chat
      </button>
      {Dialog ? <Dialog open={open} onOpenChange={setOpen} /> : null}
    </>
  )
}
