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
import "./analytics-boards.css"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, isThinSample, thinWindowSentence } from "./analytics-range"
import { CanvasTitle, PhosphorTrace, StudioReadout } from "./studio-kit"
import { allocationGini, penMinutesByDay, weekdayWeekendCut } from "./signal-stats"
import { penTotalsAtDepth } from "@/lib/tracking-summary"
import { NativeSelect } from "@/components/ui/native-select"
import { coverCount, effectiveCount, entropyByDayType } from "./time-views-stats"

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
  const [share, setShare] = useState(80)
  const pens = useMemo(
    () => (scope ? penTotalsAtDepth(entries.filter((e) => e.scopeId === scope.id), scope, dateKeys, null) : []),
    [entries, scope, dateKeys],
  )
  const gini = useMemo(() => allocationGini(pens.map((p) => p.minutes)), [pens])
  const ranked = useMemo(() => [...pens].filter((p) => p.minutes > 0).sort((a, b) => b.minutes - a.minutes), [pens])
  const rankedTotal = ranked.reduce((s, p) => s + p.minutes, 0)
  const cover = coverCount(ranked.map((p) => p.minutes), share / 100)
  const dayType = useMemo(() => entropyByDayType(series), [series])
  const cut = useMemo(() => weekdayWeekendCut(entries.filter((e) => e.scopeId === (scope?.id ?? "")), dateKeys), [
    entries,
    scope,
    dateKeys,
  ])
  const meanH = mean(active.map((d) => d.entropy))
  const thin = isThinSample(active.length, SAMPLE_FLOORS.entropyDays)
  const maxH = Math.max(0, ...active.map((d) => d.entropy))
  const evenH = ranked.length > 1 ? Math.log2(ranked.length) : 0
  const anchors = [
    { id: "one", label: "One pen all day", bits: 0, mine: false },
    { id: "two", label: "Two equal pens", bits: 1, mine: false },
    { id: "mean", label: "Your mean day", bits: meanH, mine: true },
    { id: "max", label: "Your most mixed day", bits: maxH, mine: true },
    ...(evenH > 1 ? [{ id: "even", label: `All ${ranked.length} pens even`, bits: evenH, mine: false }] : []),
  ].sort((a, b) => a.bits - b.bits)
  const anchorMax = Math.max(1, ...anchors.map((a) => a.bits))

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
          <NativeSelect value={scope.id} aria-label="Tracking scope" onChange={(e) => setScopeId(e.target.value)}>
            {scopes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
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
          <section className="an-plate">
            <div className="an-readouts">
              <StudioReadout
                label="Mean entropy"
                value={`${meanH.toFixed(2)} bits`}
                note={`${active.length} days with paint`}
                tip="Average Shannon entropy of pen shares per painted day. Higher = more mixed days."
              />
              <StudioReadout
                label="Like this many pens"
                value={`≈ ${effectiveCount(meanH).toFixed(1)}`}
                note="2^H, even-pen equivalent"
                tip="The number of equally sized pens that would give your mean entropy (2 to the power H). 1 = a one-pen day."
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
                note={`${cut.weekdayDays} weekdays · ${dayType.weekday === null ? "—" : `${dayType.weekday.toFixed(2)} b`}`}
                tip="Mean painted minutes on Mon–Fri in this window, then mean entropy of painted weekdays."
              />
              <StudioReadout
                label="Weekend / day"
                value={formatDuration(cut.weekendPerDay)}
                note={`${cut.weekendDays} weekend days · ${dayType.weekend === null ? "—" : `${dayType.weekend.toFixed(2)} b`}`}
                tip="Mean painted minutes on Sat–Sun in this window, then mean entropy of painted weekend days. Blank weekend days still sit in the minutes denominator."
              />
            </div>
          </section>
          <section className="an-plate">
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
          </section>
          <section className="an-plate" data-testid="diversity-anchors">
            <CanvasTitle
              title="Where your days sit"
              help="Your mean and most mixed day placed among fixed anchors. 0 bits is a day of one pen. 1 bit is two equal pens. log₂(k) is every pen in this window sharing a day evenly."
            />
            <ul className="an-anchor-bars">
              {anchors.map((a) => (
                <li key={a.id} className={a.mine ? "is-mine" : undefined}>
                  <span className="an-anchor-label">{a.label}</span>
                  <span className="an-anchor-track" aria-hidden>
                    <span style={{ width: `${Math.max(1, (a.bits / anchorMax) * 100)}%` }} />
                  </span>
                  <span className="an-anchor-value">{a.bits.toFixed(2)} b</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="an-plate" data-testid="diversity-cover">
            <CanvasTitle
              title="How many pens make up your time"
              help="Pens ranked by window minutes. Move the slider to pick a share; the lit bars are the fewest pens that reach it. A small count means a concentrated window."
            />
            <label className="an-studio-field an-cover-slider">
              <span>Share of time · {share}%</span>
              <input
                type="range"
                min={50}
                max={99}
                step={1}
                value={share}
                aria-label="Share of time"
                onChange={(e) => setShare(Number(e.target.value))}
              />
            </label>
            <p className="an-cover-answer">
              <strong>{cover}</strong> of {ranked.length} {ranked.length === 1 ? "pen makes" : "pens make"} up {share}% of{" "}
              {formatDuration(rankedTotal)}.
            </p>
            <ul className="an-cover-bars">
              {ranked.slice(0, 16).map((p, i) => (
                <li key={p.id} className={i < cover ? "is-in" : undefined}>
                  <span className="an-anchor-label">{p.name}</span>
                  <span className="an-anchor-track" aria-hidden>
                    <span style={{ width: `${(p.minutes / ranked[0].minutes) * 100}%`, background: p.color }} />
                  </span>
                  <span className="an-anchor-value">{Math.round((p.minutes / rankedTotal) * 100)}%</span>
                </li>
              ))}
            </ul>
            {ranked.length > 16 ? <p className="an-n">Top 16 of {ranked.length} shown.</p> : null}
          </section>
        </>
      )}
    </div>
  )
}
