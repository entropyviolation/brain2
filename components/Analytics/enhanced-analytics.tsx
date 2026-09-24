/**
 * components/Analytics/enhanced-analytics.tsx — Analytics screen
 *
 * Title bar + status stay Lists furniture. The interior is a light instrument
 * studio: shared range (presets or custom from–to), studio index, canvases.
 * Spec: §15. Face gray `#c0c0c0`, not cream paper.
 */
"use client"

import { useRef } from "react"
import { APP_NAV_KEYS, analyticsScrollSlot } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { usePersistedScroll } from "@/lib/use-persisted-scroll"
import { orbFor } from "@/components/Icons/Icon"
import { PlanVsReality } from "@/components/Analytics/PlanVsReality"
import { CalibrationView } from "@/components/Analytics/CalibrationView"
import { StreaksWidget } from "@/components/Analytics/StreaksWidget"
import { MetricsTrends } from "@/components/Analytics/MetricsTrends"
import { CorrelationExplorer } from "@/components/Analytics/CorrelationExplorer"
import { ContextSwitchHeatmap } from "@/components/Analytics/ContextSwitchHeatmap"
import { TrackingAnalytics } from "@/components/Analytics/TrackingAnalytics"
import { SleepAnalytics } from "@/components/Analytics/SleepAnalytics"
import { RegretView } from "@/components/Analytics/RegretView"
import { useAnalyticsRange } from "./analytics-range-store"
import { ANALYTICS_TABS, ANALYTICS_TAB_HELP, tabLabel } from "./analytics-tabs"
import { AnalyticsNav } from "./AnalyticsNav"
import { CrossSection } from "./CrossSection"
import { ItemTypesLibrary } from "./ItemTypesLibrary"
import { OvercommitmentView } from "./OvercommitmentView"
import { Observatory } from "./Observatory"
import { HabitsView } from "./HabitsView"
import { PointsView } from "./PointsView"
import { ReflectionView } from "./ReflectionView"
import { TodoPulseView } from "./TodoPulseView"
import { ReviewsView } from "./ReviewsView"
import { VelocityView } from "./VelocityView"
import { CycleView } from "./CycleView"
import { GoalsAnalytics } from "./GoalsAnalytics"
import { CircadianView } from "./CircadianView"
import { PlacesView } from "./PlacesView"
import { MoodFieldView } from "./MoodFieldView"
import { OperationsAnalytics } from "./OperationsAnalytics"
import { ListsAreasView } from "./ListsAreasView"
import { AttributesView } from "./AttributesView"
import { TagsView, StagesView, WeightView } from "./LibraryCuts"
import { DiversityView } from "./DiversityView"
import { TransitionsView } from "./TransitionsView"
import { SpectrumView } from "./SpectrumView"
import { ScreenTimeView } from "./ScreenTimeView"
import { TextEventsView, TextSpansView } from "./TextPipelineView"
import { useScreenTimeSync } from "@/hooks/use-screentime-sync"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./analytics-chrome.css"

export function EnhancedAnalytics() {
  const [analyticsTab, setAnalyticsTab] = usePersistedTab(APP_NAV_KEYS.analyticsTab, ANALYTICS_TABS, "habits")
  const range = useAnalyticsRange()
  const contentRef = useRef<HTMLDivElement>(null)
  usePersistedScroll(analyticsScrollSlot(analyticsTab), contentRef)
  useScreenTimeSync()

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
            <button type="button" className="fm-title-btn" aria-label="Close">
              ×
            </button>
          </div>
        </div>

        <div className="fm-toolbar an-range-bar">
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
            title="Inclusive local from–to dates, or this week / this month. The label is the actual dates."
            onClick={() => range.setCustomRange(range.fromKey ?? "", range.toKey ?? "")}
          >
            Custom
          </button>
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
            </span>
          )}
          <span className="an-range-label" aria-label="Analytics date range">
            {range.label}
          </span>
        </div>

        <div className="an-studio">
          <AnalyticsNav tab={analyticsTab} onTabChange={setAnalyticsTab} />
          <div className="an-content" role="tabpanel" ref={contentRef}>
            <p className="an-view-help">{ANALYTICS_TAB_HELP[analyticsTab]}</p>
            {analyticsTab === "habits" && <HabitsView />}
            {analyticsTab === "points" && <PointsView />}
            {analyticsTab === "velocity" && <VelocityView />}
            {analyticsTab === "tracking" && <TrackingAnalytics />}
            {analyticsTab === "sleep" && <SleepAnalytics />}
            {analyticsTab === "screentime" && <ScreenTimeView />}
            {analyticsTab === "circadian" && <CircadianView />}
            {analyticsTab === "places" && <PlacesView />}
            {analyticsTab === "mood-field" && <MoodFieldView />}
            {analyticsTab === "diversity" && <DiversityView />}
            {analyticsTab === "transitions" && <TransitionsView />}
            {analyticsTab === "plan" && <PlanVsReality />}
            {analyticsTab === "calibration" && <CalibrationView />}
            {analyticsTab === "cycle" && <CycleView />}
            {analyticsTab === "streaks" && <StreaksWidget />}
            {analyticsTab === "reflection" && <ReflectionView />}
            {analyticsTab === "todo-pulse" && <TodoPulseView />}
            {analyticsTab === "reviews" && <ReviewsView />}
            {analyticsTab === "metrics" && <MetricsTrends />}
            {analyticsTab === "correlation" && <CorrelationExplorer />}
            {analyticsTab === "spectrum" && <SpectrumView />}
            {analyticsTab === "context-switch" && <ContextSwitchHeatmap />}
            {analyticsTab === "text-events" && <TextEventsView />}
            {analyticsTab === "text-spans" && <TextSpansView />}
            {analyticsTab === "regret" && <RegretView />}
            {analyticsTab === "overcommit" && <OvercommitmentView />}
            {analyticsTab === "observatory" && <Observatory />}
            {analyticsTab === "cross-section" && <CrossSection />}
            {analyticsTab === "goals" && <GoalsAnalytics />}
            {analyticsTab === "operations" && <OperationsAnalytics />}
            {analyticsTab === "item-types" && <ItemTypesLibrary />}
            {analyticsTab === "lists-areas" && <ListsAreasView />}
            {analyticsTab === "attributes" && <AttributesView />}
            {analyticsTab === "tags" && <TagsView />}
            {analyticsTab === "stages" && <StagesView />}
            {analyticsTab === "weight" && <WeightView />}
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
