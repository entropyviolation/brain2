/**
 * components/ingest-log-dialog.tsx — Header log of applied / failed / pending ingest
 *
 * Pending chat count is a CRT well on the Ingest key (tooltip names the count).
 * Dialog shell is milled fascia (`.hpp95` / `header-popup-chrome.css`).
 */
"use client"

import { useState } from "react"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useIngestStore } from "@/lib/ingest/ingest-store"

export function IngestLogDialog() {
  const [open, setOpen] = useState(false)
  const events = useIngestStore((s) => s.events)
  const clearEvents = useIngestStore((s) => s.clearEvents)
  const pendingCount = useIngestStore((s) => Object.keys(s.pendingByChat).length)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <MessageSquare className="h-4 w-4" />
          <span>Ingest</span>
          {pendingCount > 0 ? (
            <span className="b2-shell-count" title={`${pendingCount} pending ingest chat${pendingCount === 1 ? "" : "s"}`}>
              {pendingCount}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="hpp95 hpp95-dialog sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col" data-ui-name="Ingest" data-ui-docs="components/README.md">
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle>Message ingest log</DialogTitle>
          </div>
          <DialogDescription className="hpp-caption-lead">
            Phone texts applied through Settings → Message ingest. Pairing and the cheat-sheet live
            there too.
          </DialogDescription>
        </DialogHeader>
        <div className="hpp-body">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet. Simulate one in Settings, or pair Telegram.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {events.map((ev) => (
                <li key={ev.id} className="rounded border p-2">
                  <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {ev.channel} · {ev.kind} · {ev.status}
                    </span>
                    <span>{new Date(ev.at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{ev.raw}</p>
                  <p className="text-muted-foreground">{ev.summary}</p>
                </li>
              ))}
            </ul>
          )}
          {events.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearEvents}>
              Clear log
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
