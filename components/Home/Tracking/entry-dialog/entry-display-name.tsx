/**
 * components/Home/Tracking/entry-dialog/entry-display-name.tsx — Optional display name
 *
 * Omitted for a spend block. The parent keeps that condition. No hooks.
 */
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function EntryDisplayName({
  title,
  penName,
  onTitle,
}: {
  title: string
  penName: string | undefined
  onTitle: (value: string) => void
}) {
  return (
    <div className="trk-section">
      <Label htmlFor="entry-title" className="trk-section-title">
        Display name
      </Label>
      <p className="trk-help">
        Optional. Defaults to the pen name. Surfaces that show this block use this; counting still uses pens
        and tags.
      </p>
      <Input
        id="entry-title"
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder={penName ?? "Same as pen"}
      />
    </div>
  )
}
