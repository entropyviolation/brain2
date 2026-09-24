/**
 * components/Home/Plan/plan-chip.tsx — Calendar event/task chips
 *
 * Time range + wrapping title. Overflow is `+N more` with a native tooltip of
 * the hidden rows. Color is a left stripe plus an opalescent wash — not a
 * marketing pill. Default mint is `CalendarEvent.color` (`#8cd4a5`).
 */
"use client"

import { format } from "date-fns"
import type { CalendarEvent } from "@/lib/types"
import { isMultiDayEvent } from "@/lib/event-links"
import { orbFor } from "@/components/Icons/Icon"

export const PLAN_MONTH_CHIP_LIMIT = 3
export const PLAN_WEEK_ALLDAY_LIMIT = 2

/** Default event wash — mint, never orange. Persisted on `CalendarEvent.color`. */
export const PLAN_DEFAULT_EVENT_COLOR = "#8cd4a5"
/** Scheduled-task wash — sage from the old Plan family. */
export const PLAN_TASK_COLOR = "#5f756d"
/** Green / violet / teal family the old calendar used. */
export const PLAN_COLOR_PRESETS = [
  { color: "#8cd4a5", label: "Mint" },
  { color: "#9fc2a5", label: "Sage" },
  { color: "#7eb8b2", label: "Teal" },
  { color: "#5f756d", label: "Moss" },
  { color: "#b89fbf", label: "Lilac" },
  { color: "#8b7ecc", label: "Violet" },
] as const

/** Old parser default for SHOW — peach. Not the house accent. */
const LEGACY_ORANGE_DEFAULTS = new Set(["#e89b6c"])

export function resolvePlanColor(color?: string): string {
  if (color && LEGACY_ORANGE_DEFAULTS.has(color.toLowerCase())) return "#7eb8b2"
  return color && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : PLAN_DEFAULT_EVENT_COLOR
}

export function planEventTimeLabel(event: CalendarEvent): string {
  if (event.isAllDay || isMultiDayEvent(event)) {
    if (isMultiDayEvent(event) && event.endDate) {
      return `${format(event.date, "MMM d")} – ${format(event.endDate, "MMM d")}`
    }
    return "All day"
  }
  if (!event.startTime) return ""
  if (!event.endTime || event.endTime === event.startTime) return event.startTime
  return `${event.startTime}–${event.endTime}`
}

export function planChipTooltip(timeLabel: string, title: string, extra?: string): string {
  const head = timeLabel ? `${timeLabel}  ${title}` : title
  return extra ? `${head} · ${extra}` : head
}

export function PlanChip({
  timeLabel,
  title,
  color,
  tooltip,
  onClick,
  jewel = false,
  kind,
}: {
  timeLabel: string
  title: string
  color?: string
  tooltip: string
  onClick: () => void
  jewel?: boolean
  kind?: "planned"
}) {
  return (
    <button
      type="button"
      className="plan-chip"
      data-kind={kind}
      title={tooltip}
      style={{ ["--plan-chip-color" as string]: resolvePlanColor(color) }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {timeLabel ? <span className="plan-chip-time">{timeLabel} </span> : null}
      <span className="plan-chip-title">
        {jewel ? <img src={orbFor(`plan-banner-${title}`)} alt="" className="plan-chip-orb" /> : null}
        {title}
      </span>
    </button>
  )
}

export function PlanMore({
  hidden,
}: {
  hidden: { timeLabel: string; title: string }[]
}) {
  if (hidden.length === 0) return null
  const tip = hidden.map((row) => planChipTooltip(row.timeLabel, row.title)).join("\n")
  return (
    <div className="plan-more" title={tip}>
      <img src={orbFor("plan-more")} alt="" className="plan-more-orb" />
      +{hidden.length} more
    </div>
  )
}
