/**
 * components/Analytics/enhanced-analytics.tsx — Analytics screen
 *
 * Title bar + status stay Lists furniture. Range + left index are milled fascia;
 * canvases stay a light instrument studio: shared range (presets or custom
 * from–to, Prev/Next period step), studio index, charts. Spec: §15. Face gray
 * `#c0c0c0`, not cream paper.
 */
"use client"

import { Suspense, useRef } from "react"
import { APP_NAV_KEYS, analyticsScrollSlot } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { usePersistedScroll } from "@/lib/use-persisted-scroll"
import { orbFor } from "@/components/Icons/Icon"
import { useAnalyticsRange } from "./analytics-range-store"
import { ANALYTICS_VIEWS } from "./analytics-views"
import { ANALYTICS_TABS, ANALYTICS_TAB_HELP, tabLabel } from "./analytics-tabs"
import { AnalyticsNav } from "./AnalyticsNav"
import { useScreenTimeSync } from "@/hooks/use-screentime-sync"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MachineLoading } from "@/components/machine-loading"
import { CyclePhaseConcealed, cycleDetailsConcealed } from "./cycle-phase-concealed"
import "./analytics-chrome.css"

export function EnhancedAnalytics() {
  const [analyticsTab, setAnalyticsTab] = usePersistedTab(APP_NAV_KEYS.analyticsTab, ANALYTICS_TABS, "habits")
  const range = useAnalyticsRange()
  const contentRef = useRef<HTMLDivElement>(null)
  usePersistedScroll(analyticsScrollSlot(analyticsTab), contentRef)
  useScreenTimeSync()
  const enableCycleTracking = useTimeTrackingStore((s) => s.enableCycleTracking)
  const cycleDetailsOpen = useTimeTrackingStore((s) => s.cycleDetailsOpen)
  const concealCycle =
    analyticsTab === "cycle-phase" && cycleDetailsConcealed(enableCycleTracking, cycleDetailsOpen)
  const View = ANALYTICS_VIEWS[analyticsTab]

  return (
    <TooltipProvider delayDuration={250}>
    <div className="fm98 an95" data-ui-name="Analytics" data-ui-docs="components/Analytics/README.md">
      <div className="fm-window">
        <div className="fm-title-bar">
          <div className="fm-title-bar-text">
            <img src={orbFor("analytics")} alt="" width={16} height={16} />
            Analytics
          </div>
          <div className="fm-title-bar-controls">
            <button type="button" className="fm-title-btn" aria-label="Minimize">
              _
            </button>
            <button type="button" className="fm-title-btn" aria-label="Maximize">
              □
            </button>
            <button type="button" className="fm-title-btn b2-close-key" aria-label="Close">
              ×
            </button>
          </div>
        </div>

        <div className="fm-toolbar an-range-bar">
          <span className="an-nameplate">Range</span>
          <div className="an-range-keys" role="group" aria-label="Analytics range presets">
            {range.presets.map((d) => (
              <button
                key={d}
                type="button"
                className="an-range-chip"
                aria-pressed={range.mode === "preset" && range.days === d}
                title={`Rolling last ${d} days. One shared window for every Analytics view.`}
                onClick={() => range.setDays(d)}
              >
                {d} days
              </button>
            ))}
            <button
              type="button"
              className="an-range-chip"
              aria-pressed={range.mode === "custom"}
              title="Inclusive local from–to dates, or this week / this month / this season. The label is the actual dates."
              onClick={() => range.setCustomRange(range.fromKey ?? "", range.toKey ?? "")}
            >
              Custom
            </button>
          </div>
          {range.mode === "custom" && (
            <span className="an-range-custom">
              <label title="Inclusive start (local calendar day)">
                <span className="sr-only">From date</span>
                <input
                  type="date"
                  value={range.fromKey ?? ""}
                  aria-label="From date"
                  onChange={(e) => range.setCustomRange(e.target.value, range.toKey ?? e.target.value)}
                />
              </label>
              <label title="Inclusive end (local calendar day)">
                <span className="sr-only">To date</span>
                <input
                  type="date"
                  value={range.toKey ?? ""}
                  aria-label="To date"
                  onChange={(e) => range.setCustomRange(range.fromKey ?? e.target.value, e.target.value)}
                />
              </label>
              <button
                type="button"
                className="an-range-chip"
                title="This Monday–Sunday, labeled as those dates"
                onClick={() => range.setNamedPeriod("week")}
              >
                This week
              </button>
              <button
                type="button"
                className="an-range-chip"
                title="This calendar month, labeled as first–last date"
                onClick={() => range.setNamedPeriod("month")}
              >
                This month
              </button>
              <button
                type="button"
                className="an-range-chip"
                title="This calendar quarter, labeled as its first–last date. Q3 is Fall."
                onClick={() => range.setNamedPeriod("quarter")}
              >
                This season
              </button>
            </span>
          )}
          <span className="an-range-step" role="group" aria-label="Period step">
            <button
              type="button"
              className="an-range-chip an-range-step-key"
              aria-label="Previous period"
              title="Shift the shared window back by its own length (or by week / month / season)."
              onClick={() => range.stepPeriod(-1)}
            >
              Prev
            </button>
            <span className="an-range-label" aria-label="Analytics date range">
              {range.label}
            </span>
            <button
              type="button"
              className="an-range-chip an-range-step-key"
              aria-label="Next period"
              title="Shift the shared window forward by the same length. Stops at today."
              disabled={!range.canStepNext}
              onClick={() => range.stepPeriod(1)}
            >
              Next
            </button>
          </span>
        </div>

        <div className="an-studio">
          <AnalyticsNav tab={analyticsTab} onTabChange={setAnalyticsTab} />
          <div className="an-content" role="tabpanel" ref={contentRef}>
            {concealCycle ? null : (
              <p className="an-view-help">{ANALYTICS_TAB_HELP[analyticsTab]}</p>
            )}
            <Suspense fallback={<MachineLoading size="nest" />}>
              {concealCycle ? <CyclePhaseConcealed /> : <View />}
            </Suspense>
          </div>
        </div>

        <div className="fm-status-bar">
          <p className="fm-status-field">{range.caption}</p>
          <p className="fm-status-field shrink">{tabLabel(analyticsTab)}</p>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
