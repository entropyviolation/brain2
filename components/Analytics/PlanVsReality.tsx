/**
 * components/Analytics/PlanVsReality.tsx — Plan-vs-reality dashboard (Brain2 #33)
 *
 * Compares what was planned for a chosen period (day/week/month) against what
 * actually happened, using the pure `lib/plan-vs-reality.ts` helper. Shows the
 * single intention→outcome variance score, a planned-vs-actual bar chart across
 * the measured dimensions, and the list of written intentions for the period.
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Target } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts"
import {
  computePlanVsReality,
  recentPeriodKeys,
  type PlanPeriod,
} from "@/lib/plan-vs-reality"
import { getStoredPlanText } from "@/lib/plan-text"
import { parseWeekString } from "@/lib/date-utils"

const PERIODS: { value: PlanPeriod; label: string; count: number }[] = [
  { value: "day", label: "Day", count: 14 },
  { value: "week", label: "Week", count: 8 },
  { value: "month", label: "Month", count: 6 },
]

function periodKeyLabel(period: PlanPeriod, key: string): string {
  if (period === "day") {
    const d = new Date(`${key}T00:00:00`)
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  }
  if (period === "week") {
    const r = parseWeekString(key)
    return r ? `Week of ${r.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : key
  }
  const d = new Date(`${key}-01T00:00:00`)
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" })
}

function scoreColor(variance: number): string {
  if (variance <= 25) return "#30a14e"
  if (variance <= 50) return "#f59e0b"
  return "#dc2626"
}

export function PlanVsReality() {
  const tasks = useTaskStore((s) => s.tasks)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)

  const [period, setPeriod] = useState<PlanPeriod>("day")
  const periodDef = PERIODS.find((p) => p.value === period)!
  const keys = useMemo(() => recentPeriodKeys(period, periodDef.count), [period, periodDef.count])
  const [periodKey, setPeriodKey] = useState<string>(keys[keys.length - 1])

  // Keep the selected key valid when the period type changes.
  const activeKey = keys.includes(periodKey) ? periodKey : keys[keys.length - 1]

  const planText = useMemo(() => getStoredPlanText(period, activeKey), [period, activeKey])

  const comparison = useMemo(
    () => computePlanVsReality(period, activeKey, tasks, pointsHistory, planText),
    [period, activeKey, tasks, pointsHistory, planText],
  )

  const chartData = comparison.metrics.map((m) => ({
    name: m.unit ? `${m.label} (${m.unit})` : m.label,
    Planned: m.planned,
    Actual: m.actual,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="border rounded h-9 px-2 text-sm bg-background"
          value={period}
          onChange={(e) => {
            const next = e.target.value as PlanPeriod
            setPeriod(next)
            const nextKeys = recentPeriodKeys(next, PERIODS.find((p) => p.value === next)!.count)
            setPeriodKey(nextKeys[nextKeys.length - 1])
          }}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          className="border rounded h-9 px-2 text-sm bg-background"
          value={activeKey}
          onChange={(e) => setPeriodKey(e.target.value)}
        >
          {keys
            .slice()
            .reverse()
            .map((k) => (
              <option key={k} value={k}>
                {periodKeyLabel(period, k)}
              </option>
            ))}
        </select>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Variance score
            </CardTitle>
          </CardHeader>
          <CardContent>
            {comparison.hasPlan ? (
              <div className="flex flex-col items-center justify-center py-2">
                <div
                  className="text-5xl font-bold tabular-nums"
                  style={{ color: scoreColor(comparison.varianceScore) }}
                >
                  {comparison.varianceScore}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  0 = matched the plan · 100 = total divergence
                </p>
                <Badge variant="secondary" className="mt-3">
                  {comparison.alignmentScore}% aligned
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                Nothing was planned for this {period}. Write a plan or schedule tasks to compare.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Planned vs actual</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Planned" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dimension breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {comparison.metrics.map((m) => (
              <div key={m.key} className="flex items-center justify-between text-sm">
                <span>{m.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground tabular-nums">
                    {m.actual}
                    {m.unit && ` ${m.unit}`} / {m.planned}
                    {m.unit && ` ${m.unit}`}
                  </span>
                  {m.applicable ? (
                    <Badge variant="outline">{Math.round(m.attainment * 100)}%</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      n/a
                    </Badge>
                  )}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Your intentions ({comparison.intentionCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {comparison.intentions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No written plan found for this {period}. Plans come from the Plan panel.
              </p>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                {comparison.intentions.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default PlanVsReality
