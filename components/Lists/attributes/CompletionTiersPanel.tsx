/**
 * components/Lists/attributes/CompletionTiersPanel.tsx — Tiered reward explainer
 *
 * A read-only companion shown above the value editors whenever an item carries a
 * completion-tier set (bare minimum / goal / exceptional). It surfaces three
 * things, all derived live from the item's current attribute values:
 *
 *   1. the three reward levels and which one the current value has reached,
 *   2. the live points the item is currently worth, and
 *   3. the underlying **formula** and its plain-language **rule ladder** —
 *      so the panel doubles as a worked example that teaches users how the
 *      formula/rule engine works and how to tweak it.
 */
"use client"

import type { AttributeDefinition, AttributeValue } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"
import {
  TIER_ATTR_IDS,
  buildPointsFormula,
  describeCompletionRules,
  resolveTierSnapshot,
  type CompletionTierSnapshot,
} from "@/lib/completion-tiers"

const LEVEL_LABEL: Record<CompletionTierSnapshot["level"], string> = {
  none: "Not started",
  "bare-minimum": "Bare minimum",
  goal: "Goal",
  exceptional: "Exceptional",
}

const LEVEL_ORDER: CompletionTierSnapshot["level"][] = ["bare-minimum", "goal", "exceptional"]

function TierStep({
  label,
  threshold,
  unit,
  reached,
  active,
}: {
  label: string
  threshold: number
  unit: string
  reached: boolean
  active: boolean
}) {
  return (
    <div
      className={`flex-1 rounded-md border px-2 py-1.5 text-center transition-colors ${
        active
          ? "border-primary bg-primary/10"
          : reached
            ? "border-primary/40 bg-primary/5"
            : "border-dashed bg-muted/30 opacity-70"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">
        {threshold}
        {unit ? <span className="text-[10px] font-normal text-muted-foreground"> {unit}</span> : null}
      </div>
    </div>
  )
}

export function CompletionTiersPanel({
  definitions,
  values,
}: {
  definitions: AttributeDefinition[]
  values: Record<string, AttributeValue>
}) {
  const snap = resolveTierSnapshot(values, definitions)
  const rules = describeCompletionRules(
    { bareMin: snap.bareMin, goal: snap.goal, exceptional: snap.exceptional },
    snap.unit,
  )
  const pointsDef = definitions.find((d) => d.id === TIER_ATTR_IDS.points && d.type === "formula")
  const formula = (pointsDef?.formula || buildPointsFormula()).replace(/^=/, "=").trim()

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Trophy className="h-4 w-4 text-amber-500" />
          Completion levels
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={snap.level === "none" ? "secondary" : "default"}>{LEVEL_LABEL[snap.level]}</Badge>
          <span className="text-sm font-semibold tabular-nums">
            {snap.points} pt{snap.points === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="flex items-stretch gap-1.5">
        {LEVEL_ORDER.map((lvl) => {
          const threshold = lvl === "bare-minimum" ? snap.bareMin : lvl === "goal" ? snap.goal : snap.exceptional
          const reached = snap.current >= threshold
          return (
            <TierStep
              key={lvl}
              label={LEVEL_LABEL[lvl]}
              threshold={threshold}
              unit={snap.unit}
              reached={reached}
              active={snap.level === lvl}
            />
          )
        })}
      </div>

      <div className="text-[11px] text-muted-foreground">
        Currently <span className="font-medium text-foreground tabular-nums">{snap.current}</span>
        {snap.unit ? ` ${snap.unit}` : ""} — edit <span className="font-medium">Current</span> below to see points
        update.
      </div>

      <div className="space-y-1.5 border-t pt-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Rules (what earns points)</div>
        <ul className="space-y-0.5">
          {rules.map((r) => (
            <li
              key={r.level}
              className={`flex items-baseline justify-between gap-3 text-xs ${
                r.level === snap.level ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="font-mono">{r.condition}</span>
              <span className="text-right">{r.reward}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1 border-t pt-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Points formula (edit it in the list&apos;s attribute schema)
        </div>
        <code className="block rounded bg-background/80 px-2 py-1 font-mono text-[11px] leading-relaxed break-words">
          {formula}
        </code>
      </div>
    </div>
  )
}
