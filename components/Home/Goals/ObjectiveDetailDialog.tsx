/**
 * components/Home/Goals/ObjectiveDetailDialog.tsx — Objective detail / editor
 *
 * Edit an all-time Objective, prioritize it per period (with a custom points
 * multiplier), see the goals + completed actions that serve it, and write a
 * period review (success analysis). Prioritization caps: 3 per day/week/month,
 * 5 per year.
 */
"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Star, Trash2, Trophy, ListChecks, Archive, ArchiveRestore } from "lucide-react"
import { useGoalsStore } from "@/lib/goals-store"
import { useTaskStore } from "@/lib/task-store"
import {
  periodKeyFor,
  isObjectivePrioritized,
  prioritizedObjectives,
  goalProgressPercent,
  MAX_PRIORITIES_PER_PERIOD,
} from "@/lib/objectives"
import type { PriorityPeriod } from "@/lib/types"
import { safeDateFormat } from "@/lib/date-utils"

const PERIODS: PriorityPeriod[] = ["day", "week", "month", "year"]
const PERIOD_LABELS: Record<PriorityPeriod, string> = { day: "Day", week: "Week", month: "Month", year: "Year" }

export function ObjectiveDetailDialog({
  objectiveId,
  onClose,
}: {
  objectiveId: string
  onClose: () => void
}) {
  const objective = useGoalsStore((s) => s.objectives.find((o) => o.id === objectiveId))
  const objectives = useGoalsStore((s) => s.objectives)
  const goals = useGoalsStore((s) => s.goals)
  const updateObjective = useGoalsStore((s) => s.updateObjective)
  const deleteObjective = useGoalsStore((s) => s.deleteObjective)
  const setObjectivePriority = useGoalsStore((s) => s.setObjectivePriority)
  const clearObjectivePriority = useGoalsStore((s) => s.clearObjectivePriority)
  const saveObjectiveReview = useGoalsStore((s) => s.saveObjectiveReview)
  const tasks = useTaskStore((s) => s.tasks)

  const [title, setTitle] = useState(objective?.title ?? "")
  const [description, setDescription] = useState(objective?.description ?? "")
  const [reviewPeriod, setReviewPeriod] = useState<PriorityPeriod>("year")
  const [reviewText, setReviewText] = useState("")

  const linkedGoals = useMemo(
    () => goals.filter((g) => g.objectiveIds.includes(objectiveId)),
    [goals, objectiveId],
  )
  const contributingActions = useMemo(
    () =>
      tasks
        .filter((t) => t.completed && t.contributesToObjectiveIds?.includes(objectiveId))
        .sort((a, b) => {
          const da = a.completedDate ? new Date(a.completedDate).getTime() : 0
          const db = b.completedDate ? new Date(b.completedDate).getTime() : 0
          return db - da
        }),
    [tasks, objectiveId],
  )

  if (!objective) return null

  const saveBasics = () => {
    updateObjective({ ...objective, title: title.trim() || objective.title, description: description.trim() || undefined })
  }

  const togglePriority = (period: PriorityPeriod) => {
    const key = periodKeyFor(period)
    if (isObjectivePrioritized(objective, period)) {
      clearObjectivePriority(objective.id, period, key)
      return
    }
    const count = prioritizedObjectives(objectives, period).length
    if (count >= MAX_PRIORITIES_PER_PERIOD[period]) {
      alert(`You can prioritize at most ${MAX_PRIORITIES_PER_PERIOD[period]} objectives per ${period}.`)
      return
    }
    setObjectivePriority(objective.id, { period, periodKey: key, multiplier: 2 })
  }

  const setMultiplier = (period: PriorityPeriod, multiplier: number) => {
    const key = periodKeyFor(period)
    setObjectivePriority(objective.id, { period, periodKey: key, multiplier: Math.max(1, multiplier) })
  }

  const currentPriority = (period: PriorityPeriod) =>
    (objective.priorities ?? []).find((p) => p.period === period && p.periodKey === periodKeyFor(period))

  const existingReview = (objective.reviews ?? []).find(
    (r) => r.id === `${reviewPeriod}:${periodKeyFor(reviewPeriod)}`,
  )

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Objective</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basics */}
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveBasics} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={saveBasics} rows={2} />
            </div>
          </div>

          {/* Prioritization */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              <Label className="font-medium">Prioritize for a period</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Prioritized objectives multiply points for contributing actions. Caps: 3 per day/week/month, 5 per year.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {PERIODS.map((period) => {
                const priority = currentPriority(period)
                const on = !!priority
                return (
                  <div key={period} className="flex items-center justify-between gap-2 rounded-md border p-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{PERIOD_LABELS[period]}</div>
                      <div className="text-xs text-muted-foreground truncate">{periodKeyFor(period)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {on && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">×</span>
                          <Input
                            type="number"
                            min={1}
                            step={0.5}
                            className="h-8 w-16"
                            value={priority.multiplier}
                            onChange={(e) => setMultiplier(period, Number.parseFloat(e.target.value) || 1)}
                          />
                        </div>
                      )}
                      <Switch checked={on} onCheckedChange={() => togglePriority(period)} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Linked goals */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              <Label className="font-medium">Goals serving this objective</Label>
              <Badge variant="outline">{linkedGoals.length}</Badge>
            </div>
            {linkedGoals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No goals yet. Add a goal and link it to this objective.</p>
            ) : (
              <div className="space-y-2">
                {linkedGoals.map((g) => (
                  <div key={g.id} className="rounded-md border p-2">
                    <div className="flex justify-between text-sm">
                      <span className="truncate">{g.title}</span>
                      <span className="text-muted-foreground shrink-0">
                        {g.current}/{g.target}
                        {g.unit ? ` ${g.unit}` : ""}
                      </span>
                    </div>
                    <Progress value={goalProgressPercent(g)} className="h-1.5 mt-1" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contributing actions */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              <Label className="font-medium">Contributing actions</Label>
              <Badge variant="outline">{contributingActions.length}</Badge>
            </div>
            {contributingActions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No completed actions yet. Mark tasks as contributing to this objective when you finish them.
              </p>
            ) : (
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {contributingActions.slice(0, 50).map((t) => (
                  <li key={t.id} className="text-xs flex justify-between gap-2">
                    <span className="truncate">{t.description}</span>
                    <span className="text-muted-foreground shrink-0">
                      {t.completedDate ? safeDateFormat(t.completedDate) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Period review */}
          <div className="space-y-2 rounded-md border p-3">
            <Label className="font-medium">Review this objective</Label>
            <div className="flex flex-wrap gap-1">
              {PERIODS.map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={reviewPeriod === p ? "default" : "outline"}
                  onClick={() => {
                    setReviewPeriod(p)
                    const r = (objective.reviews ?? []).find((rv) => rv.id === `${p}:${periodKeyFor(p)}`)
                    setReviewText(r?.summary ?? "")
                  }}
                >
                  {PERIOD_LABELS[p]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {PERIOD_LABELS[reviewPeriod]} {periodKeyFor(reviewPeriod)} — analyze your success furthering this objective.
            </p>
            <Textarea
              value={reviewText || existingReview?.summary || ""}
              onChange={(e) => setReviewText(e.target.value)}
              rows={3}
              placeholder="What actions contributed? How successful were you? What's next?"
            />
            <Button
              size="sm"
              onClick={() => saveObjectiveReview(objective.id, reviewPeriod, periodKeyFor(reviewPeriod), reviewText)}
              disabled={!reviewText.trim()}
            >
              Save review
            </Button>
            {(objective.reviews ?? []).length > 0 && (
              <div className="pt-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Past reviews</p>
                {(objective.reviews ?? [])
                  .slice()
                  .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                  .map((r) => (
                    <div key={r.id} className="text-xs rounded bg-muted/50 p-2">
                      <span className="font-medium">{r.id}</span>: {r.summary}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateObjective({ ...objective, archived: !objective.archived })}
            >
              {objective.archived ? (
                <><ArchiveRestore className="h-4 w-4 mr-2" />Unarchive</>
              ) : (
                <><Archive className="h-4 w-4 mr-2" />Archive</>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm(`Delete objective "${objective.title}"?`)) {
                  deleteObjective(objective.id)
                  onClose()
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
