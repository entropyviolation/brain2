/**
 * components/Home/home-dashboard.tsx — Home dashboard container
 *
 * "The epicenter": the screen opened first each session. Renders the date card,
 * today's progress, points wells, and hidable overview squares (same strip on
 * every Home sub-tab). Those squares read the selected day unless Widgets →
 * Follow the clock is on, in which case they read the wall clock. The date
 * plate stays the clock. Then the review tile and the five sub-tabs
 * (Habits / Plan / To Do / Goals / Tracking), mounting the matching sub-view.
 * Tracking also mounts a shared `PenPalette` + `PenModeBar` above Time Grid /
 * Activity Log / Day Log. The Tracking window uses milled fascia (CRT title +
 * equal-fill view keys with power lamps in `.trk-fascia`, same bay language as
 * Plan / To Do). **Log activity** on the grid rail is Time Grid and Day Log
 * only — Activity Log already has one in its period bar. Stack: fascia (title +
 * view keys), then Working now (`.trk-now-module`: Operations clock, then
 * pen-color **Working on right now**, shared by all three tabs), then pen tray +
 * tools, view modes, TIME/DIV + the plot, then `TrackingDayNotes` under all three.
 * Selecting Tracking scrolls `.trk-window` to the top of the viewport just under
 * the pinned app header. The view bar and the date are not sticky.
 *
 * Spec: §8 (Home Dashboard).
 */
"use client"

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MachineLoading } from "@/components/machine-loading"
import { HomeOverview } from "@/components/Home/home-overview"
import { HomeWidgetsMenu } from "@/components/Home/home-widgets-menu"
import { NeedsAttention } from "@/components/Home/NeedsAttention"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import { homeWidgetDate } from "@/lib/home-widgets"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"
import { useCurrentDate, useLiveToday } from "@/lib/use-current-date"
import { format } from "date-fns"
import type { ReviewPeriod } from "@/lib/types"
import { APP_NAV_KEYS } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { useTrackingUndoHotkey } from "@/components/Home/Tracking/tracking-undo"
import "./home-chrome.css"
import "@/components/Home/Tracking/tracking-chrome.css"
import "@/components/Home/Habits/habit-chrome.css"

type HomeTab = "habits" | "plan" | "todo" | "goals" | "tracking"

const HOME_TABS: HomeTab[] = ["habits", "plan", "todo", "goals", "tracking"]

const WeeklyTaskTracker = lazy(() =>
  import("@/components/Home/Habits/habit-tracker").then((mod) => ({ default: mod.WeeklyTaskTracker })),
)
const PlanPanel = lazy(() =>
  import("@/components/Home/Plan/plan-panel").then((mod) => ({ default: mod.PlanPanel })),
)
const TodoPanel = lazy(() =>
  import("@/components/Home/ToDo/todo-panel").then((mod) => ({ default: mod.TodoPanel })),
)
const GoalsTracker = lazy(() =>
  import("@/components/Home/Goals/goals-tracker").then((mod) => ({ default: mod.GoalsTracker })),
)
const TrackingPanel = lazy(() =>
  import("@/components/Home/Tracking/tracking-desk").then((mod) => ({ default: mod.TrackingDesk })),
)

function HomePanelFallback() {
  return <MachineLoading size="nest" />
}

/** Wall clock for the overview strip. A fresh instant on each pulse, once a minute, only while Follow the clock is on. */
function useWidgetClock(active: boolean): Date {
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setPulse((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [active])

  return useMemo(() => new Date(), [active, pulse])
}

/** Put the Tracking window at the top of the viewport, just under the pinned app header. */
function scrollTrackingWindowUnderHeader(): boolean {
  const target = document.querySelector<HTMLElement>(".trk-window")
  if (!target) return false
  const header = document.querySelector<HTMLElement>('[data-testid="app-header"]')
  const headerH = header?.getBoundingClientRect().height ?? 0
  const top = target.getBoundingClientRect().top + window.scrollY - headerH
  window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "auto" })
  return true
}

export function HomeDashboard() {
  const { currentDate, setCurrentDate } = useCurrentDate()
  const liveToday = useLiveToday()
  const widgetsFollowClock = useHomeWidgetsStore((s) => s.widgetsFollowClock)
  const widgetNow = useWidgetClock(widgetsFollowClock)
  const overviewDate = homeWidgetDate(currentDate, widgetNow, widgetsFollowClock)
  const [activeTab, setActiveTab] = usePersistedTab(APP_NAV_KEYS.homeTab, HOME_TABS, "habits")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  useTrackingUndoHotkey(activeTab === "tracking")

  useEffect(() => {
    if (activeTab !== "tracking") return
    let cancelled = false
    let frame = 0
    const started = performance.now()
    const attempt = () => {
      if (cancelled) return
      if (scrollTrackingWindowUnderHeader()) return
      if (performance.now() - started > 2000) return
      frame = requestAnimationFrame(attempt)
    }
    attempt()
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [activeTab])

  const handleStartReview = useCallback((_period: ReviewPeriod, _periodKey: string) => {
    // Header Reviews dropdown owns the full dialog; banner nudges the user there.
    document.querySelector<HTMLButtonElement>('[data-home-review-entry]')?.click()
  }, [])

  const habitsConsole = activeTab === "habits"

  return (
    <div className={habitsConsole ? "hab95" : undefined}>
      <div className={habitsConsole ? "hab-console" : undefined}>
      <div className="home95">
        <div className="home-window">
          <div className="home-title-bar home-date-plate">
            <h2>
              <span className="home-date-weekday">{format(liveToday, "EEEE")}</span>
              <span className="home-date-rest">
                {format(liveToday, "MMMM d")}
                <span className="home-title-year">{format(liveToday, "yyyy")}</span>
              </span>
            </h2>
            <HomeWidgetsMenu />
          </div>
          <div className="home-window-body">
            <HomeOverview
              currentDate={overviewDate}
              onStartReview={handleStartReview}
              onOpenHomeTab={(tab) => setActiveTab(tab)}
            />

            <NeedsAttention onOpenItem={setSelectedTaskId} className={habitsConsole ? "hab-na" : undefined} />
          </div>
        </div>
      </div>

      {/* Main dashboard tabs — milled fascia bay; air sits above the strip, panel flush below */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as HomeTab)}
        className={habitsConsole ? "hab-body home-body w-full" : "home-body w-full"}
      >
        <TabsList
          className="home-tabs"
          data-ui-name="Home tabs"
          data-ui-docs="components/Home/README.md"
          aria-label="Home view"
        >
          <TabsTrigger value="habits">Habits</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="todo">To Do</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="habits" className={habitsConsole ? "hab-pane home-pane" : "home-pane"}>
          <Suspense fallback={<HomePanelFallback />}>
            <WeeklyTaskTracker currentDate={currentDate} />
          </Suspense>
        </TabsContent>

        <TabsContent value="plan" className="home-pane">
          <Suspense fallback={<HomePanelFallback />}>
            <PlanPanel currentDate={currentDate} setCurrentDate={setCurrentDate} />
          </Suspense>
        </TabsContent>

        <TabsContent value="todo" className="home-pane">
          <Suspense fallback={<HomePanelFallback />}>
            <TodoPanel currentDate={currentDate} setCurrentDate={setCurrentDate} />
          </Suspense>
        </TabsContent>

        <TabsContent value="goals" className="home-pane">
          <Suspense fallback={<HomePanelFallback />}>
            <GoalsTracker />
          </Suspense>
        </TabsContent>

        <TabsContent value="tracking" className="home-pane">
          <Suspense fallback={<HomePanelFallback />}>
            <TrackingPanel currentDate={currentDate} setCurrentDate={setCurrentDate} />
          </Suspense>
        </TabsContent>
      </Tabs>

      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      </div>
    </div>
  )
}
