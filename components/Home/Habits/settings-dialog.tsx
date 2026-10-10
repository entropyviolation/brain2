/**
 * components/Home/Habits/settings-dialog.tsx — Habits & theme settings
 *
 * Portaled milled sheet (same fascia language as Week grade / Perfect output).
 * Grade-lift fields show yesterday's raw daily completion and last week's
 * Week grade + Perfect output, with signed deltas vs today / this week.
 */
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Download, Upload, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useThemeStore, type ThemeColors } from "@/lib/theme-store"
import { WillpowerGemsSettingsField } from "@/components/Home/Habits/willpower-gems"
import { HabitGemSettingsField } from "@/components/Home/Habits/gem-picker"
import { getGradeLiftComparisonTargets, useHabitsStore } from "@/lib/habits-store"
import { MAX_ACCOMPLISHMENT_BONUS } from "@/lib/habit-accomplishment"
import {
  formatGradeLiftDelta,
  formatGradeLiftLastWeekCaption,
  formatGradeLiftYesterdayCaption,
} from "@/lib/habit-points"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import { ColorSwatch } from "@/components/ui/color-swatch"
import type { WeeklyTask, WeeklyData, Category } from "@/lib/types"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"

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
  const ritualMult = useHabitsStore((s) => s.morningRitualPointMultiplier)
  const setRitualMult = useHabitsStore((s) => s.setMorningRitualPointMultiplier)
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
  const yesterdayDelta = formatGradeLiftDelta(targets.yesterdayDelta)
  const weekDelta = formatGradeLiftDelta(targets.lastWeekDeltas?.week)
  const outputDelta = formatGradeLiftDelta(targets.lastWeekDeltas?.output)

  return (
    <div className="hab-settings-bay">
      <span className="hab-settings-bay-legend">Grade lift bonuses</span>
      <p className="hab-settings-hint">
        Yesterday pays once when today&apos;s raw daily-habit completion (partial credit) is higher.
        Last week pays once for Week grade and once for Perfect output when that rail grade beats the
        prior full calendar week.         The prior 7 days and the prior 30 days each pay once when today&apos;s
        raw completion is above that average. Morning ritual is the × a habit
        prioritized in today&apos;s morning review shows on its row. 0 turns a rule off.
      </p>
      <div className="hab-settings-lift-grid">
        <div className="hab-settings-lift-row">
          <Label htmlFor="settings-day-grade-lift" className="hab-settings-label">
            Higher than yesterday
          </Label>
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
          </div>
          <p className="hab-settings-prior">
            When today&apos;s raw completion is higher than the prior 7-day average.
          </p>
        </div>
        <div className="hab-settings-lift-row">
          <Label htmlFor="settings-monthly-average-beat" className="hab-settings-label">
            Above the prior 30 days
          </Label>
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
          </div>
          <p className="hab-settings-prior">
            When today&apos;s raw completion is higher than the prior 30-day average.
          </p>
        </div>
        <div className="hab-settings-lift-row">
          <Label htmlFor="settings-morning-ritual-multiplier" className="hab-settings-label">
            Morning ritual
          </Label>
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
          <p className="hab-settings-prior">
            Shown on a habit that today&apos;s morning review prioritized. Default ×5.
          </p>
        </div>
      </div>
    </div>
  )
}

function PercentLedTintField() {
  const tint = useHabitsStore((s) => s.percentLedTint)
  const setPercentLedTint = useHabitsStore((s) => s.setPercentLedTint)
  const hydrated = usePersistHydrated(useHabitsStore.persist)
  return (
    <div className="hab-settings-bay">
      <span className="hab-settings-bay-legend">Percent LED tint</span>
      <p className="hab-settings-hint">
        Color of the glass percent tube, the numeric percent LED, and the Yes/No
        cell lamps. Control panel → Loading bar switches the tube vs digits.
      </p>
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
    </div>
  )
}

const THEME_LABELS: { key: keyof ThemeColors; label: string }[] = [
  { key: "pointsAllTime", label: "All-time points" },
  { key: "pointsToday", label: "Today's points" },
  { key: "pointsWeek", label: "This week points" },
  { key: "pointsMonth", label: "This month points" },
  { key: "habitBoolean", label: "Yes/No habit icon" },
  { key: "habitGoal", label: "Goal-based habit icon" },
  { key: "habitText", label: "Text habit icon" },
  { key: "habitIncremental", label: "Incremental habit icon" },
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
  const colors = useThemeStore((s) => s.colors)
  const setColor = useThemeStore((s) => s.setColor)
  const resetColors = useThemeStore((s) => s.resetColors)

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
        {...unsavedDismissProps(guard.requestClose)}
      >
        <DialogHeader className="hab-grade-sheet-caption">
          <span className="hab-grade-sheet-power" aria-hidden="true" />
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="hab-settings-stack">
          <div className="hab-settings-bay">
            <span className="hab-settings-bay-legend">Daily accomplishment</span>
            <p className="hab-settings-hint">
              Overall daily-habit completion for a Good day. Independent of Week grade and Perfect output.
            </p>
            <div className="hab-settings-pair">
              <div className="hab-settings-field">
                <Label htmlFor="settings-accomplishment-threshold" className="hab-settings-label">
                  Completion to feel accomplished
                </Label>
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

          <GradeLiftFields />

          <div className="hab-settings-bay">
            <span className="hab-settings-bay-legend">Willpower gems</span>
            <WillpowerGemsSettingsField />
          </div>

          <div className="hab-settings-bay">
            <span className="hab-settings-bay-legend">Gems</span>
            <HabitGemSettingsField />
          </div>

          <PercentLedTintField />

          <div className="hab-settings-bay">
            <div className="hab-settings-bay-head">
              <span className="hab-settings-bay-legend">Theme colors</span>
              <Button variant="ghost" size="sm" className="hab-settings-ghost" onClick={resetColors}>
                Reset defaults
              </Button>
            </div>
            <div className="hab-settings-theme-grid">
              {THEME_LABELS.map(({ key, label }) => (
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
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hab-settings-bay">
            <span className="hab-settings-bay-legend">Backup & restore</span>
            <div className="hab-settings-row hab-settings-actions">
              <Button variant="outline" size="sm" className="hab-settings-btn" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
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
            <Textarea
              placeholder="Paste JSON to import…"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={4}
              className="hab-settings-textarea"
            />
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
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
