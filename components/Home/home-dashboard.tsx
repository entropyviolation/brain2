/**
 * components/Home/home-dashboard.tsx — Home dashboard container
 *
 * "The epicenter": the screen opened first each session. Renders the date card,
 * today's progress, points wells, and hidable overview squares (same strip on
 * every Home sub-tab), review tile, and the five sub-tabs
 * (Habits / Plan / To Do / Goals / Tracking), mounting the matching sub-view.
 * Tracking also mounts a shared `PenPalette` + `PenModeBar` above Time Grid /
 * Activity Log / Day Log. The Tracking window uses milled fascia (CRT title +
 * equal-fill view keys with power lamps in `.trk-fascia`, same bay language as
 * Plan / To Do). **Log activity** on the grid rail is Time Grid and Day Log
 * only — Activity Log already has one in its period bar. Stack: fascia (title +
 * view keys), then Working now (`.trk-now-module`: Operations clock, then
 * pen-color **Working on right now**, shared by all three tabs), then pen tray +
 * tools, view modes, TIME/DIV + the plot, then `TrackingDayNotes` under all three.
 *
 * Spec: §8 (Home Dashboard).
 */
"use client"

import { useCallback, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WeeklyTaskTracker } from "@/components/Home/Habits/habit-tracker"
import { PlanPanel } from "@/components/Home/Plan/plan-panel"
import { TodoPanel } from "@/components/Home/ToDo/todo-panel"
import { GoalsTracker } from "@/components/Home/Goals/goals-tracker"
import { HomeOverview } from "@/components/Home/home-overview"
import { HomeWidgetsMenu } from "@/components/Home/home-widgets-menu"
import { NeedsAttention } from "@/components/Home/NeedsAttention"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import { TimeGrid } from "@/components/Home/Tracking/time-grid"
import { ActualDayView } from "@/components/Home/Tracking/actual-day-view"
import { TrackingActivityLog } from "@/components/Home/Tracking/tracking-activity-log"
import { WorkingNowStrip } from "@/components/Home/Tracking/working-now-strip"
import { PenColorNowStrip } from "@/components/Home/Tracking/pen-color-now-strip"
import { TrackingDayNotes } from "@/components/Home/Tracking/tracking-day-notes"
import { PenPalette } from "@/components/Home/Tracking/pen-palette"
import { PenModeBar } from "@/components/Home/Tracking/pen-mode-bar"
import { LogActivityLatch } from "@/components/Home/Tracking/log-activity-dialog"
import { TrkChromeStack } from "@/components/Home/Tracking/trk-instrument"
import { useCurrentDate, useLiveToday } from "@/lib/use-current-date"
import { format } from "date-fns"
import type { ReviewPeriod } from "@/lib/types"
import { APP_NAV_KEYS } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { orbFor } from "@/components/Icons"
import { useTrackingUndoHotkey } from "@/components/Home/Tracking/tracking-undo"
import "./home-chrome.css"
import "@/components/Home/Tracking/tracking-chrome.css"
import "@/components/Home/Habits/habit-chrome.css"

type HomeTab = "habits" | "plan" | "todo" | "goals" | "tracking"
type TrackingTab = "grid" | "activity" | "daylog"

const HOME_TABS: HomeTab[] = ["habits", "plan", "todo", "goals", "tracking"]
const TRACKING_TABS: TrackingTab[] = ["grid", "activity", "daylog"]

export function HomeDashboard() {
  const { currentDate, setCurrentDate } = useCurrentDate()
  const liveToday = useLiveToday()
  const [activeTab, setActiveTab] = usePersistedTab(APP_NAV_KEYS.homeTab, HOME_TABS, "habits")
  const [trackingTab, setTrackingTab] = usePersistedTab(APP_NAV_KEYS.homeTrackingTab, TRACKING_TABS, "grid")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  useTrackingUndoHotkey(activeTab === "tracking")

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
              currentDate={currentDate}
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
          <WeeklyTaskTracker currentDate={currentDate} />
        </TabsContent>

        <TabsContent value="plan" className="home-pane">
          <PlanPanel currentDate={currentDate} setCurrentDate={setCurrentDate} />
        </TabsContent>

        <TabsContent value="todo" className="home-pane">
          <TodoPanel />
        </TabsContent>

        <TabsContent value="goals" className="home-pane">
          <GoalsTracker />
        </TabsContent>

        <TabsContent value="tracking" className="home-pane">
          <div className="trk95" data-ui-name="Tracking" data-ui-docs="components/Home/Tracking/README.md">
            <div className="trk-window">
              <Tabs value={trackingTab} onValueChange={(v) => setTrackingTab(v as TrackingTab)}>
                <div className="trk-fascia">
                  <div className="trk-fascia-row">
                    <div className="trk-mark">
                      <img src={orbFor("home-tracking")} alt="" className="trk-title-orb" />
                      <h2>Tracking</h2>
                    </div>
                    <div className="hab-view-changer trk-view-keys">
                      <TabsList aria-label="Tracking view">
                        <TabsTrigger value="grid">Time Grid</TabsTrigger>
                        <TabsTrigger value="activity">Activity Log</TabsTrigger>
                        <TabsTrigger value="daylog">Day Log</TabsTrigger>
                      </TabsList>
                    </div>
                  </div>
                </div>
                <div className="trk-now-module">
                  <WorkingNowStrip />
                  <PenColorNowStrip />
                </div>
                <TrkChromeStack
                  pens={<PenPalette embedded />}
                  modeBar={<PenModeBar />}
                  gridAction={trackingTab === "activity" ? undefined : <LogActivityLatch />}
                >
                  <div className="trk-desktop">
                    <TabsContent value="grid" className="mt-0">
                      <TimeGrid showPalette={false} currentDate={currentDate} setCurrentDate={setCurrentDate} />
                    </TabsContent>
                    <TabsContent value="activity" className="mt-0">
                      <TrackingActivityLog currentDate={currentDate} setCurrentDate={setCurrentDate} />
                    </TabsContent>
                    <TabsContent value="daylog" className="mt-0">
                      <ActualDayView currentDate={currentDate} setCurrentDate={setCurrentDate} />
                    </TabsContent>
                  </div>
                  <TrackingDayNotes currentDate={currentDate} />
                </TrkChromeStack>
              </Tabs>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      </div>
    </div>
  )
}
