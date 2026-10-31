/**
 * components/Home/Tracking/entry-dialog/entry-intro.tsx — Title and the lines under it
 *
 * The header stays a child of DialogContent. The help, source, and sleep
 * lines stay children of `.space-y-3`. One fragment cannot sit in both
 * parents, so this file exports both pieces. No hooks here; an LLM block's
 * line (`llm-block-note.tsx`) reads the store itself.
 */
"use client"

import { DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { resolveLogSourceLabel } from "@/lib/log-entry-source"
import { formatDuration, isInstant, minutesToLabel, type TimeEntry } from "@/lib/time-entries"
import { nightLabel } from "./labels"
import { LlmBlockNote } from "./llm-block-note"

export function EntryDialogHead({
  displayName,
  startMin,
  endMin,
  crossesMidnight,
}: {
  displayName: string
  startMin: number
  endMin: number
  crossesMidnight: boolean
}) {
  return (
    <DialogHeader className="trk-entry-head">
      <DialogTitle className="trk-entry-title">
        {displayName} · {minutesToLabel(startMin)} – {minutesToLabel(endMin)}
        {crossesMidnight ? " (next day)" : ""}
      </DialogTitle>
    </DialogHeader>
  )
}

export function EntryIntroCopy({
  entry,
  draftDurationMin,
  durationMin,
  scopeName,
  crossesMidnight,
  penName,
  title,
}: {
  entry: TimeEntry
  draftDurationMin: number | null
  durationMin: number
  scopeName: string | undefined
  crossesMidnight: boolean
  penName: string | undefined
  title: string
}) {
  return (
    <>
      <p className="trk-help">
        {formatDuration(!isInstant(entry) && draftDurationMin != null ? draftDurationMin : durationMin)} in {scopeName ?? "this scope"}
        {crossesMidnight ? " · continues past midnight" : ""}
        {penName && title.trim() && title.trim() !== penName ? ` · pen ${penName}` : ""}
      </p>
      {isInstant(entry) ? <p className="trk-entry-source">Added from {resolveLogSourceLabel(entry)}</p> : null}

      <LlmBlockNote entry={entry} />

      {entry.generatedBy?.kind === "sleep" && (
        <p className="trk-section text-xs">
          Part of the night logged for {nightLabel(entry.generatedBy.id)}. Retime or delete it here and the sleep
          log, the Done row and the Analytics Sleep tab all follow — this block is the record, not a copy of it.
          Notes are a good place for dreams.
        </p>
      )}
    </>
  )
}
