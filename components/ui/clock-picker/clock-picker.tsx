/**
 * components/ui/clock-picker/clock-picker.tsx — House clock
 *
 * One control for every place a clock is chosen. The closed field is a real
 * text field: the face it paints is 12-hour (`08:00 AM`), and what it stores
 * is still `HH:MM`. Typing stays in the field. A clock mark opens the panel.
 * The panel is hour, minute, and AM/PM in a CRT well, Now, and the cream
 * ceramic face with ornate silver hands. Confirm writes that time. Cancel,
 * Escape, and a click outside leave the field as it was. While the hour or
 * minute lamp is on, the page stays still and the wheel steps that drum.
 * The panel is its own hit target above a dialog, including the dialog backdrop.
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
import { DismissableLayer, DismissableLayerBranch } from "@radix-ui/react-dismissable-layer"
import { cn } from "@/lib/utils"
import { timeStringToMinutes } from "@/lib/time-entries"
import {
  DEFAULT_DIAL_ID,
  clockDials,
  readHiddenDialIds,
  readSelectedDialId,
  visibleDials,
  writeHiddenDialIds,
  writeSelectedDialId,
} from "./clock-dials"
import "./clock-picker.css"

type Period = "AM" | "PM"
type Column = "hour" | "minute" | "period"
type Drum = "hour" | "minute"

const COLUMNS: Column[] = ["hour", "minute", "period"]
const PANEL_WIDTH = 224
const PANEL_HEIGHT = 520
const WHEEL_NOTCH = 100
/** Above `.trk-entry` (51) and the dialog overlay (`z-50`). */
const LAYER_Z = 80

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

/** Typed text → stored `HH:MM`. Accepts `8:00 AM`, `08:00`, `16:02`, `4.02pm`, `1pm`, `1:00 PM`, `0915`. */
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
  if (ampm && /^\d{1,2}$/.test(clock)) {
    const hour = Number(clock)
    if (hour < 1 || hour > 12) return null
    return joinClock(hour, 0, ampm[1].toLowerCase() === "p" ? "PM" : "AM")
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
  /** Fires when the panel closes. Enter and Confirm commit. Escape, Cancel, and a click outside cancel. */
  onDismiss?: (reason: "commit" | "cancel") => void
}) {
  const panelId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const entryRef = useRef<HTMLInputElement>(null)
  const hourBuf = useRef("")
  const minuteBuf = useRef("")
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onOpenChangeRef = useRef(onOpenChange)
  const onDismissRef = useRef(onDismiss)
  const seenValue = useRef(value)
  if (value !== seenValue.current) {
    seenValue.current = value
    valueRef.current = value
  }
  onChangeRef.current = onChange
  onOpenChangeRef.current = onOpenChange
  onDismissRef.current = onDismiss

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value || "08:00")
  const [column, setColumn] = useState<Column>("hour")
  const [segment, setSegment] = useState<Drum | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [dialId, setDialId] = useState(DEFAULT_DIAL_ID)
  const [hiddenDialIds, setHiddenDialIds] = useState<string[]>([])
  const [dialsEditing, setDialsEditing] = useState(false)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const openRef = useRef(open)
  openRef.current = open
  const columnRef = useRef(column)
  columnRef.current = column
  const segmentRef = useRef(segment)
  segmentRef.current = segment
  const textRef = useRef<string | null>(null)

  /** In-popup time. Confirm is what writes it, except Now, which commits at once. */
  const setDraftTime = (next: string) => {
    draftRef.current = next
    setDraft(next)
  }

  const publish = (next: string) => {
    setDraftTime(next)
    if (next !== valueRef.current) onChangeRef.current(next)
    valueRef.current = next
  }

  const commitTyped = (raw: string) => {
    const trimmed = raw.trim()
    textRef.current = null
    setText(null)
    if (!trimmed) {
      if (valueRef.current !== "") onChangeRef.current("")
      valueRef.current = ""
      return ""
    }
    const parsed = parseTypedClock(trimmed)
    if (!parsed) return valueRef.current
    if (parsed !== valueRef.current) onChangeRef.current(parsed)
    valueRef.current = parsed
    return parsed
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
      setDraftTime(joinClock(n, current.minute, current.period))
      return
    }
    if (n < 0 || n > 59) return
    setDraftTime(joinClock(current.hour, n, current.period))
  }

  const close = (reason: "commit" | "cancel") => {
    if (!openRef.current) return
    openRef.current = false
    if (reason === "commit") {
      applySegment()
      const next = draftRef.current
      if (next !== valueRef.current) onChangeRef.current(next)
      valueRef.current = next
    } else {
      segmentRef.current = null
      setSegment(null)
      const shown = valueRef.current || "08:00"
      draftRef.current = shown
      setDraft(shown)
    }
    hourBuf.current = ""
    minuteBuf.current = ""
    setDialsEditing(false)
    setOpen(false)
    onOpenChangeRef.current?.(false)
    onDismissRef.current?.(reason)
  }

  const openPanel = () => {
    if (disabled || readOnly || openRef.current) return
    const next = valueRef.current || "08:00"
    setDraft(next)
    draftRef.current = next
    setColumn("hour")
    columnRef.current = "hour"
    setSegment(null)
    segmentRef.current = null
    hourBuf.current = ""
    minuteBuf.current = ""
    setOpen(true)
    openRef.current = true
    onOpenChangeRef.current?.(true)
  }

  const applyNow = () => {
    const now = new Date()
    publish(stamp(now.getHours(), now.getMinutes()))
  }

  useEffect(() => {
    if (openRef.current) return
    if (value) setDraft(value)
  }, [value])

  useEffect(() => {
    const hiddenIds = readHiddenDialIds()
    const visible = visibleDials(clockDials(), hiddenIds).map((dial) => dial.id)
    setHiddenDialIds(hiddenIds)
    setDialId(readSelectedDialId(visible))
  }, [])

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
    setDraftTime(next)
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
    if (column === "hour") setDraftTime(joinClock(wrapHour(parts.hour, delta), parts.minute, parts.period))
    else if (column === "minute") setDraftTime(joinClock(parts.hour, wrapMinute(parts.minute, delta), parts.period))
    else setDraftTime(joinClock(parts.hour, parts.minute, parts.period === "AM" ? "PM" : "AM"))
  }

  const typeOpen = (key: string) => {
    if (segmentRef.current) return
    const lower = key.toLowerCase()
    if (lower === "a" || lower === "p") {
      setDraftTime(joinClock(parts.hour, parts.minute, lower === "p" ? "PM" : "AM"))
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
          setDraftTime(joinClock(digit, parts.minute, parts.period))
          setColumn("minute")
        } else hourBuf.current = key
        return
      }
      const first = hourBuf.current
      const combined = Number(first + key)
      hourBuf.current = ""
      if (combined >= 1 && combined <= 12) {
        setDraftTime(joinClock(combined, parts.minute, parts.period))
        setColumn("minute")
      } else {
        setDraftTime(joinClock(Number(first), parts.minute, parts.period))
        setColumn("minute")
        minuteBuf.current = key
      }
      return
    }
    if (minuteBuf.current === "") {
      if (digit >= 6) {
        setDraftTime(joinClock(parts.hour, digit, parts.period))
        minuteBuf.current = ""
        setColumn("period")
      } else minuteBuf.current = key
      return
    }
    const minute = Number(minuteBuf.current + key)
    minuteBuf.current = ""
    if (minute <= 59) setDraftTime(joinClock(parts.hour, minute, parts.period))
    setColumn("period")
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
      close("cancel")
    }
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return
    if (!openRef.current) {
      if (event.key === "Enter") {
        event.preventDefault()
        commitTyped(event.currentTarget.value)
      } else if (event.key === "Escape" && textRef.current !== null) {
        event.preventDefault()
        textRef.current = null
        setText(null)
      }
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      close("cancel")
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      event.stopPropagation()
      close("commit")
      return
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault()
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
      nudge(event.key === "ArrowDown" ? 1 : -1)
      return
    }
    if (event.key.length === 1 && /[0-9:.apm ]/i.test(event.key)) {
      event.preventDefault()
      typeOpen(event.key)
    }
  }

  const face = formatClockFace(open ? draft : value) || (value ? "" : placeholder)
  const dials = clockDials()
  const shownDials = visibleDials(dials, hiddenDialIds)
  const dial = shownDials.find((item) => item.id === dialId) ?? shownDials[0]
  const ceramicSrc = (dials.find((item) => item.id === DEFAULT_DIAL_ID) ?? dials[0]).src

  const chooseDial = (id: string) => {
    setDialId(id)
    writeSelectedDialId(id)
  }

  const shuffleDial = () => {
    const pool = shownDials.filter((item) => item.id !== dial.id)
    if (pool.length === 0) return
    chooseDial(pool[Math.floor(Math.random() * pool.length)].id)
  }

  const setDialShown = (id: string, shown: boolean) => {
    if (id === DEFAULT_DIAL_ID) return
    const next = shown ? hiddenDialIds.filter((item) => item !== id) : [...hiddenDialIds, id]
    setHiddenDialIds(next)
    writeHiddenDialIds(next)
    if (!shown && dialId === id) chooseDial(DEFAULT_DIAL_ID)
  }

  const holdFocus = (event: ReactPointerEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest("button, input, select, label, .clock-picker-analog, .clock-picker-dials, .clock-picker-dial-edit")) {
      event.stopPropagation()
      return
    }
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

  const openLabel = ariaLabel ? `Open ${ariaLabel} clock` : "Open clock"

  const panel =
    open && pos
      ? createPortal(
          <DismissableLayerBranch
            className="clock-picker-layer"
            data-testid="clock-picker-layer"
            style={{ zIndex: LAYER_Z, pointerEvents: "auto" }}
          >
            <div
              className="clock-picker-backdrop"
              data-testid="clock-picker-backdrop"
              style={{ pointerEvents: "auto" }}
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                close("cancel")
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
            />
            <DismissableLayer
              ref={panelRef}
              id={panelId}
              className="clock-picker-panel"
              style={{ top: pos.top, left: pos.left, zIndex: LAYER_Z + 1, pointerEvents: "auto" }}
              role="group"
              aria-label="Choose time"
              onPointerDown={holdFocus}
              onEscapeKeyDown={(event) => {
                event.preventDefault()
                close("cancel")
              }}
              onPointerDownOutside={(event) => {
                const target = event.target as Node | null
                if (target && rootRef.current?.contains(target)) return
                event.preventDefault()
                close("cancel")
              }}
              onInteractOutside={(event) => {
                event.preventDefault()
              }}
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
                    setDraftTime(joinClock(hour, current.minute, current.period))
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
                    setDraftTime(joinClock(current.hour, minute, current.period))
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
                        data-no95
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
                          setDraftTime(joinClock(current.hour, current.minute, period))
                        }}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" className="clock-picker-now" data-no95 aria-label="Now" onClick={applyNow}>
                <span className="clock-picker-lamp" aria-hidden />
                Now
              </button>
              <AnalogFace
                hour={parts.hour}
                minute={parts.minute}
                period={parts.period}
                dialId={dial.id}
                ceramicSrc={ceramicSrc}
                painting={dial.placement === "center" ? dial.src : null}
              />
              <div className="clock-picker-dials">
                <select
                  className="clock-picker-dial"
                  aria-label="Dial"
                  value={dial.id}
                  onChange={(event) => chooseDial(event.target.value)}
                >
                  {shownDials.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="clock-picker-mini"
                  data-no95
                  aria-label="Shuffle"
                  disabled={shownDials.length < 2}
                  onClick={shuffleDial}
                >
                  Shuffle
                </button>
                <button
                  type="button"
                  className="clock-picker-mini"
                  data-no95
                  aria-expanded={dialsEditing}
                  onClick={() => setDialsEditing((current) => !current)}
                >
                  Edit
                </button>
              </div>
              {dialsEditing ? (
                <div className="clock-picker-dial-edit" role="group" aria-label="Paintings">
                  {dials.map((item) => (
                    <label key={item.id} className="clock-picker-dial-line">
                      <input
                        type="checkbox"
                        checked={item.id === DEFAULT_DIAL_ID || !hiddenDialIds.includes(item.id)}
                        disabled={item.id === DEFAULT_DIAL_ID}
                        onChange={(event) => setDialShown(item.id, event.target.checked)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              ) : null}
              <div className="clock-picker-actions">
                <button type="button" className="clock-picker-confirm" data-no95 onClick={() => close("commit")}>
                  Confirm
                </button>
                <button type="button" className="clock-picker-cancel" data-no95 onClick={() => close("cancel")}>
                  Cancel
                </button>
              </div>
            </DismissableLayer>
          </DismissableLayerBranch>,
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
      data-editing={text !== null ? "true" : undefined}
      data-armed={armed ? column : undefined}
      data-face={face}
      data-empty={formatClockFace(open ? draft : value) ? undefined : "true"}
    >
      <input
        ref={inputRef}
        id={id}
        name={name}
        className="clock-picker-field"
        type="text"
        inputMode="text"
        role="combobox"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        disabled={disabled}
        readOnly={readOnly}
        title={title ?? (formatClockFace(open ? draft : value) || undefined)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-autocomplete="none"
        value={text !== null ? text : value}
        onFocus={() => {
          if (disabled || readOnly || openRef.current || textRef.current !== null) return
          const next = formatClockFace(valueRef.current) || valueRef.current
          textRef.current = next
          setText(next)
        }}
        onChange={(event) => {
          const next = event.target.value
          const editing = textRef.current !== null || document.activeElement === inputRef.current
          if (!editing) {
            if (next === "") {
              onChangeRef.current("")
              valueRef.current = ""
              return
            }
            const parsed = parseTypedClock(next)
            if (parsed) {
              onChangeRef.current(parsed)
              valueRef.current = parsed
            }
            return
          }
          textRef.current = next
          setText(next)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (openRef.current) return
          if (textRef.current === null) return
          commitTyped(textRef.current)
        }}
      />
      <button
        type="button"
        className="clock-picker-open"
        data-no95
        tabIndex={-1}
        aria-label={openLabel}
        aria-expanded={open}
        disabled={disabled || readOnly}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (disabled || readOnly) return
          if (textRef.current !== null) commitTyped(inputRef.current?.value ?? textRef.current)
          if (openRef.current) close("cancel")
          else openPanel()
        }}
      >
        <ClockMark />
      </button>
      {panel}
    </span>
  )
}

function ClockMark() {
  return (
    <svg className="clock-picker-mark" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 8.2 V4.7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M8 8.2 L10.5 9.6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
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
              data-no95
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

/** Minute hand: slim pierced stem, pointed tip, short tail. Drawn pointing at 12. */
const MINUTE_HAND =
  "M60 11 L61.15 19 L60.95 34 L63.4 39 C67.6 43.5 68.2 52.5 64.4 56.8 C62.6 58.8 61.7 57.4 61.45 55.4 L61.2 64 L60.65 74.5 L59.35 74.5 L58.8 64 L58.55 55.4 C58.3 57.4 57.4 58.8 55.6 56.8 C51.8 52.5 52.4 43.5 56.6 39 L59.05 34 L58.85 19 Z M60 48.6 m-1.25 0 a1.25 2.05 0 1 0 2.5 0 a1.25 2.05 0 1 0 -2.5 0 Z M55.7 52.6 m-1.45 0 a1.45 1.7 0 1 0 2.9 0 a1.45 1.7 0 1 0 -2.9 0 Z M64.3 52.6 m-1.45 0 a1.45 1.7 0 1 0 2.9 0 a1.45 1.7 0 1 0 -2.9 0 Z"

/** Hour hand: shorter neck, openwork club near the tip. Drawn pointing at 12. */
const HOUR_HAND =
  "M60 24.5 L62.6 31.5 C68.2 32.2 71.4 38.2 67.8 43.2 C65.4 46.4 62.4 44.6 61.35 41.4 L61.15 58 L58.85 58 L58.65 41.4 C57.6 44.6 54.6 46.4 52.2 43.2 C48.6 38.2 51.8 32.2 57.4 31.5 Z M60 33.4 m-1.55 0 a1.55 1.55 0 1 0 3.1 0 a1.55 1.55 0 1 0 -3.1 0 Z M55.15 39.1 m-1.4 0 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0 Z M64.85 39.1 m-1.4 0 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0 Z"

function AnalogFace({
  hour,
  minute,
  period,
  dialId,
  ceramicSrc,
  painting,
}: {
  hour: number
  minute: number
  period: Period
  dialId: string
  ceramicSrc: string
  painting: string | null
}) {
  const minuteAngle = minute * 6
  const hourAngle = (hour % 12) * 30 + minute * 0.5
  const uid = useId().replace(/:/g, "")
  const silver = `silver-${uid}`
  const brass = `brass-${uid}`
  const shade = `shade-${uid}`
  const label = `${pad(hour)}:${pad(minute)} ${period}`
  return (
    <div
      className="clock-picker-analog"
      role="img"
      aria-label={label}
      data-hour={hour}
      data-minute={minute}
      data-period={period}
      data-dial={dialId}
    >
      <img className="clock-picker-face" src={ceramicSrc} alt="" draggable={false} />
      {painting ? (
        <div className="clock-picker-well">
          <img className="clock-picker-painting" src={painting} alt="" draggable={false} />
        </div>
      ) : null}
      <svg
        className="clock-picker-hands"
        viewBox="0 0 120 120"
        aria-hidden="true"
        data-hour-angle={hourAngle}
        data-minute-angle={minuteAngle}
      >
        <defs>
          <linearGradient id={silver} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbfcfd" />
            <stop offset="42%" stopColor="#d5d9de" />
            <stop offset="100%" stopColor="#8e959c" />
          </linearGradient>
          <radialGradient id={brass} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff1c9" />
            <stop offset="45%" stopColor="#e0b85a" />
            <stop offset="100%" stopColor="#7a5a22" />
          </radialGradient>
          <filter id={shade} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0.4" stdDeviation="0.45" floodColor="#2c261c" floodOpacity="0.4" />
          </filter>
        </defs>
        <g data-hand="minute" data-angle={minuteAngle} transform={`rotate(${minuteAngle} 60 60)`} filter={`url(#${shade})`}>
          <path d={MINUTE_HAND} fill={`url(#${silver})`} fillRule="evenodd" stroke="#6a7076" strokeWidth="0.45" />
        </g>
        <g data-hand="hour" data-angle={hourAngle} transform={`rotate(${hourAngle} 60 60)`} filter={`url(#${shade})`}>
          <path d={HOUR_HAND} fill={`url(#${silver})`} fillRule="evenodd" stroke="#6a7076" strokeWidth="0.45" />
        </g>
        <circle cx="60" cy="60" r="4.15" fill="#5c4318" />
        <circle cx="60" cy="60" r="3.35" fill={`url(#${brass})`} />
        <circle cx="58.9" cy="58.7" r="0.9" fill="#fff6d8" opacity="0.9" />
      </svg>
    </div>
  )
}
