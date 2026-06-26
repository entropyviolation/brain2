/**
 * components/Reviews/reviews.tsx — End-of-period review ritual
 *
 * `Reviews` is a header entry point: a dropdown listing day/week/month/quarter/
 * year reviews, badged when a just-ended period hasn't been reviewed yet.
 * Choosing one opens `ReviewDialog`, which walks the user through:
 *   - carry-over: tasks that were scheduled in the period but not completed,
 *     each of which can be marked done or pushed to the next period;
 *   - a summary of what passed, gratitude statements, reflection questions, and
 *     plans for the period to come.
 * Saved reviews persist in `reviews-store`.
 */
"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ClipboardCheck, CheckCircle2, ArrowRight, Plus, X, Sparkles } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useRegretStore } from "@/lib/regret-store"
import type { Task, ReviewPeriod, PeriodReview, BlockedReason } from "@/lib/types"
import { MorningReview } from "@/components/Reviews/MorningReview"
import {
  taskScheduledOnDay,
  taskScheduledInWeek,
  taskScheduledInMonth,
  taskScheduledInYear,
  getWeekString,
} from "@/lib/date-utils"
import {
  useReviewsStore,
  REVIEW_PERIODS,
  getPeriodKey,
  dateFromPeriodKey,
  previousPeriodDate,
  nextPeriodDate,
  periodLabel,
} from "@/lib/reviews-store"
import { getPendingReviews } from "@/lib/pending-reviews"
import { getStoredPlanText } from "@/lib/plan-text"
import { PostMortemDialog } from "@/components/Reviews/PostMortemDialog"
import { DayReviewTomorrowSection } from "@/components/Reviews/DayReviewTomorrowSection"

const REFLECTIONS: { id: string; q: string }[] = [
  { id: "wentWell", q: "What went well?" },
  { id: "improve", q: "What could have gone better?" },
  { id: "learned", q: "What did you learn?" },
]

// Structured "why blocked/skipped" reasons (HM3, Worker G).
const BLOCKED_REASONS: { id: BlockedReason; label: string }[] = [
  { id: "no-energy", label: "No energy" },
  { id: "missing-input", label: "Missing input" },
  { id: "procrastination", label: "Procrastination" },
  { id: "no-time", label: "No time" },
  { id: "blocked-by-other", label: "Blocked by other" },
  { id: "other", label: "Other" },
]

function tasksScheduledInPeriod(tasks: Task[], period: ReviewPeriod, key: string): Task[] {
  const ref = dateFromPeriodKey(period, key)
  return tasks.filter((t) => {
    if (t.completed) return false
    switch (period) {
      case "day":
        return taskScheduledOnDay(t, ref)
      case "week":
        return taskScheduledInWeek(t, key)
      case "month":
        return taskScheduledInMonth(t, key)
      case "quarter": {
        const start = new Date(ref.getFullYear(), ref.getMonth(), 1)
        return [0, 1, 2].some((i) => {
          const mk = `${start.getFullYear()}-${String(start.getMonth() + 1 + i).padStart(2, "0")}`
          // Normalize month overflow via Date for correctness
          const md = new Date(start.getFullYear(), start.getMonth() + i, 1)
          const mkey = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, "0")}`
          return taskScheduledInMonth(t, mkey) || taskScheduledInMonth(t, mk)
        })
      }
      case "year":
        return taskScheduledInYear(t, key)
      default:
        return false
    }
  })
}

function ReviewDialog({
  open,
  period,
  periodKey,
  onClose,
}: {
  open: boolean
  period: ReviewPeriod
  periodKey: string
  onClose: () => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const saveReview = useReviewsStore((s) => s.saveReview)
  const existing = useReviewsStore((s) => s.getReview(period, periodKey))

  const [summary, setSummary] = useState(existing?.summary || "")
  const [nextPlans, setNextPlans] = useState(existing?.nextPlans || "")
  const [gratitude, setGratitude] = useState<string[]>(existing?.gratitude?.length ? existing.gratitude : [""])
  const [reflections, setReflections] = useState<Record<string, string>>(existing?.reflections || {})
  const [planReflection, setPlanReflection] = useState(existing?.planReflection || "")
  const [resolved, setResolved] = useState<string[]>(existing?.resolvedTaskIds || [])
  const [pushed, setPushed] = useState<string[]>(existing?.pushedTaskIds || [])
  const [blockedReasons, setBlockedReasons] = useState<Record<string, BlockedReason>>(
    existing?.blockedReasons || {},
  )
  const [reflectTask, setReflectTask] = useState<Task | null>(null)
  const accrueRegret = useRegretStore((s) => s.addRegret)

  const incomplete = useMemo(
    () => tasksScheduledInPeriod(tasks, period, periodKey),
    [tasks, period, periodKey],
  )

  const storedPlanText = useMemo(() => {
    if (period === "quarter" || period === "year") return null
    return getStoredPlanText(period, periodKey)?.trim() || null
  }, [period, periodKey])

  const markDone = (task: Task) => {
    updateTask({ ...task, completed: true })
    setResolved((r) => [...new Set([...r, task.id])])
  }

  const pushToNext = (task: Task) => {
    const ref = dateFromPeriodKey(period, periodKey)
    const next = nextPeriodDate(period, ref)
    const cleared = { scheduledDate: undefined, scheduledWeek: undefined, scheduledMonth: undefined, scheduledYear: undefined }
    let patch: Partial<Task> = {}
    switch (period) {
      case "day":
        patch = { ...cleared, scheduledDate: next, daysPushed: (task.daysPushed ?? 0) + 1 }
        break
      case "week":
        patch = { ...cleared, scheduledWeek: getWeekString(next), weeksPushed: (task.weeksPushed ?? 0) + 1 }
        break
      case "month":
      case "quarter":
        patch = {
          ...cleared,
          scheduledMonth: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
          monthsPushed: (task.monthsPushed ?? 0) + 1,
        }
        break
      case "year":
        patch = { ...cleared, scheduledYear: String(next.getFullYear()) }
        break
    }
    updateTask({ ...task, ...patch })
    setPushed((p) => [...new Set([...p, task.id])])
  }

  const setReason = (task: Task, reason: BlockedReason) => {
    setBlockedReasons((prev) => ({ ...prev, [task.id]: reason }))
  }

  const handleSave = () => {
    const review: PeriodReview = {
      id: `${period}:${periodKey}`,
      period,
      periodKey,
      completedAt: new Date(),
      summary,
      gratitude: gratitude.map((g) => g.trim()).filter(Boolean),
      nextPlans,
      reflections,
      planReflection: planReflection.trim() || undefined,
      resolvedTaskIds: resolved,
      pushedTaskIds: pushed,
      blockedReasons: Object.keys(blockedReasons).length ? blockedReasons : undefined,
      ...(existing?.morning ? { morning: existing.morning } : {}),
    }
    saveReview(review)
    // Tag each blocked/skipped item's accrued regret with its structured reason
    // so the Regret view can break costs down by cause (HM3 → Feature 7).
    for (const task of incomplete) {
      const reason = blockedReasons[task.id]
      if (reason && !resolved.includes(task.id)) {
        accrueRegret(task.id, task.importance ?? 1, task.description, new Date(), reason)
      }
    }
    onClose()
  }

  const nextLabel =
    period === "day"
      ? "tomorrow"
      : period === "week"
        ? "next week"
        : period === "month"
          ? "next month"
          : period === "quarter"
            ? "next quarter"
            : "next year"

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 capitalize">
            <ClipboardCheck className="h-5 w-5" />
            {period} Review
          </DialogTitle>
          <DialogDescription>{periodLabel(period, periodKey)}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* Carry-over */}
          <section className="space-y-2">
            <h3 className="font-semibold text-sm">
              Unfinished, scheduled items ({incomplete.length})
            </h3>
            {incomplete.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing left unfinished. Nice work!</p>
            ) : (
              <div className="space-y-2">
                {incomplete.map((task) => (
                  <div key={task.id} className="border rounded-md p-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm flex-1 truncate">{task.description}</span>
                      {resolved.includes(task.id) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => setReflectTask({ ...task, completed: true })}
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1" />
                          Reflect
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="h-7" onClick={() => markDone(task)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Done
                          </Button>
                          <Button size="sm" variant="outline" className="h-7" onClick={() => pushToNext(task)}>
                            <ArrowRight className="h-3.5 w-3.5 mr-1" />
                            Push to {nextLabel}
                          </Button>
                        </>
                      )}
                    </div>
                    {!resolved.includes(task.id) && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground shrink-0">Why blocked?</span>
                        <Select
                          value={blockedReasons[task.id] ?? ""}
                          onValueChange={(v) => setReason(task, v as BlockedReason)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Pick a reason (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {BLOCKED_REASONS.map((r) => (
                              <SelectItem key={r.id} value={r.id} className="text-xs">
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(resolved.length > 0 || pushed.length > 0) && (
              <p className="text-xs text-muted-foreground">
                {resolved.length} completed · {pushed.length} pushed to {nextLabel}
              </p>
            )}
          </section>

          {/* Summary */}
          <section className="space-y-2">
            <Label className="font-semibold text-sm">Summary — what happened this {period}?</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="A short recap…" />
          </section>

          {/* Gratitude */}
          <section className="space-y-2">
            <Label className="font-semibold text-sm">Gratitude</Label>
            {gratitude.map((g, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={g}
                  onChange={(e) => setGratitude((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder="I'm grateful for…"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setGratitude((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setGratitude((arr) => [...arr, ""])}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </section>

          {storedPlanText && (
            <section className="space-y-3">
              <Label className="font-semibold text-sm capitalize">Your {period} plan</Label>
              <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{storedPlanText}</div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Reflect on what you wrote in your plan</p>
                <Textarea
                  value={planReflection}
                  onChange={(e) => setPlanReflection(e.target.value)}
                  rows={3}
                  placeholder="How did the plan play out? What would you adjust?"
                />
              </div>
            </section>
          )}

          {/* Reflections */}
          <section className="space-y-3">
            <Label className="font-semibold text-sm">Reflection</Label>
            {REFLECTIONS.map((r) => (
              <div key={r.id} className="space-y-1">
                <p className="text-sm text-muted-foreground">{r.q}</p>
                <Textarea
                  value={reflections[r.id] || ""}
                  onChange={(e) => setReflections((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  rows={2}
                />
              </div>
            ))}
          </section>

          {/* Plan the next period */}
          {period === "day" ? (
            <DayReviewTomorrowSection reviewedDayKey={periodKey} />
          ) : (
            <section className="space-y-2">
              <Label className="font-semibold text-sm">Plans for the {nextLabel.replace("next ", "")} to come</Label>
              <Textarea
                value={nextPlans}
                onChange={(e) => setNextPlans(e.target.value)}
                rows={3}
                placeholder="What matters most next?"
              />
            </section>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Review</Button>
        </div>
      </DialogContent>

      <PostMortemDialog task={reflectTask} open={!!reflectTask} onClose={() => setReflectTask(null)} />
    </Dialog>
  )
}

export function Reviews() {
  const reviews = useReviewsStore((s) => s.reviews)
  const [active, setActive] = useState<{ period: ReviewPeriod; key: string } | null>(null)

  // Compute the just-ended period for each type and whether it still needs review.
  const pending = useMemo(() => getPendingReviews(reviews), [reviews])

  const pendingCount = REVIEW_PERIODS.filter((p) => pending[p].needed).length

  return (
    <>
      <MorningReview />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="relative" data-home-review-entry>
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Review
            {pendingCount > 0 && (
              <Badge className="ml-2 h-5 min-w-5 px-1 justify-center" variant="default">
                {pendingCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>End-of-period reviews</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {REVIEW_PERIODS.map((p) => (
            <DropdownMenuItem key={p} onClick={() => setActive({ period: p, key: pending[p].key })}>
              <span className="capitalize flex-1">{p} review</span>
              {pending[p].needed ? (
                <Badge variant="default" className="ml-2 text-[10px]">
                  due
                </Badge>
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 ml-2" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {active && (
        <ReviewDialog open={!!active} period={active.period} periodKey={active.key} onClose={() => setActive(null)} />
      )}
    </>
  )
}
