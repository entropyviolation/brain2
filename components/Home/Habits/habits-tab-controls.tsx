/**
 * components/Home/Habits/habits-tab-controls.tsx — Per-tab control stack
 *
 * Three bands inside HabitsControlPanel. Meters report the sheet (grade tubes,
 * one shared through line, good-period plate). Sheet changes the sheet (window,
 * Tools wands). Heatmap View, Day View, Week View, Month View, Season View,
 * Hide Done, and Mask done and missed live once on the control bar. Lamps are
 * Loading Bar and Small LEDs.
 * New habit sits in the foot, above the gem oval. Grade numbers and store
 * writes stay at the habit-tracker call site.
 */
"use client"

import type { ReactNode } from "react"
import { Plus } from "lucide-react"
import { CockpitSwitch } from "@/components/Home/Habits/cockpit-switch"
import { ExemptionWandButton } from "@/components/Home/Habits/exemption-wand-button"
import { MissedOpWandButton } from "@/components/Home/Habits/missed-op-wand-button"
import { NobleGasTube } from "@/components/Home/Habits/noble-gas-tube"
import { GOOD_DAYS_LOOKBACK } from "@/lib/habit-accomplishment"

function GradeFace({
  label,
  title,
  valueText,
  barValue,
  hue,
  onClick,
}: {
  label: string
  title: string
  valueText: string
  barValue: number | null
  hue: string
  onClick: () => void
}) {
  const gas = label === "Perfect output" ? "xenon" : "argon"
  return (
    <button type="button" className="habit-week-grade" title={title} onClick={onClick}>
      <span className="text-muted-foreground">{label}</span>
      <strong>{valueText}</strong>
      {barValue !== null && (
        <NobleGasTube value={Math.min(100, barValue)} gas={gas} hue={hue} label={label} />
      )}
    </button>
  )
}

/** One nameplate over both wells. The glass still shows the figures. */
function goodPeriodChrome(goodDays: NonNullable<HabitsTabControlsProps["goodDays"]>): {
  plate: string
  countWell: string
} {
  const of = goodDays.countOf ?? GOOD_DAYS_LOOKBACK
  switch (goodDays.streakLabel) {
    case "Good week streak":
      return { plate: "Good weeks", countWell: "Last 12" }
    case "Good month streak":
      return { plate: "Good months", countWell: `Last ${of}` }
    case "Good season streak":
      return { plate: "Good seasons", countWell: `Last ${of}` }
    default:
      return { plate: "Good days", countWell: `Last ${of}` }
  }
}

function ControlPlate({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <div className="hab-control-plate">
      <span className="hab-sort-legend">{legend}</span>
      <div className="hab-sort-bay">{children}</div>
    </div>
  )
}

export type HabitsTabToggleId = "loadingBar" | "smallLeds"

export interface HabitsTabControlsProps {
  gradeLabel: string
  gradeValueText: string
  gradeThrough: string | null
  gradeBarValue: number | null
  gradeHue: string
  onGradeClick: () => void
  outputValueText: string
  outputBarValue: number | null
  outputHue: string
  onOutputClick: () => void
  /**
   * Good day / week / month / season wells. Labels default to the daily plate.
   * Week, month, and season pass their own noun and lookback.
   */
  goodDays?: {
    streak: number
    last30Count: number
    onClick: () => void
    streakLabel?: string
    countLabel?: string
    countOf?: number
    title?: string
  }
  exemptionWand: boolean
  onExemptionWand: (on: boolean) => void
  missedOpWand: boolean
  onMissedOpWand: (on: boolean) => void
  /** Lamp rockers to show, in panel order. View rockers live on the control bar. */
  toggles: HabitsTabToggleId[]
  loadingBarId: string
  loadingBar: boolean
  onLoadingBar: (on: boolean) => void
  smallLedsId: string
  smallLeds: boolean
  onSmallLeds: (on: boolean) => void
  onNewHabit: () => void
  /** Monthly sheet only: which months the columns and span grade share. */
  monthWindow?: ReactNode
  /** Weekly sheet only: which weeks the columns and span grade share. */
  weekWindow?: ReactNode
}

export function HabitsTabControls({
  gradeLabel,
  gradeValueText,
  gradeThrough,
  gradeBarValue,
  gradeHue,
  onGradeClick,
  outputValueText,
  outputBarValue,
  outputHue,
  onOutputClick,
  goodDays,
  exemptionWand,
  onExemptionWand,
  missedOpWand,
  onMissedOpWand,
  toggles,
  loadingBarId,
  loadingBar,
  onLoadingBar,
  smallLedsId,
  smallLeds,
  onSmallLeds,
  onNewHabit,
  monthWindow,
  weekWindow,
}: HabitsTabControlsProps) {
  const lampRockers: ReactNode[] = []
  for (const id of toggles) {
    if (id === "loadingBar") {
      lampRockers.push(
        <CockpitSwitch
          key="loadingBar"
          id={loadingBarId}
          checked={loadingBar}
          onCheckedChange={onLoadingBar}
          label="Loading Bar"
        />,
      )
    } else if (id === "smallLeds") {
      lampRockers.push(
        <CockpitSwitch
          key="smallLeds"
          id={smallLedsId}
          checked={smallLeds}
          onCheckedChange={onSmallLeds}
          label="Small LEDs"
        />,
      )
    }
  }

  const period = goodDays ? goodPeriodChrome(goodDays) : null

  return (
    <>
      <div className="hab-control-stack">
        <div className="hab-control-band" data-band="meters">
          <div className="hab-control-gauges">
            <GradeFace
              label={gradeLabel}
              title="Click for raw vs curved breakdown"
              valueText={gradeValueText}
              barValue={gradeBarValue}
              hue={gradeHue}
              onClick={onGradeClick}
            />
            <GradeFace
              label="Perfect output"
              title="Click for elapsed row completion breakdown"
              valueText={outputValueText}
              barValue={outputBarValue}
              hue={outputHue}
              onClick={onOutputClick}
            />
            {gradeThrough && <p className="hab-control-through">{gradeThrough}</p>}
          </div>
          {goodDays && period && (
            <div className="hab-control-streak">
              <span className="hab-control-streak-plate">{period.plate}</span>
              <button
                type="button"
                className="habit-good-days"
                title={goodDays.title ?? "Click for Good day streak, last 30 days, and accomplishment settings"}
                onClick={goodDays.onClick}
              >
                <span className="habit-good-days-stat">
                  <span className="text-muted-foreground">Streak</span>
                  <strong>{goodDays.streak}</strong>
                </span>
              </button>
              <button
                type="button"
                className="habit-good-days"
                title={goodDays.title ?? "Click for Good day streak, last 30 days, and accomplishment settings"}
                onClick={goodDays.onClick}
              >
                <span className="habit-good-days-stat">
                  <span className="text-muted-foreground">{period.countWell}</span>
                  <strong>
                    {goodDays.last30Count}
                    <span className="habit-good-days-of">/{goodDays.countOf ?? GOOD_DAYS_LOOKBACK}</span>
                  </strong>
                </span>
              </button>
            </div>
          )}
        </div>
        <div className="hab-control-band" data-band="sheet">
          {monthWindow}
          {weekWindow}
          <div className="hab-control-toggles">
            <ControlPlate legend="Sheet lamps">
              <ExemptionWandButton on={exemptionWand} onToggle={onExemptionWand} />
              <MissedOpWandButton on={missedOpWand} onToggle={onMissedOpWand} />
            </ControlPlate>
          </div>
        </div>
        <div className="hab-control-band" data-band="lamps">
          <ControlPlate legend="Lamps">{lampRockers}</ControlPlate>
        </div>
      </div>
      <button
        type="button"
        className="habit-chrome-btn habit-chrome-btn-cta hab-control-new"
        onClick={onNewHabit}
      >
        <Plus className="inline h-3 w-3" />
        New habit
      </button>
    </>
  )
}
