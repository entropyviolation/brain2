/**
 * components/cognitive-state.tsx — Header tracking quick-entry
 *
 * The global-header button that opens the TimeGrid life tracker (see
 * components/Home/Tracking/time-grid.tsx) plus the Operations **"Working on
 * this now"** strip so a live session paints the compact grid from here too.
 * cognitive-state form: state, mood, location, activity, etc. are now all
 * captured by painting the day's minute grid per scope. The export name is kept
 * as `CognitiveState` so the header wiring in app/page.tsx is unchanged.
 * While the dialog is open, `useTrackingUndoHotkey` arms Cmd/Ctrl-Z on the
 * compact grid (same stack as Home → Tracking).
 *
 * Spec: §8.2 (dashboard top bar), §12 (Tracking).
 * Dialog frame is milled fascia (`.hpp95-shell-only`) — caption + bay only;
 * TimeGrid / WorkingNowStrip interiors stay as Tracking paints them.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Brain } from "lucide-react"
import { TimeGrid } from "@/components/Home/Tracking/time-grid"
import { WorkingNowStrip } from "@/components/Home/Tracking/working-now-strip"
import { useTrackingUndoHotkey } from "@/components/Home/Tracking/tracking-undo"

export function CognitiveState() {
  const [open, setOpen] = useState(false)
  useTrackingUndoHotkey(open)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Brain className="h-4 w-4" />
          <span>Tracking</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="hpp95 hpp95-dialog hpp95-shell-only sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle>Time Tracking</DialogTitle>
          </div>
          <DialogDescription className="hpp-caption-lead">
            Pick a scope and pen, then drag across the grid (or type a range) to log how you spent your time.
          </DialogDescription>
        </DialogHeader>
        <WorkingNowStrip />
        <TimeGrid compact />
      </DialogContent>
    </Dialog>
  )
}
