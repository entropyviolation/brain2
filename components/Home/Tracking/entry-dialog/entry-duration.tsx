/**
 * components/Home/Tracking/entry-dialog/entry-duration.tsx — Length under the clocks
 *
 * Hidden by the parent for instants and when either end is unknown. No hooks.
 */
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDuration, type SpanLock } from "@/lib/time-entries"
import { SpanLockButton } from "./span-lock-button"

export function EntryDuration({
  spanLock,
  durationEstimated,
  heroMin,
  durDraft,
  draftDurationMin,
  durationHelp,
  onLockDuration,
  onToggleEstimated,
  onDurDraft,
  onCommit,
}: {
  spanLock: SpanLock
  durationEstimated: boolean
  heroMin: number | null
  durDraft: string | null
  draftDurationMin: number | null
  durationHelp: string
  onLockDuration: () => void
  onToggleEstimated: () => void
  onDurDraft: (value: string) => void
  onCommit: () => void
}) {
  return (
    <div className="trk-section trk-duration-edit">
      <div className="trk-dur-kicker">
        <Label htmlFor="entry-duration" className="trk-section-title">
          Duration
        </Label>
        <SpanLockButton edge="duration" locked={spanLock === "duration"} onLock={onLockDuration} />
        <button
          type="button"
          className="trk-entry-key is-compact trk-dur-est"
          data-no95=""
          aria-pressed={durationEstimated}
          aria-label="Duration estimated"
          title="The length is a guess. The clocks can still be exact."
          onClick={onToggleEstimated}
        >
          ~ Est.
        </button>
      </div>
      <p className="trk-dur-hero" data-testid="entry-duration-readout" data-estimated={durationEstimated ? "true" : "false"}>
        {durationEstimated ? "~ " : ""}
        {heroMin === null ? "—" : formatDuration(heroMin)}
      </p>
      <Input
        id="entry-duration"
        aria-label="Duration"
        inputMode="text"
        placeholder="1h 30m, 90, 1:30"
        value={durDraft ?? (draftDurationMin === null ? "" : formatDuration(draftDurationMin))}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onDurDraft(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            onCommit()
          }
        }}
      />
      <p className="trk-help">{durationHelp}</p>
    </div>
  )
}
