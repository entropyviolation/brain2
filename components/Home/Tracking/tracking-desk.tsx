/**
 * components/Home/Tracking/tracking-desk.tsx — Tracking window
 *
 * Loaded only when Home → Tracking is the open section, so Habits does not
 * parse the time grid. Fascia, working-now strips, pen tray, and the four
 * views (Time Grid / Activity Log / Day Log / Tracking log) stay one instrument.
 * The four fascia keys share one row when the bay has room. A gear at the
 * end of that row opens Tracking view settings on every view. Tracking log
 * hides the pen desk; the other three views keep it.
 */
"use client"

import { useState } from "react"
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
import { TrackingViewSettingsDialog } from "@/components/Home/Tracking/tracking-view-settings-dialog"
import { LogActivityLatch } from "@/components/Home/Tracking/log-activity-dialog"
import { TrkChromeStack } from "@/components/Home/Tracking/trk-instrument"
import { APP_NAV_KEYS } from "@/lib/app-navigation"
import { formatLocalDateKey } from "@/lib/date-utils"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const settingsScopeId = scopes.some((scope) => scope.id === activeScopeId) ? activeScopeId : scopes[0]?.id
  const showPenDesk = trackingTab !== "log"

  return (
    <div
      className="trk95"
      data-ui-name="Tracking"
      data-ui-docs="components/Home/Tracking/README.md"
      data-ui-help="Retrospective time and day log: painted minutes, actuals, and day-summary prose beside the plan."
      data-temporal="retrospective"
    >
      <div className="trk-window">
        <Tabs value={trackingTab} onValueChange={(v) => setTrackingTab(v as TrackingTab)}>
          <div className="trk-fascia">
            <div className="trk-fascia-row">
              <div className="trk-mark">
                <img src={orbFor("home-tracking")} alt="" className="trk-title-orb" />
                <h2>Tracking</h2>
              </div>
              <div className="trk-view-bay">
                <div className="hab-view-changer trk-view-keys">
                  <TabsList aria-label="Tracking view">
                    <TabsTrigger value="grid">Time Grid</TabsTrigger>
                    <TabsTrigger value="activity">Activity Log</TabsTrigger>
                    <TabsTrigger value="daylog">Day Log</TabsTrigger>
                    <TabsTrigger value="log">Tracking log</TabsTrigger>
                  </TabsList>
                </div>
                <button
                  type="button"
                  className="trk-settings-gear"
                  data-no95=""
                  aria-label="Tracking settings"
                  title="Tracking settings"
                  onClick={() => setSettingsOpen(true)}
                >
                  <TrackingGearIcon />
                </button>
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
        {settingsOpen && settingsScopeId ? (
          <TrackingViewSettingsDialog scopeId={settingsScopeId} onClose={() => setSettingsOpen(false)} />
        ) : null}
      </div>
    </div>
  )
}

function TrackingGearIcon() {
  return (
    <svg className="trk-settings-gear-icon" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.51.4 1.05.71 1.63.94l.36 2.54c.05.24.25.42.5.42h3.84c.25 0 .45-.18.5-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
      />
    </svg>
  )
}
