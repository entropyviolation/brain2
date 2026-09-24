/**
 * components/Home/Habits/habits-control-panel.tsx
 *
 * Home Dashboard Habits Tab Control Panel — the right-hand column on
 * every Habits frequency tab: grades, streaks, Sort Habits, cockpit
 * rockers, New habit, then Willpower gems pinned at the foot. Width is
 * the compact default; Physics enlarges the Willpower gems display.
 */
"use client"

import { useEffect, type CSSProperties, type ReactNode } from "react"
import { WillpowerGems } from "@/components/Home/Habits/willpower-gems"
import {
  HABITS_CONTROL_PANEL_DEFAULT_WIDTH,
  HABITS_CONTROL_PANEL_NAME,
} from "@/lib/habits-control-panel"
import { useHabitsStore } from "@/lib/habits-store"
import type { WillpowerStone } from "@/lib/willpower-stones"

export function HabitsControlPanel({
  children,
  stones = [],
}: {
  children?: ReactNode
  stones?: WillpowerStone[]
}) {
  const storedWidth = useHabitsStore((s) => s.habitsControlPanelWidth)
  const setStoredWidth = useHabitsStore((s) => s.setHabitsControlPanelWidth)

  useEffect(() => {
    if (storedWidth !== HABITS_CONTROL_PANEL_DEFAULT_WIDTH) {
      setStoredWidth(HABITS_CONTROL_PANEL_DEFAULT_WIDTH)
    }
  }, [storedWidth, setStoredWidth])

  return (
    <aside
      className="hab-control-panel"
      aria-label={children ? HABITS_CONTROL_PANEL_NAME : "Willpower gems"}
      data-control-panel="habits"
      data-ui-name="Habits control panel"
      data-ui-help="Grades, streaks, exemption wand, view rockers, New habit, and Willpower gems."
      data-ui-docs="components/Home/Habits/README.md"
      style={
        {
          width: `${HABITS_CONTROL_PANEL_DEFAULT_WIDTH}px`,
          "--hab-control-panel-width": `${HABITS_CONTROL_PANEL_DEFAULT_WIDTH}px`,
          "--hab-willpower-scale": "1",
        } as CSSProperties
      }
    >
      {children}
      <WillpowerGems stones={stones} />
    </aside>
  )
}

export { HABITS_CONTROL_PANEL_DEFAULT_WIDTH }
