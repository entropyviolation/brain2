/**
 * components/Reviews/MissReasonDialog.tsx — Optional why it didn't get done
 *
 * Preset plus a multiline note. The reason menu is the shared portaled
 * select, on the menu layer above this window, so the list stays clickable.
 * Skip, the window close, and a blank Save all resolve with no reason.
 * The caller still does the push, miss, or mark.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { WhyBlockedControl } from "@/components/Reviews/WhyBlockedControl"
import type { StoredBlockedReason } from "@/lib/types"
import { cn } from "@/lib/utils"

export type WorkedToday = "yes" | "some" | "no"

const WORKED_OPTIONS: [WorkedToday, string][] = [
  ["yes", "Yes"],
  ["some", "A bit"],
  ["no", "No"],
]

export function MissReasonDialog({
  open,
  subject,
  initial,
  title = "Why didn't it get done?",
  className,
  askWorked = false,
  workedInitial,
  workedHint,
  onResolve,
}: {
  open: boolean
  subject: string
  initial?: StoredBlockedReason
  title?: string
  className?: string
  /** Also ask "Did you work on it today?" (the night ritual's Push). */
  askWorked?: boolean
  workedInitial?: WorkedToday
  /** Shown under the question when the app already saw work that day. */
  workedHint?: string
  /** Called once. `undefined` means they skipped or left it blank. */
  onResolve: (reason: StoredBlockedReason | undefined, worked?: WorkedToday) => void
}) {
  const [value, setValue] = useState<StoredBlockedReason | undefined>(initial)
  const [worked, setWorked] = useState<WorkedToday | undefined>(workedInitial)
  const resolved = useRef(false)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      resolved.current = false
      setValue(initial)
      setWorked(workedInitial)
    }
    wasOpen.current = open
  }, [open, initial, workedInitial])

  const finish = (reason: StoredBlockedReason | undefined) => {
    if (resolved.current) return
    resolved.current = true
    if (askWorked) onResolve(reason, worked)
    else onResolve(reason)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && finish(undefined)}>
      <DialogContent
        className={cn("z-[120] max-h-[calc(100dvh-2rem)] max-w-sm overflow-y-auto", className)}
        overlayClassName="z-[120]"
        data-ui-name="Why it didn't get done"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{subject}</p>
        <WhyBlockedControl
          taskTitle={subject || "this"}
          value={value}
          noteAlways
          aboveDialog
          onChange={setValue}
          onClear={() => setValue(undefined)}
        />
        {askWorked ? (
          <div className="space-y-1" role="group" aria-label="Did you work on it today?">
            <p className="text-xs font-semibold">Did you work on it today?</p>
            <div className="flex gap-1">
              {WORKED_OPTIONS.map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={worked === id ? "default" : "outline"}
                  aria-pressed={worked === id}
                  onClick={() => setWorked((cur) => (cur === id ? undefined : id))}
                >
                  {label}
                </Button>
              ))}
            </div>
            {workedHint ? <p className="text-xs text-muted-foreground">{workedHint}</p> : null}
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">Optional. You can skip this.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => finish(undefined)}>
            Skip
          </Button>
          <Button type="button" size="sm" onClick={() => finish(value)}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
