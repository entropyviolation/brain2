/**
 * components/Home/Plan/paste-events-dialog.tsx — Paste unstructured events
 *
 * Lets the user paste itinerary / tour-schedule text, preview parsed drafts,
 * optionally exclude rows, then bulk-create editable calendar events.
 */
"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CalendarEvent } from "@/lib/types"
import { useEventStore } from "@/lib/event-store"
import { parseEventText, type ParsedEventDraft } from "@/lib/parse-event-text"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"

interface PasteEventsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PreviewRow = ParsedEventDraft & { key: string; included: boolean }

function draftKey(draft: ParsedEventDraft, index: number): string {
  const end = draft.endDate ? format(draft.endDate, "yyyy-MM-dd") : ""
  return `${format(draft.date, "yyyy-MM-dd")}-${end}-${draft.title}-${draft.startTime}-${index}`
}

function formatPreviewWhen(draft: ParsedEventDraft): string {
  if (draft.endDate) {
    return `${format(draft.date, "MMM d")} – ${format(draft.endDate, "MMM d, yyyy")} · All day`
  }
  const when = format(draft.date, "MMM d, yyyy")
  if (draft.isAllDay) return `${when} · All day`
  return `${when} · ${draft.startTime}–${draft.endTime}`
}

export function PasteEventsDialog({ open, onOpenChange }: PasteEventsDialogProps) {
  const addEvent = useEventStore((s) => s.addEvent)
  const [text, setText] = useState("")
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [parsed, setParsed] = useState(false)

  useEffect(() => {
    if (!open) {
      setText("")
      setPreview([])
      setSkipped([])
      setParsed(false)
    }
  }, [open])

  const handleParse = () => {
    const result = parseEventText(text)
    setPreview(
      result.events.map((draft, index) => ({
        ...draft,
        key: draftKey(draft, index),
        included: true,
      })),
    )
    setSkipped(result.skipped)
    setParsed(true)
  }

  const toggleRow = (key: string) => {
    setPreview((rows) => rows.map((row) => (row.key === key ? { ...row, included: !row.included } : row)))
  }

  const removeRow = (key: string) => {
    setPreview((rows) => rows.filter((row) => row.key !== key))
  }

  const includedCount = preview.filter((r) => r.included).length
  const isDirty = text.trim() !== "" || preview.length > 0

  const importRows = (rows: PreviewRow[]) => {
    const selected = rows.filter((r) => r.included)
    const base = Date.now()
    selected.forEach((draft, i) => {
      const event: CalendarEvent = {
        id: `${base}-${i}`,
        title: draft.title,
        startTime: draft.startTime,
        endTime: draft.endTime,
        date: draft.date,
        endDate: draft.endDate,
        type: "event",
        color: draft.color ?? "#8cd4a5",
        isScheduled: true,
        isAllDay: draft.isAllDay,
        location: draft.location ?? "",
        description: draft.description ?? "",
      }
      addEvent(event)
    })
    return selected.length > 0
  }

  const persistPaste = () => {
    if (includedCount > 0) return importRows(preview)
    if (!text.trim()) return false
    const result = parseEventText(text)
    const rows: PreviewRow[] = result.events.map((draft, index) => ({
      ...draft,
      key: draftKey(draft, index),
      included: true,
    }))
    return importRows(rows)
  }

  const guard = useUnsavedGuard({
    open,
    onOpenChange,
    isDirty,
    onSave: persistPaste,
  })

  const handleImport = () => {
    if (!persistPaste()) return
    guard.forceClose()
  }

  return (
    <>
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="plan95-dialog plan95-dialog-lg max-h-[90vh]" hideClose {...unsavedDismissProps(guard.requestClose)}>
        <DialogHeader className="plan95-dialog-caption">
          <DialogTitle>Paste Events</DialogTitle>
          <button type="button" className="plan95-title-btn" aria-label="Close" onClick={guard.requestClose}>
            ×
          </button>
        </DialogHeader>

        <div className="plan95-dialog-body">
          <p>
            Paste unstructured schedule text (dates, shows, meetings). Preview what will be created, then import —
            events stay fully editable afterward.
          </p>
          <div className="space-y-1">
            <Label htmlFor="paste-events-text">Event text</Label>
            <Textarea
              id="paste-events-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setParsed(false)
              }}
              placeholder={`July 10th: DRIVE DAY\nJuly 14th: WRITING TRIP\nMEETING - Weekly sync @ 2PM PST\nAugust 2026\nAugust 13th: SHOW - Santa Ana, CA @ Constellation Room`}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <div className="plan95-dialog-actions">
            <button type="button" className="plan95-btn" onClick={handleParse} disabled={!text.trim()}>
              Parse
            </button>
            {parsed && (
              <p className="self-center text-sm">
                {preview.length} event{preview.length === 1 ? "" : "s"} found
                {skipped.length > 0 ? ` · ${skipped.length} line${skipped.length === 1 ? "" : "s"} skipped` : ""}
              </p>
            )}
          </div>

          {parsed && preview.length > 0 && (
            <div className="space-y-1">
              <Label>Preview</Label>
              <div className="plan-preview">
                {preview.map((row) => (
                  <div key={row.key} className="plan-preview-row" style={{ opacity: row.included ? 1 : 0.5 }}>
                    <input
                      type="checkbox"
                      checked={row.included}
                      onChange={() => toggleRow(row.key)}
                      aria-label={`Include ${row.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{row.title}</div>
                      <div className="text-xs">
                        {formatPreviewWhen(row)}
                        {row.location ? ` · ${row.location}` : ""}
                      </div>
                    </div>
                    <button type="button" onClick={() => removeRow(row.key)} aria-label={`Remove ${row.title} from preview`}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed && preview.length === 0 && (
            <p>
              No events could be parsed. Try lines like &quot;July 10th: DRIVE DAY&quot; or include a month header such
              as &quot;August 2026&quot;.
            </p>
          )}

          {skipped.length > 0 && (
            <details>
              <summary>Skipped lines</summary>
              <ul className="mt-2 list-disc pl-5 space-y-0.5">
                {skipped.map((line) => (
                  <li key={line} className="font-mono">
                    {line}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="plan95-dialog-actions">
            <button type="button" data-default="true" onClick={handleImport} disabled={includedCount === 0 && !text.trim()}>
              Import {includedCount > 0 ? `${includedCount} Event${includedCount === 1 ? "" : "s"}` : "Events"}
            </button>
            <button type="button" onClick={guard.requestClose}>
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
