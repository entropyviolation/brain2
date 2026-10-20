/**
 * components/Home/daily-progress-quickview.tsx — Today's progress summary
 *
 * Replaces the old Quick Actions card with a snapshot of daily to-do and habit
 * completion for the current day. Climb habits use `isHabitGoalMet` with
 * `{ date, weeklyData }` so the derived target is applied. On the overview
 * (`instrument`), the CRT holds three columns — Today, This week, This month —
 * each with a To Do and a Habits bar (week / month counts from
 * `home-period-stats.ts`), and one footer line sums all three.
 */
"use client"

import { CopyCaption } from "@/components/Home/widgets/copy-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, ListTodo, Repeat } from "lucide-react"
import { useHomeDayStats, type HomeDayCount } from "@/components/Home/home-day-stats"
import { useHomePeriodStats } from "@/components/Home/home-period-stats"

function PeriodColumn({ label, todo, habit }: { label: string; todo: HomeDayCount; habit: HomeDayCount }) {
  return (
    <div className="home-progress-col" aria-label={`${label}: to do ${todo.completed} of ${todo.total}, habits ${habit.completed} of ${habit.total}`}>
      <p className="home-progress-col-label">{label}</p>
      {(
        [
          ["To Do", todo],
          ["Habits", habit],
        ] as const
      ).map(([name, count]) => (
        <div key={name} className="hab-meter">
          <div className="hab-meter-row">
            <span className="hab-meter-name">{name}</span>
            <span className="hab-meter-stat">
              {count.completed}/{count.total}
            </span>
          </div>
          <span className="home-progress-bar" aria-hidden="true">
            <span style={{ width: `${count.percent}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}

export function DailyProgressQuickview({
  currentDate,
  instrument = false,
  periods = "all",
}: {
  currentDate: Date
  instrument?: boolean
  /** Which period columns the instrument draws (the Today's Progress Columns setting). */
  periods?: "today" | "week" | "all"
}) {
  const { todo: todoStats, habit: habitStats } = useHomeDayStats(currentDate)
  const week = useHomePeriodStats("week", currentDate)
  const month = useHomePeriodStats("month", currentDate)
  const done = (a: HomeDayCount, b: HomeDayCount) => `${a.completed + b.completed}/${a.total + b.total}`
  const footer = [
    `Today ${done(todoStats, habitStats)}`,
    periods !== "today" ? `week ${done(week.todo, week.habit)}` : "",
    periods === "all" ? `month ${done(month.todo, month.habit)}` : "",
  ]
    .filter(Boolean)
    .join(" · ")

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
          <span>
            <CopyCaption>Today&apos;s Progress</CopyCaption>
          </span>
        </div>
        <div className="home-crt is-stack home-progress-crt" data-periods={periods}>
          <PeriodColumn label="Today" todo={todoStats} habit={habitStats} />
          {periods !== "today" ? <PeriodColumn label="This week" todo={week.todo} habit={week.habit} /> : null}
          {periods === "all" ? <PeriodColumn label="This month" todo={month.todo} habit={month.habit} /> : null}
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
