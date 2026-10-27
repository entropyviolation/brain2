/**
 * components/Home/Tracking/entry-dialog/edge-anchors-section.tsx — Ends, next block, transit
 *
 * A fragment. Not named `entry-edges`: that file already holds the shared
 * anchor, next-block, and transit sections. The parent passes whether this
 * block is an instant. No hooks.
 */
"use client"

import { DriveCommuteSection, EdgeAnchor, NextBlockSection, TransitSection } from "@/components/Home/Tracking/entry-edges"
import type { EdgeState } from "@/lib/entry-edges"
import { timeStringToMinutes, type TimeEntry, type TrackingClockCertainty } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"

export function EdgeAnchorsSection({
  instant,
  allEntries,
  scopes,
  entry,
  last,
  scope,
  startForSentence,
  startC,
  endC,
  startEventId,
  startJoinId,
  endEventId,
  endJoinId,
  to,
  overlapping,
  alsoOthers,
  driveEnds,
  driveBusy,
  driveMsg,
  onLink,
  onUnlink,
  onTake,
  onAlsoOthers,
  onOpenEntry,
  onCalculate,
  onAddTransit,
}: {
  instant: boolean
  allEntries: TimeEntry[]
  scopes: TrackScope[]
  entry: TimeEntry
  last: TimeEntry
  scope: TrackScope | undefined
  startForSentence: number
  startC: TrackingClockCertainty
  endC: TrackingClockCertainty
  startEventId: string | undefined
  startJoinId: string | undefined
  endEventId: string | undefined
  endJoinId: string | undefined
  to: string
  overlapping: TimeEntry[]
  alsoOthers: boolean
  driveEnds: object | null
  driveBusy: boolean
  driveMsg: string
  onLink: (edge: "start" | "end", kind: "event" | "join", partner: TimeEntry) => void
  onUnlink: (edge: "start" | "end") => void
  onTake: (edge: "start" | "end", state: EdgeState) => void
  onAlsoOthers: (value: boolean) => void
  onOpenEntry?: (entry: TimeEntry) => void
  onCalculate: () => void
  onAddTransit: (spec: { from: TimeEntry; to: TimeEntry; minutes: number; label: string }) => void
}) {
  return (
    <>
      {!instant && (
        <>
          <EdgeAnchor
            edge="start"
            entries={allEntries}
            scopes={scopes}
            entry={entry}
            own={{ min: startForSentence, c: startC }}
            eventId={startEventId}
            joinId={startJoinId}
            onLink={(kind, p) => onLink("start", kind, p)}
            onUnlink={() => onUnlink("start")}
            onTake={(st) => onTake("start", st)}
          />
          <EdgeAnchor
            edge="end"
            entries={allEntries}
            scopes={scopes}
            entry={entry}
            own={{ min: timeStringToMinutes(to) ?? last.endMin, c: endC }}
            eventId={endEventId}
            joinId={endJoinId}
            onLink={(kind, p) => onLink("end", kind, p)}
            onUnlink={() => onUnlink("end")}
            onTake={(st) => onTake("end", st)}
          >
            {endEventId && overlapping.length > 0 && (
              <label className="trk-edge-also">
                <input type="checkbox" checked={alsoOthers} onChange={(e) => onAlsoOthers(e.target.checked)} />
                Also end {overlapping.length} overlapping block{overlapping.length === 1 ? "" : "s"} in other views here
              </label>
            )}
          </EdgeAnchor>
        </>
      )}
      <NextBlockSection entries={allEntries} entry={last} scope={scope} onOpen={(e) => onOpenEntry?.(e)} />
      {driveEnds && <DriveCommuteSection ready busy={driveBusy} message={driveMsg} onCalculate={onCalculate} />}
      <TransitSection
        entries={allEntries}
        entry={last}
        scope={scope}
        endMin={timeStringToMinutes(to) ?? last.endMin}
        endCertainty={endC}
        onAdd={onAddTransit}
      />
    </>
  )
}
