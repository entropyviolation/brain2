/**
 * components/Reviews/WhyBlockedControl.tsx — Why blocked? on a ritual push
 *
 * Preset reasons stay as they are. Other opens a single-line field on a ritual
 * row. The miss-reason prompt (`noteAlways`) uses a multiline note, and
 * `aboveDialog` lifts the portaled menu over that window. The stored value
 * keeps the token and, when something was typed, the words. The field keeps
 * spaces while typing; the saved note is trimmed.
 */
"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  BLOCKED_REASON_OPTIONS,
  blockedReasonNote,
  blockedReasonToken,
  packBlockedReason,
  packReasonKeepingNote,
} from "@/lib/blocked-reason"
import type { BlockedReason, StoredBlockedReason } from "@/lib/types"

export function WhyBlockedControl({
  taskTitle,
  value,
  onChange,
  noteAlways = false,
  aboveDialog = false,
  onClear,
}: {
  taskTitle: string
  value: StoredBlockedReason | undefined
  onChange: (value: StoredBlockedReason) => void
  /** Prompt: the note stays open beside any preset. Ritual rows leave this off. */
  noteAlways?: boolean
  /**
   * Miss-reason dialogs sit at z-120. The menu is the shared portaled select,
   * already on the menu layer above that scrim. This keeps pointer events on.
   * Ritual rows leave this off.
   */
  aboveDialog?: boolean
  /** Called when a prompt's preset and note are both cleared. */
  onClear?: () => void
}) {
  const token = blockedReasonToken(value)
  const storedNote = blockedReasonNote(value)
  // Stored notes are trimmed, so binding the field to them eats the space
  // just typed. The draft keeps it. Save still stores the trim.
  const [draft, setDraft] = useState(storedNote)
  useEffect(() => {
    setDraft((current) => (current.trim() === storedNote ? current : storedNote))
  }, [storedNote])
  const showNote = noteAlways || token === "other"

  const commitNote = (raw: string) => {
    setDraft(raw)
    if (noteAlways) {
      const packed = packReasonKeepingNote(token, raw)
      if (packed) onChange(packed)
      else onClear?.()
      return
    }
    onChange(packBlockedReason("other", raw))
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">Why blocked?</span>
        <Select
          value={token || undefined}
          onValueChange={(next) => {
            const reason = next as BlockedReason
            if (noteAlways) {
              const packed = packReasonKeepingNote(reason, draft)
              if (packed) onChange(packed)
              else onClear?.()
              return
            }
            onChange(packBlockedReason(reason, reason === "other" ? draft : ""))
          }}
        >
          <SelectTrigger className="h-7 text-xs" aria-label={`Why blocked? ${taskTitle}`}>
            <SelectValue placeholder="Pick a reason (optional)" />
          </SelectTrigger>
          <SelectContent className={aboveDialog ? "pointer-events-auto" : undefined}>
            {BLOCKED_REASON_OPTIONS.map((reason) => (
              <SelectItem key={reason.id} value={reason.id} className="text-xs">
                {reason.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showNote &&
        (noteAlways ? (
          <Textarea
            value={draft}
            rows={6}
            onChange={(event) => commitNote(event.target.value)}
            placeholder="Note (optional)"
            aria-label={`Note for ${taskTitle}`}
            className="min-h-[7.5rem] max-h-40 resize-none overflow-y-auto text-xs"
          />
        ) : (
          <Input
            value={draft}
            onChange={(event) => commitNote(event.target.value)}
            placeholder="Type a reason"
            aria-label={`Other reason for ${taskTitle}`}
            className="h-7 text-xs"
          />
        ))}
    </div>
  )
}
