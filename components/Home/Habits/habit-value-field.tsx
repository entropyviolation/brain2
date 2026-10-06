/**
 * components/Home/Habits/habit-value-field.tsx — Habit cell while it is being typed
 *
 * Goal and climb cells keep a local draft so `parseFloat("0.")` cannot snap
 * the field back to 0. Text cells do the same, and they do not write the store
 * on each keystroke: the grid, grades, and coverage scan stay still until the
 * note pauses or the field blurs. A note that already has text opens in a
 * larger editor. A blank cell stays the small inline field.
 */
"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { completionValueFromInput } from "@/lib/incremental-habits"

const TEXT_COMMIT_MS = 450

export function HabitNumberField({
  value,
  onValue,
  className,
  style,
  ariaLabel,
  placeholder,
  plain = false,
}: {
  value: number | undefined
  onValue: (value: number | undefined) => void
  className?: string
  style?: React.CSSProperties
  ariaLabel?: string
  placeholder?: string
  /** Lists rows use a bare `fm-input` instead of the spreadsheet slot. */
  plain?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft !== null ? draft : value === undefined ? "" : String(value)
  const props = {
    type: "text" as const,
    inputMode: "decimal" as const,
    autoComplete: "off" as const,
    value: shown,
    "aria-label": ariaLabel,
    placeholder,
    className,
    style,
    onFocus: () => setDraft(value === undefined ? "" : String(value)),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return
      setDraft(raw)
      onValue(completionValueFromInput(raw))
    },
    onBlur: () => setDraft(null),
  }
  if (plain) return <input {...props} />
  return <Input {...props} />
}

function useDebouncedCommit(value: string, onValue: (value: string) => void) {
  const timer = useRef<number | null>(null)
  const onValueRef = useRef(onValue)
  onValueRef.current = onValue
  const valueRef = useRef(value)
  valueRef.current = value

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  const commit = (text: string) => {
    clear()
    if (text !== valueRef.current) onValueRef.current(text)
  }

  const schedule = (text: string) => {
    clear()
    timer.current = window.setTimeout(() => {
      timer.current = null
      if (text !== valueRef.current) onValueRef.current(text)
    }, TEXT_COMMIT_MS)
  }

  useEffect(() => clear, [])

  return { commit, schedule, clear }
}

export function HabitTextField({
  value,
  onValue,
  className,
  style,
  placeholder,
  plain = false,
  ariaLabel,
}: {
  value: string
  onValue: (value: string) => void
  className?: string
  style?: React.CSSProperties
  placeholder?: string
  plain?: boolean
  ariaLabel?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const { commit, schedule } = useDebouncedCommit(value, onValue)
  const filled = value.trim().length > 0
  const shown = draft !== null ? draft : value
  const draftingInline = draft !== null && !expanded

  const flush = (text: string) => {
    commit(text)
    setDraft(null)
  }

  if (filled && !draftingInline) {
    return (
      <>
        <button
          ref={anchorRef}
          type="button"
          className={`habit-cell-text-preview ${className ?? ""}`.trim()}
          style={style}
          title={value}
          aria-label={ariaLabel ? `Edit ${ariaLabel}` : "Edit note"}
          onClick={() => setExpanded(true)}
        >
          {value}
        </button>
        {expanded ? (
          <HabitTextEditor
            text={shown}
            label={ariaLabel ?? "Habit note"}
            anchor={anchorRef.current}
            onChange={(next) => {
              setDraft(next)
              schedule(next)
            }}
            onClose={() => {
              flush(draft ?? value)
              setExpanded(false)
            }}
          />
        ) : null}
      </>
    )
  }

  const fieldProps = {
    type: "text" as const,
    value: shown,
    placeholder,
    className,
    style,
    "aria-label": ariaLabel ?? "Habit note",
    onFocus: () => {
      if (draft === null) setDraft(value)
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value
      setDraft(next)
      schedule(next)
    },
    onBlur: () => {
      if (draft !== null) flush(draft)
    },
  }

  if (plain) return <input {...fieldProps} />
  return <Input {...fieldProps} />
}

function HabitTextEditor({
  text,
  label,
  anchor,
  onChange,
  onClose,
}: {
  text: string
  label: string
  anchor: HTMLElement | null
  onChange: (text: string) => void
  onClose: () => void
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const place = editorPlace(anchor)

  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    area.focus()
    const end = area.value.length
    area.setSelectionRange(end, end)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (typeof document === "undefined") return null

  return createPortal(
    <div className="habit-text-editor-layer">
      <button type="button" className="habit-text-editor-shade" aria-label="Close note" onClick={onClose} />
      <div
        className="habit-text-editor"
        role="dialog"
        aria-label={label}
        style={{ top: place.top, left: place.left, width: place.width }}
      >
        <textarea
          ref={areaRef}
          className="habit-text-editor-area"
          value={text}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              onClose()
            }
          }}
        />
        <div className="habit-text-editor-bar">
          <button type="button" className="habit95-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function editorPlace(anchor: HTMLElement | null): { top: number; left: number; width: number } {
  const width = 320
  if (!anchor || typeof window === "undefined") return { top: 80, left: 80, width }
  const rect = anchor.getBoundingClientRect()
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
  const below = rect.bottom + 6
  const top = below + 180 > window.innerHeight ? Math.max(8, rect.top - 186) : below
  return { top, left, width }
}
