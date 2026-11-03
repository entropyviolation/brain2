/**
 * components/Home/Habits/settings-dialog.tsx — Habits & theme settings
 *
 * Portaled milled sheet (same fascia language as Week grade / Perfect output).
 * Six pages you flip through (`settings/settings-pages.ts`): a keycap strip,
 * ‹ › keys, and ← → anywhere outside a text field. Every page stays mounted so
 * a staged import or an unapplied number survives a flip; the inactive ones
 * are hidden by `settings/settings-pager.css`.
 * Grade-lift fields show yesterday's raw daily completion, last week's
 * Week grade + Perfect output, and today's raw completion against the prior
 * 7-day and 30-day averages, with signed deltas. Default points are the
 * completion-points number a new habit of that period starts with.
 */
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Download, Upload, RotateCcw } from "lucide-react"
import { useState, type KeyboardEvent } from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { useThemeStore, type ThemeColors } from "@/lib/theme-store"
import { WillpowerGemsSettingsField } from "@/components/Home/Habits/panel/willpower-gems"
import { HabitGemSettingsField } from "@/components/Home/Habits/gem-picker"
import { getGradeLiftComparisonTargets, useHabitsStore } from "@/lib/habits-store"
import { MAX_ACCOMPLISHMENT_BONUS } from "@/lib/habit-accomplishment"
import {
  formatGradeLiftAverageCaption,
  formatGradeLiftDelta,
  formatGradeLiftLastWeekCaption,
  formatGradeLiftYesterdayCaption,
  type HabitPeriodPointDefaults,
} from "@/lib/habit-points"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import { ColorSwatch } from "@/components/ui/color-swatch"
import type { WeeklyTask, WeeklyData, Category } from "@/lib/types"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import {
  SETTINGS_PAGES,
  readStoredSettingsPage,
  stepSettingsPage,
  storeSettingsPage,
  isSettingsPageId,
  type SettingsPageId,
} from "@/components/Home/Habits/settings/settings-pages"

type HabitsImportData = {
  tasks: WeeklyTask[]
  weeklyData: WeeklyData
  weeklyHabitData?: WeeklyData
  monthlyHabitData?: WeeklyData
  categories?: Category[]
}

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: unknown[]
  weeklyData: unknown
  onImportData: (data: HabitsImportData) => void
  onResetData: () => void
  accomplishmentThreshold: number
  accomplishmentBonus: number
  onAccomplishmentThresholdChange: (value: number) => void
  onAccomplishmentBonusChange: (value: number) => void
}

function deltaTone(delta: number | null | undefined): "over" | "under" | "even" | "mute" {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return "mute"
  if (delta > 0) return "over"
  if (delta < 0) return "under"
  return "even"
}

function GradeLiftFields() {
  const dayLift = useHabitsStore((s) => s.dayGradeLiftBonus)
  const setDayLift = useHabitsStore((s) => s.setDayGradeLiftBonus)
  const weekLift = useHabitsStore((s) => s.weeklyGradeLiftBonus)
  const setWeekLift = useHabitsStore((s) => s.setWeeklyGradeLiftBonus)
  const weekAvg = useHabitsStore((s) => s.weeklyAverageBeatBonus)
  const setWeekAvg = useHabitsStore((s) => s.setWeeklyAverageBeatBonus)
  const monthAvg = useHabitsStore((s) => s.monthlyAverageBeatBonus)
  const setMonthAvg = useHabitsStore((s) => s.setMonthlyAverageBeatBonus)
  useHabitsStore((s) => s.weeklyData)
  useHabitsStore((s) => s.weeklyHabitData)
  useHabitsStore((s) => s.tasks)
  useHabitsStore((s) => s.gradeTolerance)
  useHabitsStore((s) => s.outputGradeTolerance)
  useHabitsStore((s) => s.gradeUsePriority)
  useHabitsStore((s) => s.outputUsePriority)
  const targets = getGradeLiftComparisonTargets()
  const yesterdayCaption = formatGradeLiftYesterdayCaption(targets.yesterdayRaw)
  const lastWeekCaption = formatGradeLiftLastWeekCaption(targets.lastWeek)
  const prior7Caption = formatGradeLiftAverageCaption("Prior 7 days", targets.prior7Average)
  const prior30Caption = formatGradeLiftAverageCaption("Prior 30 days", targets.prior30Average)
  const yesterdayDelta = formatGradeLiftDelta(targets.yesterdayDelta)
  const weekDelta = formatGradeLiftDelta(targets.lastWeekDeltas?.week)
  const outputDelta = formatGradeLiftDelta(targets.lastWeekDeltas?.output)
  const prior7Delta = formatGradeLiftDelta(targets.prior7Delta)
  const prior30Delta = formatGradeLiftDelta(targets.prior30Delta)

  return (
    <div className="hab-settings-bay">
      <span className="hab-settings-bay-legend">Grade lift bonuses</span>
      <div className="hab-settings-lift-grid">
        <div className="hab-settings-lift-row">
          <Label htmlFor="settings-day-grade-lift" className="hab-settings-label">
            Higher than yesterday
          </Label>
          <p className="hab-settings-hint">Pays once when today&apos;s daily-habit completion beats yesterday&apos;s.</p>
          <div className="hab-settings-row">
            <Input
              id="settings-day-grade-lift"
              type="number"
              min={0}
              max={MAX_ACCOMPLISHMENT_BONUS}
              step={1}
              value={dayLift}
              onChange={(e) => setDayLift(Number(e.target.value))}
              className="hab-settings-input"
            />
            <span className="hab-settings-unit">pts</span>
            <span
              className={`hab-settings-delta is-${deltaTone(targets.yesterdayDelta)}`}
              data-testid="grade-lift-yesterday-delta"
              title="Today vs yesterday (percentage points)"
            >
              {yesterdayDelta}
            </span>
          </div>
          <p className="hab-settings-prior" data-testid="grade-lift-yesterday">
            {yesterdayCaption}
          </p>
        </div>
        <div className="hab-settings-lift-row">
          <Label htmlFor="settings-weekly-grade-lift" className="hab-settings-label">
            Higher than last week
          </Label>
          <p className="hab-settings-hint">Pays once each when Week grade or Perfect output beats last week&apos;s.</p>
          <div className="hab-settings-row">
            <Input
              id="settings-weekly-grade-lift"
              type="number"
              min={0}
              max={MAX_ACCOMPLISHMENT_BONUS}
              step={1}
              value={weekLift}
              onChange={(e) => setWeekLift(Number(e.target.value))}
              className="hab-settings-input"
            />
            <span className="hab-settings-unit">pts</span>
            <span
              className={`hab-settings-delta is-${deltaTone(targets.lastWeekDeltas?.week)}`}
              data-testid="grade-lift-last-week-delta"
              title="This week grade vs last week (percentage points)"
            >
              {weekDelta}
            </span>
            <span
              className={`hab-settings-delta is-${deltaTone(targets.lastWeekDeltas?.output)}`}
              data-testid="grade-lift-last-week-output-delta"
              title="This week perfect output vs last week (percentage points)"
            >
              {outputDelta}
            </span>
          </div>
          <p className="hab-settings-prior" data-testid="grade-lift-last-week">
            {lastWeekCaption}
          </p>
        </div>
        <div className="hab-settings-lift-row">
          <Label htmlFor="settings-weekly-average-beat" className="hab-settings-label">
            Above the prior 7 days
          </Label>
          <p className="hab-settings-hint">Pays once when today&apos;s completion is above the 7-day average.</p>
          <div className="hab-settings-row">
            <Input
              id="settings-weekly-average-beat"
              type="number"
              min={0}
              max={MAX_ACCOMPLISHMENT_BONUS}
              step={1}
              value={weekAvg}
              onChange={(e) => setWeekAvg(Number(e.target.value))}
              className="hab-settings-input"
            />
            <span className="hab-settings-unit">pts</span>
            <span
              className={`hab-settings-delta is-${deltaTone(targets.prior7Delta)}`}
              data-testid="grade-lift-prior-7-delta"
              title="Today vs the prior 7-day average (percentage points)"
            >
              {prior7Delta}
            </span>
          </div>
          <p className="hab-settings-prior" data-testid="grade-lift-prior-7">
            {prior7Caption}
          </p>
        </div>
        <div className="hab-settings-lift-row">
          <Label htmlFor="settings-monthly-average-beat" className="hab-settings-label">
            Above the prior 30 days
          </Label>
          <p className="hab-settings-hint">Pays once when today&apos;s completion is above the 30-day average.</p>
          <div className="hab-settings-row">
            <Input
              id="settings-monthly-average-beat"
              type="number"
              min={0}
              max={MAX_ACCOMPLISHMENT_BONUS}
              step={1}
              value={monthAvg}
              onChange={(e) => setMonthAvg(Number(e.target.value))}
              className="hab-settings-input"
            />
            <span className="hab-settings-unit">pts</span>
            <span
              className={`hab-settings-delta is-${deltaTone(targets.prior30Delta)}`}
              data-testid="grade-lift-prior-30-delta"
              title="Today vs the prior 30-day average (percentage points)"
            >
              {prior30Delta}
            </span>
          </div>
          <p className="hab-settings-prior" data-testid="grade-lift-prior-30">
            {prior30Caption}
          </p>
        </div>
      </div>
    </div>
  )
}

function GoodDayFields({
  accomplishmentThreshold,
  accomplishmentBonus,
  onAccomplishmentThresholdChange,
  onAccomplishmentBonusChange,
}: Pick<
  SettingsDialogProps,
  | "accomplishmentThreshold"
  | "accomplishmentBonus"
  | "onAccomplishmentThresholdChange"
  | "onAccomplishmentBonusChange"
>) {
  const ritualMult = useHabitsStore((s) => s.morningRitualPointMultiplier)
  const setRitualMult = useHabitsStore((s) => s.setMorningRitualPointMultiplier)
  return (
    <>
      <div className="hab-settings-bay">
        <span className="hab-settings-bay-legend">Daily accomplishment</span>
        <div className="hab-settings-pair">
          <div className="hab-settings-field">
            <Label htmlFor="settings-accomplishment-threshold" className="hab-settings-label">
              Completion to feel accomplished
            </Label>
            <p className="hab-settings-hint">Daily-habit completion that makes today a Good day.</p>
            <div className="hab-settings-row">
              <Input
                id="settings-accomplishment-threshold"
                type="number"
                min={1}
                max={100}
                step={1}
                value={accomplishmentThreshold}
                onChange={(e) => onAccomplishmentThresholdChange(Number(e.target.value))}
                className="hab-settings-input"
              />
              <span className="hab-settings-unit">%</span>
            </div>
          </div>
          <div className="hab-settings-field">
            <Label htmlFor="settings-accomplishment-bonus" className="hab-settings-label">
              Accomplishment bonus
            </Label>
            <p className="hab-settings-hint">Points a Good day pays once.</p>
            <div className="hab-settings-row">
              <Input
                id="settings-accomplishment-bonus"
                type="number"
                min={0}
                max={10000}
                step={1}
                value={accomplishmentBonus}
                onChange={(e) => onAccomplishmentBonusChange(Number(e.target.value))}
                className="hab-settings-input"
              />
              <span className="hab-settings-unit">pts</span>
            </div>
          </div>
        </div>
      </div>
      <div className="hab-settings-bay">
        <span className="hab-settings-bay-legend">Prioritized habits</span>
        <div className="hab-settings-field">
          <Label htmlFor="settings-morning-ritual-multiplier" className="hab-settings-label">
            Morning ritual
          </Label>
          <p className="hab-settings-hint">The × shown on habits today&apos;s morning review prioritized. Default ×5.</p>
          <div className="hab-settings-row">
            <Input
              id="settings-morning-ritual-multiplier"
              type="number"
              min={0}
              max={99}
              step={1}
              value={ritualMult}
              onChange={(e) => setRitualMult(Number(e.target.value))}
              className="hab-settings-input"
            />
            <span className="hab-settings-unit">×</span>
          </div>
        </div>
      </div>
    </>
  )
}

const PERIOD_POINT_ROWS: { key: keyof HabitPeriodPointDefaults; label: string; hint: string }[] = [
  { key: "daily", label: "Daily", hint: "Points a new daily habit starts with." },
  { key: "weekly", label: "Weekly", hint: "Points a new weekly habit starts with." },
  { key: "monthly", label: "Monthly", hint: "Points a new monthly habit starts with." },
  { key: "seasonal", label: "Season", hint: "Points a new season habit starts with." },
]

function DefaultHabitPointsFields() {
  const defaults = useHabitsStore((s) => s.defaultHabitPoints)
  const setOne = useHabitsStore((s) => s.setDefaultHabitPoints)
  const setAll = useHabitsStore((s) => s.setAllDefaultHabitPoints)
  const [allValue, setAllValue] = useState("")

  return (
    <div className="hab-settings-bay">
      <span className="hab-settings-bay-legend">Default points</span>
      <div className="hab-settings-points-grid">
        {PERIOD_POINT_ROWS.map(({ key, label, hint }) => (
          <div className="hab-settings-lift-row" key={key}>
            <Label htmlFor={`settings-default-points-${key}`} className="hab-settings-label">
              {label}
            </Label>
            <p className="hab-settings-hint">{hint}</p>
            <div className="hab-settings-row">
              <Input
                id={`settings-default-points-${key}`}
                type="number"
                min={0}
                max={MAX_ACCOMPLISHMENT_BONUS}
                step={1}
                value={defaults[key]}
                aria-label={`${label} default points`}
                onChange={(e) => setOne(key, Number(e.target.value))}
                className="hab-settings-input"
              />
              <span className="hab-settings-unit">pts</span>
            </div>
          </div>
        ))}
        <div className="hab-settings-lift-row is-wide">
          <Label htmlFor="settings-default-points-all" className="hab-settings-label">
            All periods
          </Label>
          <p className="hab-settings-hint">Sets all four at once when you press Apply.</p>
          <div className="hab-settings-row">
            <Input
              id="settings-default-points-all"
              type="number"
              min={0}
              max={MAX_ACCOMPLISHMENT_BONUS}
              step={1}
              value={allValue}
              aria-label="Default points for all periods"
              onChange={(e) => setAllValue(e.target.value)}
              className="hab-settings-input"
            />
            <span className="hab-settings-unit">pts</span>
            <Button
              type="button"
              size="sm"
              className="hab-settings-btn"
              disabled={allValue.trim() === "" || !Number.isFinite(Number(allValue))}
              onClick={() => setAll(Number(allValue))}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The ninth cell of the color grid; its own store field, so Reset defaults leaves it. */
function PercentLedTintField() {
  const tint = useHabitsStore((s) => s.percentLedTint)
  const setPercentLedTint = useHabitsStore((s) => s.setPercentLedTint)
  const hydrated = usePersistHydrated(useHabitsStore.persist)
  return (
    <div className="hab-settings-theme-cell">
      <Label htmlFor="percent-led-tint" className="hab-settings-label">
        Percent LED tint
      </Label>
      <div className="hab-settings-swatch-row">
        <ColorSwatch
          id="percent-led-tint"
          value={tint}
          onChange={setPercentLedTint}
          aria-label="Percent LED tint"
          size="md"
          disabled={!hydrated}
        />
        <span className="hab-settings-mono">{tint}</span>
      </div>
      <p className="hab-settings-hint">The percent tube, percent LED, and Yes/No lamps.</p>
    </div>
  )
}

const THEME_LABELS: { key: keyof ThemeColors; label: string; hint: string }[] = [
  { key: "pointsAllTime", label: "All-time points", hint: "The all-time points readout." },
  { key: "pointsToday", label: "Today's points", hint: "Today's points readout." },
  { key: "pointsWeek", label: "This week points", hint: "This week's points readout." },
  { key: "pointsMonth", label: "This month points", hint: "This month's points readout." },
  { key: "habitBoolean", label: "Yes/No habit icon", hint: "Icon beside a Yes/No habit." },
  { key: "habitGoal", label: "Goal-based habit icon", hint: "Icon beside a goal habit." },
  { key: "habitText", label: "Text habit icon", hint: "Icon beside a text habit." },
  { key: "habitIncremental", label: "Incremental habit icon", hint: "Icon beside a climbing habit." },
]

export function SettingsDialog({
  open,
  onOpenChange,
  tasks,
  weeklyData,
  onImportData,
  onResetData,
  accomplishmentThreshold,
  accomplishmentBonus,
  onAccomplishmentThresholdChange,
  onAccomplishmentBonusChange,
}: SettingsDialogProps) {
  const [importText, setImportText] = useState("")
  const [page, setPageState] = useState<SettingsPageId>(readStoredSettingsPage)
  const pageIndex = SETTINGS_PAGES.findIndex((p) => p.id === page)
  const current = SETTINGS_PAGES[pageIndex]
  const colors = useThemeStore((s) => s.colors)
  const setColor = useThemeStore((s) => s.setColor)
  const resetColors = useThemeStore((s) => s.resetColors)

  const setPage = (next: SettingsPageId) => {
    setPageState(next)
    storeSettingsPage(next)
  }

  /** ← → flip pages unless a field wants the arrow or a nested popup has focus. */
  const handlePageKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return
    const target = e.target as HTMLElement
    if (!e.currentTarget.contains(target)) return
    if (target.closest("input, textarea, select, [contenteditable='true'], [role='tab']")) return
    e.preventDefault()
    setPage(stepSettingsPage(page, e.key === "ArrowLeft" ? -1 : 1))
  }

  const handleExport = () => {
    const data = { tasks, weeklyData, exportDate: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `habits-backup-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    try {
      onImportData(JSON.parse(importText) as HabitsImportData)
      setImportText("")
      onOpenChange(false)
      return true
    } catch {
      alert("Invalid JSON format.")
      return false
    }
  }

  const guard = useUnsavedGuard({
    open,
    onOpenChange,
    isDirty: importText.trim() !== "",
    onSave: () => {
      if (!importText.trim()) return false
      return handleImport()
    },
    onDiscard: () => setImportText(""),
  })

  return (
    <>
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent
        className="hab-grade-sheet hab-settings-sheet sm:max-w-[640px] max-h-[90vh] overflow-y-auto"
        data-ui-name="Habits settings"
        data-ui-docs="components/Home/Habits/README.md"
        onKeyDown={handlePageKeys}
        {...unsavedDismissProps(guard.requestClose)}
      >
        <DialogHeader className="hab-grade-sheet-caption">
          <span className="hab-grade-sheet-power" aria-hidden="true" />
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <TabsPrimitive.Root
          value={page}
          onValueChange={(v) => isSettingsPageId(v) && setPage(v)}
          className="hab-settings-pager"
        >
          <TabsPrimitive.List
            loop={false}
            aria-label="Settings pages"
            className="hab-settings-tabs b2-keycap-tab"
          >
            {SETTINGS_PAGES.map((p) => (
              <TabsPrimitive.Trigger key={p.id} value={p.id} className="hab-settings-tab">
                {p.title}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>

          <div className="hab-settings-pager-bar">
            <button
              type="button"
              data-no95
              className="hab-settings-flip"
              aria-label="Previous page"
              disabled={pageIndex === 0}
              onClick={() => setPage(stepSettingsPage(page, -1))}
            >
              ‹
            </button>
            <div className="hab-settings-pager-readout" aria-live="polite">
              <span className="hab-settings-page-name" data-testid="settings-page-name">
                {current.title}
              </span>
              <span className="hab-settings-page-count" data-testid="settings-page-count">
                {pageIndex + 1} / {SETTINGS_PAGES.length}
              </span>
            </div>
            <button
              type="button"
              data-no95
              className="hab-settings-flip"
              aria-label="Next page"
              disabled={pageIndex === SETTINGS_PAGES.length - 1}
              onClick={() => setPage(stepSettingsPage(page, 1))}
            >
              ›
            </button>
          </div>

          <p className="hab-settings-page-hint">{current.hint}</p>

          <TabsPrimitive.Content forceMount value="good-day" className="hab-settings-page">
            <GoodDayFields
              accomplishmentThreshold={accomplishmentThreshold}
              accomplishmentBonus={accomplishmentBonus}
              onAccomplishmentThresholdChange={onAccomplishmentThresholdChange}
              onAccomplishmentBonusChange={onAccomplishmentBonusChange}
            />
          </TabsPrimitive.Content>

          <TabsPrimitive.Content forceMount value="beat-past" className="hab-settings-page">
            <GradeLiftFields />
          </TabsPrimitive.Content>

          <TabsPrimitive.Content forceMount value="new-habits" className="hab-settings-page">
            <DefaultHabitPointsFields />
          </TabsPrimitive.Content>

          <TabsPrimitive.Content forceMount value="colors" className="hab-settings-page">
            <div className="hab-settings-bay">
              <div className="hab-settings-bay-head">
                <span className="hab-settings-bay-legend">Theme colors</span>
                <Button variant="ghost" size="sm" className="hab-settings-ghost" onClick={resetColors}>
                  Reset defaults
                </Button>
              </div>
              <div className="hab-settings-theme-grid">
                <PercentLedTintField />
                {THEME_LABELS.map(({ key, label, hint }) => (
                  <div key={key} className="hab-settings-theme-cell">
                    <Label className="hab-settings-label">{label}</Label>
                    <div className="hab-settings-swatch-row">
                      <input
                        type="color"
                        value={colors[key]}
                        onChange={(e) => setColor(key, e.target.value)}
                        className="hab-settings-swatch"
                        aria-label={label}
                      />
                      <Input
                        value={colors[key]}
                        onChange={(e) => setColor(key, e.target.value)}
                        className="hab-settings-input hab-settings-input-wide"
                        aria-label={`${label} hex`}
                      />
                    </div>
                    <p className="hab-settings-hint">{hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsPrimitive.Content>

          <TabsPrimitive.Content forceMount value="pictures" className="hab-settings-page">
            <div className="hab-settings-bay">
              <span className="hab-settings-bay-legend">Willpower gems</span>
              <WillpowerGemsSettingsField />
            </div>
            <div className="hab-settings-bay">
              <span className="hab-settings-bay-legend">Gems</span>
              <HabitGemSettingsField />
            </div>
          </TabsPrimitive.Content>

          <TabsPrimitive.Content forceMount value="backup" className="hab-settings-page">
            <div className="hab-settings-bay">
              <span className="hab-settings-bay-legend">Backup & restore</span>
              <div className="hab-settings-field">
                <p className="hab-settings-hint">Export downloads your habits and daily history as a JSON file.</p>
                <div className="hab-settings-row hab-settings-actions">
                  <Button variant="outline" size="sm" className="hab-settings-btn" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
              <div className="hab-settings-field">
                <Label htmlFor="settings-import-json" className="hab-settings-label">
                  Import
                </Label>
                <p className="hab-settings-hint">Paste an exported file here, then press Import to load it.</p>
                <Textarea
                  id="settings-import-json"
                  placeholder="Paste JSON to import…"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={4}
                  className="hab-settings-textarea"
                />
                <div className="hab-settings-row">
                  <Button
                    size="sm"
                    className="hab-settings-btn"
                    onClick={handleImport}
                    disabled={!importText.trim()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                </div>
              </div>
            </div>
            <div className="hab-settings-bay">
              <span className="hab-settings-bay-legend">Reset</span>
              <p className="hab-settings-hint">Deletes every habit and its history. Asks first.</p>
              <div className="hab-settings-row hab-settings-actions">
                <Button
                  variant="destructive"
                  size="sm"
                  className="hab-settings-btn is-danger"
                  onClick={() => {
                    if (confirm("Reset all habit data?")) {
                      onResetData()
                      onOpenChange(false)
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset habits
                </Button>
              </div>
            </div>
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
