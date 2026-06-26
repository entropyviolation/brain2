/**
 * components/Analytics/RegretView.tsx — Regret accrual ledger (Feature 7, Worker G)
 *
 * The mirror image of the Points stats: instead of rewarding completion, this
 * view surfaces the **accrued cost of not having done** important/overdue items.
 * It reads the persisted `regret-store` ledger and the task snapshot, accrues
 * the current day's increment on mount (idempotent), and renders day/week/month
 * totals, a recent-days trend, outstanding (projected) regret, the heaviest
 * offenders, and a breakdown by structured blocked reason (HM3).
 *
 * Self-contained: mounted as an Analytics tab by the coordinator in
 * `enhanced-analytics.tsx`.
 */
"use client"

import { useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Frown, TrendingDown, AlertTriangle, CalendarClock } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { useTaskStore } from "@/lib/task-store"
import { useRegretStore, regretCost } from "@/lib/regret-store"

const BLOCKED_REASON_LABELS: Record<string, string> = {
  "no-energy": "No energy",
  "missing-input": "Missing input",
  procrastination: "Procrastination",
  "no-time": "No time",
  "blocked-by-other": "Blocked by other",
  other: "Other",
  unspecified: "Unspecified",
}

function StatCard({
  icon,
  value,
  label,
  tone = "muted",
}: {
  icon: React.ReactNode
  value: number
  label: string
  tone?: "muted" | "warn"
}) {
  return (
    <Card className="card-hover">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-full p-2 ${
              tone === "warn" ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"
            }`}
          >
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold">{Math.round(value)}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RegretView() {
  const tasks = useTaskStore((s) => s.tasks)
  const regretHistory = useRegretStore((s) => s.regretHistory)
  const accrueOverdue = useRegretStore((s) => s.accrueOverdue)
  const getDayRegret = useRegretStore((s) => s.getDayRegret)
  const getWeekRegret = useRegretStore((s) => s.getWeekRegret)
  const getMonthRegret = useRegretStore((s) => s.getMonthRegret)
  const getTopRegretTasks = useRegretStore((s) => s.getTopRegretTasks)
  const getRegretByReason = useRegretStore((s) => s.getRegretByReason)

  // Accrue today's overdue increment once on mount (idempotent per task/day).
  useEffect(() => {
    accrueOverdue(tasks)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const now = new Date()

  const day = getDayRegret(now)
  const week = getWeekRegret(now)
  const month = getMonthRegret(now)

  const outstanding = useMemo(
    () => tasks.reduce((total, t) => total + regretCost(t, now), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, regretHistory],
  )

  const trend = useMemo(() => {
    const out: { label: string; regret: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      out.push({
        label: d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
        regret: getDayRegret(d),
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regretHistory])

  const topTasks = useMemo(() => getTopRegretTasks(8), [regretHistory, getTopRegretTasks])
  const byReason = useMemo(
    () =>
      Object.entries(getRegretByReason())
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]),
    [regretHistory, getRegretByReason],
  )

  const hasData = regretHistory.length > 0 || outstanding > 0

  if (!hasData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No regret accrued — nothing important is overdue. Regret accumulates each day an important or
            scheduled item slips past its due date without being done.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Frown className="h-5 w-5" />} value={day} label="Today's regret" tone="warn" />
        <StatCard icon={<TrendingDown className="h-5 w-5" />} value={week} label="This week" />
        <StatCard icon={<CalendarClock className="h-5 w-5" />} value={month} label="This month" />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          value={outstanding}
          label="Outstanding (not yet done)"
          tone="warn"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Regret accrued (last 14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={10} interval={1} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip formatter={(v: number) => [`${Math.round(v)}`, "Regret"]} />
              <Bar dataKey="regret" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Heaviest regrets</CardTitle>
          </CardHeader>
          <CardContent>
            {topTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items have accrued regret yet.</p>
            ) : (
              <div className="divide-y">
                {topTasks.map((t) => (
                  <div key={t.taskId} className="flex items-center justify-between py-2 gap-3">
                    <span className="text-sm truncate flex-1">{t.taskDescription}</span>
                    <Badge variant="outline" className="text-red-600 border-red-200">
                      {Math.round(t.regret)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">By reason</CardTitle>
          </CardHeader>
          <CardContent>
            {byReason.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No structured reasons captured yet. Record why items were blocked during your reviews.
              </p>
            ) : (
              <div className="divide-y">
                {byReason.map(([reason, value]) => (
                  <div key={reason} className="flex items-center justify-between py-2">
                    <span className="text-sm">{BLOCKED_REASON_LABELS[reason] ?? reason}</span>
                    <Badge variant="secondary">{Math.round(value)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default RegretView
