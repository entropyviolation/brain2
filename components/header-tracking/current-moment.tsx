/**
 * Current moment — the top of the Now dialog, on both panes.
 * Activity, Location, Mood, and Company, plus the Metrics key, Working on,
 * Events, and Thought process. Estimated facts wear `~` and the dashed est.
 * treatment. Update state opens from a lane and writes on either pane.
 * Metrics is the same wellbeing logger the header used to open.
 */
"use client"

import { useMemo, useState } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { minutesPastMidnight } from "@/lib/ingest/times"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import {
  formatLoggedMoment,
  livePresenceHints,
  PRESENCE_SCOPE_IDS,
  PRESENCE_SCOPE_LABEL,
  trackingScopeStatuses,
  type PresenceScopeId,
  type ScopeStatusLane,
} from "@/lib/tracking-presence"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { WorkingNowStrip } from "@/components/Home/Tracking/working-now-strip"
import { MetricLoggerButton } from "@/components/Tracking/MetricLogger"
import { EstMark } from "@/components/header-tracking/est-mark"
import { NowLogLists } from "@/components/header-tracking/now-log-lists"
import { UpdateState } from "@/components/header-tracking/update-state"

function emptyLane(scopeId: PresenceScopeId): ScopeStatusLane {
  return {
    scopeId,
    scopeName: PRESENCE_SCOPE_LABEL[scopeId],
    kind: "empty",
    name: "—",
    estimated: false,
    loggedAt: null,
  }
}

export function useCurrentMomentLanes(): { today: string; lanes: ScopeStatusLane[] } {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const workSession = useWorkSessionStore((s) => s.session)
  const penSession = usePenColorSessionStore((s) => s.session)
  const now = new Date()
  const today = formatLocalDateKey(now)
  const live = livePresenceHints({
    workSession: workSession ? { title: workSession.title, scopeId: workSession.scopeId } : null,
    penSession: penSession ? { title: penSession.title, scopeId: penSession.scopeId } : null,
  })
  const lanes = useMemo(() => {
    const statuses = trackingScopeStatuses({
      date: today,
      min: minutesPastMidnight(now),
      entries,
      scopes,
      live,
    })
    const byId = new Map(statuses.map((lane) => [lane.scopeId, lane]))
    return PRESENCE_SCOPE_IDS.map((scopeId) => byId.get(scopeId) ?? emptyLane(scopeId))
    // The strip reads the store. It is not a ticking clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, entries, scopes, live])
  return { today, lanes }
}

export function CurrentMoment({
  selected,
  onSelect,
}: {
  selected?: string | null
  onSelect?: (scopeId: string) => void
}) {
  const { today, lanes } = useCurrentMomentLanes()

  return (
    <div className="htk-moment-lanes" role="list">
        {lanes.map((item) => {
          const when = item.loggedAt ? formatLoggedMoment(item.loggedAt, today) : "empty"
          const body = (
            <>
              <span className="htk-lane-scope">{item.scopeName}</span>
              <span className="htk-lane-name">
                <EstMark estimated={item.kind !== "empty" && item.estimated}>{item.name}</EstMark>
              </span>
              <span className="htk-lane-kind">
                {item.loggedAt ? <EstMark estimated={item.estimated}>{when}</EstMark> : "empty"}
              </span>
            </>
          )
          if (!onSelect) {
            return (
              <div key={item.scopeId} role="listitem" className="htk-lane" data-kind={item.kind} data-testid={`htk-lane-${item.scopeId}`}>
                {body}
              </div>
            )
          }
          return (
            <button
              key={item.scopeId}
              type="button"
              role="listitem"
              className="htk-lane"
              data-kind={item.kind}
              data-testid={`htk-lane-${item.scopeId}`}
              aria-pressed={selected === item.scopeId}
              onClick={() => onSelect(item.scopeId)}
            >
              {body}
            </button>
          )
        })}
    </div>
  )
}

/** Working-now first; paint lanes / Update state behind Paint…. Stays mounted across panes. */
export function CurrentMomentDeck() {
  const { today, lanes } = useCurrentMomentLanes()
  const [selected, setSelected] = useState<string | null>(null)
  const [nowName, setNowName] = useState("")
  const [paintOpen, setPaintOpen] = useState(false)
  const lane = lanes.find((item) => item.scopeId === selected) ?? null

  function selectLane(scopeId: string) {
    const next = lanes.find((item) => item.scopeId === scopeId)
    setSelected(scopeId)
    setNowName(next && next.kind !== "empty" ? next.name : "")
    setPaintOpen(true)
  }

  return (
    <section className="htk-moment" aria-label="Current moment" data-testid="htk-current-moment">
      <p className="htk-moment-title">Current moment</p>
      <div className="htk-working" data-testid="htk-working-now">
        <WorkingNowStrip />
      </div>
      <div className="htk-moment-band htk-moment-band-metrics">
        <MetricLoggerButton className="htk-metrics" />
      </div>
      <details className="htk-paint" open={paintOpen} onToggle={(e) => setPaintOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="htk-paint-sum">Paint…</summary>
        <div className="htk-paint-body">
          <CurrentMoment selected={selected} onSelect={selectLane} />
          {lane ? (
            <UpdateState lane={lane} today={today} nowName={nowName} onName={setNowName} />
          ) : (
            <p className="htk-hint">Pick a view to add what is true now, or a recent sequence.</p>
          )}
        </div>
      </details>
      <NowLogLists dayKey={today} />
    </section>
  )
}
