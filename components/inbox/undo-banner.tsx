/**
 * Undo sentences for the last inbox batch.
 * Mounted only when there is a label and the Links tab is not showing.
 */
"use client"

import { Button } from "@/components/ui/button"

export function InboxUndoBanner({ undoLabel, handleUndo }: { undoLabel: string; handleUndo: () => void }) {
  return (
    <div className="inbox-undo">
      <span>
        {undoLabel === "inbox merge"
          ? "Merged. Cmd/Ctrl-Z undoes."
          : undoLabel === "inbox delete selection"
            ? "Deleted. Cmd/Ctrl-Z undoes."
              : undoLabel === "inbox mark clarified" || undoLabel === "inbox apply and clarify"
              ? "Filed onto their lists, or All Items. Cmd/Ctrl-Z undoes."
              : undoLabel === "inbox to monkey brain"
                ? "Sent to Monkey brain. Cmd/Ctrl-Z undoes."
                : undoLabel === "monkey brain to inbox"
                  ? "Sent to Inbox. Cmd/Ctrl-Z undoes."
                  : undoLabel === "inbox bulk edit"
                    ? "Bulk edit saved. Cmd/Ctrl-Z undoes."
                    : undoLabel === "inbox transfer to log"
                      ? "Transferred to the Tracking log at each idea's original time. Cmd/Ctrl-Z undoes."
                      : undoLabel === "inbox transfer failed"
                        ? "Could not write the Tracking log. Those ideas are back in the pile."
                        : "Applied. Cmd/Ctrl-Z undoes."}
      </span>
      <Button variant="outline" size="sm" onClick={handleUndo}>
        Undo
      </Button>
    </div>
  )
}
