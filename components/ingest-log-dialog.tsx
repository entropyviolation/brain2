/**
 * components/ingest-log-dialog.tsx — Log of applied / failed / pending ingest
 *
 * Opened from Settings and Lists settings (**Notes and ingest**), not the pin bar.
 *
 * Pending chat count is a CRT well on the Ingest key (tooltip names the count).
 * GPS tracking points stay off this list unless Show GPS is on. Location still
 * collects them. Dialog shell is milled fascia (`.hpp95` / `header-popup-chrome.css`).
 */
"use client"

import { useCallback, useState } from "react"
import { useCaptureDoorRequest } from "@/components/capture-door-bus"
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
import { hiddenGpsCount, useGpsIngestLog, visibleIngestEvents } from "@/lib/ingest/gps-log"
import { useIngestStore } from "@/lib/ingest/ingest-store"

export function IngestLogDialog({ hideTrigger = false }: { hideTrigger?: boolean } = {}) {
  const [open, setOpen] = useState(false)
  const openDoor = useCallback(() => setOpen(true), [])
  useCaptureDoorRequest("ingest", openDoor)
  const [showGps, setShowGps] = useState(false)
  const events = useIngestStore((s) => s.events)
  const gpsEvents = useGpsIngestLog((s) => s.events)
  const clearEvents = useIngestStore((s) => s.clearEvents)
  const pendingCount = useIngestStore((s) => Object.keys(s.pendingByChat).length)
  const visible = visibleIngestEvents(events, gpsEvents, showGps)
  const hiddenGps = hiddenGpsCount(events, gpsEvents)
  const hasLog = events.length > 0 || gpsEvents.length > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger ? (
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
      ) : null}
      <DialogContent className="hpp95 hpp95-dialog sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col" data-ui-name="Ingest" data-ui-docs="components/README.md">
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle>Message ingest log</DialogTitle>
          </div>
          <DialogDescription className="hpp-caption-lead">
            Phone texts applied through Settings → Message ingest. GPS tracking points stay on
            Location and off this log unless you show them. Pairing and the cheat-sheet live there
            too.
          </DialogDescription>
        </DialogHeader>
        <div className="hpp-body">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hiddenGps > 0
                ? "No other messages. GPS points stay on Location and off this log until you show them."
                : "No messages yet. Simulate one in Settings, or pair Telegram."}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {visible.map((ev) => (
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
          {hasLog ? (
            <div className="flex flex-wrap gap-2">
              {hiddenGps > 0 || showGps ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={showGps}
                  onClick={() => setShowGps((on) => !on)}
                >
                  {showGps ? "Hide GPS" : `Show GPS (${hiddenGps})`}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={clearEvents}>
                Clear log
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
