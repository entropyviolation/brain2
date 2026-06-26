/**
 * components/Analytics/StreaksWidget.tsx — Streaks (Brain2 §8b / §9.5)
 *
 * Self-contained widget showing current + longest streaks for habits (from
 * habits-store completion data) and for the daily review ritual (from
 * reviews-store). All streak math is delegated to the pure `lib/streaks.ts`
 * helper, so this component only gathers the relevant completion dates.
 */
"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Flame, ClipboardCheck } from "lucide-react"
import { useHabitsStore } from "@/lib/habits-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { computeStreak, type StreakResult } from "@/lib/streaks"

interface StreakRow {
  id: string
  name: string
  streak: StreakResult
}

function StreakPill({ result }: { result: StreakResult }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex items-center gap-1 font-semibold">
        <Flame className={`h-4 w-4 ${result.current > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
        {result.current}
      </span>
      <span className="text-xs text-muted-foreground">best {result.longest}</span>
    </div>
  )
}

export function StreaksWidget() {
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const reviews = useReviewsStore((s) => s.reviews)

  const habitStreaks = useMemo<StreakRow[]>(() => {
    return habitTasks
      .map((task) => {
        const dates: string[] = []
        for (const dateKey of Object.keys(weeklyData)) {
          const completion = weeklyData[dateKey]?.[task.id]
          if (completion && isHabitGoalMet(task, completion)) dates.push(dateKey)
        }
        return { id: task.id, name: task.name, streak: computeStreak(dates, { unit: "day" }) }
      })
      .sort((a, b) => b.streak.current - a.streak.current || b.streak.longest - a.streak.longest)
  }, [habitTasks, weeklyData])

  const reviewStreak = useMemo<StreakResult>(() => {
    const dayKeys = reviews.filter((r) => r.period === "day").map((r) => r.periodKey)
    return computeStreak(dayKeys, { unit: "day" })
  }, [reviews])

  const topHabitStreak = habitStreaks[0]?.streak.current ?? 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-orange-500/10 p-2 text-orange-500">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{topHabitStreak}</p>
                <p className="text-xs text-muted-foreground">Best active habit streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reviewStreak.current}</p>
                <p className="text-xs text-muted-foreground">Daily review streak (best {reviewStreak.longest})</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Habit streaks</CardTitle>
        </CardHeader>
        <CardContent>
          {habitStreaks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No habits yet.</p>
          ) : (
            <div className="divide-y">
              {habitStreaks.map((row) => (
                <div key={row.id} className="flex items-center justify-between py-2">
                  <span className="text-sm truncate flex-1 pr-3">{row.name}</span>
                  <div className="flex items-center gap-3">
                    {row.streak.current > 0 && row.streak.current === row.streak.longest && (
                      <Badge variant="secondary" className="text-[10px]">
                        personal best
                      </Badge>
                    )}
                    <StreakPill result={row.streak} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default StreaksWidget
