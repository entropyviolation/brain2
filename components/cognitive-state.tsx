/**
 * components/cognitive-state.tsx — Header Now door
 *
 * The global-header word key opens the Now popup
 * (`components/header-tracking/`). That popup is the edge of the current
 * moment: recent tracking and the short plan ahead. Current moment, including
 * Working on, Events, Thought process, and Update state, stays above the
 * Tracking / Plan switch. Home → Tracking stays the full desk. The export
 * name stays `CognitiveState` so the header wiring is unchanged. While the
 * dialog is open, `useTrackingUndoHotkey` arms Cmd/Ctrl-Z on the grid inside
 * the Tracking pane.
 *
 * Spec: §8.2 (dashboard top bar), §12 (Tracking).
 * Dialog frame is milled fascia (`.hpp95-shell-only`).
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Brain } from "lucide-react"
import { HeaderTrackingPopup } from "@/components/header-tracking/header-tracking-popup"
import { useTrackingUndoHotkey } from "@/components/Home/Tracking/tracking-undo"

export function CognitiveState() {
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<"tracking" | "plan">("tracking")
  useTrackingUndoHotkey(open)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setPane("tracking")
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1" title="Now">
          <Brain className="h-4 w-4" />
          <span>Now</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="hpp95 hpp95-dialog hpp95-shell-only htk-popup max-h-[92vh] overflow-visible sm:max-w-[min(94vw,66rem)]">
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle>{pane === "plan" ? "Upcoming now" : "Recent now"}</DialogTitle>
          </div>
          <DialogDescription className="hpp-caption-lead">
            This is the edge of the current moment. It catches the recent past that was not tracked yet, updates what
            is true now, and adjusts the short plan ahead, so filling the moment is quick.
          </DialogDescription>
        </DialogHeader>
        <HeaderTrackingPopup pane={pane} onPane={setPane} />
      </DialogContent>
    </Dialog>
  )
}
