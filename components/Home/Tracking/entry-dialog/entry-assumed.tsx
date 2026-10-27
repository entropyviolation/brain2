/**
 * components/Home/Tracking/entry-dialog/entry-assumed.tsx — Assumed / reconstructed switch
 *
 * Off means the block is certain. No hooks.
 */
"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function EntryAssumed({
  assumed,
  onAssumed,
}: {
  assumed: boolean
  onAssumed: (value: boolean) => void
}) {
  return (
    <div className="trk-section trk-assumed-row">
      <div className="trk-assumed-copy">
        <Label htmlFor="entry-assumed" className="trk-section-title cursor-pointer">
          Assumed / reconstructed
        </Label>
        <p className="trk-help">
          Off means this is certain — you painted what happened. On hides it when Analytics excludes speculative
          time.
        </p>
      </div>
      <Switch id="entry-assumed" className="trk-assumed-switch" checked={assumed} onCheckedChange={onAssumed} />
    </div>
  )
}
