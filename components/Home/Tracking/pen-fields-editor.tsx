/**
 * components/Home/Tracking/pen-fields-editor.tsx — Detail fields a pen or tag asks for
 *
 * Pen settings and tag settings both use this. One row per field: name, Text
 * or Number, an optional unit for numbers, Remove. Adding offers the three
 * originals first (Project / context, Book(s), Pages read — picking one reuses
 * its id, so values already on blocks show up) and then a custom field.
 * `inherited` lists fields that come from the pen's tags, read-only, so the
 * person sees everything a block on this pen will ask for. See `lib/pen-fields.ts`.
 */
"use client"

import { useState } from "react"
import { FIELD_PRESETS, makeFieldId, type BlockField, type PenField, type PenFieldKind } from "@/lib/pen-fields"

export function PenFieldsEditor({
  fields,
  onChange,
  inherited = [],
  ownerName,
}: {
  fields: PenField[]
  onChange: (next: PenField[]) => void
  inherited?: BlockField[]
  ownerName: string
}) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<PenFieldKind>("text")
  const taken = new Set([...fields.map((f) => f.id), ...inherited.map((row) => row.field.id)])
  const presets = FIELD_PRESETS.filter((preset) => !taken.has(preset.id))

  const update = (id: string, patch: Partial<PenField>) =>
    onChange(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)))

  const addCustom = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const preset = FIELD_PRESETS.find((p) => p.name.toLowerCase() === trimmed.toLowerCase())
    if (preset && !taken.has(preset.id)) onChange([...fields, { ...preset }])
    else onChange([...fields, { id: makeFieldId(trimmed), name: trimmed, kind }])
    setName("")
    setKind("text")
  }

  return (
    <div className="trk-fields-editor" data-testid="pen-fields-editor">
      {fields.length === 0 && inherited.length === 0 ? (
        <p className="trk-fields-empty">No detail fields. Blocks on {ownerName} ask only for the usual title and notes.</p>
      ) : null}
      {fields.map((field) => (
        <div key={field.id} className="trk-fields-row">
          <input
            aria-label={`Field name ${field.name}`}
            value={field.name}
            onChange={(event) => update(field.id, { name: event.target.value })}
            onBlur={(event) => {
              if (!event.target.value.trim()) update(field.id, { name: field.name || "Field" })
            }}
          />
          <select
            aria-label={`${field.name} type`}
            value={field.kind}
            onChange={(event) => update(field.id, { kind: event.target.value as PenFieldKind })}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
          </select>
          {field.kind === "number" ? (
            <input
              className="trk-fields-unit"
              aria-label={`${field.name} unit`}
              placeholder="unit"
              value={field.unit ?? ""}
              onChange={(event) => update(field.id, { unit: event.target.value || undefined })}
            />
          ) : null}
          <button
            type="button"
            data-no95=""
            aria-label={`Remove field ${field.name}`}
            onClick={() => onChange(fields.filter((f) => f.id !== field.id))}
          >
            Remove
          </button>
        </div>
      ))}
      {inherited.map((row) => (
        <div key={`inherited-${row.field.id}`} className="trk-fields-row trk-fields-inherited">
          <span className="trk-fields-name">{row.field.name}</span>
          <span className="trk-fields-kind">{row.field.kind === "number" ? "Number" : "Text"}</span>
          <span className="trk-fields-from">from tag {row.sourceName}</span>
        </div>
      ))}
      {presets.length ? (
        <div className="trk-fields-presets" role="group" aria-label="Add a usual field">
          {presets.map((preset) => (
            <button key={preset.id} type="button" data-no95="" onClick={() => onChange([...fields, { ...preset }])}>
              + {preset.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="trk-fields-row trk-fields-add">
        <input
          aria-label="New field name"
          placeholder="Add a detail field, e.g. Client"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addCustom()
            }
          }}
        />
        <select aria-label="New field type" value={kind} onChange={(event) => setKind(event.target.value as PenFieldKind)}>
          <option value="text">Text</option>
          <option value="number">Number</option>
        </select>
        <button type="button" data-no95="" onClick={addCustom} disabled={!name.trim()}>
          Add field
        </button>
      </div>
    </div>
  )
}
