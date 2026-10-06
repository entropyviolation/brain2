/**
 * components/Reviews/WhyBlockedControl.tsx — Why blocked? on a ritual push
 *
 * Preset reasons stay as they are. Other opens a text field. The stored value
 * keeps the token and, when something was typed, the words.
 */
"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BLOCKED_REASON_OPTIONS,
  blockedReasonNote,
  blockedReasonToken,
  packBlockedReason,
} from "@/lib/blocked-reason"
import type { BlockedReason, StoredBlockedReason } from "@/lib/types"

export function WhyBlockedControl({
  taskTitle,
  value,
  onChange,
}: {
  taskTitle: string
  value: StoredBlockedReason | undefined
  onChange: (value: StoredBlockedReason) => void
}) {
  const token = blockedReasonToken(value)
  const note = blockedReasonNote(value)
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">Why blocked?</span>
        <Select
          value={token || undefined}
          onValueChange={(next) => {
            const reason = next as BlockedReason
            onChange(packBlockedReason(reason, reason === "other" ? note : ""))
          }}
        >
          <SelectTrigger className="h-7 text-xs" aria-label={`Why blocked? ${taskTitle}`}>
            <SelectValue placeholder="Pick a reason (optional)" />
          </SelectTrigger>
          <SelectContent>
            {BLOCKED_REASON_OPTIONS.map((reason) => (
              <SelectItem key={reason.id} value={reason.id} className="text-xs">
                {reason.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {token === "other" && (
        <Input
          value={note}
          onChange={(event) => onChange(packBlockedReason("other", event.target.value))}
          placeholder="Type a reason"
          aria-label={`Other reason for ${taskTitle}`}
          className="h-7 text-xs"
        />
      )}
    </div>
  )
}
