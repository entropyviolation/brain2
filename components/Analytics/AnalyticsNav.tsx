/**
 * components/Analytics/AnalyticsNav.tsx — Studio index
 *
 * Groups on a rail; views of the selected group beneath. Same role="tab"
 * contract as before so tests and screenshot capture still click group then view.
 */
"use client"

import { useMemo, useState, useEffect } from "react"
import {
  ANALYTICS_TAB_GROUPS,
  firstTabInGroup,
  groupForTab,
  type AnalyticsGroupId,
  type AnalyticsTab,
} from "./analytics-tabs"
import { APP_NAV_KEYS, readStoredRecord, writeStoredRecord } from "@/lib/app-navigation"

function readGroupViews(): Partial<Record<AnalyticsGroupId, AnalyticsTab>> {
  const stored = readStoredRecord(APP_NAV_KEYS.analyticsGroupViews)
  const out: Partial<Record<AnalyticsGroupId, AnalyticsTab>> = {}
  for (const [groupId, tabId] of Object.entries(stored)) {
    const group = ANALYTICS_TAB_GROUPS.find((g) => g.id === groupId)
    if (group?.tabs.some((t) => t.id === tabId)) out[groupId as AnalyticsGroupId] = tabId as AnalyticsTab
  }
  return out
}

export function AnalyticsNav({
  tab,
  onTabChange,
}: {
  tab: AnalyticsTab
  onTabChange: (tab: AnalyticsTab) => void
}) {
  const group = groupForTab(tab)
  const [lastInGroup, setLastInGroup] = useState<Partial<Record<AnalyticsGroupId, AnalyticsTab>>>(readGroupViews)

  useEffect(() => {
    writeStoredRecord(APP_NAV_KEYS.analyticsGroupViews, lastInGroup as Record<string, string>)
  }, [lastInGroup])

  useEffect(() => {
    setLastInGroup((prev) => (prev[group.id] === tab ? prev : { ...prev, [group.id]: tab }))
  }, [group.id, tab])

  const views = useMemo(() => group.tabs, [group])

  const selectGroup = (groupId: AnalyticsGroupId) => {
    if (groupId === group.id) return
    const next = lastInGroup[groupId] ?? firstTabInGroup(groupId)
    onTabChange(next)
  }

  const selectView = (next: AnalyticsTab) => {
    setLastInGroup((prev) => ({ ...prev, [group.id]: next }))
    onTabChange(next)
  }

  return (
    <div
      className="an-nav"
      data-ui-name="Analytics index"
      data-ui-help="Studio groups and views over recorded life."
      data-ui-docs="components/Analytics/README.md"
      data-ui-docs-anchor="studio-views"
    >
      <nav className="an-group-bar" aria-label="Analytics groups" role="tablist">
        {ANALYTICS_TAB_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={g.id === group.id}
            className="an-group-btn"
            title={`${g.label}: ${g.tabs.map((t) => t.label).join(", ")}`}
            onClick={() => selectGroup(g.id)}
          >
            {g.label}
          </button>
        ))}
      </nav>
      <nav className="an-view-bar" aria-label="Analytics views" role="tablist">
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={tab === view.id}
            className="an-view-btn"
            title={view.label}
            onClick={() => selectView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
