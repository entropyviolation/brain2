/**
 * components/Home/Tracking/entry-edges.tsx — Entry dialog sections for a block's ends
 *
 * Per-end certainty, the end linked to a logged event, the next block, and
 * (Location only) transit to the next block. Logic lives in `lib/entry-edges.ts`.
 */
"use client"

import { useEffect, useState } from "react"
import { Link2, Unlink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { arrivalWindow, nearbyInstants, nextBlock } from "@/lib/entry-edges"
import { isInstant, minutesToLabel, type TimeEntry, type TrackingClockCertainty } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"
import { isLocationScope, pinOf, transitPenOf } from "@/lib/transit-suggest"
import { transitEnabled, travelMinutes } from "@/lib/transit-time"

const LEVELS: { id: TrackingClockCertainty; label: string; hint: string }[] = [
  { id: "exact", label: "Exact", hint: "You know this time" },
  { id: "estimated", label: "~ Est.", hint: "Roughly this time" },
  { id: "unknown", label: "?", hint: "Placed, never observed" },
]

/** Exact / estimated / unknown for one end of a block. */
export function CertaintyToggle({ edge, value, onChange }: { edge: "start" | "end"; value: TrackingClockCertainty | null; onChange: (v: TrackingClockCertainty | null) => void }) {
  return (
    <div className="trk-edge-certainty" role="radiogroup" aria-label={`${edge === "start" ? "Start" : "End"} certainty`}>
      {LEVELS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={value === l.id}
          title={l.hint}
          data-level={l.id}
          onClick={() => onChange(value === l.id ? null : l.id)}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

const gapText = (gap: number) => (gap <= 0 ? "back to back" : gap < 60 ? `${gap} min later` : `${Math.floor(gap / 60)}h ${gap % 60 ? `${gap % 60}m ` : ""}later`)

/** Link the end to a logged event ("left Chickfila 3pm"), and any overlapping blocks in other views. */
export function EndEventSection({
  entries,
  entry,
  endMin,
  linkedId,
  onLink,
  alsoOthers,
  onAlsoOthers,
  othersCount,
}: {
  entries: TimeEntry[]
  entry: TimeEntry
  endMin: number
  linkedId: string | undefined
  onLink: (event: TimeEntry | null) => void
  alsoOthers: boolean
  onAlsoOthers: (v: boolean) => void
  othersCount: number
}) {
  const linked = linkedId ? entries.find((e) => e.id === linkedId) : undefined
  const options = nearbyInstants(entries, entry.date, endMin).filter((e) => e.id !== linkedId)
  if (!linked && !options.length) return null
  return (
    <div className="trk-section trk-edge-event" data-testid="entry-end-event">
      <Label className="trk-section-title">Ends at event</Label>
      {linked ? (
        <div className="trk-edge-chip">
          <Link2 size={13} aria-hidden />
          <span>
            {linked.title || linked.eventKind || "Event"} · {minutesToLabel(linked.startMin)}
          </span>
          <button type="button" onClick={() => onLink(null)} aria-label="Unlink event">
            <Unlink size={13} aria-hidden />
          </button>
        </div>
      ) : (
        <>
          <p className="trk-help">Tie the end to something you logged. The end time snaps to it, and moves it if you retime.</p>
          <div className="trk-edge-options">
            {options.map((e) => (
              <button key={e.id} type="button" className="trk-edge-option" onClick={() => onLink(e)}>
                {e.title || e.eventKind || "Event"} · {minutesToLabel(e.startMin)}
              </button>
            ))}
          </div>
        </>
      )}
      {linked && othersCount > 0 && (
        <label className="trk-edge-also">
          <input type="checkbox" checked={alsoOthers} onChange={(e) => onAlsoOthers(e.target.checked)} />
          Also end {othersCount} overlapping block{othersCount === 1 ? "" : "s"} in other views here
        </label>
      )}
    </div>
  )
}

/** The next recorded block in this view, and how far off it is. */
export function NextBlockSection({ entries, entry, scope, onOpen }: { entries: TimeEntry[]; entry: TimeEntry; scope: TrackScope | undefined; onOpen: (e: TimeEntry) => void }) {
  if (isInstant(entry)) return null
  const next = nextBlock(entries, entry)
  const pen = next && scope?.pens.find((p) => p.id === next.entry.penId)
  return (
    <div className="trk-section trk-edge-next" data-testid="entry-next-block">
      <Label className="trk-section-title">Next timeblock</Label>
      {next ? (
        <button type="button" className="trk-edge-next-row" onClick={() => onOpen(next.entry)}>
          <strong>{next.entry.title || pen?.name || "Block"}</strong>
          <span>
            {minutesToLabel(next.entry.startMin)} – {minutesToLabel(next.entry.endMin % 1440)} · {gapText(next.gap)}
          </span>
        </button>
      ) : (
        <p className="trk-help">Nothing recorded after this today.</p>
      )}
    </div>
  )
}

/** Location only: price the trip to the next place and add it as a self-fitting block. */
export function TransitSection({
  entries,
  entry,
  scope,
  endMin,
  endCertainty,
  onAdd,
}: {
  entries: TimeEntry[]
  entry: TimeEntry
  scope: TrackScope | undefined
  endMin: number
  endCertainty: TrackingClockCertainty
  onAdd: (a: { from: TimeEntry; to: TimeEntry; minutes: number; label: string }) => void
}) {
  const next = isInstant(entry) || !isLocationScope(scope) ? null : nextBlock(entries, { ...entry, endMin })
  const fromPen = scope?.pens.find((p) => p.id === entry.penId)
  const toPen = next ? scope?.pens.find((p) => p.id === next.entry.penId) : undefined
  const a = pinOf(fromPen)
  const b = pinOf(toPen)
  const transitPen = scope && transitPenOf(scope)
  const isTransitNext = !!next && next.entry.penId === transitPen?.id
  const ready = !!(next && a && b && transitPen && !isTransitNext && fromPen?.id !== toPen?.id)
  const [minutes, setMinutes] = useState<number | undefined>()
  const [asked, setAsked] = useState(false)
  useEffect(() => {
    setMinutes(undefined)
    setAsked(false)
    if (!ready || !a || !b) return
    let live = true
    void travelMinutes(a, b, entry.date, endMin).then((t) => {
      if (live) {
        setMinutes(t)
        setAsked(true)
      }
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, entry.date, endMin, entry.penId, next?.entry.id])
  if (isTransitNext && next) {
    return (
      <div className="trk-section trk-edge-transit">
        <Label className="trk-section-title">Transit</Label>
        <p className="trk-help">
          {next.entry.title || "Transit"} · {minutesToLabel(next.entry.startMin)} – {minutesToLabel(next.entry.endMin % 1440)} follows this block{next.entry.transitFrom ? " and refits when it moves" : ""}.
        </p>
      </div>
    )
  }
  if (!ready || !next || !transitPen) return null
  const gap = next.gap
  const win = minutes != null ? arrivalWindow(endMin, minutes, endCertainty) : null
  const label = `Transit from ${entry.title || fromPen!.name} to ${next.entry.title || toPen!.name}`
  return (
    <div className="trk-section trk-edge-transit" data-testid="entry-transit">
      <Label className="trk-section-title">Transit to {next.entry.title || toPen!.name}</Label>
      {!transitEnabled() ? (
        <p className="trk-help">Add a Google Maps key to price the trip.</p>
      ) : !asked ? (
        <p className="trk-help">Pricing the trip for {minutesToLabel(endMin)}…</p>
      ) : minutes == null ? (
        <p className="trk-help">No route found.</p>
      ) : (
        <>
          <p className="trk-help">
            About {minutes} min leaving {endCertainty === "exact" ? "at" : "around"} {minutesToLabel(endMin)}
            {win && endCertainty !== "exact" ? ` — arrive ${minutesToLabel(win[0])}–${minutesToLabel(win[1])}` : ` — arrive ${minutesToLabel(endMin + minutes)}`}. {gap > 0 ? `Gap is ${gap} min.` : "No gap yet."}
            {minutes > gap ? " The trip is longer than the gap, so the block is clipped." : ""}
          </p>
          <Button type="button" size="sm" disabled={gap < 1} onClick={() => onAdd({ from: entry, to: next.entry, minutes, label })}>
            Add transit block
          </Button>
        </>
      )}
    </div>
  )
}
