/**
 * components/Home/Habits/habits-tab-controls.tsx — Per-tab control stack
 *
 * Shared stack inside HabitsControlPanel: two GradeFace tubes, optional Good
 * day / week / month / season wells, optional monthly or weekly window plate,
 * Sort Habits, Exemption wand, view rockers (Day / Week / Month / Season View), New habit.
 * Grade numbers and store writes stay at the habit-tracker call site.
 */
"use client"

import type { ReactNode } from "react"
import { Plus } from "lucide-react"
import { CockpitSwitch } from "@/components/Home/Habits/cockpit-switch"
import { HabitSortControl } from "@/components/Home/Habits/habit-sort-control"
import { ExemptionWandButton } from "@/components/Home/Habits/exemption-wand-button"
import { MissedOpWandButton } from "@/components/Home/Habits/missed-op-wand-button"
import { NobleGasTube } from "@/components/Home/Habits/noble-gas-tube"
import { GOOD_DAYS_LOOKBACK } from "@/lib/habit-accomplishment"
import type { HabitSortMode } from "@/lib/habit-sort"

function GradeFace({
  label,
  title,
  valueText,
  through,
  barValue,
  hue,
  onClick,
}: {
  label: string
  title: string
  valueText: string
  through: string | null
  barValue: number | null
  hue: string
  onClick: () => void
}) {
  const gas = label === "Perfect output" ? "xenon" : "argon"
  return (
    <button type="button" className="habit-week-grade" title={title} onClick={onClick}>
      <span className="text-muted-foreground">{label}</span>
      <strong>{valueText}</strong>
      {through && <span className="text-muted-foreground text-[11px]">{through}</span>}
      {barValue !== null && (
        <NobleGasTube value={Math.min(100, barValue)} gas={gas} hue={hue} label={label} />
      )}
    </button>
  )
}

export type HabitsTabToggleId =
  | "heatmap"
  | "dayView"
  | "weekView"
  | "monthView"
  | "seasonView"
  | "hideCompleted"
  | "loadingBar"
  | "smallLeds"

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
  sortId?: string
  /** Completion-% key. Day and week: Weekly. Month: Monthly. Season: Season. */
  sortCompletionLabel?: string
  habitSortMode: HabitSortMode
  habitSortDirection: "asc" | "desc" | null
  onHabitSortMode: (mode: HabitSortMode) => void
  onHabitSortDirection: (direction: "asc" | "desc") => void
  exemptionWand: boolean
  onExemptionWand: (on: boolean) => void
  missedOpWand: boolean
  onMissedOpWand: (on: boolean) => void
  /** Which rockers to show, in panel order. */
  toggles: HabitsTabToggleId[]
  hideCompletedLabel: string
  hideCompletedId: string
  hideCompleted: boolean
  onHideCompleted: (on: boolean) => void
  hideCompletedAndMissedId: string
  hideCompletedAndMissed: boolean
  onHideCompletedAndMissed: (on: boolean) => void
  heatmapOn?: boolean
  onHeatmap?: (on: boolean) => void
  dayViewOn?: boolean
  onDayView?: (on: boolean) => void
  /** Weekly sheet: this week only, plus that week's plan log. */
  weekViewOn?: boolean
  onWeekView?: (on: boolean) => void
  /** Monthly sheet: this month only, plus that month's plan log. */
  monthViewOn?: boolean
  onMonthView?: (on: boolean) => void
  /** Season sheet: this season only, plus that season's plan log. */
  seasonViewOn?: boolean
  onSeasonView?: (on: boolean) => void
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
  sortId,
  sortCompletionLabel,
  habitSortMode,
  habitSortDirection,
  onHabitSortMode,
  onHabitSortDirection,
  exemptionWand,
  onExemptionWand,
  missedOpWand,
  onMissedOpWand,
  toggles,
  hideCompletedLabel,
  hideCompletedId,
  hideCompleted,
  onHideCompleted,
  hideCompletedAndMissedId,
  hideCompletedAndMissed,
  onHideCompletedAndMissed,
  heatmapOn = false,
  onHeatmap,
  dayViewOn = false,
  onDayView,
  weekViewOn = false,
  onWeekView,
  monthViewOn = false,
  onMonthView,
  seasonViewOn = false,
  onSeasonView,
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
  const rockers: ReactNode[] = []
  for (const id of toggles) {
    if (id === "heatmap" && onHeatmap) {
      rockers.push(
        <CockpitSwitch
          key="heatmap"
          id="heatmap-view"
          checked={heatmapOn}
          onCheckedChange={(on) => onHeatmap(on)}
          label="Heatmap View"
        />,
      )
    } else if (id === "dayView" && onDayView) {
      rockers.push(
        <CockpitSwitch
          key="dayView"
          id="day-view"
          checked={dayViewOn}
          onCheckedChange={onDayView}
          label="Day View"
        />,
      )
    } else if (id === "weekView" && onWeekView) {
      rockers.push(
        <CockpitSwitch
          key="weekView"
          id="week-view"
          checked={weekViewOn}
          onCheckedChange={onWeekView}
          label="Week View"
        />,
      )
    } else if (id === "monthView" && onMonthView) {
      rockers.push(
        <CockpitSwitch
          key="monthView"
          id="month-view"
          checked={monthViewOn}
          onCheckedChange={onMonthView}
          label="Month View"
        />,
      )
    } else if (id === "seasonView" && onSeasonView) {
      rockers.push(
        <CockpitSwitch
          key="seasonView"
          id="season-view"
          checked={seasonViewOn}
          onCheckedChange={onSeasonView}
          label="Season View"
        />,
      )
    } else if (id === "hideCompleted") {
      rockers.push(
        <CockpitSwitch
          key="hideCompleted"
          id={hideCompletedId}
          checked={hideCompleted}
          onCheckedChange={onHideCompleted}
          label={hideCompletedLabel}
        />,
      )
      rockers.push(
        <CockpitSwitch
          key="hideCompletedAndMissed"
          id={hideCompletedAndMissedId}
          checked={hideCompletedAndMissed}
          onCheckedChange={onHideCompletedAndMissed}
          label="Hide completed and missed"
        />,
      )
    } else if (id === "loadingBar") {
      rockers.push(
        <CockpitSwitch
          key="loadingBar"
          id={loadingBarId}
          checked={loadingBar}
          onCheckedChange={onLoadingBar}
          label="Loading Bar"
        />,
      )
    } else if (id === "smallLeds") {
      rockers.push(
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

  return (
    <div className="hab-control-stack">
      <div className="hab-control-gauges">
        <GradeFace
          label={gradeLabel}
          title="Click for raw vs curved breakdown"
          valueText={gradeValueText}
          through={gradeThrough}
          barValue={gradeBarValue}
          hue={gradeHue}
          onClick={onGradeClick}
        />
        <GradeFace
          label="Perfect output"
          title="Click for elapsed row completion breakdown"
          valueText={outputValueText}
          through={gradeThrough}
          barValue={outputBarValue}
          hue={outputHue}
          onClick={onOutputClick}
        />
      </div>
      {goodDays && (
        <div className="hab-control-streak">
          <button
            type="button"
            className="habit-good-days"
            title={goodDays.title ?? "Click for Good day streak, last 30 days, and accomplishment settings"}
            onClick={goodDays.onClick}
          >
            <span className="habit-good-days-stat">
              <span className="text-muted-foreground">{goodDays.streakLabel ?? "Good day streak"}</span>
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
              <span className="text-muted-foreground">{goodDays.countLabel ?? "Good days in the last month"}</span>
              <strong>
                {goodDays.last30Count}
                <span className="habit-good-days-of">/{goodDays.countOf ?? GOOD_DAYS_LOOKBACK}</span>
              </strong>
            </span>
          </button>
        </div>
      )}
      {monthWindow}
      {weekWindow}
      <HabitSortControl
        id={sortId}
        value={habitSortMode}
        direction={habitSortDirection}
        completionLabel={sortCompletionLabel}
        onChange={onHabitSortMode}
        onDirection={onHabitSortDirection}
      />
      <div className="hab-control-toggles">
        <ExemptionWandButton on={exemptionWand} onToggle={onExemptionWand} />
        <MissedOpWandButton on={missedOpWand} onToggle={onMissedOpWand} />
        {rockers}
      </div>
      <button
        type="button"
        className="habit-chrome-btn habit-chrome-btn-cta hab-control-new"
        onClick={onNewHabit}
      >
        <Plus className="inline h-3 w-3" />
        New habit
      </button>
    </div>
  )
}
