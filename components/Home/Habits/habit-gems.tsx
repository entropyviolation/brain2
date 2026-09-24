/**
 * components/Home/Habits/habit-gems.tsx — Photographed gems for Daily habits
 *
 * Cabinet contents from `gems/` (processed to `public/gems-removebackground/`).
 * Slots persist on `cogs-habits-store.habitGems`. Sparkline stays an honest SVG.
 */
"use client"

import { memo, useId } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { useHabitsStore } from "@/lib/habits-store"
import { type HabitGemSlot, resolveHabitGem, resolveTaskGem } from "@/lib/habit-gems"

/** Catalog stones are 200–800KB photos shown at 18px — decode off the UI thread. */
export function HabitGemImg({
  src,
  className,
  title,
  width = 18,
  height = 18,
  inverted = false,
}: {
  src: string
  className?: string
  title?: string
  width?: number
  height?: number
  inverted?: boolean
}) {
  return (
    <img
      src={src}
      alt=""
      title={title}
      width={width}
      height={height}
      className={className}
      data-inverted={inverted ? "true" : undefined}
      aria-hidden={title ? undefined : true}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  )
}

function PhotoGem({
  slot,
  className,
  title,
}: {
  slot: HabitGemSlot
  className?: string
  title?: string
}) {
  const stored = useHabitsStore((s) => s.habitGems[slot])
  const src = resolveHabitGem(slot, stored)
  return <HabitGemImg src={src} className={className} title={title} />
}

/** Same cutout pipeline as type / edit / delete gems — cabinet object, not a sigil. */
export function HabitSlotGem({
  slot,
  className = "habit-gem",
  title,
}: {
  slot: HabitGemSlot
  className?: string
  title?: string
}) {
  return <PhotoGem slot={slot} className={className} title={title} />
}

export function HabitTypeGem({ type, className = "habit-gem" }: { type: TaskType; className?: string }) {
  switch (type) {
    case TaskType.BOOLEAN:
      return <PhotoGem slot="boolean" className={className} title="Yes/No habit" />
    case TaskType.GOAL:
    case TaskType.TIME:
    case TaskType.COUNT:
      return <PhotoGem slot="goal" className={className} title="Goal habit" />
    case TaskType.TEXT:
      return <PhotoGem slot="text" className={className} title="Text habit" />
    case TaskType.INCREMENTAL:
      return <PhotoGem slot="incremental" className={className} title="Climb habit" />
  }
}

export function EditGem({ className = "habit-gem" }: { className?: string }) {
  return <PhotoGem slot="edit" className={className} />
}

export function DeleteGem({ className = "habit-gem" }: { className?: string }) {
  return <PhotoGem slot="delete" className={className} />
}

/** Jewel on the row edit button: stored habit gem (random catalog or user pick). */
export const HabitRowGem = memo(function HabitRowGem({
  task,
  className = "habit-gem",
  inverted = false,
}: {
  task: Pick<WeeklyTask, "gem">
  className?: string
  inverted?: boolean
}) {
  const src = resolveTaskGem(task)
  return (
    <HabitGemImg
      src={src}
      className={`${className}${inverted ? " is-inverted" : ""}`}
      inverted={inverted}
    />
  )
})

/** Jewel set into the sheet metal — no dark disc, no raised button rectangle. */
export function HabitEditGemButton({
  task,
  onEdit,
  inverted = false,
}: {
  task: WeeklyTask
  onEdit: (task: WeeklyTask) => void
  inverted?: boolean
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" data-no95="" className="habit-gem-btn habit-gem-socket" onClick={() => onEdit(task)}>
            <span className="habit-gem-press">
              <HabitRowGem task={task} inverted={inverted} />
            </span>
            <span className="sr-only">Edit</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Edit Task</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function IssueGem({ className = "habit-gem-issue" }: { className?: string }) {
  return <PhotoGem slot="issue" className={className} />
}

/** Honest week sparkline: Tek-style phosphor field, one point per daily percent. */
export function HabitWeekSparkline({
  values,
  label,
}: {
  values: number[]
  label: string
}) {
  const gid = useId().replace(/:/g, "")
  const w = 200
  const h = 84
  const pad = 8
  const innerW = w - pad * 2
  const innerH = h - pad * 2
  const pts = values.length
    ? values.map((v, i) => {
        const x = pad + (i * innerW) / Math.max(values.length - 1, 1)
        const y = h - pad - (Math.min(100, Math.max(0, v)) / 100) * innerH
        return { x, y }
      })
    : []
  const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  const last = pts[pts.length - 1]
  const vLines = 8
  const hLines = 6

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="hab-sparkline"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <defs>
        <linearGradient id={`hab-crt-field-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#062a28" />
          <stop offset="1" stopColor="#031410" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#hab-crt-field-${gid})`} />
      {Array.from({ length: vLines + 1 }, (_, i) => {
        const x = pad + (i * innerW) / vLines
        return (
          <line
            key={`v${i}`}
            x1={x}
            x2={x}
            y1={pad}
            y2={h - pad}
            stroke="rgba(90, 255, 220, 0.16)"
            strokeWidth="0.7"
          />
        )
      })}
      {Array.from({ length: hLines + 1 }, (_, i) => {
        const y = pad + (i * innerH) / hLines
        return (
          <line
            key={`h${i}`}
            x1={pad}
            x2={w - pad}
            y1={y}
            y2={y}
            stroke="rgba(90, 255, 220, 0.16)"
            strokeWidth="0.7"
          />
        )
      })}
      {pts.length > 1 && (
        <polyline
          points={poly}
          fill="none"
          stroke="#2d8a58"
          strokeWidth="5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.42"
        />
      )}
      {pts.length > 1 && (
        <polyline
          points={poly}
          fill="none"
          stroke="#5cff9a"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {last && (
        <g className="hab-spark-crosshair">
          <line
            x1={last.x - 6}
            x2={last.x + 6}
            y1={last.y}
            y2={last.y}
            stroke="#e8c44a"
            strokeWidth="1.2"
          />
          <line
            x1={last.x}
            x2={last.x}
            y1={last.y - 6}
            y2={last.y + 6}
            stroke="#e8c44a"
            strokeWidth="1.2"
          />
          <circle cx={last.x} cy={last.y} r="1.6" fill="#5cff9a" />
        </g>
      )}
    </svg>
  )
}
