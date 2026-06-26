/**
 * components/Lists/attributes/AttributeValueField.tsx — Per-type value editors
 *
 * Renders the correct input for a single attribute value based on its type
 * (string, boolean, color, datetime, list, item, multistring, selection, image,
 * multiimage, link, goal, number). Used by the values editors.
 */
"use client"

import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Plus, X } from "lucide-react"
import type { AttributeDefinition, AttributeValue, FileValue } from "@/lib/types"
import { normalizeAttributeType } from "@/lib/attribute-utils"
import { computeFormulaValue, formatFormulaValue } from "@/lib/formula"
import { useTaskStore } from "@/lib/task-store"
import { ListPicker } from "@/components/Lists/list-picker"
import { asArray, asFile, asFiles, asGoal, fileToFileValue } from "./helpers"

function SelectionValueEditor({
  def,
  value,
  onChange,
}: {
  def: AttributeDefinition
  value: AttributeValue
  onChange: (v: AttributeValue) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)

  const options = useMemo(() => {
    if (def.optionSource === "list" && def.optionListId) {
      return tasks.filter((t) => t.lists?.includes(def.optionListId!)).map((t) => t.description)
    }
    return def.options || []
  }, [def, tasks])

  if (def.allowMultiple) {
    const arr = asArray(value)
    return (
      <div className="flex flex-wrap gap-2 pt-1">
        {options.length === 0 && <span className="text-xs text-muted-foreground">No options defined.</span>}
        {options.map((o) => {
          const on = arr.includes(o)
          return (
            <label key={o} className="flex items-center gap-1 text-sm border rounded px-2 py-1 cursor-pointer">
              <Checkbox checked={on} onCheckedChange={(c) => onChange(c ? [...arr, o] : arr.filter((x) => x !== o))} />
              {o}
            </label>
          )
        })}
      </div>
    )
  }

  return (
    <Select value={(value as string) || "none"} onValueChange={(val) => onChange(val === "none" ? undefined : val)}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder="Choose…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">—</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function MultiStringEditor({ value, onChange }: { value: AttributeValue; onChange: (v: AttributeValue) => void }) {
  const arr = asArray(value)
  const add = () => onChange([...arr, ""])
  const setAt = (i: number, s: string) => {
    const next = [...arr]
    next[i] = s
    onChange(next.filter((x, idx) => x.trim() !== "" || idx === i))
  }
  const removeAt = (i: number) => onChange(arr.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-1">
      {arr.map((s, i) => (
        <div key={i} className="flex gap-1">
          <Input value={s} onChange={(e) => setAt(i, e.target.value)} className="h-8" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAt(i)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-3 w-3 mr-1" />
        Add line
      </Button>
    </div>
  )
}

function ImageValueEditor({
  multiple,
  value,
  onChange,
}: {
  multiple: boolean
  value: AttributeValue
  onChange: (v: AttributeValue) => void
}) {
  const pick = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.multiple = multiple
    input.onchange = () => {
      const files = Array.from(input.files || [])
      if (!files.length) return
      Promise.all(
        files.map(
          (f) =>
            new Promise<string>((resolve) => {
              const r = new FileReader()
              r.onload = () => resolve(String(r.result))
              r.readAsDataURL(f)
            }),
        ),
      ).then((urls) => {
        if (multiple) onChange([...asArray(value), ...urls])
        else onChange(urls[0])
      })
    }
    input.click()
  }

  const urls = multiple ? asArray(value) : value ? [String(value)] : []

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <div key={i} className="relative border rounded overflow-hidden">
            <img src={url} alt="" className="h-16 w-16 object-cover" />
            <button
              type="button"
              className="absolute top-0 right-0 bg-black/50 text-white text-xs px-1"
              onClick={() => {
                if (multiple) onChange(urls.filter((_, idx) => idx !== i))
                else onChange(undefined)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={pick}>
        {multiple ? "Add images" : "Choose image"}
      </Button>
    </div>
  )
}

/** Human-readable file size (e.g. "12 KB"). */
function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return ""
  const units = ["B", "KB", "MB", "GB"]
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`
}

/**
 * Best-effort text extraction for newly attached files, patched onto a copy of
 * each `FileValue`. Dynamically imports `lib/file-extract` so the (potentially
 * heavier) extraction path stays out of the initial bundle. Never throws.
 */
async function enrichWithText(files: FileValue[]): Promise<FileValue[]> {
  try {
    const { extractText, canExtractText } = await import("@/lib/file-extract")
    return await Promise.all(
      files.map(async (f) => {
        if (!canExtractText(f)) return f
        const text = await extractText(f)
        return text ? { ...f, extractedText: text } : f
      }),
    )
  } catch {
    return files
  }
}

function FileValueEditor({
  multiple,
  value,
  onChange,
}: {
  multiple: boolean
  value: AttributeValue
  onChange: (v: AttributeValue) => void
}) {
  const files: FileValue[] = multiple ? asFiles(value) : asFile(value) ? [asFile(value)!] : []

  const pick = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = multiple
    input.onchange = async () => {
      const picked = Array.from(input.files || [])
      if (!picked.length) return
      // Snapshot the existing files so the async extraction patch below stays
      // consistent with what was on screen when the picker opened.
      const base = multiple ? asFiles(value) : []
      const added = await Promise.all(picked.map(fileToFileValue))

      // Show the chips immediately (extraction must never block the UI).
      if (multiple) onChange([...base, ...added])
      else onChange(added[0])

      // Patch in extracted text once it resolves (PDF via Electron, text inline).
      void enrichWithText(added).then((enriched) => {
        if (!enriched.some((f) => f.extractedText)) return
        if (multiple) onChange([...base, ...enriched])
        else onChange(enriched[0])
      })
    }
    input.click()
  }

  const removeAt = (i: number) => {
    if (multiple) onChange(files.filter((_, idx) => idx !== i))
    else onChange(undefined)
  }

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div
              key={f.id || i}
              className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-sm max-w-full"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={f.uri || undefined}
                download={f.name}
                title={f.extractedText ? "Text extracted (searchable)" : f.name}
                className="truncate max-w-[180px] hover:underline"
              >
                {f.name}
              </a>
              {formatBytes(f.size) && (
                <span className="shrink-0 text-[10px] text-muted-foreground">{formatBytes(f.size)}</span>
              )}
              {f.extractedText && (
                <span className="shrink-0 text-[10px] text-green-600" title="Searchable text extracted">
                  ✓ text
                </span>
              )}
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" onClick={pick}>
        <Plus className="h-3 w-3 mr-1" />
        {multiple ? "Add files" : files.length ? "Replace file" : "Choose file"}
      </Button>
    </div>
  )
}

export function AttributeValueField({
  def,
  value,
  onChange,
  definitions,
  siblingValues,
}: {
  def: AttributeDefinition
  value: AttributeValue
  onChange: (v: AttributeValue) => void
  /** Sibling attribute schema — enables live formula evaluation when provided. */
  definitions?: AttributeDefinition[]
  /** This item's other attribute values — required to compute formula results. */
  siblingValues?: Record<string, AttributeValue>
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const type = normalizeAttributeType(def.type)

  switch (type) {
    case "formula": {
      const canCompute = !!def.formula && !!siblingValues && !!definitions
      const result = canCompute
        ? computeFormulaValue(
            def,
            siblingValues!,
            Object.fromEntries(definitions!.map((d) => [d.id, d])),
          )
        : null
      const expr = def.formula ? `= ${def.formula.replace(/^=/, "").trim()}` : "No formula set"
      return (
        <div
          className="flex items-center gap-2 h-9 px-2 rounded-md border bg-muted/40 text-sm"
          title={def.formula || undefined}
        >
          <span className="text-muted-foreground font-mono text-xs select-none">ƒ</span>
          {result ? (
            <span className={result.error ? "text-destructive font-medium" : "font-medium"}>
              {formatFormulaValue(result, def) || "—"}
            </span>
          ) : (
            <span className="text-muted-foreground font-mono text-xs truncate">{expr}</span>
          )}
        </div>
      )
    }
    case "boolean":
      return def.booleanDisplay === "switch" ? (
        <Switch checked={!!value} onCheckedChange={(c) => onChange(!!c)} />
      ) : (
        <Checkbox checked={!!value} onCheckedChange={(c) => onChange(!!c)} />
      )
    case "color":
      return (
        <div className="flex items-center gap-2">
          <Input type="color" value={(value as string) || "#3b82f6"} onChange={(e) => onChange(e.target.value)} className="h-9 w-14 p-1" />
          <Input value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} className="h-9 flex-1" placeholder="#hex" />
        </div>
      )
    case "datetime": {
      const mode = def.datetimeMode || "date"
      const inputType = mode === "time" ? "time" : mode === "datetime" ? "datetime-local" : "date"
      return (
        <Input
          type={inputType}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
          className="h-9"
        />
      )
    }
    case "list":
      return (
        <ListPicker
          mode="single"
          selected={value ? [String(value)] : []}
          onChange={(ids) => onChange(ids[0])}
          compact
        />
      )
    case "item": {
      const scoped = def.refListId ? tasks.filter((t) => t.lists?.includes(def.refListId!)) : tasks
      return (
        <Select value={(value as string) || "none"} onValueChange={(v) => onChange(v === "none" ? undefined : v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Choose item…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {scoped.slice(0, 200).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    case "multistring":
      return <MultiStringEditor value={value} onChange={onChange} />
    case "selection":
      return <SelectionValueEditor def={def} value={value} onChange={onChange} />
    case "image":
      return <ImageValueEditor multiple={false} value={value} onChange={onChange} />
    case "multiimage":
      return <ImageValueEditor multiple value={value} onChange={onChange} />
    case "file":
      return <FileValueEditor multiple={false} value={value} onChange={onChange} />
    case "multifile":
      return <FileValueEditor multiple value={value} onChange={onChange} />
    case "link":
      return (
        <Input
          type="url"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
          className="h-9"
          placeholder="https://…"
        />
      )
    case "goal":
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={asGoal(value).current || ""}
            placeholder={def.labels?.current || "Actual"}
            onChange={(e) => onChange({ ...asGoal(value), current: Number(e.target.value) || 0 })}
            className="h-9"
          />
          <span className="text-muted-foreground">/</span>
          <Input
            type="number"
            value={asGoal(value).target || ""}
            placeholder={def.labels?.target || "Goal"}
            onChange={(e) => onChange({ ...asGoal(value), target: Number(e.target.value) || 0 })}
            className="h-9"
          />
        </div>
      )
    case "number":
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step={def.allowFloat === false ? 1 : "any"}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === "") onChange(undefined)
              else onChange(def.allowFloat === false ? parseInt(raw, 10) : Number(raw))
            }}
            className="h-9"
          />
          {def.unit && <span className="text-xs text-muted-foreground">{def.unit}</span>}
        </div>
      )
    case "string":
    default:
      return (
        <Textarea
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
          rows={2}
          className="min-h-[36px] resize-y"
        />
      )
  }
}
