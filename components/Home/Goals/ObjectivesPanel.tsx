/**
 * components/Home/Goals/ObjectivesPanel.tsx — Objectives (prioritized + list)
 *
 * Two stacked wells:
 *  1. **Prioritized** — objectives prioritized for the selected period
 *     (day/week/month/year), or every active priority in **All** mode.
 *  2. **All objectives** — a collapsible packed list; a quick star prioritizes
 *     an objective for the selected period (capped). Clicking a row opens detail.
 */
"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useGoalsStore } from "@/lib/goals-store"
import {
  periodKeyFor,
  isObjectivePrioritized,
  prioritizedObjectives,
  MAX_PRIORITIES_PER_PERIOD,
} from "@/lib/objectives"
import { APP_NAV_KEYS } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import type { Objective, ObjectivePriority, PriorityPeriod } from "@/lib/types"
import { ObjectiveDetailDialog } from "./ObjectiveDetailDialog"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"

const PERIODS: PriorityPeriod[] = ["day", "week", "month", "year"]
const PERIOD_LABELS: Record<PriorityPeriod, string> = { day: "Day", week: "Week", month: "Month", year: "Year" }
const VIEW_MODES = ["day", "week", "month", "year", "all"] as const
type ViewMode = (typeof VIEW_MODES)[number]

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

  const [mode, setMode] = usePersistedTab(APP_NAV_KEYS.homeGoalsPeriod, VIEW_MODES, "week")
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

  const addGuard = useUnsavedGuard({
    open: showAdd,
    onOpenChange: (next) => {
      setShowAdd(next)
      if (!next) {
        setNewTitle("")
        setNewDesc("")
      }
    },
    isDirty: newTitle.trim() !== "" || newDesc.trim() !== "",
    onSave: () => {
      if (!newTitle.trim()) return false
      handleAdd()
    },
    onDiscard: () => {
      setNewTitle("")
      setNewDesc("")
    },
  })

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
    <div className="gol-chips">
      {activePriorities(o)
        .sort((a, b) => PERIODS.indexOf(a.period) - PERIODS.indexOf(b.period))
        .map((p) => (
          <span key={`${p.period}-${p.periodKey}`} className="gol-chip is-gold">
            {PERIOD_LABELS[p.period]} ×{p.multiplier}
          </span>
        ))}
    </div>
  )

  const capLabel =
    mode === "all"
      ? `${prioritized.length} prioritized`
      : `${prioritizedObjectives(active, mode).length}/${MAX_PRIORITIES_PER_PERIOD[mode]} this ${mode}`

  return (
    <div className="gol-section">
      <div className="gol-section-head">
        <div>
          <h3 className="gol-legend">Objectives</h3>
          <p className="gol-hint">Your all-time directions. Prioritize a few per period to multiply points.</p>
        </div>
        <Dialog open={showAdd} onOpenChange={addGuard.handleOpenChange}>
          <DialogTrigger asChild>
            <button type="button" className="gol-btn">
              Add Objective
            </button>
          </DialogTrigger>
          <DialogContent className="gol95 gol95-dialog" hideClose aria-describedby={undefined} {...unsavedDismissProps(addGuard.requestClose)}>
            <div className="gol-dialog-caption">
              <DialogTitle>New Objective</DialogTitle>
            </div>
            <div className="gol-dialog-body">
              <label>
                Title
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g., Read a lot" />
              </label>
              <label>
                Description
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} />
              </label>
              <div className="gol-dialog-actions">
                <button type="button" className="gol-btn" onClick={() => addGuard.requestClose()}>
                  Cancel
                </button>
                <button type="button" className="gol-btn" onClick={handleAdd}>
                  Add Objective
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="gol-section-head">
        <Tabs value={mode} onValueChange={(v) => setMode(v as ViewMode)}>
          <TabsList className="gol-tabs">
            {PERIODS.map((p) => (
              <TabsTrigger key={p} value={p}>
                {PERIOD_LABELS[p]}
              </TabsTrigger>
            ))}
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="gol-cap">{capLabel}</span>
      </div>

      <h4 className="gol-legend">
        Prioritized {mode === "all" ? "(all periods)" : `· ${PERIOD_LABELS[mode as PriorityPeriod]}`}
      </h4>
      {prioritized.length === 0 ? (
        <p className="gol-empty">
          {mode === "all"
            ? "No objectives prioritized for any period yet."
            : `Nothing prioritized this ${mode}. Star an objective below to focus it.`}
        </p>
      ) : (
        <div className="gol-list">
          {prioritized.map((o) => (
            <div key={o.id} className="gol-row is-prio">
              <button type="button" className="gol-row-name" onClick={() => setOpenId(o.id)}>
                {o.title}
              </button>
              {priorityBadges(o)}
              {mode !== "all" && (
                <button
                  type="button"
                  className="gol-btn is-star is-on"
                  onClick={() => quickToggle(o, mode)}
                  title="Remove priority"
                >
                  ★
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Collapsible open={listOpen} onOpenChange={setListOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="gol-collapse" data-no95>
            <span aria-hidden>{listOpen ? "▾" : "▸"}</span>
            <span>All objectives</span>
            <span className="gol-cap">({active.length})</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="gol-list">
            {active.map((o) => {
              const isPrio = mode !== "all" && isObjectivePrioritized(o, mode)
              const n = goalCount(o.id)
              return (
                <div key={o.id} className={`gol-row${isPrio ? " is-prio" : ""}`}>
                  {mode !== "all" && (
                    <button
                      type="button"
                      data-no95
                      className={`gol-btn is-star${isPrio ? " is-on" : ""}`}
                      onClick={() => quickToggle(o, mode)}
                      title={`Prioritize for this ${mode}`}
                    >
                      {isPrio ? "★" : "☆"}
                    </button>
                  )}
                  <button type="button" data-no95 className="gol-row-name" onClick={() => setOpenId(o.id)}>
                    {o.title}
                  </button>
                  {priorityBadges(o)}
                  <span className="gol-meta">
                    {n} {n === 1 ? "goal" : "goals"}
                  </span>
                </div>
              )
            })}
            {active.length === 0 && <div className="gol-empty">No objectives yet.</div>}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {openId && <ObjectiveDetailDialog objectiveId={openId} onClose={() => setOpenId(null)} />}
      <UnsavedChangesDialog {...addGuard.prompt} />
    </div>
  )
}
