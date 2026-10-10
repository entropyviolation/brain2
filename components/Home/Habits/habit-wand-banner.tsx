/**
 * components/Home/Habits/habit-wand-banner.tsx — wand-view status lamp
 *
 * A pinned one-line strip for the open wand. Exemption wand and Missed op
 * wand are different hues. Null paints nothing, so the sheet does not keep
 * an empty gap. Meant to sit under the Priority bar.
 */
import "./habit-wand-banner.css"

const COPY = {
  exemption: "EXEMPTION WAND VIEW ON",
  missed: "MISSED OPPORTUNITY WAND VIEW ON",
} as const

export function HabitWandBanner({ view }: { view: "exemption" | "missed" | null }) {
  if (!view) return null
  return (
    <div className={`hab-wand-banner is-${view}`} role="status" data-wand-view={view}>
      <span className="hab-wand-banner-lamp" aria-hidden="true" />
      <span className="hab-wand-banner-text">{COPY[view]}</span>
    </div>
  )
}
