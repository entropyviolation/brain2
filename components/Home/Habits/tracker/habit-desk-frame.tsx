/**
 * tracker/habit-desk-frame.tsx — Sheet skeleton shared by the four panes.
 *
 * Tabs pane, desk, sheet, wand mast, well, control panel, then the plan
 * log as the next sibling of the desk. Slots only, so the frame adds no node.
 */
"use client"

import type { ReactNode } from "react"
import { TabsContent } from "@/components/ui/tabs"
import { HabitsControlPanel } from "@/components/Home/Habits/panel/habits-control-panel"
import type { HabitsTabControlsProps } from "@/components/Home/Habits/panel/habits-tab-controls"
import { HabitWandMast } from "@/components/Home/Habits/tracker/habit-wand-mast"
import type { WillpowerStone } from "@/lib/willpower-stones"

export type HabitMeterProps = Pick<
  HabitsTabControlsProps,
  | "gradeLabel"
  | "gradeValueText"
  | "gradeThrough"
  | "gradeBarValue"
  | "gradeHue"
  | "onGradeClick"
  | "outputValueText"
  | "outputBarValue"
  | "outputHue"
  | "onOutputClick"
  | "exemptionWand"
  | "onExemptionWand"
  | "missedOpWand"
  | "onMissedOpWand"
  | "loadingBar"
  | "onLoadingBar"
  | "smallLeds"
  | "onSmallLeds"
>

export type HabitPriorityProps = {
  highlightPriorities: boolean
  ritualIds: readonly string[]
  ritualMultiplier: number
  showStreakMarks: boolean
}

export function HabitDeskFrame({
  value,
  season,
  exemptionWand,
  missedOpWand,
  well,
  stones,
  controls,
  plan,
}: {
  value: "daily" | "weekly" | "monthly" | "quarterly"
  season?: string
  exemptionWand: boolean
  missedOpWand: boolean
  well: ReactNode
  stones: WillpowerStone[]
  controls: ReactNode
  plan?: ReactNode
}) {
  return (
    <TabsContent value={value} className="hab-pane" {...(season !== undefined ? { "data-season": season } : {})}>
      <div className="hab-desk">
        <div className="hab-sheet">
          <HabitWandMast exemptionWand={exemptionWand} missedOpWand={missedOpWand} />
          <div className="hab-well">{well}</div>
        </div>
        <HabitsControlPanel stones={stones}>{controls}</HabitsControlPanel>
      </div>
      {plan}
    </TabsContent>
  )
}
