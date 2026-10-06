/**
 * Presentational merge-dialog field chrome — radios, optional None, or text input.
 * Callers own plan state and apply semantics.
 */
"use client"

import type { ReactNode } from "react"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { Label } from "@/components/ui/label"

export function MergeKeepCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function MergeFieldGroup({
  label,
  radioName,
  options,
  value,
  onChange,
  /** When options.length ≤ 1, show an editable input instead of a lone radio. */
  inputFallback = false,
  allowNone = false,
  /** When set, show this hint and hide the None radio (Keep-all path). */
  keepAllHint,
  optionAlign = "start",
  renderOption,
}: {
  label: string
  radioName: string
  options: string[]
  value: string | undefined
  onChange: (value: string | undefined) => void
  inputFallback?: boolean
  allowNone?: boolean
  keepAllHint?: string
  optionAlign?: "start" | "center"
  renderOption?: (option: string) => ReactNode
}) {
  const alignClass = optionAlign === "center" ? "items-center" : "items-start"

  if (inputFallback && options.length <= 1) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <IsolatedInput value={value ?? ""} onCommit={(next) => onChange(next)} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {keepAllHint ? (
        <p className="text-xs text-muted-foreground">{keepAllHint}</p>
      ) : (
        allowNone && (
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={radioName}
              checked={!value}
              onChange={() => onChange(undefined)}
            />
            None
          </label>
        )
      )}
      {options.map((option) => (
        <label key={option} className={`flex ${alignClass} gap-2`}>
          <input
            type="radio"
            name={radioName}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          {renderOption ? renderOption(option) : <span>{option}</span>}
        </label>
      ))}
    </div>
  )
}

export function MergeMembershipToggles({
  label,
  hint,
  items,
  selectedIds,
  onToggle,
  emptyMessage,
}: {
  label: string
  hint: string
  items: { id: string; name: string }[]
  selectedIds: string[]
  onToggle: (id: string, on: boolean) => void
  emptyMessage: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {items.map((item) => (
        <label key={item.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedIds.includes(item.id)}
            onChange={(e) => onToggle(item.id, e.target.checked)}
          />
          {item.name}
        </label>
      ))}
      {items.length === 0 && <p className="text-xs text-muted-foreground">{emptyMessage}</p>}
    </div>
  )
}
