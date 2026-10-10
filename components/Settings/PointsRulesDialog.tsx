/**
 * components/Settings/PointsRulesDialog.tsx — Every global points rule
 *
 * Nested inside Settings, same shell as Manage Item Types. Each row saves
 * through the catalog (`commitPointsRule` / `resetPointsRule`). Habit rows
 * and ritual / goal-focus rows write the fields those screens already use.
 */
"use client"

import { useMemo, useState } from "react"
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useHabitsStore } from "@/lib/habits-store"
import {
  POINTS_RULES,
  POINTS_RULE_SECTIONS,
  POINTS_RULES_ITEM_NOTE,
  type PointsRuleDef,
} from "@/lib/points-rules"
import { commitPointsRule, pointsRuleValue, resetPointsRule } from "@/lib/points-rules-live"
import { useUserSettingsStore } from "@/lib/user-settings-store"

function usePointsRuleRevision(): void {
  useUserSettingsStore((s) => s.pointsRules)
  useUserSettingsStore((s) => s.ritualSectionPoints)
  useUserSettingsStore((s) => s.ritualCompletionBonus)
  useUserSettingsStore((s) => s.goalFocusMultiplier)
  useHabitsStore((s) => s.accomplishmentThreshold)
  useHabitsStore((s) => s.accomplishmentBonus)
  useHabitsStore((s) => s.dayGradeLiftBonus)
  useHabitsStore((s) => s.weeklyGradeLiftBonus)
  useHabitsStore((s) => s.weeklyAverageBeatBonus)
  useHabitsStore((s) => s.monthlyAverageBeatBonus)
  useHabitsStore((s) => s.morningRitualPointMultiplier)
  useHabitsStore((s) => s.defaultHabitPoints)
}

function ruleMatches(rule: PointsRuleDef, query: string): boolean {
  if (!query) return true
  return (
    rule.label.toLowerCase().includes(query) ||
    rule.section.toLowerCase().includes(query) ||
    rule.explanation.toLowerCase().includes(query)
  )
}

function PointsRuleRow({ rule }: { rule: PointsRuleDef }) {
  const value = pointsRuleValue(rule.id)
  return (
    <div className="space-y-1.5 rounded-lg border border-dashed p-3" data-points-rule={rule.id}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[8rem] flex-1 space-y-1">
          <Label htmlFor={`points-rule-${rule.id}`}>{rule.label}</Label>
          <div className="flex items-center gap-2">
            <Input
              id={`points-rule-${rule.id}`}
              type="number"
              inputMode="decimal"
              min={rule.min}
              max={rule.max}
              step={rule.step}
              value={value}
              className="w-28"
              onChange={(event) => {
                const raw = event.target.value
                if (raw.trim() === "" || raw === "-" || raw === ".") return
                const next = Number(raw)
                if (!Number.isFinite(next)) return
                commitPointsRule(rule.id, next)
              }}
            />
            {rule.unit ? <span className="text-sm text-muted-foreground">{rule.unit}</span> : null}
          </div>
        </div>
        <Button type="button" variant="outline" aria-label={`Restore ${rule.label}`} onClick={() => resetPointsRule(rule.id)}>
          Default
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{rule.explanation}</p>
    </div>
  )
}

export function PointsRulesDialog({ container }: { container?: HTMLElement | null }) {
  usePointsRuleRevision()
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const groups = useMemo(
    () =>
      POINTS_RULE_SECTIONS.map((section) => ({
        section,
        rules: POINTS_RULES.filter((rule) => rule.section === section && ruleMatches(rule, needle)),
      })).filter((group) => group.rules.length > 0),
    [needle],
  )

  return (
    <DialogContent
      className="set95 set95-dialog flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl"
      container={container}
      data-ui-name="Points rules"
    >
      <DialogHeader className="set-caption">
        <div className="set-caption-mark">
          <span className="set-power-lamp" aria-hidden />
          <DialogTitle>Points rules</DialogTitle>
        </div>
        <DialogDescription className="set-caption-lead">
          Every global point rule. A change saves immediately. Default restores that one rule.
        </DialogDescription>
      </DialogHeader>
      <div className="set-body min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="space-y-1.5">
          <Label htmlFor="points-rules-filter">Filter</Label>
          <Input
            id="points-rules-filter"
            value={query}
            placeholder="Label, section, or explanation"
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules match that filter.</p>
        ) : (
          groups.map((group) => (
            <section key={group.section} className="space-y-2" aria-label={group.section}>
              <h3 className="font-semibold">{group.section}</h3>
              {group.rules.map((rule) => (
                <PointsRuleRow key={rule.id} rule={rule} />
              ))}
            </section>
          ))
        )}
        <div className="space-y-1.5 rounded-lg border border-dashed p-3">
          <h3 className="font-semibold">Edited on the item</h3>
          <p className="text-sm text-muted-foreground">{POINTS_RULES_ITEM_NOTE}</p>
        </div>
      </div>
    </DialogContent>
  )
}
