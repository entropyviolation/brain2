/**
 * components/Home/Tracking/entry-edges.tsx — Entry dialog sections for a block's ends
 *
 * Per-end certainty, the end linked to a logged event, the next block, and
 * (Location only) transit to the next block. Logic lives in `lib/entry-edges.ts`.
 */
"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Link2, Unlink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { arrivalWindow, edgeOf, nearbyInstants, neighborBlock, nextBlock, resolveEdge, type Edge, type EdgeState } from "@/lib/entry-edges"
import { isInstant, minutesToLabel, type TimeEntry, type TrackingClockCertainty } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"
import { isLocationScope, pinOf, transitPenOf } from "@/lib/transit-suggest"
import { travelMinutes } from "@/lib/transit-time"

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

const certMark = (c: TrackingClockCertainty) => (c === "exact" ? "" : c === "estimated" ? " ~" : " ?")
const edgeText = (st: EdgeState) => `${minutesToLabel(st.min % 1440)}${certMark(st.c)}`

/**
 * Anchor one end of a block to a logged event or to the neighbouring block's
 * edge. The more certain side wins; equal certainty at different times asks.
 */
export function EdgeAnchor({
  edge,
  entries,
  scopes,
  entry,
  own,
  eventId,
  joinId,
  onLink,
  onUnlink,
  onTake,
  children,
}: {
  edge: Edge
  entries: TimeEntry[]
  scopes: TrackScope[]
  entry: TimeEntry
  own: EdgeState
  eventId: string | undefined
  joinId: string | undefined
  onLink: (kind: "event" | "join", partner: TimeEntry) => void
  onUnlink: () => void
  onTake: (to: EdgeState) => void
  children?: ReactNode
}) {
  const [kept, setKept] = useState(false)
  const partner = entries.find((e) => e.id === (eventId ?? joinId))
  const theirs = partner ? edgeOf(partner, eventId ? "start" : edge === "start" ? "end" : "start") : null
  const res = theirs ? resolveEdge(own, theirs) : null
  useEffect(() => setKept(false), [partner?.id, theirs?.min, theirs?.c])
  const events = nearbyInstants(entries, entry.date, own.min).filter((e) => e.id !== entry.id && e.id !== partner?.id)
  const neighbor = neighborBlock(entries, entry, edge)
  const block = neighbor && neighbor.id !== partner?.id ? neighbor : null
  if (!partner && !events.length && !block) return null
  const name = (e: TimeEntry) =>
    e.title || scopes.find((s) => s.id === e.scopeId)?.pens.find((p) => p.id === e.penId)?.name || e.eventKind || (isInstant(e) ? "Event" : "Block")
  return (
    <div className="trk-section trk-edge-event" data-testid={`entry-${edge}-anchor`}>
      <Label className="trk-section-title">{edge === "start" ? "Start anchor" : "End anchor"}</Label>
      {partner && theirs ? (
        <div className="trk-edge-chip">
          <Link2 size={13} aria-hidden />
          <span>
            {eventId ? "Event" : edge === "start" ? "Previous timeblock, ends where this starts:" : "Next timeblock, starts where this ends:"} {name(partner)} · {edgeText(theirs)}
          </span>
          <button type="button" onClick={onUnlink} aria-label="Unlink">
            <Unlink size={13} aria-hidden />
          </button>
        </div>
      ) : (
        <>
          <p className="trk-help">Tie this {edge} to an event you logged or to the neighbouring block. They stay one moment; the surer time wins.</p>
          <div className="trk-edge-options">
            {block && (
              <button type="button" className="trk-edge-option" onClick={() => onLink("join", block)}>
                {edge === "start" ? "After" : "Before"} {name(block)} · {edgeText(edgeOf(block, edge === "start" ? "end" : "start"))}
              </button>
            )}
            {events.map((e) => (
              <button key={e.id} type="button" className="trk-edge-option" onClick={() => onLink("event", e)}>
                {name(e)} · {edgeText(edgeOf(e, "start"))}
              </button>
            ))}
          </div>
        </>
      )}
      {partner && theirs && res?.kind === "snap" && (
        <p className="trk-help trk-edge-conflict">
          The other side is surer.{" "}
          <button type="button" className="trk-edge-option" onClick={() => onTake(res.to)}>
            Take {edgeText(res.to)}
          </button>
        </p>
      )}
      {partner && theirs && res?.kind === "conflict" && !kept && (
        <p className="trk-help trk-edge-conflict" role="alert">
          Both sure, different times.{" "}
          <button type="button" className="trk-edge-option" onClick={() => onTake(theirs)}>
            Use {edgeText(theirs)}
          </button>{" "}
          <button type="button" className="trk-edge-option" onClick={() => setKept(true)}>
            Keep {edgeText(own)}
          </button>
        </p>
      )}
      {partner && theirs && (res?.kind === "keep" || kept) && theirs.min !== own.min && <p className="trk-help">The other side follows when you save.</p>}
      {children}
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
          <strong>
            {next.entry.title || pen?.name || "Block"}
            {entry.endJoinId === next.entry.id ? " · joined" : ""}
          </strong>
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

/** Transit block only: price the drive between its two neighbours and fill the length and Activity. */
export function DriveCommuteSection({ ready, busy, message, onCalculate }: { ready: boolean; busy: boolean; message: string; onCalculate: () => void }) {
  return (
    <div className="trk-section trk-edge-transit" data-testid="entry-drive-commute">
      <Label className="trk-section-title">Driving commute</Label>
      <p className="trk-help">{message || (ready ? "Work out the drive between the blocks on either side, then set this block's length and mark Activity as driving." : "Anchor this block to a block with an address on each side first.")}</p>
      <Button type="button" size="sm" disabled={!ready || busy} onClick={onCalculate}>
        {busy ? "Calculating…" : "Calculate driving commute"}
      </Button>
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
      {!asked ? (
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
