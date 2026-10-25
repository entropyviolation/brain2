/**
 * components/Analytics/TodoPulseView.tsx — Morning to-do walkthrough metrics
 *
 * Tier, expected duration, points, day importance, resistance series, and
 * day excitement from the morning “Go through to do list” step (and any later
 * edits to those fields). Labels explain each number.
 */
"use client"

import { useMemo, useState } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts"
import { useTaskStore } from "@/lib/task-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { getTierFromTask } from "@/components/Home/ToDo/todo-utils"
import { parseLocalDate, formatLocalDateKey } from "@/lib/date-utils"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import {
  CanvasTitle,
  STUDIO_AXIS,
  STUDIO_GRID,
  STUDIO_TOOLTIP,
  StudioBars,
  StudioCheck,
  StudioSelect,
} from "./studio-kit"
import { BEHAVIOR_FILL, BubblePlot, Fold, RangeField, SearchField, round1, useShowMore } from "./behavior-kit"

const TIERS = ["A+", "A", "B", "C", "D"] as const

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
    const points: {
      label: string
      at: number
      resistance: number
      title: string
      source?: string
    }[] = []
    for (const t of tasks) {
      for (const r of t.resistanceReadings ?? []) {
        const d = parseLocalDate(r.at) ?? new Date(r.at)
        const key = formatLocalDateKey(d)
        if (!range.keySet.has(key)) continue
        points.push({
          label: d.toLocaleDateString(undefined, {
            month: "numeric",
            day: "numeric",
          }),
          at: d.getTime(),
          resistance: r.value,
          title: itemTitleOrUntitled(t),
          source: r.source,
        })
      }
    }
    // Sort by time, not by the "M/D" label (string order put 10/3 before 9/30).
    return points.sort((a, b) => a.at - b.at)
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
          label: d.toLocaleDateString(undefined, {
            month: "numeric",
            day: "numeric",
          }),
          importance: vals.reduce((a, b) => a + b, 0) / vals.length,
          excitement: (() => {
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

  // Quadrant scatter: latest resistance (x) and excitement (y) per item, as of a day.
  const ratedDays = useMemo(() => {
    const days = new Set<string>()
    for (const t of tasks) {
      for (const k of Object.keys(t.dayRatings ?? {})) if (range.keySet.has(k)) days.add(k)
      for (const r of t.resistanceReadings ?? []) {
        const k = formatLocalDateKey(parseLocalDate(r.at) ?? new Date(r.at))
        if (range.keySet.has(k)) days.add(k)
      }
    }
    return [...days].sort()
  }, [tasks, range.keySet])
  const [dayIdx, setDayIdx] = useState<number | null>(null)
  const asOf = dayIdx == null || dayIdx >= ratedDays.length ? null : ratedDays[dayIdx]
  const quadrant = useMemo(() => {
    const pts = tasks.flatMap((t) => {
      const res = (t.resistanceReadings ?? [])
        .map((r) => ({
          k: formatLocalDateKey(parseLocalDate(r.at) ?? new Date(r.at)),
          v: r.value,
        }))
        .filter((r) => range.keySet.has(r.k) && (!asOf || r.k <= asOf))
        .sort((a, b) => a.k.localeCompare(b.k))
        .pop()
      const day = Object.entries(t.dayRatings ?? {})
        .filter(([k, v]) => range.keySet.has(k) && (!asOf || k <= asOf) && v.excitement != null)
        .sort(([a], [b]) => a.localeCompare(b))
        .pop()
      if (!res || !day) return []
      const exc = day[1].excitement!
      const imp = day[1].importance ?? 5
      return [
        {
          id: t.id,
          x: res.v,
          y: exc,
          size: imp + 1,
          label: `${itemTitleOrUntitled(t)} · resistance ${res.v} · excitement ${exc} · importance ${day[1].importance ?? "—"}`,
          color:
            exc >= 5
              ? res.v >= 5
                ? BEHAVIOR_FILL.d
                : BEHAVIOR_FILL.a
              : res.v >= 5
                ? BEHAVIOR_FILL.b
                : BEHAVIOR_FILL.quiet,
        },
      ]
    })
    const count = { joy: 0, hook: 0, chore: 0, dread: 0 }
    for (const p of pts) {
      if (p.y >= 5) count[p.x >= 5 ? "hook" : "joy"]++
      else count[p.x >= 5 ? "dread" : "chore"]++
    }
    return { pts, count }
  }, [tasks, range.keySet, asOf])

  const tierRows = useMemo(() => {
    const counts = new Map<string, { n: number; minutes: number }>()
    for (const t of pulsed) {
      const tier = getTierFromTask(t)
      const row = counts.get(tier) ?? { n: 0, minutes: 0 }
      row.n += 1
      row.minutes += t.estimatedDuration ?? 0
      counts.set(tier, row)
    }
    return TIERS.filter((tier) => counts.has(tier)).map((tier) => ({
      tier,
      ...counts.get(tier)!,
    }))
  }, [pulsed])

  const [itemQuery, setItemQuery] = useState("")
  const [itemSort, setItemSort] = useState<"default" | "resistance" | "duration" | "points" | "title">("default")
  const [ratedOnly, setRatedOnly] = useState(false)
  const items = useMemo(() => {
    const q = itemQuery.trim().toLowerCase()
    const rows = pulsed.filter((t) => {
      if (q && !itemTitleOrUntitled(t).toLowerCase().includes(q)) return false
      if (ratedOnly && !Object.keys(t.dayRatings ?? {}).some((k) => range.keySet.has(k))) return false
      return true
    })
    if (itemSort === "title") rows.sort((a, b) => itemTitleOrUntitled(a).localeCompare(itemTitleOrUntitled(b)))
    if (itemSort === "duration") rows.sort((a, b) => (b.estimatedDuration ?? -1) - (a.estimatedDuration ?? -1))
    if (itemSort === "points") rows.sort((a, b) => (b.rewardValue ?? -1) - (a.rewardValue ?? -1))
    if (itemSort === "resistance") {
      const last = (t: (typeof rows)[0]) => t.resistanceReadings?.at(-1)?.value ?? -1
      rows.sort((a, b) => last(b) - last(a))
    }
    return rows
  }, [pulsed, itemQuery, itemSort, ratedOnly, range.keySet])
  const { shown: shownItems, more: moreItems } = useShowMore(items, 10)

  const hasAnything = pulsed.length > 0 || resistanceSeries.length > 0 || dayImportanceAvg.length > 0

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
      <Fold title="What each number means">
        <ul className="an-bx-help">
          {(Object.entries(FIELD_HELP) as [keyof typeof FIELD_HELP, string][]).map(([k, text]) => (
            <li key={k}>
              <strong style={{ textTransform: "capitalize" }}>{k}</strong> — {text}
            </li>
          ))}
        </ul>
      </Fold>
      {(morningSources.telegram > 0 || morningSources.desktop > 0) && (
        <p className="an-n">
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

      {quadrant.pts.length > 0 && (
        <section className="an-plate" data-testid="pulse-quadrant">
          <CanvasTitle
            title="Dread, joy, chore, hook"
            help="Each bubble is one item: its latest resistance reading across, its latest excitement rating up. Size = that day's importance. The lines sit at 5. Slide the day to watch the field as it stood then."
          />
          <div className="an-bx-tools">
            {ratedDays.length > 1 && (
              <RangeField
                label="As of"
                value={dayIdx ?? ratedDays.length}
                min={0}
                max={ratedDays.length}
                onChange={(v) => setDayIdx(v >= ratedDays.length ? null : v)}
                shown={asOf ?? "whole window"}
              />
            )}
            <span className="an-n">
              n = {quadrant.pts.length} · joy {quadrant.count.joy} · hook {quadrant.count.hook} · chore{" "}
              {quadrant.count.chore} · dread {quadrant.count.dread}
            </span>
          </div>
          <BubblePlot
            points={quadrant.pts}
            xDomain={[0, 10]}
            yDomain={[0, 10]}
            xLabel="Resistance"
            yLabel="Excitement"
            refX={5}
            refY={5}
            corners={["Joy", "Hook", "Chore", "Dread"]}
          />
        </section>
      )}

      {tierRows.length > 0 && (
        <section className="an-plate">
          <CanvasTitle
            title="Tier mix"
            help="Items with pulse fields by priority band. The note is their summed expected minutes."
          />
          <StudioBars
            rows={tierRows.map((r) => ({ name: r.tier, value: r.n }))}
            max={Math.max(...tierRows.map((r) => r.n))}
            unit=""
          />
          <p className="an-n">{tierRows.map((r) => `${r.tier} ${round1(r.minutes / 60)} h expected`).join(" · ")}</p>
        </section>
      )}

      {dayImportanceAvg.length > 0 && (
        <section className="an-plate">
          <p className="an-canvas-title">Day importance &amp; excitement (averages)</p>
          <p className="an-canvas-kicker">
            Mean of that day&apos;s per-item morning ratings (0–10). Importance = how much it matters today; excitement
            = how pumped you are.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dayImportanceAvg}>
              <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} />
              <YAxis domain={[0, 10]} fontSize={11} stroke={STUDIO_AXIS} />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              <Bar dataKey="importance" name="Importance (today)" fill={BEHAVIOR_FILL.c} />
              <Bar dataKey="excitement" name="Excitement (today)" fill={BEHAVIOR_FILL.a} />
            </BarChart>
          </ResponsiveContainer>
          <p className="an-bx-legend">
            <span>
              <i style={{ background: BEHAVIOR_FILL.c }} />
              Importance
            </span>
            <span>
              <i style={{ background: BEHAVIOR_FILL.a }} />
              Excitement
            </span>
          </p>
        </section>
      )}

      {resistanceSeries.length > 0 && (
        <section className="an-plate">
          <p className="an-canvas-title">Resistance over time</p>
          <p className="an-canvas-kicker">
            Each point is one reading (0–10). Resistance can be logged again and again — this is a series, not a single
            lifetime value.
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
              <Line type="monotone" dataKey="resistance" stroke={BEHAVIOR_FILL.b} strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      <Fold title="Items with pulse fields" count={pulsed.length} testId="pulse-items">
        <p className="an-canvas-kicker">
          Tier, expected duration, and points live on the item anytime; importance / excitement are per day; resistance
          is the full reading history.
        </p>
        <div className="an-bx-tools">
          <SearchField value={itemQuery} onChange={setItemQuery} placeholder="Item title…" />
          <StudioSelect label="Sort" value={itemSort} onChange={(v) => setItemSort(v as typeof itemSort)}>
            <option value="default">As found</option>
            <option value="resistance">Latest resistance</option>
            <option value="duration">Expected minutes</option>
            <option value="points">Points</option>
            <option value="title">Title</option>
          </StudioSelect>
          <StudioCheck id="pulse-rated-only" checked={ratedOnly} onChange={setRatedOnly}>
            Rated in window only
          </StudioCheck>
        </div>
        <ul className="an-list">
          {shownItems.map((t) => {
            const ratingsInRange = Object.entries(t.dayRatings ?? {}).filter(([k]) => range.keySet.has(k))
            const latestDay = ratingsInRange.sort(([a], [b]) => b.localeCompare(a))[0]
            const resCount = t.resistanceReadings?.length ?? 0
            return (
              <li
                key={t.id}
                className="an-list-row"
                style={{
                  flexDirection: "column",
                  alignItems: "stretch",
                  cursor: "default",
                }}
              >
                <span className="truncate" style={{ fontWeight: 600 }}>
                  {itemTitleOrUntitled(t)}
                </span>
                <span className="an-n">
                  Tier {getTierFromTask(t)}
                  {t.estimatedDuration != null ? ` · ${t.estimatedDuration} min expected` : ""}
                  {t.rewardValue != null ? ` · ${t.rewardValue} points` : ""}
                  {latestDay
                    ? ` · importance ${latestDay[1].importance ?? "—"} / excitement ${latestDay[1].excitement ?? "—"} (${latestDay[0]})`
                    : ""}
                  {resCount > 0 ? ` · ${resCount} resistance reading${resCount === 1 ? "" : "s"}` : ""}
                </span>
              </li>
            )
          })}
        </ul>
        {moreItems}
      </Fold>
    </div>
  )
}
