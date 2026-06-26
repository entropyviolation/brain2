/**
 * components/Analytics/enhanced-analytics.tsx — Analytics screen
 *
 * Real visualizations across COGS data using recharts plus a custom calendar
 * heatmap:
 *  - Overview: headline metrics + recent points.
 *  - Habits: GitHub-style completion heatmap + per-habit completion rates.
 *  - Points: cumulative + daily points and top point-earning tasks.
 *  - Tracking: time distribution from the TimeGrid tracker (per scope).
 *  - Reviews: browse saved end-of-period reviews.
 *
 * Spec: §15 (Analytics).
 */
"use client"

import { useMemo, useState, useEffect } from "react"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useTimeTrackingStore, SLOT_MINUTES } from "@/lib/time-tracking-store"
import { calculateDayPercentageAV } from "@/lib/calculations"
import { formatDateKey } from "@/lib/date-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { TrendingUp, Star, CheckCircle2, Flame, ClipboardCheck, Sparkles } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { APP_NAV_KEYS, readStoredTab, writeStoredTab } from "@/lib/app-navigation"
import { PlanVsReality } from "@/components/Analytics/PlanVsReality"
import { CalibrationView } from "@/components/Analytics/CalibrationView"
import { StreaksWidget } from "@/components/Analytics/StreaksWidget"
import { MetricsTrends } from "@/components/Analytics/MetricsTrends"
import { CorrelationExplorer } from "@/components/Analytics/CorrelationExplorer"
import { ContextSwitchHeatmap } from "@/components/Analytics/ContextSwitchHeatmap"
import { RegretView } from "@/components/Analytics/RegretView"
import { PostMortemDialog } from "@/components/Reviews/PostMortemDialog"
import { ItemTypesPanel } from "@/components/ItemTypes/ItemTypesPanel"
import type { Task } from "@/lib/types"

const ANALYTICS_TABS = [
  "habits",
  "points",
  "tracking",
  "plan",
  "calibration",
  "streaks",
  "reflection",
  "reviews",
  "metrics",
  "correlation",
  "context-switch",
  "regret",
  "item-types",
] as const
type AnalyticsTab = (typeof ANALYTICS_TABS)[number]

const HEATMAP_WEEKS = 17 // ~4 months
const UNKNOWN_TIME_LABEL = "Unknown"
const UNKNOWN_TIME_COLOR = "#94a3b8"

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function heatColor(pct: number): string {
  if (pct <= 0) return "#ebedf0"
  if (pct < 25) return "#9be9a8"
  if (pct < 50) return "#40c463"
  if (pct < 75) return "#30a14e"
  return "#216e39"
}

export function EnhancedAnalytics() {
  const allTasks = useTaskStore((s) => s.tasks)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const reviews = useReviewsStore((s) => s.reviews)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const trackingData = useTimeTrackingStore((s) => s.data)

  const [trackScopeId, setTrackScopeId] = useState(scopes[0]?.id ?? "")
  const [showUncategorizedTime, setShowUncategorizedTime] = useState(false)
  const [openReviewId, setOpenReviewId] = useState<string | null>(null)
  const [reflectTask, setReflectTask] = useState<Task | null>(null)
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>(() =>
    readStoredTab(APP_NAV_KEYS.analyticsTab, ANALYTICS_TABS, "habits"),
  )

  useEffect(() => {
    writeStoredTab(APP_NAV_KEYS.analyticsTab, analyticsTab)
  }, [analyticsTab])

  // ---- headline metrics ----
  const completedCount = allTasks.filter((t) => t.completed).length
  const completionRate = allTasks.length ? Math.round((completedCount / allTasks.length) * 100) : 0
  const totalPoints = pointsHistory.reduce((s, e) => s + e.points, 0)

  // ---- points: last 14 days ----
  const pointsByDay = useMemo(() => {
    const days: { date: string; label: string; points: number }[] = []
    const today = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = addDays(today, -i)
      const key = formatDateKey(d)
      const points = pointsHistory.filter((e) => e.date === key).reduce((s, e) => s + e.points, 0)
      days.push({ date: key, label: d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }), points })
    }
    let cum = 0
    return days.map((d) => ({ ...d, cumulative: (cum += d.points) }))
  }, [pointsHistory])

  // ---- top tasks by points ----
  const topTasks = useMemo(() => {
    const byTask: Record<string, { name: string; points: number }> = {}
    pointsHistory.forEach((e) => {
      byTask[e.taskId] = byTask[e.taskId] || { name: e.taskDescription, points: 0 }
      byTask[e.taskId].points += e.points
    })
    return Object.values(byTask)
      .sort((a, b) => b.points - a.points)
      .slice(0, 8)
  }, [pointsHistory])

  // ---- post-mortem (task reflection) data ----
  const reflectedTasks = useMemo(() => allTasks.filter((t) => t.completionReview), [allTasks])
  const reflectableTasks = useMemo(
    () =>
      allTasks
        .filter((t) => t.completed && !t.completionReview)
        .sort((a, b) => (b.createdAt as any) - (a.createdAt as any))
        .slice(0, 20),
    [allTasks],
  )
  const postMortemSummary = useMemo(() => {
    if (reflectedTasks.length === 0) return null
    const avg = (pick: (r: NonNullable<Task["completionReview"]>) => number) =>
      reflectedTasks.reduce((s, t) => s + pick(t.completionReview!), 0) / reflectedTasks.length
    return {
      count: reflectedTasks.length,
      satisfaction: avg((r) => r.satisfaction),
      resistance: avg((r) => r.resistance),
      focus: avg((r) => r.focus),
      distraction: avg((r) => r.distraction),
    }
  }, [reflectedTasks])

  // ---- habit heatmap ----
  const heatmap = useMemo(() => {
    const today = new Date()
    // align to week (start Monday); go back HEATMAP_WEEKS weeks
    const weekday = (today.getDay() + 6) % 7 // 0 = Monday
    const start = addDays(today, -(HEATMAP_WEEKS * 7 - 1 + weekday))
    const weeks: { date: Date; key: string; pct: number }[][] = []
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      const col: { date: Date; key: string; pct: number }[] = []
      for (let day = 0; day < 7; day++) {
        const d = addDays(start, w * 7 + day)
        const key = formatDateKey(d)
        const pct = habitTasks.length ? calculateDayPercentageAV(key, habitTasks as any, weeklyData as any, day) : 0
        col.push({ date: d, key, pct: d > today ? -1 : pct })
      }
      weeks.push(col)
    }
    return weeks
  }, [habitTasks, weeklyData])

  // ---- per-habit completion rate (last 30 days) ----
  const habitRates = useMemo(() => {
    const today = new Date()
    return habitTasks
      .map((task) => {
        let done = 0
        for (let i = 0; i < 30; i++) {
          const key = formatDateKey(addDays(today, -i))
          const c = weeklyData[key]?.[task.id]
          if (!c) continue
          if (c.completed || c.text || (c.value !== undefined && task.goal && c.value >= task.goal) || c.incrementalValues)
            done++
        }
        return { name: task.name, rate: Math.round((done / 30) * 100), done }
      })
      .sort((a, b) => b.rate - a.rate)
  }, [habitTasks, weeklyData])

  // ---- tracking distribution for selected scope (last 30 days) ----
  const trackingDist = useMemo(() => {
    const scope = scopes.find((s) => s.id === trackScopeId)
    if (!scope) return []
    const totals: Record<string, number> = {}
    let unknownMinutes = 0
    const today = new Date()
    for (let i = 0; i < 30; i++) {
      const key = formatDateKey(addDays(today, -i))
      const slots = trackingData[key]?.[scope.id]
      if (!slots) continue
      slots.forEach((penId) => {
        if (penId) totals[penId] = (totals[penId] || 0) + SLOT_MINUTES
        else unknownMinutes += SLOT_MINUTES
      })
    }
    const slices = scope.pens
      .filter((p) => totals[p.id])
      .map((p) => ({ name: p.name, value: totals[p.id], color: p.color }))
    if (showUncategorizedTime && unknownMinutes > 0) {
      slices.push({ name: UNKNOWN_TIME_LABEL, value: unknownMinutes, color: UNKNOWN_TIME_COLOR })
    }
    return slices
  }, [scopes, trackScopeId, trackingData, showUncategorizedTime])

  const metric = (icon: React.ReactNode, label: string, value: string | number) => (
    <Card className="card-hover">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">{icon}</div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Analytics &amp; Insights</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metric(<Star className="h-5 w-5" />, "Total points", totalPoints)}
        {metric(<CheckCircle2 className="h-5 w-5" />, "Tasks completed", completedCount)}
        {metric(<TrendingUp className="h-5 w-5" />, "Completion rate", `${completionRate}%`)}
        {metric(<Flame className="h-5 w-5" />, "Active habits", habitTasks.length)}
      </div>

      <Tabs value={analyticsTab} onValueChange={(v) => setAnalyticsTab(v as AnalyticsTab)}>
        <TabsList className="flex flex-wrap h-auto w-full justify-start">
          <TabsTrigger value="habits">Habits</TabsTrigger>
          <TabsTrigger value="points">Points</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="plan">Plan vs Reality</TabsTrigger>
          <TabsTrigger value="calibration">Calibration</TabsTrigger>
          <TabsTrigger value="streaks">Streaks</TabsTrigger>
          <TabsTrigger value="reflection">Reflection</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="correlation">Correlation</TabsTrigger>
          <TabsTrigger value="context-switch">Context Switch</TabsTrigger>
          <TabsTrigger value="regret">Regret</TabsTrigger>
          <TabsTrigger value="item-types">Item Types</TabsTrigger>
        </TabsList>

        {/* HABITS */}
        <TabsContent value="habits" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Daily habit completion heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-[3px] overflow-x-auto pb-2">
                {heatmap.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((cell) => (
                      <div
                        key={cell.key}
                        title={`${cell.key}: ${cell.pct < 0 ? "—" : Math.round(cell.pct) + "%"}`}
                        style={{
                          width: 13,
                          height: 13,
                          borderRadius: 2,
                          background: cell.pct < 0 ? "transparent" : heatColor(cell.pct),
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                Less
                {[0, 20, 40, 70, 100].map((p) => (
                  <span key={p} style={{ width: 13, height: 13, borderRadius: 2, background: heatColor(p) }} />
                ))}
                More
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Habit completion (last 30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {habitRates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No habits yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, habitRates.length * 34)}>
                  <BarChart data={habitRates} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} />
                    <YAxis type="category" dataKey="name" width={150} fontSize={11} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="rate" fill="#30a14e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* POINTS */}
        <TabsContent value="points" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Points (last 14 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={pointsByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="points" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cumulative points</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={pointsByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="cumulative" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top point earners</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Complete tasks to earn points.</p>
              ) : (
                topTasks.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1">{t.name}</span>
                    <Badge variant="secondary">{t.points} pts</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRACKING */}
        <TabsContent value="tracking" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-3 space-y-3">
              <div className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">Time distribution (last 30 days)</CardTitle>
                <select
                  className="border rounded h-8 px-2 text-sm bg-background"
                  value={trackScopeId}
                  onChange={(e) => setTrackScopeId(e.target.value)}
                >
                  {scopes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-uncategorized-time"
                  checked={showUncategorizedTime}
                  onCheckedChange={setShowUncategorizedTime}
                />
                <Label htmlFor="show-uncategorized-time" className="text-sm cursor-pointer">
                  Show uncategorized time
                </Label>
              </div>
            </CardHeader>
            <CardContent>
              {trackingDist.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tracking data yet. Use the Tracking tab on Home to paint your day.
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4 items-center">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={trackingDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {trackingDist.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${Math.round(v / 60)}h ${v % 60}m`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1">
                    {trackingDist
                      .slice()
                      .sort((a, b) => b.value - a.value)
                      .map((d) => (
                        <div key={d.name} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: d.color }} />
                            {d.name}
                          </span>
                          <span className="font-medium">
                            {Math.floor(d.value / 60)}h {d.value % 60}m
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLAN VS REALITY */}
        <TabsContent value="plan" className="mt-6">
          <PlanVsReality />
        </TabsContent>

        {/* CALIBRATION */}
        <TabsContent value="calibration" className="mt-6">
          <CalibrationView />
        </TabsContent>

        {/* STREAKS */}
        <TabsContent value="streaks" className="mt-6">
          <StreaksWidget />
        </TabsContent>

        {/* REFLECTION (post-mortems) */}
        <TabsContent value="reflection" className="mt-6 space-y-6">
          {postMortemSummary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {metric(<Sparkles className="h-5 w-5" />, "Avg satisfaction", postMortemSummary.satisfaction.toFixed(1))}
              {metric(<Sparkles className="h-5 w-5" />, "Avg resistance", postMortemSummary.resistance.toFixed(1))}
              {metric(<Sparkles className="h-5 w-5" />, "Avg focus", postMortemSummary.focus.toFixed(1))}
              {metric(<Sparkles className="h-5 w-5" />, "Avg distraction", postMortemSummary.distraction.toFixed(1))}
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reflect on completed tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reflectableTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {reflectedTasks.length > 0
                    ? "All completed tasks have been reflected on. Nice work!"
                    : "Complete tasks to capture a post-mortem reflection."}
                </p>
              ) : (
                reflectableTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                    <span className="text-sm flex-1 truncate">{t.description}</span>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => setReflectTask(t)}>
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      Reflect
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {reflectedTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent reflections ({reflectedTasks.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {reflectedTasks
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.completionReview!.completedAt).getTime() -
                      new Date(a.completionReview!.completedAt).getTime(),
                  )
                  .slice(0, 10)
                  .map((t) => {
                    const r = t.completionReview!
                    return (
                      <button
                        key={t.id}
                        onClick={() => setReflectTask(t)}
                        className="w-full flex items-center justify-between gap-2 border rounded-md p-2 text-left hover:bg-muted/50"
                      >
                        <span className="text-sm flex-1 truncate">{t.description}</span>
                        <span className="flex gap-1 text-xs text-muted-foreground shrink-0">
                          <Badge variant="outline" className="font-normal">
                            sat {r.satisfaction}
                          </Badge>
                          <Badge variant="outline" className="font-normal">
                            focus {r.focus}
                          </Badge>
                        </span>
                      </button>
                    )
                  })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* REVIEWS */}
        <TabsContent value="reviews" className="mt-6 space-y-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews saved yet. Use the Review button in the header.</p>
          ) : (
            reviews
              .slice()
              .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
              .map((r) => {
                const open = openReviewId === r.id
                return (
                  <Card key={r.id}>
                    <CardHeader
                      className="pb-3 cursor-pointer"
                      onClick={() => setOpenReviewId(open ? null : r.id)}
                    >
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4" />
                        <span className="capitalize">{r.period}</span> · {r.periodKey}
                        <Badge variant="outline" className="ml-auto font-normal">
                          {new Date(r.completedAt).toLocaleDateString()}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    {open && (
                      <CardContent className="space-y-3 text-sm">
                        {r.summary && (
                          <div>
                            <p className="font-medium">Summary</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">{r.summary}</p>
                          </div>
                        )}
                        {r.gratitude?.filter(Boolean).length > 0 && (
                          <div>
                            <p className="font-medium">Gratitude</p>
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {r.gratitude.filter(Boolean).map((g, i) => (
                                <li key={i}>{g}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {r.nextPlans && (
                          <div>
                            <p className="font-medium">Plans for next {r.period}</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">{r.nextPlans}</p>
                          </div>
                        )}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>{r.resolvedTaskIds?.length || 0} resolved</span>
                          <span>{r.pushedTaskIds?.length || 0} pushed forward</span>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )
              })
          )}
        </TabsContent>

        {/* SELF-TRACKING METRICS (Worker C) */}
        <TabsContent value="metrics" className="mt-6">
          <MetricsTrends />
        </TabsContent>

        {/* METRIC CORRELATION (Worker C) */}
        <TabsContent value="correlation" className="mt-6">
          <CorrelationExplorer />
        </TabsContent>

        {/* CONTEXT-SWITCH HEATMAP (Worker C) */}
        <TabsContent value="context-switch" className="mt-6">
          <ContextSwitchHeatmap />
        </TabsContent>

        {/* REGRET LEDGER (Worker G) */}
        <TabsContent value="regret" className="mt-6">
          <RegretView />
        </TabsContent>

        {/* ITEM TYPES */}
        <TabsContent value="item-types" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <ItemTypesPanel compact />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PostMortemDialog
        task={reflectTask}
        open={!!reflectTask}
        onClose={() => setReflectTask(null)}
      />
    </div>
  )
}
