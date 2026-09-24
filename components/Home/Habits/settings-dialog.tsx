/**
 * components/Home/Habits/settings-dialog.tsx — Habits & theme settings
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
import { useHabitsStore } from "@/lib/habits-store"
import { MAX_ACCOMPLISHMENT_BONUS } from "@/lib/habit-accomplishment"
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

function PercentLedTintField() {
  const tint = useHabitsStore((s) => s.percentLedTint)
  const setPercentLedTint = useHabitsStore((s) => s.setPercentLedTint)
  const hydrated = usePersistHydrated(useHabitsStore.persist)
  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold" htmlFor="percent-led-tint">
        Percent LED tint
      </Label>
      <p className="text-xs text-muted-foreground">
        Color of the 10-pip loading channel, the numeric percent LED, and the Yes/No
        cell lamps. Control panel → Loading bar switches channel vs digits.
      </p>
      <div className="flex items-center gap-2">
        <ColorSwatch
          id="percent-led-tint"
          value={tint}
          onChange={setPercentLedTint}
          aria-label="Percent LED tint"
          size="md"
          disabled={!hydrated}
        />
        <span className="text-xs font-mono">{tint}</span>
      </div>
    </div>
  )
}

function GradeLiftFields() {
  const dayLift = useHabitsStore((s) => s.dayGradeLiftBonus)
  const setDayLift = useHabitsStore((s) => s.setDayGradeLiftBonus)
  const weekLift = useHabitsStore((s) => s.weeklyGradeLiftBonus)
  const setWeekLift = useHabitsStore((s) => s.setWeeklyGradeLiftBonus)
  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">Grade lift bonuses</Label>
      <p className="text-xs text-muted-foreground">
        Pays once for Week grade and once for Perfect output when that grade is higher than the day or week before.
        The high-completion bonus above is separate. 0 turns a lift off.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="settings-day-grade-lift" className="text-xs">
            Higher than yesterday
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="settings-day-grade-lift"
              type="number"
              min={0}
              max={MAX_ACCOMPLISHMENT_BONUS}
              step={1}
              value={dayLift}
              onChange={(e) => setDayLift(Number(e.target.value))}
              className="h-8"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">pts</span>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="settings-weekly-grade-lift" className="text-xs">
            Higher than last week
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="settings-weekly-grade-lift"
              type="number"
              min={0}
              max={MAX_ACCOMPLISHMENT_BONUS}
              step={1}
              value={weekLift}
              onChange={(e) => setWeekLift(Number(e.target.value))}
              className="h-8"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">pts</span>
          </div>
        </div>
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
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto" data-ui-name="Habits settings" data-ui-docs="components/Home/Habits/README.md" {...unsavedDismissProps(guard.requestClose)}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Daily accomplishment</Label>
            <p className="text-xs text-muted-foreground">
              Overall daily-habit completion for a Good day. Independent of Week grade and Perfect output.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="settings-accomplishment-threshold" className="text-xs">
                  Completion to feel accomplished
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="settings-accomplishment-threshold"
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={accomplishmentThreshold}
                    onChange={(e) => onAccomplishmentThresholdChange(Number(e.target.value))}
                    className="h-8"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="settings-accomplishment-bonus" className="text-xs">
                  Accomplishment bonus
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="settings-accomplishment-bonus"
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    value={accomplishmentBonus}
                    onChange={(e) => onAccomplishmentBonusChange(Number(e.target.value))}
                    className="h-8"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">pts</span>
                </div>
              </div>
            </div>
          </div>

          <GradeLiftFields />

          <div className="space-y-3">
            <Label className="text-base font-semibold">Willpower gems</Label>
            <WillpowerGemsSettingsField />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">Gems</Label>
            <HabitGemSettingsField />
          </div>

          <PercentLedTintField />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Theme colors</Label>
              <Button variant="ghost" size="sm" onClick={resetColors}>
                Reset defaults
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {THEME_LABELS.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={colors[key]}
                      onChange={(e) => setColor(key, e.target.value)}
                      className="h-8 w-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={colors[key]}
                      onChange={(e) => setColor(key, e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label className="text-base font-semibold">Backup & restore</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="destructive"
                size="sm"
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
            />
            <Button size="sm" onClick={handleImport} disabled={!importText.trim()}>
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
