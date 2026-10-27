/**
 * tracker/habit-wand-mast.tsx — Wand banner above the habit well.
 *
 * The mount is only the banner. Rockers stay in the control panel.
 */
"use client"

import { HabitWandBanner } from "@/components/Home/Habits/habit-wand-banner"

export function HabitWandMast({
  exemptionWand,
  missedOpWand,
}: {
  exemptionWand: boolean
  missedOpWand: boolean
}) {
  return (
    <div className="hab-sheet-mast">
      <div className="hab-wand-mount" data-testid="habit-wand-banner-mount">
        <HabitWandBanner
          view={exemptionWand ? "exemption" : missedOpWand ? "missed" : null}
        />
      </div>
    </div>
  )
}
