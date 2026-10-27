/**
 * components/Home/Tracking/entry-dialog/entry-tools.tsx — Split, delete, save, show in timegrid
 *
 * A fragment: the tool row and the action row. No hooks.
 */
"use client"

import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { Label } from "@/components/ui/label"
import { showBlockInTimegrid } from "@/components/Home/Tracking/block-editor/show-in-timegrid"
import { isInstant, type TimeEntry } from "@/lib/time-entries"
import { Scissors, Trash2 } from "lucide-react"

export function EntryTools({
  entry,
  splitAt,
  onSplitAt,
  onSplit,
  onSave,
  removeEntry,
  onClose,
  guardAction,
}: {
  entry: TimeEntry
  splitAt: string
  onSplitAt: (value: string) => void
  onSplit: () => void
  onSave: () => void
  removeEntry: (id: string) => void
  onClose: () => void
  guardAction: (action: () => void) => void
}) {
  return (
    <>
      <div className="trk-entry-tools">
        {!isInstant(entry) && (
          <>
            <Label htmlFor="entry-split" className="sr-only">
              Split at
            </Label>
            <ClockPicker
              id="entry-split"
              value={splitAt}
              onChange={onSplitAt}
              className="h-9 w-[7.5rem]"
              title="Minute to split at"
              aria-label="Split at"
            />
            <button
              type="button"
              className="trk-entry-key is-mod trk-entry-icon"
              data-no95=""
              title="Split this block at the chosen minute into two blocks of the same pen"
              onClick={onSplit}
              disabled={entry.endMin - entry.startMin < 2}
            >
              <Scissors className="h-4 w-4" aria-hidden />
              <span className="sr-only">Split block</span>
            </button>
          </>
        )}
        <button
          type="button"
          className="trk-entry-key is-mod is-danger trk-entry-icon"
          data-no95=""
          onClick={() => {
            const noun = isInstant(entry) ? "event" : "timeblock"
            if (!window.confirm(`Are you sure you want to delete this ${noun}? This cannot be undone.`)) return
            removeEntry(entry.id)
            onClose()
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          <span className="sr-only">Delete block</span>
        </button>
      </div>
      <div className="trk-entry-actions">
        <button type="button" className="trk-entry-key is-primary" data-no95="" onClick={onSave}>
          Save {isInstant(entry) ? "event" : "block"}
        </button>
        <button
          type="button"
          className="trk-entry-key"
          data-no95=""
          title="Open this block on the Time Grid"
          onClick={() => {
            if (!entry.id) return
            const id = entry.id
            guardAction(() => {
              window.setTimeout(() => showBlockInTimegrid(id), 0)
              onClose()
            })
          }}
        >
          show in timegrid
        </button>
      </div>
    </>
  )
}
