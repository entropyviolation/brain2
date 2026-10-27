/**
 * components/Home/Tracking/entry-dialog/entry-fields.tsx — Detail fields and the door
 *
 * A fragment: the fields grid when the block asks for any, and the pen-settings
 * door when it is not a mood or spend block. The door stays hidden for those.
 * No hooks.
 */
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { openPenSettings } from "@/components/Home/Tracking/open-pen-settings"
import type { BlockField } from "@/lib/pen-fields"
import type { TrackPen } from "@/lib/time-tracking-store"

export function EntryFields({
  blockFields,
  fieldTexts,
  pen,
  isMood,
  spendEntry,
  scopeId,
  entryScopeId,
  onField,
}: {
  blockFields: BlockField[]
  fieldTexts: Record<string, string>
  pen: TrackPen | undefined
  isMood: boolean
  spendEntry: boolean
  scopeId: string | undefined
  entryScopeId: string
  onField: (fieldId: string, value: string) => void
}) {
  return (
    <>
      {blockFields.length ? (
        <div className="trk-section trk-entry-fields" data-testid="entry-fields">
          <Label className="trk-section-title">Details</Label>
          <div className="trk-entry-fields-grid">
            {blockFields.map((row) => (
              <div key={row.field.id} className={row.field.kind === "text" ? "trk-entry-field is-wide" : "trk-entry-field"}>
                <Label htmlFor={`entry-field-${row.field.id}`} className="trk-section-title">
                  {row.field.name}
                  <span className="trk-entry-field-from">
                    {row.source === "kept" ? " · kept" : row.source === "tag" ? ` · ${row.sourceName} tag` : ""}
                  </span>
                </Label>
                <Input
                  id={`entry-field-${row.field.id}`}
                  type={row.field.kind === "number" ? "number" : "text"}
                  inputMode={row.field.kind === "number" ? "decimal" : undefined}
                  placeholder={row.field.unit ?? ""}
                  value={fieldTexts[row.field.id] ?? ""}
                  onChange={(e) => onField(row.field.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {pen && !isMood && !spendEntry ? (
        <button
          type="button"
          className="trk-entry-key is-compact trk-entry-fields-door"
          data-no95=""
          onClick={() => openPenSettings(scopeId ?? entryScopeId, pen.id)}
        >
          {blockFields.some((row) => row.source !== "kept") ? "Edit detail fields" : `Add a detail field to ${pen.name}…`}
        </button>
      ) : null}
    </>
  )
}
