/**
 * components/Settings/PointAllocationField.tsx — Automatic point allocation
 *
 * Ritual section points, the whole-ritual bonus, and the tomorrow goal-focus
 * multiplier. Habit bonuses stay in Habits → Settings. Inbox (+1 / +50) and
 * schedule (+1) stay their own constants. Objective stacking stays on the
 * goal layer (default 1.5×, or a period priority). This bay is where the
 * ritual award and the focus multiplier are edited.
 */
"use client"

import { Trophy } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { DEFAULT_GOAL_FOCUS_MULTIPLIER } from "@/lib/goal-focus"
import { DEFAULT_RITUAL_COMPLETION_BONUS, DEFAULT_RITUAL_SECTION_POINTS } from "@/lib/ritual-points"

export function PointAllocationField() {
  const sectionPoints = useUserSettingsStore((s) => s.ritualSectionPoints)
  const setSectionPoints = useUserSettingsStore((s) => s.setRitualSectionPoints)
  const bonus = useUserSettingsStore((s) => s.ritualCompletionBonus)
  const setBonus = useUserSettingsStore((s) => s.setRitualCompletionBonus)
  const focus = useUserSettingsStore((s) => s.goalFocusMultiplier)
  const setFocus = useUserSettingsStore((s) => s.setGoalFocusMultiplier)

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4" data-ui-name="Automatic point allocation">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4" />
        <h3 className="font-semibold">Automatic point allocation</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Submitting a ritual as done awards points for each section you actually filled or confirmed, plus a bonus
        for finishing the whole ritual. Closing it saves a draft and awards nothing. Tasks that serve goals you
        focus for tomorrow earn the focus multiplier — if an objective multiplier is already boosting that task,
        the larger one is kept.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ritual-section-points">Per section</Label>
          <Input
            id="ritual-section-points"
            type="number"
            min={0}
            step={1}
            value={sectionPoints ?? DEFAULT_RITUAL_SECTION_POINTS}
            onChange={(e) => setSectionPoints(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ritual-completion-bonus">Whole ritual</Label>
          <Input
            id="ritual-completion-bonus"
            type="number"
            min={0}
            step={1}
            value={bonus ?? DEFAULT_RITUAL_COMPLETION_BONUS}
            onChange={(e) => setBonus(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-focus-multiplier">Goal focus</Label>
          <Input
            id="goal-focus-multiplier"
            type="number"
            min={1}
            step={0.1}
            value={focus ?? DEFAULT_GOAL_FOCUS_MULTIPLIER}
            onChange={(e) => setFocus(Number(e.target.value))}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Defaults: {DEFAULT_RITUAL_SECTION_POINTS} per section, {DEFAULT_RITUAL_COMPLETION_BONUS} for the whole
        ritual, {DEFAULT_GOAL_FOCUS_MULTIPLIER}× for tomorrow&apos;s focused goals.
      </p>
    </div>
  )
}
