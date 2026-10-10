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

export function MissReasonDialog({
  open,
  subject,
  initial,
  title = "Why didn't it get done?",
  className,
  onResolve,
}: {
  open: boolean
  subject: string
  initial?: StoredBlockedReason
  title?: string
  className?: string
  /** Called once. `undefined` means they skipped or left it blank. */
  onResolve: (reason: StoredBlockedReason | undefined) => void
}) {
  const [value, setValue] = useState<StoredBlockedReason | undefined>(initial)
  const resolved = useRef(false)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      resolved.current = false
      setValue(initial)
    }
    wasOpen.current = open
  }, [open, initial])

  const finish = (reason: StoredBlockedReason | undefined) => {
    if (resolved.current) return
    resolved.current = true
    onResolve(reason)
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
