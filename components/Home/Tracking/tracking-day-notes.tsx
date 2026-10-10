/**
 * components/Home/Tracking/tracking-day-notes.tsx — Per-day notes append log
 *
 * Sits under Time Grid, Activity Log, Day Log, and Tracking log on the Home Tracking tab.
 * The header Now popup opens the same log (`forceOpen`) without flipping Expand.
 * An append log (`lib/append-log.ts`): Submit note stamps the writing time;
 * List / Bulk / Latest (Habits `.hab-view-changer` keys); past entries cannot
 * be edited. Jots like "zoo 4–5" stay with that date while you figure out
 * which pen they belong on. Not a second activity log — the grid remains the
 * record of what happened. Looks: metal well (`.trk-notes`) in the fascia
 * mill, white field, toolbar padded so key bevels stay whole. Collapsed is only the **Day notes**
 * legend and Expand. Expand opens a tall composer and a tall history pane;
 * `notesWellExpanded` persists on tracking-view-prefs.
 *
 * Source of truth is `brain2-tracking-day-notes` (hub-synced on that small key).
 * A hub pick of painted intervals cannot wipe it. If that key's last write
 * failed (origin quota), the well says so (`.trk-notes-unsaved`) instead of
 * showing a stamped entry that will not come back.
 */
"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { format } from "date-fns"
import { AppendLog } from "@/components/append-log"
import { formatLocalDateKey } from "@/lib/date-utils"
import {
  appendDayNote,
  DAY_NOTES_PERSIST_KEY,
  getDayNote,
  getDayNoteEntries,
  hydrateDayNotesFromStorage,
  seedDayNotesPersist,
  subscribeDayNotesPersist,
} from "@/lib/day-notes-persist"
import { persistKeyFailed, subscribePersistStatus } from "@/lib/persist-storage"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { AppendLogEntry } from "@/lib/append-log"
import { setTrackingViewPrefs, useTrackingViewPrefs } from "./tracking-view-prefs"

const notesUnsaved = () => persistKeyFailed(DAY_NOTES_PERSIST_KEY)

export function TrackingDayNotes({
  currentDate,
  forceOpen = false,
}: {
  currentDate: Date
  /** Show the composer without changing the desk's Expand preference. */
  forceOpen?: boolean
}) {
  const unsaved = useSyncExternalStore(subscribePersistStatus, notesUnsaved, () => false)
  const dayKey = formatLocalDateKey(currentDate)
  const setDayNotes = useTimeTrackingStore((s) => s.setDayNotes)
  const notesPrefOpen = useTrackingViewPrefs().notesWellExpanded
  const notesOpen = forceOpen || notesPrefOpen
  const [entries, setEntries] = useState<AppendLogEntry[]>(() => getDayNoteEntries(dayKey))
  const label = `Notes for ${format(currentDate, "EEEE, MMM d")}`
  const logId = forceOpen ? "htk-day-notes-log" : "trk-day-notes-log"

  const reload = useCallback(() => {
    seedDayNotesPersist(useTimeTrackingStore.getState().dayNotes)
    const storeText = useTimeTrackingStore.getState().dayNotes?.[dayKey]
    if (storeText && !getDayNote(dayKey)) setDayNotes(dayKey, storeText)
    setEntries(getDayNoteEntries(dayKey))
  }, [dayKey, setDayNotes])

  useEffect(() => {
    void hydrateDayNotesFromStorage()
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => subscribeDayNotesPersist(reload), [reload])

  return (
    <div id={forceOpen ? undefined : "trk-day-notes"} className={notesOpen ? "trk-notes trk-notes-open" : "trk-notes"}>
      <div className="trk-notes-head">
        <p className="trk-silk trk-notes-legend">Day notes</p>
        {forceOpen ? null : (
          <button
            type="button"
            className="trk-notes-fold"
            aria-expanded={notesOpen}
            aria-controls={notesOpen ? logId : undefined}
            onClick={() => setTrackingViewPrefs({ notesWellExpanded: !notesOpen })}
          >
            {notesOpen ? "Collapse" : "Expand"}
          </button>
        )}
      </div>
      {unsaved && (
        <p className="trk-notes-unsaved" role="alert">
          This note is only in memory — storage is full. Export a backup in Settings, then refresh.
        </p>
      )}
      {notesOpen && (
        <>
          <p className="trk-notes-file">{label}</p>
          <div id={logId}>
            <AppendLog
              logKey={dayKey}
              entries={entries}
              onSubmit={(text, at) => {
                const entry = appendDayNote(dayKey, text, at)
                if (!entry) return
                setDayNotes(dayKey, getDayNote(dayKey))
              }}
              placeholder="e.g. zoo 4–5; meal at 1pm"
              submitLabel="Submit note"
              emptyHint="Nothing on file. Submit to freeze this writing time."
              size="day"
              composerAriaLabel={label}
              bulkAriaLabel="All day notes, copy only"
              viewsAriaLabel="How to show day notes"
              viewsWellClassName="hab-view-changer"
            />
          </div>
        </>
      )}
    </div>
  )
}
