/**
 * components/Home/Tracking/pen-action-format-editor.tsx — Default Done-today titles
 *
 * Separate from habit links. A Walking pen can log "Went for a walk" into To-Do
 * Done whenever a block is painted; a more specific template with {location} or
 * {project} wins when that data is present. The user can still rename the Done
 * row afterwards. Collapsible instructions.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"
import type { PenActionFormat } from "@/lib/time-tracking-store"
import { interpolateActionFormat, pickActionFormat } from "@/lib/pen-action-format"

const rid = () => `fmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export function PenActionFormatEditor({
  penName,
  formats,
  onChange,
}: {
  penName: string
  formats: PenActionFormat[]
  onChange: (next: PenActionFormat[]) => void
}) {
  const [open, setOpen] = useState(formats.length > 0)
  const [help, setHelp] = useState(false)

  const preview =
    interpolateActionFormat(
      pickActionFormat(formats, {
        minutes: "15",
        x: "15",
        hours: "0.25",
        duration: "15m",
        name: penName,
        pen: penName,
        start: "1:00 PM",
        end: "1:15 PM",
        location: "",
        project: "",
        "project name": "",
        projectname: "",
      })?.template ?? "",
      {
        minutes: "15",
        x: "15",
        hours: "0.25",
        duration: "15m",
        name: penName,
        pen: penName,
        start: "1:00 PM",
        end: "1:15 PM",
        location: "",
        project: "",
        "project name": "",
        projectname: "",
      },
    ) || "(nothing — add a template with no optional variables, e.g. Went for a walk)"

  return (
    <div className="trk-section space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="trk-section-title">Default action format</Label>
        <button type="button" className="text-[11px] underline" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide formats" : "Show formats"}
        </button>
      </div>
      <p className="trk-help">
        Separate from habit links. A painted block can log a Done-today row (Home → To Do → Done)
        named from these templates.
      </p>
      {open && (
        <>
          <button type="button" className="text-left text-[11px] underline" onClick={() => setHelp((v) => !v)}>
            {help ? "Hide instructions" : "How templates work"}
          </button>
          {help && (
            <div className="trk-help space-y-1 border border-[#808080] bg-white p-2">
              <p>
                Write one line per situation. The most specific template whose placeholders all have
                values is used. If two fit equally, the one listed first wins — so order is a real
                control. A line with no optional placeholders is the fallback.
              </p>
              <p>
                Always filled: <code>{"{minutes}"}</code> / <code>{"{x}"}</code> (minutes),{" "}
                <code>{"{hours}"}</code>, <code>{"{duration}"}</code> (15m), <code>{"{name}"}</code>{" "}
                (block display name), <code>{"{pen}"}</code>, <code>{"{start}"}</code>,{" "}
                <code>{"{end}"}</code>.
              </p>
              <p>
                Only when present (otherwise that template is skipped): <code>{"{location}"}</code>{" "}
                (overlapping Location pen), <code>{"{project}"}</code> / <code>{"{project name}"}</code>.
              </p>
              <p>
                Example: <code>Went for a walk</code> plus{" "}
                <code>{"Went for a {minutes} minute walk at {location}"}</code>. A 15m block at Ocean
                Beach logs the second; a 15m block with no location logs the first.
              </p>
              <p>
                You can rename the Done row afterwards. If you leave the generated name, changing the
                block&apos;s project, duration, location, or display name updates that row too.
              </p>
            </div>
          )}
          <div className="space-y-1">
            {formats.map((format, index) => (
              <div key={format.id} className="flex items-center gap-1">
                <Input
                  value={format.template}
                  onChange={(e) =>
                    onChange(formats.map((f) => (f.id === format.id ? { ...f, template: e.target.value } : f)))
                  }
                  placeholder={index === 0 ? `e.g. Went for a walk` : `e.g. Worked on {project} for {hours} hours`}
                  aria-label={`Action format ${index + 1}`}
                  className="h-7 text-sm"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-1.5 text-destructive"
                  title="Remove this format"
                  onClick={() => onChange(formats.filter((f) => f.id !== format.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove format {index + 1}</span>
                </Button>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => onChange([...formats, { id: rid(), template: "" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Add format
          </Button>
          {formats.some((f) => f.template.trim()) && (
            <p className="trk-help">
              Preview for a 15m {penName} block with no location or project: <strong>{preview}</strong>
            </p>
          )}
        </>
      )}
    </div>
  )
}
