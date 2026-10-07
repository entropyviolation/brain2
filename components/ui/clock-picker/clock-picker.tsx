/**
 * components/ui/clock-picker/clock-picker.tsx — House clock
 *
 * One control for every place a clock is chosen. The closed field is a sunken
 * bevel that paints 12-hour time; the value it stores and reports is still
 * `HH:MM` (minute precision), the same string `<input type="time">` used.
 * Opening it shows hour, minute, and AM/PM in a CRT well. The lamp is the
 * cursor. Enter and a click outside confirm; Escape restores the time from
 * when the panel opened.
 */
"use client"

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { timeStringToMinutes } from "@/lib/time-entries"
import "./clock-picker.css"

type Period = "AM" | "PM"
type Column = "hour" | "minute" | "period"

const COLUMNS: Column[] = ["hour", "minute", "period"]

export function formatClockFace(value: string): string {
  const mins = timeStringToMinutes(value)
  if (mins === null) return ""
  const h24 = Math.floor(mins / 60)
  const minute = mins % 60
  const period: Period = h24 >= 12 ? "PM" : "AM"
  const hour = h24 % 12 || 12
  return `${pad(hour)}:${pad(minute)} ${period}`
}

/** Typed text → stored `HH:MM`. Accepts `09:15`, `15:47`, `0915`, `9:15p`, `3:47 PM`. */
export function parseTypedClock(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, "")
  if (!text) return null
  const ampm = text.match(/([ap])m?$/i)
  const clock = text.replace(/([ap])m?$/i, "")
  const colon = /^(\d{1,2}):(\d{2})$/.exec(clock)
  if (colon) {
    const hour = Number(colon[1])
    const minute = Number(colon[2])
    if (minute > 59) return null
    if (!ampm) {
      if (hour > 23) return null
      return stamp(hour, minute)
    }
    if (hour < 1 || hour > 12) return null
    return joinClock(hour, minute, ampm[1].toLowerCase() === "p" ? "PM" : "AM")
  }
  const digits = clock.replace(/\D/g, "")
  if (ampm && (digits.length === 3 || digits.length === 4)) {
    const hour = digits.length === 3 ? Number(digits[0]) : Number(digits.slice(0, 2))
    const minute = digits.length === 3 ? Number(digits.slice(1)) : Number(digits.slice(2))
    if (hour < 1 || hour > 12 || minute > 59) return null
    return joinClock(hour, minute, ampm[1].toLowerCase() === "p" ? "PM" : "AM")
  }
  if (!ampm && digits.length === 4 && !text.includes(":")) {
    const hour = Number(digits.slice(0, 2))
    const minute = Number(digits.slice(2))
    if (hour > 23 || minute > 59) return null
    return stamp(hour, minute)
  }
  return null
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function stamp(hour24: number, minute: number): string {
  return `${pad(hour24)}:${pad(minute)}`
}

function splitClock(value: string): { hour: number; minute: number; period: Period } {
  const mins = timeStringToMinutes(value)
  const total = mins ?? 8 * 60
  const h24 = Math.floor(total / 60)
  return { hour: h24 % 12 || 12, minute: total % 60, period: h24 >= 12 ? "PM" : "AM" }
}

function joinClock(hour: number, minute: number, period: Period): string {
  let h24 = hour % 12
  if (period === "PM") h24 += 12
  return stamp(h24, minute)
}

function wrapHour(hour: number, delta: number): number {
  return ((hour - 1 + delta) % 12 + 12) % 12 + 1
}

function wrapMinute(minute: number, delta: number): number {
  return (minute + delta + 60) % 60
}

export function ClockPicker({
  id,
  value,
  onChange,
  "aria-label": ariaLabel,
  disabled,
  readOnly,
  className,
  title,
  name,
  autoFocus,
  defaultOpen,
  placeholder = "––:––",
  onOpenChange,
  onDismiss,
}: {
  id?: string
  /** Stored `HH:MM`, or "" when the clock is unset. */
  value: string
  onChange: (value: string) => void
  "aria-label"?: string
  disabled?: boolean
  readOnly?: boolean
  className?: string
  title?: string
  name?: string
  autoFocus?: boolean
  /** Open the panel on mount (a double-clicked fill clock). */
  defaultOpen?: boolean
  placeholder?: string
  onOpenChange?: (open: boolean) => void
  /** Fires when the panel closes. Escape is cancel; Enter and a click outside commit. */
  onDismiss?: (reason: "commit" | "cancel") => void
}) {
  const panelId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buffer = useRef("")
  const hourBuf = useRef("")
  const minuteBuf = useRef("")
  const originRef = useRef(value)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onOpenChangeRef = useRef(onOpenChange)
  const onDismissRef = useRef(onDismiss)
  valueRef.current = value
  onChangeRef.current = onChange
  onOpenChangeRef.current = onOpenChange
  onDismissRef.current = onDismiss

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value || "08:00")
  const [column, setColumn] = useState<Column>("hour")
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const openRef = useRef(open)
  openRef.current = open

  useEffect(() => {
    if (value) setDraft(value)
  }, [value])

  const publish = (next: string) => {
    setDraft(next)
    if (next !== valueRef.current) onChangeRef.current(next)
  }

  const close = (reason: "commit" | "cancel") => {
    if (reason === "cancel") {
      const origin = originRef.current
      if (draftRef.current !== origin || valueRef.current !== origin) onChangeRef.current(origin)
      setDraft(origin || "08:00")
    } else if (draftRef.current !== valueRef.current) {
      onChangeRef.current(draftRef.current)
    }
    buffer.current = ""
    hourBuf.current = ""
    minuteBuf.current = ""
    setOpen(false)
    onOpenChangeRef.current?.(false)
    onDismissRef.current?.(reason)
  }

  const openPanel = () => {
    if (disabled || readOnly || openRef.current) return
    originRef.current = valueRef.current
    setDraft(valueRef.current || "08:00")
    setColumn("hour")
    hourBuf.current = ""
    minuteBuf.current = ""
    buffer.current = ""
    setOpen(true)
    onOpenChangeRef.current?.(true)
  }

  useEffect(() => {
    if (!defaultOpen) return
    openPanel()
    inputRef.current?.focus()
    // Mount-only: a fill clock asks to open as soon as it is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const place = () => {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const width = 196
      const height = 148
      const below = window.innerHeight - rect.bottom
      const top = below < height && rect.top > height ? rect.top - height - 4 : rect.bottom + 4
      const left = Math.max(4, Math.min(rect.left, window.innerWidth - width - 4))
      setPos({ top, left })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      close("commit")
    }
    document.addEventListener("pointerdown", onDoc, true)
    return () => document.removeEventListener("pointerdown", onDoc, true)
  }, [open])

  const parts = splitClock(open ? draft : value || draft)
  const nudge = (delta: number) => {
    if (column === "hour") publish(joinClock(wrapHour(parts.hour, delta), parts.minute, parts.period))
    else if (column === "minute") publish(joinClock(parts.hour, wrapMinute(parts.minute, delta), parts.period))
    else publish(joinClock(parts.hour, parts.minute, parts.period === "AM" ? "PM" : "AM"))
  }

  const typeOpen = (key: string) => {
    const lower = key.toLowerCase()
    if (lower === "a" || lower === "p") {
      publish(joinClock(parts.hour, parts.minute, lower === "p" ? "PM" : "AM"))
      setColumn("period")
      return
    }
    if (key === ":") {
      setColumn((current) => COLUMNS[Math.min(COLUMNS.indexOf(current) + 1, COLUMNS.length - 1)])
      return
    }
    if (!/^\d$/.test(key)) return
    const digit = Number(key)
    if (column === "period") return
    if (column === "hour") {
      if (hourBuf.current === "") {
        if (digit >= 2) {
          publish(joinClock(digit, parts.minute, parts.period))
          setColumn("minute")
        } else hourBuf.current = key
        return
      }
      const first = hourBuf.current
      const combined = Number(first + key)
      hourBuf.current = ""
      if (combined >= 1 && combined <= 12) {
        publish(joinClock(combined, parts.minute, parts.period))
        setColumn("minute")
      } else {
        publish(joinClock(Number(first), parts.minute, parts.period))
        setColumn("minute")
        minuteBuf.current = key
      }
      return
    }
    if (minuteBuf.current === "") {
      if (digit >= 6) {
        publish(joinClock(parts.hour, digit, parts.period))
        minuteBuf.current = ""
        setColumn("period")
      } else minuteBuf.current = key
      return
    }
    const minute = Number(minuteBuf.current + key)
    minuteBuf.current = ""
    if (minute <= 59) publish(joinClock(parts.hour, minute, parts.period))
    setColumn("period")
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return
    if (event.key === "Escape") {
      if (!openRef.current) return
      event.preventDefault()
      event.stopPropagation()
      close("cancel")
      return
    }
    if (event.key === "Enter") {
      if (!openRef.current) return
      event.preventDefault()
      event.stopPropagation()
      close("commit")
      return
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault()
      if (!openRef.current) {
        openPanel()
        return
      }
      setColumn((current) => {
        const index = COLUMNS.indexOf(current)
        const next = index + (event.key === "ArrowRight" ? 1 : -1)
        return COLUMNS[(next + COLUMNS.length) % COLUMNS.length]
      })
      hourBuf.current = ""
      minuteBuf.current = ""
      return
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault()
      if (!openRef.current) {
        openPanel()
        return
      }
      nudge(event.key === "ArrowDown" ? 1 : -1)
      return
    }
    if (event.key === "Backspace" && !openRef.current) {
      event.preventDefault()
      buffer.current = buffer.current.slice(0, -1)
      return
    }
    if (event.key.length === 1 && /[0-9:ap]/i.test(event.key)) {
      event.preventDefault()
      if (openRef.current) typeOpen(event.key)
      buffer.current = (buffer.current + event.key).slice(-8)
      const parsed = parseTypedClock(buffer.current)
      if (parsed) {
        buffer.current = ""
        hourBuf.current = ""
        minuteBuf.current = ""
        publish(parsed)
      }
    }
  }

  const face = formatClockFace(open ? draft : value)
  const holdFocus = (event: ReactPointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const panel =
    open && pos
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            className="clock-picker-panel"
            style={{ top: pos.top, left: pos.left }}
            role="group"
            aria-label="Choose time"
            onPointerDown={holdFocus}
          >
            <Wheel
              kicker="Hour"
              active={column === "hour"}
              current={parts.hour}
              previous={wrapHour(parts.hour, -1)}
              next={wrapHour(parts.hour, 1)}
              onPick={(hour) => {
                setColumn("hour")
                publish(joinClock(hour, parts.minute, parts.period))
              }}
              onActivate={() => setColumn("hour")}
            />
            <span className="clock-picker-colon" aria-hidden>
              :
            </span>
            <Wheel
              kicker="Min"
              active={column === "minute"}
              current={parts.minute}
              previous={wrapMinute(parts.minute, -1)}
              next={wrapMinute(parts.minute, 1)}
              onPick={(minute) => {
                setColumn("minute")
                publish(joinClock(parts.hour, minute, parts.period))
              }}
              onActivate={() => setColumn("minute")}
            />
            <div className="clock-picker-stack clock-picker-period">
              <span className="clock-picker-kicker">Day</span>
              <div className="clock-picker-col" data-active={column === "period" ? "true" : "false"}>
                {(["AM", "PM"] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    tabIndex={-1}
                    className={cn(
                      "clock-picker-cell",
                      parts.period === period && "is-cursor",
                      column === "period" && parts.period === period && "is-caret",
                    )}
                    aria-pressed={parts.period === period}
                    onClick={() => {
                      setColumn("period")
                      publish(joinClock(parts.hour, parts.minute, period))
                    }}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <span
      ref={rootRef}
      className={cn("clock-picker", className)}
      data-disabled={disabled ? "true" : undefined}
      data-readonly={readOnly ? "true" : undefined}
      data-open={open ? "true" : "false"}
      data-face={face || placeholder}
      data-empty={face ? undefined : "true"}
    >
      <input
        ref={inputRef}
        id={id}
        name={name}
        className="clock-picker-field"
        type="text"
        inputMode="numeric"
        role="combobox"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        disabled={disabled}
        readOnly={readOnly}
        title={title ?? (face || undefined)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-autocomplete="none"
        value={value}
        onChange={(event) => {
          const next = event.target.value
          if (next === "") {
            onChange("")
            return
          }
          const parsed = parseTypedClock(next)
          if (parsed) onChange(parsed)
        }}
        onClick={() => {
          if (disabled || readOnly) return
          if (openRef.current) close("commit")
          else openPanel()
        }}
        onKeyDown={onKeyDown}
        onPaste={(event) => {
          const parsed = parseTypedClock(event.clipboardData.getData("text"))
          if (!parsed) return
          event.preventDefault()
          publish(parsed)
        }}
      />
      {panel}
    </span>
  )
}

function Wheel({
  kicker,
  active,
  current,
  previous,
  next,
  onPick,
  onActivate,
}: {
  kicker: string
  active: boolean
  current: number
  previous: number
  next: number
  onPick: (value: number) => void
  onActivate: () => void
}) {
  const noun = kicker === "Hour" ? "Hour" : "Minute"
  const rows = [
    { value: previous, ghost: true },
    { value: current, ghost: false },
    { value: next, ghost: true },
  ]
  return (
    <div className="clock-picker-stack">
      <span className="clock-picker-kicker">{kicker}</span>
      <div className="clock-picker-col" data-active={active ? "true" : "false"}>
        {rows.map((row) => (
          <button
            key={`${noun}-${row.ghost ? "g" : "c"}-${row.value}`}
            type="button"
            tabIndex={-1}
            className={cn("clock-picker-cell", !row.ghost && "is-cursor", !row.ghost && active && "is-caret")}
            aria-label={`${noun} ${pad(row.value)}`}
            aria-pressed={!row.ghost}
            onClick={() => {
              if (row.ghost) onPick(row.value)
              else onActivate()
            }}
          >
            {pad(row.value)}
          </button>
        ))}
      </div>
    </div>
  )
}
