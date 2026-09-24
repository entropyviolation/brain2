/**
 * components/Home/daily-progress-quickview.tsx — Today's progress summary
 *
 * Replaces the old Quick Actions card with a snapshot of daily to-do and habit
 * completion for the current day. Climb habits use `isHabitGoalMet` with
 * `{ date, weeklyData }` so the derived target is applied. On the overview
 * (`instrument`), the bars sit in the CRT and one footer line sums the day.
 */
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, ListTodo, Repeat } from "lucide-react"
import { useHomeDayStats } from "@/components/Home/home-day-stats"

export function DailyProgressQuickview({
  currentDate,
  instrument = false,
}: {
  currentDate: Date
  instrument?: boolean
}) {
  const { todo: todoStats, habit: habitStats } = useHomeDayStats(currentDate)
  const footer = `To do ${todoStats.completed}/${todoStats.total} · habits ${habitStats.completed}/${habitStats.total}`

  const meters = (
    <>
      <div className={instrument ? "hab-meter" : "space-y-2"}>
        <div className={instrument ? "hab-meter-row" : "flex items-center justify-between text-sm"}>
          <span className={instrument ? "hab-meter-name" : "flex items-center gap-1.5 font-medium"}>
            {!instrument && <ListTodo className="h-4 w-4 text-blue-600" />}
            To Do
          </span>
          <span className={instrument ? "hab-meter-stat" : "text-muted-foreground"}>
            {todoStats.remaining} left · {todoStats.percent}%
          </span>
        </div>
        <Progress
          value={todoStats.percent}
          className={instrument ? "hab-well-fill" : undefined}
          indicatorClassName={instrument ? undefined : "bg-blue-500"}
        />
        {!instrument && (
          <p className="text-xs text-muted-foreground">
            {todoStats.completed} of {todoStats.total} done today
          </p>
        )}
      </div>

      <div className={instrument ? "hab-meter" : "space-y-2"}>
        <div className={instrument ? "hab-meter-row" : "flex items-center justify-between text-sm"}>
          <span className={instrument ? "hab-meter-name" : "flex items-center gap-1.5 font-medium"}>
            {!instrument && <Repeat className="h-4 w-4 text-emerald-600" />}
            Habits
          </span>
          <span className={instrument ? "hab-meter-stat" : "text-muted-foreground"}>
            {habitStats.remaining} left · {habitStats.percent}%
          </span>
        </div>
        <Progress
          value={habitStats.percent}
          className={instrument ? "hab-well-fill" : undefined}
          indicatorClassName={instrument ? undefined : "bg-emerald-500"}
        />
        {!instrument && (
          <p className="text-xs text-muted-foreground">
            {habitStats.completed} of {habitStats.total} done today
          </p>
        )}
      </div>
    </>
  )

  if (instrument) {
    return (
      <div className="hab-progress-module">
        <div className="hab-score-caption">
          <span>Today&apos;s Progress</span>
        </div>
        <div className="home-crt is-stack">
          <div className="hab-progress-meters">{meters}</div>
        </div>
        <div className="home-tile-foot">
          <p className="hab-score-sub">{footer}</p>
        </div>
      </div>
    )
  }

  return (
    <Card className="lg:w-80 card-hover">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Today&apos;s Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">{meters}</CardContent>
    </Card>
  )
}
