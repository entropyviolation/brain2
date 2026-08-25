/**
 * components/Home/Plan/paste-events-dialog.tsx — Paste unstructured events
 *
 * Lets the user paste itinerary / tour-schedule text, preview parsed drafts,
 * optionally exclude rows, then bulk-create editable calendar events.
 */
"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ClipboardPaste, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CalendarEvent } from "@/lib/types"
import { useEventStore } from "@/lib/event-store"
import { parseEventText, type ParsedEventDraft } from "@/lib/parse-event-text"

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

  const handleImport = () => {
    const selected = preview.filter((r) => r.included)
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
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-black border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-[#8cd4a5] via-[#b89fbf] to-[#8b7ecc] bg-clip-text text-transparent">
            Paste Events
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Paste unstructured schedule text (dates, shows, meetings). Preview what will be created, then import —
            events stay fully editable afterward.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="paste-events-text" className="text-sm font-semibold text-gray-200">
              Event text
            </Label>
            <Textarea
              id="paste-events-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setParsed(false)
              }}
              placeholder={`July 10th: DRIVE DAY\nJuly 14th: WRITING TRIP\nMEETING - Weekly sync @ 2PM PST\nAugust 2026\nAugust 13th: SHOW - Santa Ana, CA @ Constellation Room`}
              rows={10}
              className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-500 focus:border-[#8cd4a5] focus:ring-[#8cd4a5]/20 transition-all duration-300 font-mono text-sm resize-y"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={handleParse}
              disabled={!text.trim()}
              className="bg-gradient-to-r from-[#8cd4a5] via-[#9fc2a5] to-[#adc29f] hover:from-[#7bc394] hover:via-[#8eb194] hover:to-[#9cb18e] text-black font-semibold disabled:opacity-50"
            >
              <ClipboardPaste className="h-4 w-4 mr-2" />
              Parse
            </Button>
            {parsed && (
              <p className="self-center text-sm text-gray-400">
                {preview.length} event{preview.length === 1 ? "" : "s"} found
                {skipped.length > 0 ? ` · ${skipped.length} line${skipped.length === 1 ? "" : "s"} skipped` : ""}
              </p>
            )}
          </div>

          {parsed && preview.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-200">Preview</Label>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-600 divide-y divide-gray-700">
                {preview.map((row) => (
                  <div
                    key={row.key}
                    className={`flex items-start gap-3 px-3 py-2 text-sm ${row.included ? "bg-gray-800/40" : "bg-gray-900/60 opacity-50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={row.included}
                      onChange={() => toggleRow(row.key)}
                      className="mt-1 accent-[#8cd4a5]"
                      aria-label={`Include ${row.title}`}
                    />
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color ?? "#8cd4a5" }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-100 truncate">{row.title}</div>
                      <div className="text-xs text-gray-400">
                        {formatPreviewWhen(row)}
                        {row.location ? ` · ${row.location}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                      aria-label={`Remove ${row.title} from preview`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed && preview.length === 0 && (
            <p className="text-sm text-amber-400/90">
              No events could be parsed. Try lines like &quot;July 10th: DRIVE DAY&quot; or include a month header such
              as &quot;August 2026&quot;.
            </p>
          )}

          {skipped.length > 0 && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-400">Skipped lines</summary>
              <ul className="mt-2 list-disc pl-5 space-y-0.5">
                {skipped.map((line) => (
                  <li key={line} className="font-mono">
                    {line}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={handleImport}
              disabled={includedCount === 0}
              className="flex-1 bg-gradient-to-r from-[#8cd4a5] via-[#9fc2a5] to-[#adc29f] hover:from-[#7bc394] hover:via-[#8eb194] hover:to-[#9cb18e] text-black font-semibold shadow-lg disabled:opacity-50"
            >
              Import {includedCount > 0 ? `${includedCount} Event${includedCount === 1 ? "" : "s"}` : "Events"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-gray-600 text-gray-200 hover:bg-gray-800"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
