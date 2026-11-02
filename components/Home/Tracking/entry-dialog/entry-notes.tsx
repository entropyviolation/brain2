/**
 * components/Home/Tracking/entry-dialog/entry-notes.tsx — Notes on the block
 *
 * Dream notes for a sleep block live in this same field. No hooks.
 */
"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SecretMark } from "@/components/Secrets/SecretMark"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

export function EntryNotes({ notes, onNotes, entryId }: { notes: string; onNotes: (value: string) => void; entryId?: string }) {
  const saved = useTimeTrackingStore((s) => (entryId ? s.entries.find((e) => e.id === entryId) : undefined))
  return (
    <div>
      <Label htmlFor="entry-notes" className="trk-section-title">Notes</Label>
      <Textarea id="entry-notes" rows={2} value={notes} onChange={(e) => onNotes(e.target.value)} />
      {saved ? <SecretMark checked={saved.secret === true} onChange={(on) => useTimeTrackingStore.getState().updateEntry(saved.id, { secret: on ? true : undefined })} /> : null}
    </div>
  )
}
