/**
 * components/Home/Tracking/entry-dialog/entry-notes.tsx — Notes on the block
 *
 * Dream notes for a sleep block live in this same field. No hooks.
 */
"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function EntryNotes({ notes, onNotes }: { notes: string; onNotes: (value: string) => void }) {
  return (
    <div>
      <Label htmlFor="entry-notes" className="trk-section-title">Notes</Label>
      <Textarea id="entry-notes" rows={2} value={notes} onChange={(e) => onNotes(e.target.value)} />
    </div>
  )
}
