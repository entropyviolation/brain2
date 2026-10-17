"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { ChevronDown } from "lucide-react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import "./native-select.css"

/**
 * Drop-in for a native `<select>` with `<option>` children. Renders the
 * app's Radix select (menu layer, house styling) instead of the OS popup.
 * `onChange` gets `{ target: { value } }`, so `e.target.value` callers work.
 */

const EMPTY = "__empty__"

type Opt = { value: string; label: React.ReactNode; disabled?: boolean; group?: string }

function collect(children: React.ReactNode, out: Opt[], group?: string) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as { value?: unknown; children?: React.ReactNode; disabled?: boolean; label?: string }
    if (child.type === "option") {
      const value = props.value == null ? String(textOf(props.children)) : String(props.value)
      out.push({ value, label: props.children, disabled: props.disabled, group })
    } else if (child.type === "optgroup") {
      collect(props.children, out, props.label)
    } else {
      collect(props.children, out, group)
    }
  })
}

/** Runs of options that share an `<optgroup>` label (undefined = no group). */
function groupRuns(options: Opt[]) {
  const runs: { group?: string; items: Opt[] }[] = []
  for (const o of options) {
    const last = runs[runs.length - 1]
    if (last && last.group === o.group) last.items.push(o)
    else runs.push({ group: o.group, items: [o] })
  }
  return runs
}

// The list is portaled, but React events still bubble to the select's
// parents (clickable rows, dialog key handlers). A native popup does not.
const stop = (e: React.SyntheticEvent) => e.stopPropagation()

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  return ""
}

export type NativeSelectChange = { target: { value: string }; currentTarget: { value: string } }

export interface NativeSelectProps {
  value?: string | number
  defaultValue?: string | number
  onChange?: (event: NativeSelectChange) => void
  children?: React.ReactNode
  className?: string
  id?: string
  name?: string
  title?: string
  disabled?: boolean
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  style?: React.CSSProperties
  "aria-label"?: string
  "aria-labelledby"?: string
  "data-testid"?: string
}

export function NativeSelect({ value, defaultValue, onChange, children, className, style, disabled, ...rest }: NativeSelectProps) {
  const options: Opt[] = []
  collect(children, options)
  const enc = (v: string | number | undefined) => (v === undefined ? undefined : String(v) === "" ? EMPTY : String(v))
  return (
    <Select
      value={enc(value)}
      defaultValue={enc(defaultValue)}
      disabled={disabled}
      onValueChange={(v) => {
        const raw = v === EMPTY ? "" : v
        onChange?.({ target: { value: raw }, currentTarget: { value: raw } })
      }}
    >
      {/* The bare trigger, not `SelectTrigger`: no shadcn field classes, so the
          house rules that style `select` (twinned as `.native-select`) apply. */}
      <SelectPrimitive.Trigger className={cn("native-select", className)} style={style} {...rest}>
        <span className="native-select-value">
          <SelectValue />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="native-select-icon" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectContent onClick={stop} onPointerDown={stop} onMouseDown={stop} onKeyDown={stop}>
        {groupRuns(options).map((run, i) => {
          const items = run.items.map((o) => (
            <SelectItem key={o.value} value={o.value === "" ? EMPTY : o.value} disabled={o.disabled} data-value={o.value}>
              {o.label}
            </SelectItem>
          ))
          return run.group === undefined ? (
            <React.Fragment key={i}>{items}</React.Fragment>
          ) : (
            <SelectGroup key={i}>
              <SelectLabel>{run.group}</SelectLabel>
              {items}
            </SelectGroup>
          )
        })}
      </SelectContent>
    </Select>
  )
}
