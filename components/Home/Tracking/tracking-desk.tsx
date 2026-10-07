/**
 * components/Home/Tracking/tracking-desk.tsx — Tracking window
 *
 * Loaded only when Home → Tracking is the open section, so Habits does not
 * parse the time grid. Fascia, working-now strips, pen tray, and the four
 * views (Time Grid / Activity Log / Day Log / Tracking log) stay one instrument.
 * The four fascia keys share one row when the bay has room. Tracking log
 * hides the pen desk; the other three views keep it.
 */
"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TimeGrid } from "@/components/Home/Tracking/time-grid"
import { ActualDayView } from "@/components/Home/Tracking/actual-day-view"
import { TrackingActivityLog } from "@/components/Home/Tracking/tracking-activity-log"
import { TrackingLogView } from "@/components/Home/Tracking/tracking-log-view"
import { WorkingNowStrip } from "@/components/Home/Tracking/working-now-strip"
import { PenColorNowStrip } from "@/components/Home/Tracking/pen-color-now-strip"
import { TrackingDayNotes } from "@/components/Home/Tracking/tracking-day-notes"
import { PenPalette } from "@/components/Home/Tracking/pen-palette"
import { PenModeBar } from "@/components/Home/Tracking/pen-mode-bar"
import { LogActivityLatch } from "@/components/Home/Tracking/log-activity-dialog"
import { TrkChromeStack } from "@/components/Home/Tracking/trk-instrument"
import { APP_NAV_KEYS } from "@/lib/app-navigation"
import { formatLocalDateKey } from "@/lib/date-utils"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { orbFor } from "@/components/Icons"

type TrackingTab = "grid" | "activity" | "daylog" | "log"
const TRACKING_TABS: TrackingTab[] = ["grid", "activity", "daylog", "log"]

export function TrackingDesk({
  currentDate,
  setCurrentDate,
}: {
  currentDate: Date
  setCurrentDate: (date: Date) => void
}) {
  const [trackingTab, setTrackingTab] = usePersistedTab(APP_NAV_KEYS.homeTrackingTab, TRACKING_TABS, "grid")
  const showPenDesk = trackingTab !== "log"

  return (
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
                  <TabsTrigger value="log">Tracking log</TabsTrigger>
                </TabsList>
              </div>
            </div>
          </div>
          <div className="trk-now-module">
            <WorkingNowStrip />
            {showPenDesk ? <PenColorNowStrip /> : null}
          </div>
          <TrkChromeStack
            pens={showPenDesk ? <PenPalette embedded /> : null}
            modeBar={showPenDesk ? <PenModeBar /> : null}
            gridAction={
              trackingTab === "activity" || trackingTab === "log" ? undefined : (
                <LogActivityLatch dateKey={formatLocalDateKey(currentDate)} />
              )
            }
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
              <TabsContent value="log" className="mt-0">
                <TrackingLogView currentDate={currentDate} setCurrentDate={setCurrentDate} />
              </TabsContent>
            </div>
            <TrackingDayNotes currentDate={currentDate} />
          </TrkChromeStack>
        </Tabs>
      </div>
    </div>
  )
}
