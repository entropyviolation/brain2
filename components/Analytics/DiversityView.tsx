/**
 * components/Analytics/DiversityView.tsx — Shannon entropy + Gini + weekday cut
 *
 * Entropy of Tracking pens per day (H = −Σ p log₂ p of that day's minute
 * shares). Gini of the window's pen totals. Weekday vs weekend occupancy.
 * Empty/thin frames stay honest. SAMPLE_FLOORS.entropyDays.
 */
"use client"

import { useMemo, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatDuration } from "@/lib/time-entries"
import { giniCoefficient, mean } from "@/lib/metrics"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, isThinSample, thinWindowSentence } from "./analytics-range"
import { CanvasTitle, PhosphorTrace, StudioReadout } from "./studio-kit"
import { allocationGini, penMinutesByDay, weekdayWeekendCut } from "./signal-stats"
import { penTotalsAtDepth } from "@/lib/tracking-summary"

export function DiversityView() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const { dateKeys, label } = useAnalyticsRange()
  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? "")
  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0]

  const series = useMemo(
    () => (scope ? penMinutesByDay(entries, dateKeys, scope.id) : []),
    [entries, dateKeys, scope],
  )
  const active = series.filter((d) => d.minutes > 0)
  const gini = useMemo(() => {
    if (!scope) return 0
    const pens = penTotalsAtDepth(entries.filter((e) => e.scopeId === scope.id), scope, dateKeys, null)
    return allocationGini(pens.map((p) => p.minutes))
  }, [entries, scope, dateKeys])
  const cut = useMemo(() => weekdayWeekendCut(entries.filter((e) => e.scopeId === (scope?.id ?? "")), dateKeys), [
    entries,
    scope,
    dateKeys,
  ])
  const meanH = mean(active.map((d) => d.entropy))
  const thin = isThinSample(active.length, SAMPLE_FLOORS.entropyDays)

  if (!scope) {
    return (
      <div className="an-canvas an-stack" data-testid="diversity-view">
        <ChartFrame empty emptySentence="No tracking scopes yet. Paint a day in Home → Tracking." />
      </div>
    )
  }

  return (
    <div className="an-canvas an-stack" data-testid="diversity-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Diversity"
            help="Shannon entropy H = −Σ pᵢ log₂ pᵢ of that day's pen-minute shares. 0 bits = one pen took the day. log₂(k) = k pens shared it evenly. Gini is inequality of the window's pen totals (0 = even, 1 = one pen). Weekday vs weekend is occupancy, not a mood score."
          />
          <p className="an-canvas-kicker">{label} · {scope.name}</p>
        </div>
        <label className="an-studio-field">
          <span>Scope</span>
          <select value={scope.id} aria-label="Tracking scope" onChange={(e) => setScopeId(e.target.value)}>
            {scopes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {active.length === 0 ? (
        <ChartFrame
          empty
          emptySentence={`Nothing painted in ${scope.name} in ${label}. Entropy needs at least one tracked day.`}
        />
      ) : thin ? (
        <ChartFrame thin thinSentence={thinWindowSentence(active.length, SAMPLE_FLOORS.entropyDays, label)} />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout
              label="Mean entropy"
              value={`${meanH.toFixed(2)} bits`}
              note={`${active.length} days with paint`}
              tip="Average Shannon entropy of pen shares per painted day. Higher = more mixed days."
            />
            <StudioReadout
              label="Gini (pens)"
              value={gini.toFixed(2)}
              note="0 even · 1 concentrated"
              tip="Gini of this window's pen totals. Independent of how mixed any single day was."
            />
            <StudioReadout
              label="Weekday / day"
              value={formatDuration(cut.weekdayPerDay)}
              note={`${cut.weekdayDays} weekdays`}
              tip="Mean painted minutes on Mon–Fri in this window."
            />
            <StudioReadout
              label="Weekend / day"
              value={formatDuration(cut.weekendPerDay)}
              note={`${cut.weekendDays} weekend days`}
              tip="Mean painted minutes on Sat–Sun in this window. Blank weekend days still sit in the denominator."
            />
          </div>
          <p className="an-canvas-title">Entropy · bits / day</p>
          <PhosphorTrace
            title="Shannon entropy of pens per day"
            points={series.map((d) => ({ x: d.date.slice(5), y: d.entropy }))}
            unit="b"
          />
          <p className="an-canvas-hint">
            Empty days are 0 bits (nothing to mix). A day of one pen is also 0. Two equal pens ≈ 1 bit.
            Gini of daily entropies: {giniCoefficient(active.map((d) => d.entropy)).toFixed(2)}.
          </p>
        </>
      )}
    </div>
  )
}
