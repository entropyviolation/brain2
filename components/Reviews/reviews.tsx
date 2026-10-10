/**
 * components/Reviews/reviews.tsx — Rituals entry (header) + end/night dialog
 *
 * User-facing label: Rituals. Day shows sun (morning) + moon (night). Week–
 * year offer Start ritual (plan) and Review ritual (end). A Star Lord Report
 * opens on the local new moon, the local full moon, and the birthday in
 * Settings. End dialog walks
 * carry-over (push via the Scheduler, Other as free text), assumed times,
 * week–year stats and the shared reflection, summary, gratitude, and next plans.
 * Morning stays `MorningReviewDialog`. Start (non-day) is `StartRitualDialog`.
 * Saved reviews persist in `reviews-store`. Shells: `.hpp95`.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { ClipboardCheck, CheckCircle2, ArrowRight, Plus, X, Sparkles } from "lucide-react"
import { RitualMoonIcon, RitualSunIcon } from "@/components/Icons"
import { useTaskStore } from "@/lib/task-store"
import { useRegretStore } from "@/lib/regret-store"
import { usePointsStore } from "@/lib/points-store"
import { useGoalsStore } from "@/lib/goals-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import type { Task, ReviewPeriod, PeriodReview, PeriodArcReflection, StoredBlockedReason } from "@/lib/types"
import { MorningReviewDialog } from "@/components/Reviews/MorningReview"
import { StarLordReportDialog } from "@/components/Reviews/StarLordReportDialog"
import { StartRitualDialog } from "@/components/Reviews/StartRitualDialog"
import { ritualPushPatch } from "@/lib/ritual-push"
import { blockedReasonToken } from "@/lib/blocked-reason"
import { cleanArc } from "@/lib/period-arc"
import {
  useReviewsStore,
  REVIEW_PERIODS,
  getPeriodKey,
  dateFromPeriodKey,
  localDayKey,
  morningReviewPhase,
  nextPeriodDate,
  periodLabel,
} from "@/lib/reviews-store"
import { countAvailableRituals, endRitualPhase, startRitualPhase } from "@/lib/rituals"
import { listStarLordSlots, type StarLordKind } from "@/lib/star-lord"
import { useStarLordStore } from "@/lib/star-lord-store"
import { seasonOfDate, seasonSlug } from "@/lib/seasons"
import { getPendingReviews } from "@/lib/pending-reviews"
import { getStoredPlanText } from "@/lib/plan-text"
import { PostMortemDialog } from "@/components/Reviews/PostMortemDialog"
import { DayReviewTomorrowSection } from "@/components/Reviews/DayReviewTomorrowSection"
import { AssumedTimesSection, pendingAssumedTasks } from "@/components/Reviews/AssumedTimesSection"
import { NightTimeGlance } from "@/components/Reviews/NightTimeGlance"
import { WhyBlockedControl } from "@/components/Reviews/WhyBlockedControl"
import { PeriodReviewStudio } from "@/components/Reviews/PeriodReviewStudio"
import { unfinishedTasksForRitual } from "@/lib/ritual-unfinished"
import {
  completedRitualSections,
  ritualAwardPoints,
  ritualPointsLabel,
  ritualPointsTaskId,
} from "@/lib/ritual-points"
import { currentRitualPointSettings } from "@/lib/points-rules-live"
import { itemTitle } from "@/lib/item-utils"

const REFLECTIONS: { id: string; q: string }[] = [
  { id: "wentWell", q: "What went well?" },
  { id: "improve", q: "What could have gone better?" },
  { id: "learned", q: "What did you learn?" },
]

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
  const [gratitude, setGratitude] = useState<string[]>(
    existing?.gratitude?.length ? existing.gratitude : [""],
  )
  const [reflections, setReflections] = useState<Record<string, string>>(existing?.reflections || {})
  const [planReflection, setPlanReflection] = useState(existing?.planReflection || "")
  const [wakeReminder, setWakeReminder] = useState(existing?.wakeReminder || "")
  const [tomorrowMatters, setTomorrowMatters] = useState(existing?.tomorrowMatters || "")
  const [timeReflection, setTimeReflection] = useState(existing?.timeReflection || "")
  const [focusGoalIds, setFocusGoalIds] = useState<string[]>(existing?.tomorrowFocusGoalIds || [])
  const [arc, setArc] = useState<PeriodArcReflection>(existing?.arc || {})
  const [resolved, setResolved] = useState<string[]>(existing?.resolvedTaskIds || [])
  const [pushed, setPushed] = useState<string[]>(existing?.pushedTaskIds || [])
  const [blockedReasons, setBlockedReasons] = useState<Record<string, StoredBlockedReason>>(
    existing?.blockedReasons || {},
  )
  const [pushError, setPushError] = useState<string | null>(null)
  const [reflectTask, setReflectTask] = useState<Task | null>(null)
  const accrueRegret = useRegretStore((s) => s.addRegret)
  const upsertPoints = usePointsStore((s) => s.upsertPoints)
  const goals = useGoalsStore((s) => s.goals)
  const submittedRef = useRef(false)
  const baselineRef = useRef("")

  const incomplete = useMemo(
    () => unfinishedTasksForRitual(tasks, period, periodKey),
    [tasks, period, periodKey],
  )
  const visibleUnfinished = incomplete.filter((task) => !pushed.includes(task.id))
  const assumedPending = useMemo(
    () => pendingAssumedTasks(tasks, period, periodKey).length,
    [tasks, period, periodKey],
  )
  const baselineAssumed = useRef(assumedPending)

  const storedPlanText = useMemo(() => {
    if (period === "quarter" || period === "year") return null
    return getStoredPlanText(period, periodKey)?.trim() || null
  }, [period, periodKey])

  const markDone = (task: Task) => {
    updateTask({ ...task, completed: true })
    setResolved((r) => [...new Set([...r, task.id])])
  }

  const pushToNext = (task: Task) => {
    try {
      const patch = ritualPushPatch(task, period, periodKey)
      updateTask({ ...task, ...patch })
      setPushed((p) => [...new Set([...p, task.id])])
      setPushError(null)
    } catch {
      setPushError("Could not push this task.")
    }
  }

  const setReason = (taskId: string, reason: StoredBlockedReason) => {
    setBlockedReasons((prev) => ({ ...prev, [taskId]: reason }))
  }

  const tomorrowKey = useMemo(() => {
    if (period !== "day") return ""
    return localDayKey(nextPeriodDate("day", dateFromPeriodKey("day", periodKey)))
  }, [period, periodKey])

  const snapshot = () =>
    JSON.stringify({
      summary,
      nextPlans,
      gratitude,
      reflections,
      planReflection,
      wakeReminder,
      tomorrowMatters,
      timeReflection,
      focusGoalIds,
      arc,
      resolved,
      pushed,
      blockedReasons,
    })

  useEffect(() => {
    baselineRef.current = snapshot()
    // Capture the form as opened. Later edits are what make a draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, periodKey])

  const persist = (markDone: boolean) => {
    const done = markDone || existing?.endCompleted === true
    const grateful = gratitude.map((g) => g.trim()).filter(Boolean)
    const review: PeriodReview = {
      id: `${period}:${periodKey}`,
      period,
      periodKey,
      completedAt: existing?.completedAt ?? new Date(),
      endCompleted: done ? true : false,
      summary,
      gratitude: grateful,
      nextPlans,
      reflections,
      planReflection: planReflection.trim() || undefined,
      wakeReminder: wakeReminder.trim() || undefined,
      tomorrowMatters: tomorrowMatters.trim() || undefined,
      timeReflection: timeReflection.trim() || undefined,
      tomorrowFocusGoalIds: focusGoalIds.length ? focusGoalIds : undefined,
      arc: cleanArc(arc),
      resolvedTaskIds: resolved,
      pushedTaskIds: pushed,
      blockedReasons: Object.keys(blockedReasons).length ? blockedReasons : undefined,
      ...(existing?.morning ? { morning: existing.morning } : {}),
      ...(existing?.start ? { start: existing.start } : {}),
    }
    saveReview(review)
    if (!done) return
    const nextPlanText =
      period === "day" ? getStoredPlanText("day", tomorrowKey) || "" : nextPlans
    const input = {
      period,
      unfinishedCount: incomplete.length,
      unfinishedTouched: new Set([...resolved, ...pushed, ...Object.keys(blockedReasons)]).size,
      assumedPending,
      assumedTouched:
        assumedPending < baselineAssumed.current ||
        pendingAssumedTasks(tasks, period, periodKey).some((task) => task.timeRough),
      summary,
      gratitude: grateful,
      planShown: !!storedPlanText,
      planReflection,
      reflections,
      nextPlanText,
      wakeReminder,
      tomorrowMatters,
      timeReflection,
      focusGoalCount: focusGoalIds.length,
      arc: cleanArc(arc),
    }
    const settings = currentRitualPointSettings()
    const points = ritualAwardPoints(input, settings, true)
    const sections = completedRitualSections(input).length
    upsertPoints(
      ritualPointsTaskId(period, periodKey),
      points,
      ritualPointsLabel(review, sections, settings.completionBonus),
      dateFromPeriodKey(period, periodKey),
    )
    if (!markDone) return
    for (const task of incomplete) {
      const reason = blockedReasonToken(blockedReasons[task.id])
      if (reason && !resolved.includes(task.id)) {
        accrueRegret(task.id, task.importance ?? 1, itemTitle(task), dateFromPeriodKey(period, periodKey), reason)
      }
    }
  }

  const handleSave = () => {
    submittedRef.current = true
    persist(true)
    onClose()
  }

  const dismiss = () => {
    if (!submittedRef.current && snapshot() !== baselineRef.current) persist(false)
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

  const title =
    period === "day" ? "Night ritual" : period === "quarter" ? "Season review" : `${period} Review ritual`

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent
        className="hpp95 hpp95-dialog sm:max-w-2xl max-h-[88vh] overflow-hidden flex flex-col"
        data-ui-name="Period review"
        data-ui-docs="components/Reviews/README.md"
      >
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle className="flex items-center gap-2 capitalize">
              {period === "day" ? (
                <RitualMoonIcon className="h-5 w-5" />
              ) : (
                <ClipboardCheck className="h-5 w-5" />
              )}
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="hpp-caption-lead">
            {periodLabel(period, periodKey)}
          </DialogDescription>
        </DialogHeader>

        <div className="hpp-body flex-1 overflow-y-auto space-y-6 pr-1">
          <section className="space-y-2">
            <h3 className="font-semibold text-sm">
              Unfinished, scheduled items ({visibleUnfinished.length})
            </h3>
            {visibleUnfinished.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing left unfinished. Nice work!</p>
            ) : (
              <div className="space-y-2">
                {visibleUnfinished.map((task) => (
                  <div key={task.id} className="border rounded-md p-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm flex-1 truncate">{itemTitle(task)}</span>
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
                      <WhyBlockedControl
                        taskTitle={itemTitle(task)}
                        value={blockedReasons[task.id]}
                        onChange={(reason) => setReason(task.id, reason)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            {pushError && <p className="text-xs text-muted-foreground">{pushError}</p>}
            {(resolved.length > 0 || pushed.length > 0) && (
              <p className="text-xs text-muted-foreground">
                {resolved.length} completed · {pushed.length} pushed to {nextLabel}
              </p>
            )}
          </section>

          <AssumedTimesSection period={period} periodKey={periodKey} />

          {period !== "day" && (
            <PeriodReviewStudio period={period} periodKey={periodKey} arc={arc} onArc={setArc} />
          )}

          {period === "day" && (
            <NightTimeGlance periodKey={periodKey} note={timeReflection} onNote={setTimeReflection} />
          )}

          <section className="space-y-2">
            <Label className="font-semibold text-sm">Summary — what happened this {period}?</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="A short recap…"
            />
          </section>

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
                  onClick={() =>
                    setGratitude((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr))
                  }
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
              <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {storedPlanText}
              </div>
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

          {period === "day" ? (
            <>
              <section className="space-y-2">
                <Label className="font-semibold text-sm">Things you&apos;d like to remind yourself when you wake up</Label>
                <Textarea
                  value={wakeReminder}
                  onChange={(e) => setWakeReminder(e.target.value)}
                  rows={2}
                  placeholder="Optional — shown at the top of tomorrow's morning ritual"
                  aria-label="Wake-up reminder"
                />
              </section>
              <section className="space-y-2">
                <Label className="font-semibold text-sm">What matters most tomorrow?</Label>
                <Textarea
                  value={tomorrowMatters}
                  onChange={(e) => setTomorrowMatters(e.target.value)}
                  rows={2}
                  placeholder="Optional"
                  aria-label="What matters most tomorrow?"
                />
              </section>
              <section className="space-y-2">
                <Label className="font-semibold text-sm">Goals to focus on tomorrow</Label>
                <p className="text-xs text-muted-foreground">
                  Tasks that serve these goals are more likely to be picked, and earn the focus multiplier when you
                  finish them.
                </p>
                {goals.filter((goal) => !goal.completed).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open goals yet.</p>
                ) : (
                  <div className="space-y-1">
                    {goals
                      .filter((goal) => !goal.completed)
                      .map((goal) => (
                        <label key={goal.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={focusGoalIds.includes(goal.id)}
                            onChange={(e) =>
                              setFocusGoalIds((ids) =>
                                e.target.checked ? [...new Set([...ids, goal.id])] : ids.filter((id) => id !== goal.id),
                              )
                            }
                          />
                          <span className="truncate">{goal.title}</span>
                        </label>
                      ))}
                  </div>
                )}
              </section>
              <DayReviewTomorrowSection reviewedDayKey={periodKey} />
            </>
          ) : (
            <section className="space-y-2">
              <Label className="font-semibold text-sm">
                Plans for the {nextLabel.replace("next ", "")} to come
              </Label>
              <Textarea
                value={nextPlans}
                onChange={(e) => setNextPlans(e.target.value)}
                rows={3}
                placeholder="What matters most next?"
              />
            </section>
          )}
        </div>

        <div className="hpp-actions">
          <Button variant="outline" onClick={dismiss}>
            Close
          </Button>
          <Button className="hpp-key-go" onClick={handleSave}>
            {period === "day" ? "Save Night ritual" : "Save Review ritual"}
          </Button>
        </div>
      </DialogContent>

      <PostMortemDialog task={reflectTask} open={!!reflectTask} onClose={() => setReflectTask(null)} />
    </Dialog>
  )
}

type ActiveRitual =
  | { kind: "morning"; date: Date }
  | { kind: "end"; period: ReviewPeriod; key: string }
  | { kind: "start"; period: ReviewPeriod; key: string }
  | { kind: "star-lord"; occasion: StarLordKind; dateKey: string }

function SlotMark({ status }: { status: "none" | "partial" | "done" }) {
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 ml-2 shrink-0" />
  if (status === "partial")
    return (
      <Badge variant="secondary" className="ml-2 text-[10px]">
        …
      </Badge>
    )
  return (
    <Badge variant="default" className="ml-2 text-[10px]">
      due
    </Badge>
  )
}

/** Header Rituals control — also exported as `Reviews` for older imports. */
export function Rituals() {
  const reviews = useReviewsStore((s) => s.reviews)
  const starReports = useStarLordStore((s) => s.reports)
  const birthday = useUserSettingsStore((s) => s.birthday)
  const [active, setActive] = useState<ActiveRitual | null>(null)
  const now = useMemo(() => new Date(), [])
  const todayKey = localDayKey(now)
  const starSlots = useMemo(
    () => listStarLordSlots(starReports, now, birthday),
    [starReports, now, birthday],
  )

  const availableCount = useMemo(
    () => countAvailableRituals(reviews, now) + starSlots.filter((slot) => slot.status !== "done").length,
    [reviews, now, starSlots],
  )
  const pendingEnds = useMemo(() => getPendingReviews(reviews, now), [reviews, now])

  const dayMorningStatus = morningReviewPhase(
    reviews.find((r) => r.period === "day" && r.periodKey === todayKey)?.morning,
  )
  const dayNightStatus = endRitualPhase(
    reviews.find((r) => r.period === "day" && r.periodKey === todayKey),
  )

  const title =
    availableCount > 0
      ? `${availableCount} ritual${availableCount === 1 ? "" : "s"} available`
      : "Rituals"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="relative"
            data-home-review-entry
            data-rituals-entry
            title={title}
          >
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Rituals
            {availableCount > 0 && (
              <Badge className="b2-shell-count" variant="default">
                {availableCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Rituals</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Day · {periodLabel("day", todayKey)}
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setActive({ kind: "morning", date: now })}
            data-ritual-slot="day-morning"
          >
            <RitualSunIcon className="h-4 w-4 mr-2 shrink-0" />
            <span className="flex-1">Morning</span>
            <SlotMark status={dayMorningStatus} />
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setActive({ kind: "end", period: "day", key: todayKey })}
            data-ritual-slot="day-night"
          >
            <RitualMoonIcon className="h-4 w-4 mr-2 shrink-0" />
            <span className="flex-1">Night</span>
            <SlotMark status={dayNightStatus} />
          </DropdownMenuItem>
          {(() => {
            const priorKey = localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
            const priorStatus = endRitualPhase(
              reviews.find((r) => r.period === "day" && r.periodKey === priorKey),
            )
            return (
              <DropdownMenuItem
                onClick={() => setActive({ kind: "end", period: "day", key: priorKey })}
                data-ritual-slot="day-night-prior"
              >
                <RitualMoonIcon className="h-4 w-4 mr-2 shrink-0" />
                <span className="flex-1">Night · {periodLabel("day", priorKey)}</span>
                <SlotMark status={priorStatus} />
              </DropdownMenuItem>
            )
          })()}

          <DropdownMenuSeparator />

          {REVIEW_PERIODS.filter((p) => p !== "day").map((p) => {
            const startKey = getPeriodKey(p, now)
            const startStatus = startRitualPhase(
              reviews.find((r) => r.period === p && r.periodKey === startKey)?.start,
            )
            const endKey = pendingEnds[p].key
            const endStatus = endRitualPhase(
              reviews.find((r) => r.period === p && r.periodKey === endKey),
            )
            return (
              <div key={p}>
                <DropdownMenuLabel
                  className="text-xs font-normal text-muted-foreground capitalize"
                  data-season={p === "quarter" ? seasonSlug(seasonOfDate(dateFromPeriodKey(p, startKey))) : undefined}
                >
                  {p === "quarter" ? periodLabel(p, startKey) : `${p} · ${periodLabel(p, startKey)}`}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setActive({ kind: "start", period: p, key: startKey })}
                  data-ritual-slot={`${p}-start`}
                >
                  <RitualSunIcon className="h-4 w-4 mr-2 shrink-0" />
                  <span className="flex-1">Start ritual</span>
                  <SlotMark status={startStatus} />
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setActive({ kind: "end", period: p, key: endKey })}
                  data-ritual-slot={`${p}-end`}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2 shrink-0" />
                  <span className="flex-1">Review ritual</span>
                  <SlotMark status={endStatus} />
                </DropdownMenuItem>
              </div>
            )
          })}

          {starSlots.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Star Lord Report
              </DropdownMenuLabel>
              {starSlots.map((slot) => (
                <DropdownMenuItem
                  key={slot.id}
                  onClick={() => setActive({ kind: "star-lord", occasion: slot.kind, dateKey: slot.dateKey })}
                  data-ritual-slot={slot.id}
                >
                  {slot.kind === "birth" ? (
                    <Sparkles className="h-4 w-4 mr-2 shrink-0" />
                  ) : (
                    <RitualMoonIcon className="h-4 w-4 mr-2 shrink-0" />
                  )}
                  <span className="flex-1">{slot.title}</span>
                  <SlotMark status={slot.status} />
                </DropdownMenuItem>
              ))}
            </>
          )}

          {availableCount > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Telegram: rituals · gm · gn · review week · ritual start week
              </DropdownMenuLabel>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {active?.kind === "morning" && (
        <MorningReviewDialog
          open
          onClose={() => setActive(null)}
          date={active.date}
        />
      )}
      {active?.kind === "end" && (
        <ReviewDialog
          open
          period={active.period}
          periodKey={active.key}
          onClose={() => setActive(null)}
        />
      )}
      {active?.kind === "start" && (
        <StartRitualDialog
          open
          period={active.period}
          periodKey={active.key}
          onClose={() => setActive(null)}
        />
      )}
      {active?.kind === "star-lord" && (
        <StarLordReportDialog
          open
          kind={active.occasion}
          dateKey={active.dateKey}
          onClose={() => setActive(null)}
        />
      )}
    </>
  )
}

/** @deprecated Prefer `Rituals` — same component. */
export const Reviews = Rituals

export { ReviewDialog }
