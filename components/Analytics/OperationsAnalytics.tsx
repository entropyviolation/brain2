/**
 * components/Analytics/OperationsAnalytics.tsx — Stage mosaic + work/neglect heat
 *
 * Reads operation items. Does not restyle the Operations module interior.
 */
"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { buildHeatmap, isOperation } from "@/lib/operations"
import { getOperationCategories, OPERATION_ATTR } from "@/lib/operation-types"
import { parseLocalDate } from "@/lib/date-utils"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SliceMosaic, StudioReadout } from "./studio-kit"

const STAGE_COLOR: Record<string, string> = {
  planning: "#64748b",
  active: "#34d399",
  paused: "#fbbf24",
  done: "#60a5fa",
  abandoned: "#f87171",
}

export function OperationsAnalytics() {
  const tasks = useTaskStore((s) => s.tasks)
  const operationReviews = useReviewsStore((s) => s.operationReviews)
  const { dateKeys, label } = useAnalyticsRange()

  const ops = useMemo(() => tasks.filter((t) => isOperation(t)), [tasks])
  const start = parseLocalDate(dateKeys[0] ?? "") ?? new Date()
  const end = parseLocalDate(dateKeys[dateKeys.length - 1] ?? "") ?? new Date()

  const heat = useMemo(
    () => (dateKeys.length ? buildHeatmap(ops, { start, end, days: dateKeys.length }) : []),
    [ops, start, end, dateKeys.length],
  )

  const stages = useMemo(() => {
    const counts = new Map<string, number>()
    for (const op of ops) {
      const stage = String(op.attributes?.[OPERATION_ATTR.stage] ?? "planning")
      counts.set(stage, (counts.get(stage) ?? 0) + 1)
    }
    return [...counts.entries()].map(([id, minutes]) => ({
      id,
      name: id,
      color: STAGE_COLOR[id] ?? "#64748b",
      minutes,
      label: String(minutes),
    }))
  }, [ops])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const op of ops) {
      const cats = getOperationCategories(op)
      if (cats.length === 0) counts.set("uncategorized", (counts.get("uncategorized") ?? 0) + 1)
      for (const c of cats) counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    return [...counts.entries()].map(([id, minutes]) => ({
      id,
      name: id,
      color: "#5eead4",
      minutes,
      label: String(minutes),
    }))
  }, [ops])

  const rated = operationReviews.filter((r) => r.ratings && Object.keys(r.ratings).length > 0)

  return (
    <div className="an-canvas an-stack" data-testid="operations-analytics">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Operations</p>
          <p className="an-canvas-kicker">{label} · stage / category mosaic and work vs neglect from timeLogs.</p>
        </div>
      </header>
      {ops.length === 0 ? (
        <ChartFrame empty emptySentence="No operations yet." />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout label="Operations" value={ops.length} />
            <StudioReadout label="Reviews" value={operationReviews.length} />
            <StudioReadout label="Rated" value={rated.length} />
          </div>
          <p className="an-canvas-title">Stage</p>
          <SliceMosaic slices={stages} max={Math.max(...stages.map((s) => s.minutes), 1)} />
          {categories.length > 0 && (
            <>
              <p className="an-canvas-title">Categories</p>
              <SliceMosaic slices={categories} max={Math.max(...categories.map((s) => s.minutes), 1)} />
            </>
          )}
          {heat.some((c) => c.minutes > 0) ? (
            <div
              className="an-density-cells"
              style={{ ["--an-cols" as string]: String(Math.max(heat.length, 1)) }}
              role="img"
              aria-label="Operations work minutes by day"
            >
              {heat.map((cell) => (
                <span
                  key={cell.date}
                  className="an-density-cell"
                  title={`${cell.date}: ${cell.minutes}m`}
                  style={{
                    background:
                      cell.minutes <= 0
                        ? "#b0b0b0"
                        : `hsl(312 ${30 + cell.level * 12}% ${16 + cell.level * 10}%)`,
                  }}
                />
              ))}
            </div>
          ) : (
            <ChartFrame empty emptySentence={`No operation timeLogs in the ${label}.`} />
          )}
          <OpenInListsButton taskIds={ops.map((t) => t.id)} />
        </>
      )}
    </div>
  )
}
