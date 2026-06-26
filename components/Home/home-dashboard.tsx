/**
 * components/Home/home-dashboard.tsx — Home dashboard container
 *
 * "The epicenter": the screen opened first each session. Renders the date card,
 * today's progress quickview, the Points Stats grid, review banner, and the five
 * sub-tabs (Habits / Plan / To Do / Goals / Tracking), mounting the matching sub-view.
 *
 * Spec: §8 (Home Dashboard).
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock } from "lucide-react"
import { WeeklyTaskTracker } from "@/components/Home/Habits/habit-tracker"
import { PlanPanel } from "@/components/Home/Plan/plan-panel"
import { TodoPanel } from "@/components/Home/ToDo/todo-panel"
import { GoalsTracker } from "@/components/Home/Goals/goals-tracker"
import { PointsStats } from "@/components/Home/points-stats"
import { DailyProgressQuickview } from "@/components/Home/daily-progress-quickview"
import { HomeReviewBanner } from "@/components/Home/home-review-banner"
import { NeedsAttention } from "@/components/Home/NeedsAttention"
import { TaskDetailPopup } from "@/components/task-detail-popup"
import { TimeGrid } from "@/components/Home/Tracking/time-grid"
import { ActualDayView } from "@/components/Home/Tracking/actual-day-view"
import { useCurrentDate } from "@/lib/use-current-date"
import { format } from "date-fns"
import type { ReviewPeriod } from "@/lib/types"
import { APP_NAV_KEYS, readStoredTab, writeStoredTab } from "@/lib/app-navigation"

type HomeTab = "habits" | "plan" | "todo" | "goals" | "tracking"
type TrackingTab = "grid" | "daylog"

const HOME_TABS: HomeTab[] = ["habits", "plan", "todo", "goals", "tracking"]
const TRACKING_TABS: TrackingTab[] = ["grid", "daylog"]

export function HomeDashboard() {
  const { currentDate, setCurrentDate } = useCurrentDate()
  const [activeTab, setActiveTab] = useState<HomeTab>(() => readStoredTab(APP_NAV_KEYS.homeTab, HOME_TABS, "habits"))
  const [trackingTab, setTrackingTab] = useState<TrackingTab>(() =>
    readStoredTab(APP_NAV_KEYS.homeTrackingTab, TRACKING_TABS, "grid"),
  )
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    writeStoredTab(APP_NAV_KEYS.homeTab, activeTab)
  }, [activeTab])

  useEffect(() => {
    writeStoredTab(APP_NAV_KEYS.homeTrackingTab, trackingTab)
  }, [trackingTab])

  const handleStartReview = useCallback((_period: ReviewPeriod, _periodKey: string) => {
    // Header Reviews dropdown owns the full dialog; banner nudges the user there.
    document.querySelector<HTMLButtonElement>('[data-home-review-entry]')?.click()
  }, [])

  return (
    <div className="space-y-6">
      <HomeReviewBanner currentDate={currentDate} onStartReview={handleStartReview} />

      {/* Header with date and points stats */}
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1 card-hover">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">{format(currentDate, "EEEE, MMMM d")}</CardTitle>
                <p className="text-muted-foreground">{format(currentDate, "yyyy")}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <PointsStats currentDate={currentDate} />
          </CardContent>
        </Card>

        <DailyProgressQuickview currentDate={currentDate} />
      </div>

      <NeedsAttention onOpenItem={setSelectedTaskId} />

      {/* Main dashboard tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as HomeTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="habits">Habits</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="todo">To Do</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="habits" className="mt-6">
          <WeeklyTaskTracker currentDate={currentDate} />
        </TabsContent>

        <TabsContent value="plan" className="mt-6">
          <PlanPanel currentDate={currentDate} setCurrentDate={setCurrentDate} />
        </TabsContent>

        <TabsContent value="todo" className="mt-6">
          <TodoPanel />
        </TabsContent>

        <TabsContent value="goals" className="mt-6">
          <GoalsTracker />
        </TabsContent>

        <TabsContent value="tracking" className="mt-6 space-y-4">
          <Tabs value={trackingTab} onValueChange={(v) => setTrackingTab(v as TrackingTab)}>
            <TabsList>
              <TabsTrigger value="grid">Time Grid</TabsTrigger>
              <TabsTrigger value="daylog">Day Log</TabsTrigger>
            </TabsList>
            <TabsContent value="grid" className="mt-4">
              <Card className="card-hover">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Time Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TimeGrid />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="daylog" className="mt-4">
              <Card className="card-hover">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Actual Day Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ActualDayView currentDate={currentDate} setCurrentDate={setCurrentDate} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  )
}
