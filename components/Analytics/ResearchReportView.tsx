/**
 * components/Analytics/ResearchReportView.tsx — Produce research report
 *
 * Reads the same stores as the rest of Analytics and previews only the
 * shapes `buildResearchReport` keeps. Copy is plain text. No model call.
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useMetricsStore, METRIC_DEFINITIONS } from "@/lib/metrics-store"
import { isLoggedSpanStamp } from "@/lib/habit-keyword-source"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useSleepStore, useExemptionContext } from "@/lib/sleep-store"
import { useEventStore } from "@/lib/event-store"
import { calculateDayPercentageAV, calculateWeekToDateGrade } from "@/lib/calculations"
import { exemptionTest } from "@/lib/habit-exemption"
import { formatLocalDateKey, getWeekDates, getWeekStartDate, parseLocalDate } from "@/lib/date-utils"
import { uniqueMinutes, uniqueMinutesByDate } from "@/lib/tracking-summary"
import { isNightEstimated, sleepMinutes } from "@/lib/sleep-log"
import { resolveNights } from "@/lib/sleep-inference"
import { plannedMinutesForDay } from "@/components/Home/Plan/plan-capacity"
import { blockedReasonLabel } from "@/lib/blocked-reason"
import { dateKeyOf } from "./analytics-range"
import { useAnalyticsRange } from "./analytics-range-store"
import { inRange } from "./analytics-range"
import { ANALYTICS_TAB_HELP } from "./analytics-tabs"
import { ChartFrame } from "./chart-frame"
import { CanvasTitle, FindingBlock, PhosphorTrace, StudioBars } from "./studio-kit"
import { buildResearchReport, researchReportPlainText, type ResearchReportInput } from "./research-report"

const MINUTES_PER_DAY = 24 * 60

function clip(text: string, max = 80): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

export function ResearchReportView() {
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const gradeTolerance = useHabitsStore((s) => s.gradeTolerance)
  const exemptionCtx = useExemptionContext()
  const tasks = useTaskStore((s) => s.tasks)
  const reviews = useReviewsStore((s) => s.reviews)
  const datapoints = useMetricsStore((s) => s.datapoints)
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const nights = useSleepStore((s) => s.nights)
  const events = useEventStore((s) => s.events)
  const range = useAnalyticsRange()
  const [copied, setCopied] = useState(false)

  const report = useMemo(() => {
    const exempt = exemptionTest(habitExemptions, "daily", exemptionCtx)
    const habitDays =
      habitTasks.length === 0
        ? []
        : range.dateKeys.map((key) => {
            const date = parseLocalDate(key)
            const dow = date ? (date.getDay() + 6) % 7 : 0
            return {
              date: key,
              value: calculateDayPercentageAV(key, habitTasks as never, weeklyData as never, dow, exempt),
            }
          })
    const habitMetDates = habitDays.filter((day) => day.value >= 100).map((day) => day.date)

    const asOf = parseLocalDate(range.dateKeys[range.dateKeys.length - 1] ?? "") ?? new Date()
    const weekDates = getWeekDates(getWeekStartDate(asOf))
    const weekGrade =
      habitTasks.length === 0
        ? null
        : (() => {
            const grade = calculateWeekToDateGrade(habitTasks as never, weeklyData, weekDates, asOf, gradeTolerance, exempt)
            return { raw: grade.rawGrade, curved: grade.grade, days: grade.daysIncluded }
          })()

    const byDate = uniqueMinutesByDate(entries)
    const trackingDays = range.dateKeys
      .filter((key) => (byDate[key] ?? 0) > 0)
      .map((key) => ({
        date: key,
        value: Math.min(100, ((byDate[key] ?? 0) / MINUTES_PER_DAY) * 100),
      }))
    const trackedTotal = uniqueMinutes(entries, range.dateKeys)

    const resolved = resolveNights(nights, { scopes, entries }, range.dateKeys)
    const sleepNights = range.dateKeys.flatMap((key) => {
      const minutes = sleepMinutes(resolved[key])
      if (minutes == null) return []
      return [{ date: key, minutes, estimated: isNightEstimated(resolved[key]) }]
    })

    const metrics = METRIC_DEFINITIONS.map((definition) => ({
      name: definition.name,
      points: datapoints
        .filter((point) => point.values[definition.key] !== undefined)
        .map((point) => {
          const date = dateKeyOf(point.at)
          return date ? { date, value: point.values[definition.key] as number } : null
        })
        .filter((point): point is { date: string; value: number } => point !== null && range.keySet.has(point.date)),
    }))

    let planned = 0
    for (const key of range.dateKeys) {
      const date = parseLocalDate(key)
      if (!date) continue
      planned += plannedMinutesForDay(date, tasks, events)
    }

    const inWindow = entries.filter((entry) => range.keySet.has(entry.date))
    const phoneStamped = inWindow.filter(
      (entry) => entry.generatedBy?.kind === "text" && !isLoggedSpanStamp(entry.generatedBy.id),
    ).length
    const otherRows = inWindow.length - phoneStamped

    const reviewsInRange = reviews.filter((review) => inRange(review.completedAt, range.keySet) || range.keySet.has(review.periodKey))
    const gratitude = reviewsInRange.flatMap((review) => {
      const lines = [...(review.morning?.gratitude ?? []), ...(review.gratitude ?? [])].map((line) => line.trim()).filter(Boolean)
      if (lines.length === 0) return []
      return [{ date: review.periodKey, lines: lines.length, sample: clip(lines[0]) }]
    })

    const whyCounts = new Map<string, { text: string; n: number }>()
    const addWhy = (raw: string | undefined) => {
      const text = raw?.trim()
      if (!text) return
      const key = text.toLowerCase()
      const prev = whyCounts.get(key)
      if (prev) prev.n += 1
      else whyCounts.set(key, { text: clip(text), n: 1 })
    }
    for (const review of reviewsInRange) {
      for (const reason of Object.values(review.blockedReasons ?? {})) addWhy(blockedReasonLabel(reason))
    }
    for (const task of tasks) {
      if (!task.why) continue
      if (inRange(task.completedDate ?? task.createdAt, range.keySet)) addWhy(task.why)
    }

    const input: ResearchReportInput = {
      windowLabel: range.label,
      habitDays,
      habitMetDates,
      today: asOf,
      trackingDays,
      sleepNights,
      metrics,
      weekGrade,
      plannedMinutes: planned > 0 ? planned : null,
      trackedMinutes: trackedTotal > 0 ? trackedTotal : null,
      phoneStamped,
      otherRows,
      gratitude,
      whyNotes: [...whyCounts.values()],
    }
    return buildResearchReport(input)
  }, [
    habitTasks,
    weeklyData,
    habitExemptions,
    exemptionCtx,
    gradeTolerance,
    tasks,
    reviews,
    datapoints,
    entries,
    scopes,
    nights,
    events,
    range.dateKeys,
    range.keySet,
    range.label,
  ])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(researchReportPlainText(report))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="an-canvas an-stack" data-testid="research-report-view">
      <header className="an-canvas-head">
        <CanvasTitle title="Produce research report" help={ANALYTICS_TAB_HELP["research-report"]} />
        <button type="button" className="an-chip" onClick={() => void copy()} title="Copy the rundown as plain text">
          {copied ? "Copied" : "Copy rundown"}
        </button>
      </header>
      <p className="an-finding">{report.lede}</p>
      {report.sections.length === 0 ? (
        <ChartFrame empty emptySentence="Nothing in this window was dense enough to put in the report." />
      ) : (
        report.sections.map((section) => (
          <section key={section.id} className="an-plate">
            <p className="an-canvas-title">{section.title}</p>
            <FindingBlock sentence={section.sentence} n={section.n} />
            {section.bars && section.bars.length > 0 ? (
              <StudioBars
                rows={section.bars.map((row) => ({ name: row.name, value: row.value }))}
                max={Math.max(...section.bars.map((row) => row.value), 1)}
                unit={section.bars[0]?.unit ?? ""}
              />
            ) : null}
            {section.trace && section.trace.length > 0 ? (
              <PhosphorTrace title={section.title} points={section.trace} unit={section.traceUnit} />
            ) : null}
          </section>
        ))
      )}
      <section className="an-plate">
        <p className="an-canvas-title">Included because</p>
        {report.includedBecause.length === 0 ? (
          <p className="an-canvas-hint">Nothing cleared a floor.</p>
        ) : (
          <ul className="an-canvas-hint">
            {report.includedBecause.map((reason, index) => (
              <li key={`${index}-${reason}`}>{reason}</li>
            ))}
          </ul>
        )}
        <p className="an-canvas-title">Left out because</p>
        <ul className="an-canvas-hint">
          {report.leftOutBecause.map((reason, index) => (
            <li key={`${index}-${reason}`}>{reason}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
