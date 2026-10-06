/**
 * Shared presentational fields for New List / New Folder dialogs.
 * Create payloads stay in the callers.
 */
"use client"

import { CalendarClock } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function BulkNamesField({
  id,
  label,
  placeholder,
  ariaLabel,
  value,
  onChange,
  names,
  entitySingular,
}: {
  id: string
  label: string
  placeholder: string
  ariaLabel: string
  value: string
  onChange: (value: string) => void
  names: string[]
  entitySingular: string
}) {
  const plural = `${entitySingular}${names.length === 1 ? "" : "s"}`
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        className="w-full min-h-[120px] border rounded-md px-2 py-1.5 bg-background text-sm font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      <p className="text-[11px] text-muted-foreground">
        {names.length === 0
          ? "Enter at least one name."
          : `${names.length} ${plural} will be created.`}
      </p>
    </div>
  )
}

export function ScheduleableSwitch({
  id,
  checked,
  onCheckedChange,
  description,
}: {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  description: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          Send to Scheduler
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export function PlacementModeRadios({
  legend,
  radioName,
  mode,
  onModeChange,
  keepLabel,
  moveLabel,
  moveDisabled,
}: {
  legend: string
  radioName: string
  mode: "keep" | "move"
  onModeChange: (mode: "keep" | "move") => void
  keepLabel: string
  moveLabel: string
  moveDisabled?: boolean
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label>{legend}</Label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name={radioName}
          checked={mode === "keep"}
          onChange={() => onModeChange("keep")}
        />
        {keepLabel}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name={radioName}
          checked={mode === "move"}
          disabled={moveDisabled}
          onChange={() => onModeChange("move")}
        />
        {moveLabel}
      </label>
    </div>
  )
}
