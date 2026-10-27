/**
 * components/Analytics/TodoPulseView.tsx — Morning to-do walkthrough metrics
 *
 * Tier, expected duration, points, day importance, resistance series, and
 * day excitement from the morning “Go through to do list” step (and any later
 * edits to those fields). Labels explain each number.
 */
"use client"

import { useMemo } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts"
import { useTaskStore } from "@/lib/task-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { getTierFromTask } from "@/components/Home/ToDo/todo-utils"
import { parseLocalDate, formatLocalDateKey } from "@/lib/date-utils"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP } from "./studio-kit"

const FIELD_HELP = {
  tier: "Priority band on the to-do (A+ … D). Maps to urgency/importance on the item.",
  duration: "Expected duration in minutes — how long you think the item will take.",
  points: "Reward points awarded when the item is completed.",
  importance: "How important this item is today (0–10). Set per day in the morning walkthrough.",
  resistance: "How hard it feels to start (0–10). Can be recorded many times; each reading keeps its time.",
  excitement: "How excited you are about this item today (0–10).",
} as const

export function TodoPulseView() {
  const tasks = useTaskStore((s) => s.tasks)
  const reviews = useReviewsStore((s) => s.reviews)
  const range = useAnalyticsRange()

  const pulsed = useMemo(() => {
    return tasks
      .filter((t) => {
        const hasDay = Object.keys(t.dayRatings ?? {}).some((k) => range.keySet.has(k))
        const hasRes = (t.resistanceReadings ?? []).some((r) => {
          const d = parseLocalDate(r.at) ?? new Date(r.at)
          return range.keySet.has(formatLocalDateKey(d))
        })
        return hasDay || hasRes || t.estimatedDuration != null || t.rewardValue != null
      })
      .slice(0, 40)
  }, [tasks, range.keySet])

  const resistanceSeries = useMemo(() => {
    const points: { label: string; resistance: number; title: string; source?: string }[] = []
    for (const t of tasks) {
      for (const r of t.resistanceReadings ?? []) {
        const d = parseLocalDate(r.at) ?? new Date(r.at)
        const key = formatLocalDateKey(d)
        if (!range.keySet.has(key)) continue
        points.push({
          label: d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
          resistance: r.value,
          title: itemTitleOrUntitled(t),
          source: r.source,
        })
      }
    }
    return points.sort((a, b) => a.label.localeCompare(b.label))
  }, [tasks, range.keySet])

  const dayImportanceAvg = useMemo(() => {
    const byDay = new Map<string, number[]>()
    for (const t of tasks) {
      for (const [day, rating] of Object.entries(t.dayRatings ?? {})) {
        if (!range.keySet.has(day)) continue
        if (rating.importance == null) continue
        const arr = byDay.get(day) ?? []
        arr.push(rating.importance)
        byDay.set(day, arr)
      }
    }
    return range.dateKeys
      .filter((k) => byDay.has(k))
      .map((key) => {
        const vals = byDay.get(key)!
        const d = parseLocalDate(key) ?? new Date()
        return {
          label: d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
          importance: vals.reduce((a, b) => a + b, 0) / vals.length,
          excitement:
            (() => {
              const ex: number[] = []
              for (const t of tasks) {
                const e = t.dayRatings?.[key]?.excitement
                if (e != null) ex.push(e)
              }
              return ex.length ? ex.reduce((a, b) => a + b, 0) / ex.length : null
            })(),
        }
      })
  }, [tasks, range.dateKeys, range.keySet])

  const morningSources = useMemo(() => {
    let telegram = 0
    let desktop = 0
    for (const r of reviews) {
      if (r.period !== "day" || !r.morning || !range.keySet.has(r.periodKey)) continue
      if (r.morning.source === "telegram") telegram++
      else if (r.morning.source === "desktop") desktop++
    }
    return { telegram, desktop }
  }, [reviews, range.keySet])

  const hasAnything =
    pulsed.length > 0 || resistanceSeries.length > 0 || dayImportanceAvg.length > 0

  if (!hasAnything) {
    return (
      <div className="an-canvas an-stack">
        <ChartFrame
          empty
          emptySentence={`No to-do pulse yet in the ${range.label}. Complete a morning review walkthrough (desktop or text gm) to record tier, duration, points, importance, resistance, and excitement.`}
        />
      </div>
    )
  }

  return (
    <div className="an-canvas an-stack">
      <div className="rounded-md border border-dashed p-3 space-y-2 text-sm">
        <p className="an-canvas-title" style={{ margin: 0 }}>
          What each number means
        </p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {(Object.entries(FIELD_HELP) as [keyof typeof FIELD_HELP, string][]).map(([k, text]) => (
            <li key={k}>
              <strong className="text-foreground capitalize">{k}</strong> — {text}
            </li>
          ))}
        </ul>
        {(morningSources.telegram > 0 || morningSources.desktop > 0) && (
          <p className="text-xs text-muted-foreground">
            Morning reviews in this window:{" "}
            {morningSources.telegram > 0 && (
              <span>
                {morningSources.telegram} from text pipeline (BIM)
                {morningSources.desktop > 0 ? " · " : ""}
              </span>
            )}
            {morningSources.desktop > 0 && <span>{morningSources.desktop} desktop</span>}
          </p>
        )}
      </div>

      {dayImportanceAvg.length > 0 && (
        <div>
          <p className="an-canvas-title">Day importance &amp; excitement (averages)</p>
          <p className="an-canvas-kicker">
            Mean of that day&apos;s per-item morning ratings (0–10). Importance = how much it matters today;
            excitement = how pumped you are.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dayImportanceAvg}>
              <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} />
              <YAxis domain={[0, 10]} fontSize={11} stroke={STUDIO_AXIS} />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              <Bar dataKey="importance" name="Importance (today)" fill="#60a5fa" />
              <Bar dataKey="excitement" name="Excitement (today)" fill="#34d399" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {resistanceSeries.length > 0 && (
        <div>
          <p className="an-canvas-title">Resistance over time</p>
          <p className="an-canvas-kicker">
            Each point is one reading (0–10). Resistance can be logged again and again — this is a series, not a
            single lifetime value.
            {resistanceSeries.some((p) => p.source?.includes("telegram"))
              ? " Readings from the text morning review are labeled morning-telegram."
              : ""}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={resistanceSeries}>
              <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} />
              <YAxis domain={[0, 10]} fontSize={11} stroke={STUDIO_AXIS} />
              <Tooltip
                contentStyle={STUDIO_TOOLTIP}
                formatter={(value: number) => [value, "Resistance"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as (typeof resistanceSeries)[0] | undefined
                  return row ? `${row.title}${row.source ? ` · ${row.source}` : ""}` : ""
                }}
              />
              <Line type="monotone" dataKey="resistance" stroke="#f87171" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <p className="an-canvas-title">Items with pulse fields</p>
        <p className="an-canvas-kicker">
          Tier, expected duration, and points live on the item anytime; importance / excitement are per day;
          resistance is the full reading history.
        </p>
        <ul className="an-list">
          {pulsed.map((t) => {
            const ratingsInRange = Object.entries(t.dayRatings ?? {}).filter(([k]) => range.keySet.has(k))
            const latestDay = ratingsInRange.sort(([a], [b]) => b.localeCompare(a))[0]
            const resCount = t.resistanceReadings?.length ?? 0
            return (
              <li key={t.id}>
                <div className="flex flex-col gap-0.5 w-full">
                  <span className="truncate font-medium">{itemTitleOrUntitled(t)}</span>
                  <span className="text-xs text-muted-foreground">
                    Tier {getTierFromTask(t)}
                    {t.estimatedDuration != null ? ` · ${t.estimatedDuration} min expected` : ""}
                    {t.rewardValue != null ? ` · ${t.rewardValue} points` : ""}
                    {latestDay
                      ? ` · importance ${latestDay[1].importance ?? "—"} / excitement ${latestDay[1].excitement ?? "—"} (${latestDay[0]})`
                      : ""}
                    {resCount > 0 ? ` · ${resCount} resistance reading${resCount === 1 ? "" : "s"}` : ""}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
