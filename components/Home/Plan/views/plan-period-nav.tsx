/**
 * components/Home/Plan/plan-period-nav.tsx — Date toolbar for Plan
 *
 * Period nameplate date with metal prev/next/today keys. Day, Week, Month, and
 * Season views share this so the four desks use one navigator. Date math stays
 * in each view; aria-labels and visible labels are passed in. Kin of
 * TrackingPeriodNav — class names stay `.plan-period*` for plan-chrome.
 */
"use client"

export function PlanPeriodNav({
  label,
  onPrevious,
  onNext,
  onToday,
  previousLabel,
  nextLabel,
  todayLabel = "Today",
}: {
  label: string
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  previousLabel: string
  nextLabel: string
  todayLabel?: string
}) {
  return (
    <div className="plan-period">
      <button type="button" className="plan-period-chev" aria-label={previousLabel} onClick={onPrevious}>
        &lt;
      </button>
      <h3>{label}</h3>
      <button type="button" className="plan-period-chev" aria-label={nextLabel} onClick={onNext}>
        &gt;
      </button>
      <button type="button" className="plan-period-today" onClick={onToday}>
        {todayLabel}
      </button>
    </div>
  )
}
