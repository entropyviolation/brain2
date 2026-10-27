/**
 * components/Home/Habits/habit-sort-control.tsx — Sort on the Priority bar
 *
 * A visible SORT: label, a milled `habit95-select` (not a native OS popup),
 * and one direction key. The list portals to the document on the shared menu
 * layer, so the sheet, its frozen header, and the lamps cannot cover it.
 * Daily names the completion key Weekly completion %. Weekly, monthly, and
 * season name it Period completion %. The key stores asc / desc. Its mark
 * shows which of those is active.
 */
"use client"

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MENU_LAYER_Z } from "@/components/ui/menu-layer"
import {
  effectiveSortDescending,
  HABIT_SORT_LABELS,
  HABIT_SORT_MODES,
  type HabitSortMode,
} from "@/lib/habit-sort"
import type { HabitFrequency } from "@/lib/types"

/** Daily sorts by week percent. Weekly, monthly, and season sort by the period on screen. */
export function habitCompletionSortLabel(frequency: HabitFrequency): string {
  return frequency === "daily" ? "Weekly completion %" : "Period completion %"
}

/**
 * Names for the stored asc / desc pair. The click still writes that direction.
 * Completion % and priority compare a number. Alphabetical is A→Z / Z→A.
 * Date created asc is oldest. Default asc is the store array.
 */
export function habitSortDirectionLabels(mode: HabitSortMode): { asc: string; desc: string } {
  switch (mode) {
    case "alphabetical":
      return { asc: "A → Z", desc: "Z → A" }
    case "created":
      return { asc: "Oldest first", desc: "Newest first" }
    case "weeklyCompletion":
    case "priority":
      return { asc: "Low first", desc: "High first" }
    case "default":
      return { asc: "As stored", desc: "Reversed" }
  }
}

function frequencyOnPlate(frequency: HabitFrequency | undefined, id: string): HabitFrequency {
  if (frequency) return frequency
  if (id.includes("weekly")) return "weekly"
  if (id.includes("monthly")) return "monthly"
  if (id.includes("season") || id.includes("quarter")) return "quarterly"
  return "daily"
}

export function HabitSortControl({
  value,
  direction,
  onChange,
  onDirection,
  id = "habit-sort",
  frequency,
}: {
  value: HabitSortMode
  direction: "asc" | "desc" | null
  onChange: (mode: HabitSortMode) => void
  onDirection: (direction: "asc" | "desc") => void
  id?: string
  /** Habit sheet. Daily keeps the week percent; the other sheets name the period on screen. */
  frequency?: HabitFrequency
  /**
   * Ignored. A view-mode label cannot rename this key.
   * The name comes from `frequency` (or the sort id until that is passed).
   */
  completionLabel?: string
}) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const descending = effectiveSortDescending(value, direction)
  const completionLabel = habitCompletionSortLabel(frequencyOnPlate(frequency, id))
  const directionLabels = habitSortDirectionLabels(value)
  const valueLabel = value === "weeklyCompletion" ? completionLabel : HABIT_SORT_LABELS[value]
  const activeName = descending ? directionLabels.desc : directionLabels.asc
  const optionLabels = useMemo(
    () =>
      HABIT_SORT_MODES.map((mode) => (mode === "weeklyCompletion" ? completionLabel : HABIT_SORT_LABELS[mode])),
    [completionLabel],
  )

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const button = buttonRef.current
      if (!button) return
      const rect = button.getBoundingClientRect()
      const probe = document.createElement("span")
      const font = getComputedStyle(button).font
      probe.style.cssText =
        "position:fixed;left:0;top:0;visibility:hidden;white-space:nowrap;padding:3px 6px"
      probe.style.font = font
      document.body.append(probe)
      let width = rect.width
      for (const label of optionLabels) {
        probe.textContent = label
        width = Math.max(width, probe.offsetWidth)
      }
      probe.remove()
      const next = { top: rect.bottom, left: rect.left, width: Math.ceil(width + 8) }
      setBox((current) =>
        current && current.top === next.top && current.left === next.left && current.width === next.width
          ? current
          : next,
      )
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open, optionLabels])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("mousedown", onPointer)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onPointer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="hab-priority-sort" id={id}>
      <span className="hab-priority-sort-legend">SORT:</span>
      <div className="habit95-pick" ref={rootRef}>
        <button
          ref={buttonRef}
          type="button"
          className="habit95-select"
          aria-label="Sort"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="habit95-select-label">{valueLabel}</span>
          <span className="habit95-select-arrow" aria-hidden />
        </button>
        {open && box
          ? createPortal(
              <div
                className="hab-priority"
                data-menu-layer=""
                style={{
                  position: "fixed",
                  top: box.top,
                  left: box.left,
                  width: box.width,
                  height: 0,
                  margin: 0,
                  padding: 0,
                  gap: 0,
                  display: "block",
                  border: 0,
                  background: "transparent",
                  boxShadow: "none",
                  overflow: "visible",
                  zIndex: MENU_LAYER_Z,
                  pointerEvents: "none",
                }}
              >
                <div
                  ref={menuRef}
                  className="habit95-select-menu"
                  id={menuId}
                  role="listbox"
                  aria-label="Sort"
                  style={{ pointerEvents: "auto", zIndex: MENU_LAYER_Z, whiteSpace: "nowrap" }}
                >
                  {HABIT_SORT_MODES.map((mode) => {
                    const label = mode === "weeklyCompletion" ? completionLabel : HABIT_SORT_LABELS[mode]
                    const selected = mode === value
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className="habit95-habit-option"
                        onClick={() => {
                          onChange(mode)
                          setOpen(false)
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
      <button
        type="button"
        className={`hab-priority-dir${descending ? " is-desc" : " is-asc"}`}
        aria-pressed={descending}
        aria-label={descending ? "Sort descending" : "Sort ascending"}
        title={activeName}
        onClick={() => onDirection(descending ? "asc" : "desc")}
      >
        <span aria-hidden>{descending ? "↓" : "↑"}</span>
      </button>
    </div>
  )
}
