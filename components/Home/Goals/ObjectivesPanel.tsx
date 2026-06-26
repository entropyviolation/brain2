/**
 * components/Home/Goals/ObjectivesPanel.tsx — Objectives (prioritized + list)
 *
 * Two stacked containers:
 *  1. **Prioritized** — objectives prioritized for the selected period
 *     (day/week/month/year), or every active priority in **All** mode.
 *  2. **All objectives** — a compact, collapsible list; a quick star prioritizes
 *     an objective for the selected period (capped). Clicking a row opens detail.
 */
"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Compass, Plus, Star, ChevronDown } from "lucide-react"
import { useGoalsStore } from "@/lib/goals-store"
import {
  periodKeyFor,
  isObjectivePrioritized,
  prioritizedObjectives,
  MAX_PRIORITIES_PER_PERIOD,
} from "@/lib/objectives"
import type { Objective, ObjectivePriority, PriorityPeriod } from "@/lib/types"
import { ObjectiveDetailDialog } from "./ObjectiveDetailDialog"

const PERIODS: PriorityPeriod[] = ["day", "week", "month", "year"]
const PERIOD_LABELS: Record<PriorityPeriod, string> = { day: "Day", week: "Week", month: "Month", year: "Year" }
type ViewMode = PriorityPeriod | "all"

/** Priorities currently in effect (matching the period key for "now"). */
function activePriorities(o: Objective): ObjectivePriority[] {
  return (o.priorities ?? []).filter((p) => p.periodKey === periodKeyFor(p.period))
}

export function ObjectivesPanel() {
  const objectives = useGoalsStore((s) => s.objectives)
  const goals = useGoalsStore((s) => s.goals)
  const addObjective = useGoalsStore((s) => s.addObjective)
  const setObjectivePriority = useGoalsStore((s) => s.setObjectivePriority)
  const clearObjectivePriority = useGoalsStore((s) => s.clearObjectivePriority)

  const [mode, setMode] = useState<ViewMode>("week")
  const [listOpen, setListOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)

  const active = useMemo(() => objectives.filter((o) => !o.archived), [objectives])
  const goalCount = (id: string) => goals.filter((g) => g.objectiveIds.includes(id)).length

  const prioritized = useMemo(() => {
    if (mode === "all") return active.filter((o) => activePriorities(o).length > 0)
    return prioritizedObjectives(active, mode)
  }, [active, mode])

  const handleAdd = () => {
    if (!newTitle.trim()) return
    addObjective({ title: newTitle.trim(), description: newDesc.trim() || undefined })
    setNewTitle("")
    setNewDesc("")
    setShowAdd(false)
  }

  const quickToggle = (objective: Objective, period: PriorityPeriod) => {
    const key = periodKeyFor(period)
    if (isObjectivePrioritized(objective, period)) {
      clearObjectivePriority(objective.id, period, key)
      return
    }
    if (prioritizedObjectives(active, period).length >= MAX_PRIORITIES_PER_PERIOD[period]) {
      alert(`You can prioritize at most ${MAX_PRIORITIES_PER_PERIOD[period]} objectives per ${period}.`)
      return
    }
    setObjectivePriority(objective.id, { period, periodKey: key, multiplier: 2 })
  }

  const priorityBadges = (o: Objective) => (
    <div className="flex flex-wrap gap-1 justify-end">
      {activePriorities(o)
        .sort((a, b) => PERIODS.indexOf(a.period) - PERIODS.indexOf(b.period))
        .map((p) => (
          <Badge key={`${p.period}-${p.periodKey}`} className="bg-yellow-100 text-yellow-800 border-yellow-200 text-[10px] px-1.5 py-0">
            <Star className="h-2.5 w-2.5 mr-0.5" />
            {PERIOD_LABELS[p.period]} ×{p.multiplier}
          </Badge>
        ))}
    </div>
  )

  const capLabel =
    mode === "all"
      ? `${prioritized.length} prioritized`
      : `${prioritizedObjectives(active, mode).length}/${MAX_PRIORITIES_PER_PERIOD[mode]} this ${mode}`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Compass className="h-5 w-5" /> Objectives
          </h3>
          <p className="text-sm text-muted-foreground">
            Your all-time directions. Prioritize a few per period to multiply points.
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Objective</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Objective</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g., Read a lot" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} />
              </div>
              <Button onClick={handleAdd} className="w-full">Add Objective</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Period selector (shared by both containers) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={mode} onValueChange={(v) => setMode(v as ViewMode)}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p} value={p}>{PERIOD_LABELS[p]}</TabsTrigger>
            ))}
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-xs text-muted-foreground">{capLabel}</span>
      </div>

      {/* Prioritized container */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            Prioritized {mode === "all" ? "(all periods)" : `· ${PERIOD_LABELS[mode as PriorityPeriod]}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {prioritized.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">
              {mode === "all"
                ? "No objectives prioritized for any period yet."
                : `Nothing prioritized this ${mode}. Star an objective below to focus it.`}
            </p>
          ) : (
            <div className="divide-y">
              {prioritized.map((o) => (
                <div key={o.id} className="flex items-center gap-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenId(o.id)}
                    className="flex-1 min-w-0 text-left text-sm font-medium truncate hover:underline"
                  >
                    {o.title}
                  </button>
                  {priorityBadges(o)}
                  {mode !== "all" && (
                    <button
                      type="button"
                      onClick={() => quickToggle(o, mode)}
                      title="Remove priority"
                      className="shrink-0"
                    >
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All objectives — compact collapsible list */}
      <Collapsible open={listOpen} onOpenChange={setListOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-1 py-2 text-left text-sm font-semibold hover:bg-muted/60 transition-colors"
          >
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${listOpen ? "" : "-rotate-90"}`} />
            <span>All objectives</span>
            <span className="text-muted-foreground font-normal">({active.length})</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border rounded-lg divide-y mt-1">
            {active.map((o) => {
              const isPrio = mode !== "all" && isObjectivePrioritized(o, mode)
              return (
                <div key={o.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 text-sm">
                  {mode !== "all" && (
                    <button
                      type="button"
                      onClick={() => quickToggle(o, mode)}
                      title={`Prioritize for this ${mode}`}
                      className="shrink-0"
                    >
                      <Star className={`h-4 w-4 ${isPrio ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"}`} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenId(o.id)}
                    className="flex-1 min-w-0 text-left truncate hover:underline"
                  >
                    {o.title}
                  </button>
                  {priorityBadges(o)}
                  <span className="text-[10px] text-muted-foreground shrink-0 w-12 text-right">
                    {goalCount(o.id)} goals
                  </span>
                </div>
              )
            })}
            {active.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No objectives yet.</div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {openId && <ObjectiveDetailDialog objectiveId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
