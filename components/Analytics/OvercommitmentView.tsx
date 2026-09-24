/**
 * components/Analytics/OvercommitmentView.tsx — Load early-warning (#238)
 *
 * One sentence + n over the shared Analytics range. A thin window is not a
 * finding. Does not reschedule anything.
 */
"use client"

import { useMemo } from "react"
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { useTaskStore } from "@/lib/task-store"
import { summarizeOvercommitment } from "@/lib/overcommitment"
import { parseLocalDate } from "@/lib/date-utils"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, thinWindowSentence } from "./analytics-range"
import { STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP } from "./studio-kit"

const CAVEAT =
  "Day-pushes are reconstructed from each item’s daysPushed, ending at its schedule (or today). Logged minutes are timeLogs. This does not move your day."

export function OvercommitmentView() {
  const tasks = useTaskStore((s) => s.tasks)
  const { dateKeys, label } = useAnalyticsRange()

  const report = useMemo(
    () => summarizeOvercommitment(tasks, dateKeys, { floor: SAMPLE_FLOORS.overcommitment }),
    [tasks, dateKeys],
  )

  const periodPushes = useMemo(() => {
    let weeks = 0
    let months = 0
    for (const t of tasks) {
      weeks += Math.max(0, t.weeksPushed ?? 0)
      months += Math.max(0, t.monthsPushed ?? 0)
    }
    return { weeks, months }
  }, [tasks])

  const chartData = useMemo(
    () =>
      dateKeys.map((key, i) => {
        const d = parseLocalDate(key) ?? new Date()
        return {
          label: d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
          minutes: report.minutes[i]?.value ?? 0,
          pushes: report.pushes[i]?.value ?? 0,
        }
      }),
    [dateKeys, report.minutes, report.pushes],
  )

  const listIds = report.pushedTaskIds.length ? report.pushedTaskIds : report.loggedTaskIds
  const empty = report.status === "empty"
  const thin = report.status === "thin"
  const extraPushes =
    periodPushes.weeks > 0 || periodPushes.months > 0
      ? ` Week-pushes on the vault: ${periodPushes.weeks}. Month-pushes: ${periodPushes.months}.`
      : ""

  return (
    <div className="an-canvas an-stack" data-testid="overcommit-view">
      <p className="an-canvas-kicker">Load early-warning — reconstructed, not a nanny.</p>
      {empty ? (
        <ChartFrame
          empty
          emptySentence={`No day-pushes or logged minutes in the ${label}. Push a task on To Do or log time to see a load trend.`}
        />
      ) : thin ? (
        <ChartFrame thin thinSentence={thinWindowSentence(report.n, SAMPLE_FLOORS.overcommitment, label)} />
      ) : (
        <>
          <p className="an-finding">
            {report.sentence}
            {extraPushes}
          </p>
          <p className="an-n">
            n = {report.n} day{report.n === 1 ? "" : "s"} with pushes or logs
          </p>
          <p className="an-caveat">{CAVEAT}</p>
          <OpenInListsButton taskIds={listIds} />
        </>
      )}

      {!empty && !thin && (
        <div className="an-frame">
          <p className="an-canvas-title">Day-pushes and logged minutes</p>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={STUDIO_GRID} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} tick={{ fill: STUDIO_AXIS }} />
              <YAxis yAxisId="min" fontSize={11} allowDecimals={false} stroke={STUDIO_AXIS} tick={{ fill: STUDIO_AXIS }} />
              <YAxis
                yAxisId="push"
                orientation="right"
                fontSize={11}
                allowDecimals={false}
                stroke={STUDIO_AXIS}
                tick={{ fill: STUDIO_AXIS }}
              />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              <Line yAxisId="min" type="monotone" dataKey="minutes" name="Logged minutes" stroke="#7dd3fc" dot={false} />
              <Line yAxisId="push" type="monotone" dataKey="pushes" name="Day-pushes" stroke="#fbbf24" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
