/**
 * components/Home/points-stats.tsx — Points summary cards
 */
"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Trophy, Target, Calendar, TrendingUp } from "lucide-react"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useThemeStore } from "@/lib/theme-store"

interface PointsStatsProps {
  currentDate: Date
}

export function PointsStats({ currentDate }: PointsStatsProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const colors = useThemeStore((s) => s.colors)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const getTotalPoints = usePointsStore((s) => s.getTotalPoints)
  const getDayPoints = usePointsStore((s) => s.getDayPoints)
  const getWeekPoints = usePointsStore((s) => s.getWeekPoints)
  const getMonthPoints = usePointsStore((s) => s.getMonthPoints)
  const getPossibleDayPoints = usePointsStore((s) => s.getPossibleDayPoints)
  const getPossibleWeekPoints = usePointsStore((s) => s.getPossibleWeekPoints)
  const getPossibleMonthPoints = usePointsStore((s) => s.getPossibleMonthPoints)

  const totalPoints = mounted ? getTotalPoints() : 0
  const dayPoints = mounted ? getDayPoints(currentDate) : 0
  const weekPoints = mounted ? getWeekPoints(currentDate) : 0
  const monthPoints = mounted ? getMonthPoints(currentDate) : 0

  const possibleDayPoints = mounted ? getPossibleDayPoints(currentDate, tasks) : 0
  const possibleWeekPoints = mounted ? getPossibleWeekPoints(currentDate, tasks) : 0
  const possibleMonthPoints = mounted ? getPossibleMonthPoints(currentDate, tasks) : 0

  const dayProgress = possibleDayPoints > 0 ? (dayPoints / (dayPoints + possibleDayPoints)) * 100 : 0
  const weekProgress = possibleWeekPoints > 0 ? (weekPoints / (weekPoints + possibleWeekPoints)) * 100 : 0
  const monthProgress = possibleMonthPoints > 0 ? (monthPoints / (monthPoints + possibleMonthPoints)) * 100 : 0

  // Re-render when habits complete (pointsHistory / weeklyData change)
  void pointsHistory
  void weeklyData

  const fmt = (n: number) => (mounted ? n.toLocaleString() : "—")

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4" style={{ color: colors.pointsAllTime }} />
            All Time Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ color: colors.pointsAllTime }} suppressHydrationWarning>
            {fmt(totalPoints)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total earned</p>
        </CardContent>
      </Card>

      <Card className="card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: colors.pointsToday }} />
            Today&apos;s Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ color: colors.pointsToday }} suppressHydrationWarning>
            {fmt(dayPoints)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {mounted && possibleDayPoints > 0 && `+${possibleDayPoints} possible`}
          </div>
          {mounted && possibleDayPoints > 0 && <Progress value={dayProgress} className="mt-2 h-2" />}
        </CardContent>
      </Card>

      <Card className="card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" style={{ color: colors.pointsWeek }} />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ color: colors.pointsWeek }} suppressHydrationWarning>
            {fmt(weekPoints)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {mounted && possibleWeekPoints > 0 && `+${possibleWeekPoints} possible`}
          </div>
          {mounted && possibleWeekPoints > 0 && <Progress value={weekProgress} className="mt-2 h-2" />}
        </CardContent>
      </Card>

      <Card className="card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: colors.pointsMonth }} />
            This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ color: colors.pointsMonth }} suppressHydrationWarning>
            {fmt(monthPoints)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {mounted && possibleMonthPoints > 0 && `+${possibleMonthPoints} possible`}
          </div>
          {mounted && possibleMonthPoints > 0 && <Progress value={monthProgress} className="mt-2 h-2" />}
        </CardContent>
      </Card>
    </div>
  )
}
