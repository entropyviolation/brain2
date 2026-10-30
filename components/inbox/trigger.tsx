/**
 * Header Inbox key when the pin bar does not own `open`.
 * Counts the revisit pile only. `hideTrigger` omits this button.
 */
"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DialogTrigger } from "@/components/ui/dialog"
import type { Task } from "@/lib/types"
import { InboxIcon } from "lucide-react"

export function InboxTrigger({
  revisitTasks,
  monkeyTasks,
}: {
  revisitTasks: Task[]
  monkeyTasks: Task[]
}) {
  return (
    <DialogTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        data-inbox-entry=""
        title={
          revisitTasks.length > 0
            ? `${revisitTasks.length} to revisit${monkeyTasks.length ? ` · ${monkeyTasks.length} in monkey brain` : ""}`
            : monkeyTasks.length > 0
              ? `Inbox — nothing to revisit · ${monkeyTasks.length} in monkey brain`
              : "Inbox — nothing to revisit"
        }
      >
        <InboxIcon className="h-4 w-4" />
        Inbox
        {revisitTasks.length > 0 && (
          <Badge variant="secondary" className="b2-shell-count">
            {revisitTasks.length}
          </Badge>
        )}
      </Button>
    </DialogTrigger>
  )
}
