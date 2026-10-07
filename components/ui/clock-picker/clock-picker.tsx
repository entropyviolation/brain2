/**
 * components/ui/clock-picker/clock-picker.tsx — House clock
 *
 * One control for every place a clock is chosen. The closed field is a sunken
 * bevel that paints 12-hour time; the value it stores and reports is still
 * `HH:MM` (minute precision), the same string `<input type="time">` used.
 * Opening it shows hour, minute, and AM/PM in a CRT well, and a console face
 * under those drums that keeps the same time. The lamp is the cursor. While
 * the hour or minute lamp is on, the page stays still and the wheel steps
 * that drum. Enter and a click outside confirm; Escape restores the time from
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
type Drum = "hour" | "minute"

const COLUMNS: Column[] = ["hour", "minute", "period"]
const PANEL_WIDTH = 212
const PANEL_HEIGHT = 328
const WHEEL_NOTCH = 100

const FACE_TICKS = Array.from({ length: 60 }, (_, index) => index)

type ScrollSnapshot = {
  bodyOverflow: string
  bodyOverscroll: string
  rootOverflow: string
  rootOverscroll: string
}

let pageScrollLocks = 0
let pageScrollSnapshot: ScrollSnapshot | null = null

/** Hold the page still. The matching release restores the previous overflow, including on unmount. */
function holdPageScroll(): () => void {
  if (pageScrollLocks === 0) {
    const body = document.body
    const root = document.documentElement
    pageScrollSnapshot = {
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      rootOverflow: root.style.overflow,
      rootOverscroll: root.style.overscrollBehavior,
    }
    body.style.overflow = "hidden"
    body.style.overscrollBehavior = "none"
    root.style.overflow = "hidden"
    root.style.overscrollBehavior = "none"
  }
  pageScrollLocks += 1
  let released = false
  return () => {
    if (released) return
    released = true
    pageScrollLocks = Math.max(0, pageScrollLocks - 1)
    if (pageScrollLocks > 0 || !pageScrollSnapshot) return
    const body = document.body
    const root = document.documentElement
    body.style.overflow = pageScrollSnapshot.bodyOverflow
    body.style.overscrollBehavior = pageScrollSnapshot.bodyOverscroll
    root.style.overflow = pageScrollSnapshot.rootOverflow
    root.style.overscrollBehavior = pageScrollSnapshot.rootOverscroll
    pageScrollSnapshot = null
  }
}

export function formatClockFace(value: string): string {
  const mins = timeStringToMinutes(value)
  if (mins === null) return ""
  const h24 = Math.floor(mins / 60)
  const minute = mins % 60
  const period: Period = h24 >= 12 ? "PM" : "AM"
  const hour = h24 % 12 || 12
  return `${pad(hour)}:${pad(minute)} ${period}`
}

/** Typed text → stored `HH:MM`. Accepts `4:02 AM`, `04:02`, `16:02`, `4.02pm`, `9:15p`, `0915`. */
export function parseTypedClock(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, "")
  if (!text) return null
  const ampm = text.match(/([ap])m?$/i)
  const clock = text.replace(/([ap])m?$/i, "").replace(/\./g, ":")
  const colon = /^(\d{1,2}):(\d{1,2})$/.exec(clock)
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
  if (!ampm && digits.length === 4 && !text.includes(":") && !text.includes(".")) {
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

function polar(deg: number, radius: number): { cx: number; cy: number } {
  const rad = (deg * Math.PI) / 180
  return { cx: 60 + Math.sin(rad) * radius, cy: 60 - Math.cos(rad) * radius }
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
  const entryRef = useRef<HTMLInputElement>(null)
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
  const [segment, setSegment] = useState<Drum | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const openRef = useRef(open)
  openRef.current = open
  const columnRef = useRef(column)
  columnRef.current = column
  const segmentRef = useRef(segment)
  segmentRef.current = segment

  const publish = (next: string) => {
    draftRef.current = next
    setDraft(next)
    if (next !== valueRef.current) onChangeRef.current(next)
  }

  const applySegment = () => {
    const which = segmentRef.current
    if (!which) return
    const raw = entryRef.current?.value ?? ""
    segmentRef.current = null
    setSegment(null)
    const trimmed = raw.trim()
    if (!trimmed) return
    const n = Number(trimmed)
    if (!Number.isInteger(n)) return
    const current = splitClock(draftRef.current || "08:00")
    if (which === "hour") {
      if (n < 1 || n > 12) return
      publish(joinClock(n, current.minute, current.period))
      return
    }
    if (n < 0 || n > 59) return
    publish(joinClock(current.hour, n, current.period))
  }

  const close = (reason: "commit" | "cancel") => {
    if (reason === "commit") applySegment()
    else {
      segmentRef.current = null
      setSegment(null)
    }
    if (reason === "cancel") {
      const origin = originRef.current
      if (draftRef.current !== origin || valueRef.current !== origin) onChangeRef.current(origin)
      setDraft(origin || "08:00")
      draftRef.current = origin || "08:00"
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
    const next = valueRef.current || "08:00"
    setDraft(next)
    draftRef.current = next
    setColumn("hour")
    columnRef.current = "hour"
    setSegment(null)
    segmentRef.current = null
    hourBuf.current = ""
    minuteBuf.current = ""
    buffer.current = ""
    setOpen(true)
    onOpenChangeRef.current?.(true)
  }

  useEffect(() => {
    if (value) setDraft(value)
  }, [value])

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
      const below = window.innerHeight - rect.bottom
      const top = below < PANEL_HEIGHT && rect.top > PANEL_HEIGHT ? rect.top - PANEL_HEIGHT - 4 : rect.bottom + 4
      const left = Math.max(4, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 4))
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

  const armed = open && (column === "hour" || column === "minute")
  const stepArmedRef = useRef<(delta: number) => void>(() => {})
  stepArmedRef.current = (delta: number) => {
    const col = columnRef.current
    if (col !== "hour" && col !== "minute") return
    if (segmentRef.current) return
    const current = splitClock(draftRef.current || "08:00")
    const next =
      col === "hour"
        ? joinClock(wrapHour(current.hour, delta), current.minute, current.period)
        : joinClock(current.hour, wrapMinute(current.minute, delta), current.period)
    if (col === "hour") hourBuf.current = ""
    else minuteBuf.current = ""
    publish(next)
  }

  useEffect(() => {
    if (!armed) return
    const release = holdPageScroll()
    let pending = 0
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      const col = columnRef.current
      if (col !== "hour" && col !== "minute") return
      if (segmentRef.current) return
      const dominant = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
      if (dominant === 0) return
      if (event.deltaMode !== 0) {
        const count = Math.max(1, Math.min(8, Math.round(Math.abs(dominant))))
        const dir = dominant > 0 ? 1 : -1
        for (let i = 0; i < count; i += 1) stepArmedRef.current(dir)
        return
      }
      pending += dominant
      while (pending >= WHEEL_NOTCH) {
        stepArmedRef.current(1)
        pending -= WHEEL_NOTCH
      }
      while (pending <= -WHEEL_NOTCH) {
        stepArmedRef.current(-1)
        pending += WHEEL_NOTCH
      }
    }
    window.addEventListener("wheel", onWheel, { passive: false, capture: true })
    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true })
      release()
    }
  }, [armed])

  useLayoutEffect(() => {
    if (!segment) return
    const el = entryRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [segment])

  const parts = splitClock(open ? draft : value || draft)
  const nudge = (delta: number) => {
    if (segmentRef.current) return
    if (column === "hour") publish(joinClock(wrapHour(parts.hour, delta), parts.minute, parts.period))
    else if (column === "minute") publish(joinClock(parts.hour, wrapMinute(parts.minute, delta), parts.period))
    else publish(joinClock(parts.hour, parts.minute, parts.period === "AM" ? "PM" : "AM"))
  }

  const typeOpen = (key: string) => {
    if (segmentRef.current) return
    const lower = key.toLowerCase()
    if (lower === "a" || lower === "p") {
      publish(joinClock(parts.hour, parts.minute, lower === "p" ? "PM" : "AM"))
      setColumn("period")
      return
    }
    if (key === ":" || key === ".") {
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

  const pushClosedBuffer = (key: string) => {
    const prior = buffer.current
    let next = (prior + key).slice(-16)
    let parsed = parseTypedClock(next)
    if (!parsed && prior && parseTypedClock(prior) && /\d/.test(key)) {
      next = key
      parsed = parseTypedClock(next)
    }
    buffer.current = next
    if (parsed) publish(parsed)
  }

  const onEntryKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation()
    if (event.key === "Enter") {
      event.preventDefault()
      applySegment()
      inputRef.current?.focus()
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      segmentRef.current = null
      setSegment(null)
      inputRef.current?.focus()
    }
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
      if (segmentRef.current) return
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
      const parsed = parseTypedClock(buffer.current)
      if (parsed) publish(parsed)
      return
    }
    if (event.key.length === 1 && /[0-9:.apm ]/i.test(event.key)) {
      event.preventDefault()
      if (openRef.current) typeOpen(event.key)
      else pushClosedBuffer(event.key)
    }
  }

  const face = formatClockFace(open ? draft : value)
  const holdFocus = (event: ReactPointerEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest(".clock-picker-entry")) return
    if (segmentRef.current) applySegment()
    event.preventDefault()
    event.stopPropagation()
  }

  const beginSegment = (which: Drum) => {
    if (columnRef.current !== which) return
    hourBuf.current = ""
    minuteBuf.current = ""
    segmentRef.current = which
    setSegment(which)
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
            <div className="clock-picker-drums">
              <Wheel
                kicker="Hour"
                active={column === "hour"}
                editing={segment === "hour"}
                entryRef={segment === "hour" ? entryRef : undefined}
                current={parts.hour}
                previous={wrapHour(parts.hour, -1)}
                next={wrapHour(parts.hour, 1)}
                onPick={(hour) => {
                  setColumn("hour")
                  const current = splitClock(draftRef.current || "08:00")
                  publish(joinClock(hour, current.minute, current.period))
                }}
                onActivate={() => setColumn("hour")}
                onEdit={() => beginSegment("hour")}
                onEntryKeyDown={onEntryKeyDown}
                onEntryBlur={applySegment}
              />
              <span className="clock-picker-colon" aria-hidden>
                :
              </span>
              <Wheel
                kicker="Min"
                active={column === "minute"}
                editing={segment === "minute"}
                entryRef={segment === "minute" ? entryRef : undefined}
                current={parts.minute}
                previous={wrapMinute(parts.minute, -1)}
                next={wrapMinute(parts.minute, 1)}
                onPick={(minute) => {
                  setColumn("minute")
                  const current = splitClock(draftRef.current || "08:00")
                  publish(joinClock(current.hour, minute, current.period))
                }}
                onActivate={() => setColumn("minute")}
                onEdit={() => beginSegment("minute")}
                onEntryKeyDown={onEntryKeyDown}
                onEntryBlur={applySegment}
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
                        const current = splitClock(draftRef.current || "08:00")
                        publish(joinClock(current.hour, current.minute, period))
                      }}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <AnalogFace hour={parts.hour} minute={parts.minute} period={parts.period} />
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
      data-armed={armed ? column : undefined}
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
            buffer.current = ""
            onChange("")
            return
          }
          const parsed = parseTypedClock(next)
          if (parsed) {
            buffer.current = ""
            onChange(parsed)
          }
        }}
        onClick={() => {
          if (disabled || readOnly) return
          if (openRef.current) close("commit")
          else openPanel()
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!openRef.current) buffer.current = ""
        }}
        onPaste={(event) => {
          const parsed = parseTypedClock(event.clipboardData.getData("text"))
          if (!parsed) return
          event.preventDefault()
          buffer.current = ""
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
  editing,
  entryRef,
  current,
  previous,
  next,
  onPick,
  onActivate,
  onEdit,
  onEntryKeyDown,
  onEntryBlur,
}: {
  kicker: string
  active: boolean
  editing: boolean
  entryRef?: { current: HTMLInputElement | null }
  current: number
  previous: number
  next: number
  onPick: (value: number) => void
  onActivate: () => void
  onEdit: () => void
  onEntryKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
  onEntryBlur: () => void
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
        {editing ? (
          <input
            ref={entryRef}
            className="clock-picker-entry"
            aria-label={noun}
            inputMode="numeric"
            autoComplete="off"
            defaultValue={pad(current)}
            onKeyDown={onEntryKeyDown}
            onBlur={onEntryBlur}
          />
        ) : (
          rows.map((row) => (
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
              onDoubleClick={(event) => {
                if (row.ghost || !active) return
                event.preventDefault()
                event.stopPropagation()
                onEdit()
              }}
            >
              {pad(row.value)}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function AnalogFace({ hour, minute, period }: { hour: number; minute: number; period: Period }) {
  const gid = `face${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const minuteAngle = minute * 6
  const hourAngle = (hour % 12) * 30 + minute * 0.5
  const label = `${pad(hour)}:${pad(minute)} ${period}`
  return (
    <div
      className="clock-picker-analog"
      role="img"
      aria-label={label}
      data-hour={hour}
      data-minute={minute}
      data-period={period}
    >
      <svg className="clock-picker-analog-svg" viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <radialGradient id={`${gid}-bezel`} cx="36%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#f4f6f8" />
            <stop offset="22%" stopColor="#c8ccd0" />
            <stop offset="58%" stopColor="#8a8e92" />
            <stop offset="100%" stopColor="#3a3e42" />
          </radialGradient>
          <radialGradient id={`${gid}-glass`} cx="50%" cy="36%" r="70%">
            <stop offset="0%" stopColor="#1a3830" />
            <stop offset="42%" stopColor="#071410" />
            <stop offset="100%" stopColor="#040a08" />
          </radialGradient>
          <radialGradient id={`${gid}-hub`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#f4fff8" />
            <stop offset="40%" stopColor="#7dffc4" />
            <stop offset="100%" stopColor="#0b4a32" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="58" fill="#9a9ea2" />
        <circle cx="60" cy="60" r="58" fill={`url(#${gid}-bezel)`} />
        <circle cx="60" cy="60" r="50" fill="#141618" />
        <circle cx="60" cy="60" r="47.4" fill="#07090a" />
        <circle cx="60" cy="60" r="46" fill="#071410" />
        <circle cx="60" cy="60" r="46" fill={`url(#${gid}-glass)`} />
        {([45, 135, 225, 315] as const).map((deg) => {
          const { cx, cy } = polar(deg, 54)
          return (
            <g key={deg} transform={`rotate(${deg} ${cx} ${cy})`}>
              <circle cx={cx} cy={cy} r="1.85" fill="#2a2e32" stroke="#e6e8ea" strokeWidth="0.35" />
              <path d={`M ${cx - 1.05} ${cy} H ${cx + 1.05}`} stroke="#0c0e10" strokeWidth="0.45" />
            </g>
          )
        })}
        <circle cx="60" cy="60" r="43.2" fill="none" stroke="rgba(125, 255, 196, 0.16)" strokeWidth="0.6" />
        {FACE_TICKS.map((index) => {
          const cardinal = index % 15 === 0
          const major = index % 5 === 0
          const width = cardinal ? 2.6 : major ? 1.8 : 1.15
          const height = cardinal ? 7.2 : major ? 4.8 : 2.6
          const tone = cardinal ? "#7dffc4" : major ? "rgba(125, 255, 196, 0.72)" : "rgba(125, 255, 196, 0.32)"
          return (
            <rect
              key={index}
              x={60 - width / 2}
              y={15.2}
              width={width}
              height={height}
              fill={tone}
              transform={`rotate(${index * 6} 60 60)`}
            />
          )
        })}
        <text className="clock-picker-numeral" x="60" y="33">
          12
        </text>
        <text className="clock-picker-numeral" x="87" y="61.5">
          3
        </text>
        <text className="clock-picker-numeral" x="60" y="90">
          6
        </text>
        <text className="clock-picker-numeral" x="33" y="61.5">
          9
        </text>
        <g className="clock-picker-daywin">
          <rect x="48.5" y="72" width="23" height="10" />
          <text x="60" y="77.2">
            {period}
          </text>
        </g>
        <Hand angle={hourAngle} length={22} tail={6} width={7} />
        <Hand angle={minuteAngle} length={34} tail={8} width={3.3} />
        <circle cx="60" cy="60" r="4.3" fill="#04110c" />
        <circle cx="60" cy="60" r="3.15" fill={`url(#${gid}-hub)`} />
        <ellipse cx="46" cy="36" rx="16" ry="8" fill="rgba(255, 255, 255, 0.13)" />
        <circle cx="60" cy="7.2" r="1.35" fill="#7dffc4" />
      </svg>
    </div>
  )
}

function Hand({ angle, length, tail, width }: { angle: number; length: number; tail: number; width: number }) {
  const y = 60 - length
  const height = length + tail
  return (
    <g transform={`rotate(${angle} 60 60)`}>
      <rect x={60 - width / 2 + 0.45} y={y + 0.7} width={width} height={height} fill="#02140e" />
      <rect x={60 - width / 2} y={y} width={width} height={height} fill="#7dffc4" />
    </g>
  )
}
