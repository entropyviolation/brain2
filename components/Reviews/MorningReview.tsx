/**
 * components/Reviews/MorningReview.tsx — Morning review ritual (HM2)
 *
 * Start-of-day ritual: sleep (or all-nighter), 5 random affirmations from the
 * Lists "affirmations" list, today's to-dos (add + 3–5 priorities), daily habit
 * priorities (1–3), go-through to-do (six-slot fields), plaintext day plan,
 * branching circumstances, best-day why, and 10 gratitude. Mirrors BIM's `gm`
 * text flow. The `morning` slice merges onto today's day PeriodReview via
 * `reviews-store.saveMorningReview`.
 * Dialog shell is milled fascia (`.hpp95` / `header-popup-chrome.css`).
 */
"use client"

import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sun, Plus, X, Moon, Mic, Sparkles } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { describeAllNighterLifts, isHabitPeriodExempt } from "@/lib/habit-exemption"
import { useReviewsStore, localDayKey, periodLabel } from "@/lib/reviews-store"
import { taskScheduledOnDay } from "@/lib/date-utils"
import type { PeriodReview, Task } from "@/lib/types"
import { AffirmationsDialog } from "@/components/Reviews/AffirmationsDialog"
import { useExemptionContext, useSleepStore } from "@/lib/sleep-store"
import { useSleepSync } from "@/lib/sleep-sync"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { inferNight } from "@/lib/sleep-inference"
import {
  formatSleepDuration,
  nightProblem,
  offsetToClock,
  parseBedtime,
  parseWakeTime,
  sleepMinutes,
} from "@/lib/sleep-log"
import { itemTitle } from "@/lib/item-utils"
import { createScheduledTodoTask, getTierFromTask } from "@/components/Home/ToDo/todo-utils"
import {
  AFFIRMATIONS_PER_SESSION,
  DEFAULT_AFFIRMATIONS,
  affirmationText,
  findAffirmationsCategory,
  getAffirmationItems,
  pickRandom,
  AFFIRMATIONS_LIST_NAME,
} from "@/lib/affirmations"
import { createListItem } from "@/lib/item-utils"
import type { List } from "@/lib/types"
import { appendPlanEntry } from "@/lib/plan-text"
import {
  TODO_WALK_TIERS,
  applyTodoWalkSlots,
  emptyTodoWalkForm,
  formToTodoWalkReply,
  parseTodoWalkReply,
  type TodoWalkFormFields,
} from "@/lib/morning-todo-walk"

const LOGGED_FROM_TEXT = "logged from text"

type MorningSlice = NonNullable<PeriodReview["morning"]>

type MorningDraft = {
  allNighter: boolean
  wakeTime: string
  bedTime: string
  dream: string
  affirmations: string[]
  newTodoLines: string[]
  priorityIds: string[]
  priorityHabitIds: string[]
  todoWalkById: Record<string, TodoWalkFormFields>
  dayPlan: string
  circumstance: { mustDo: boolean; mustNotDo: boolean; newEvents: boolean; excited: boolean }
  mustDo: string
  mustNotDo: string
  newEvents: string
  excitedAbout: string
  bestDayWhy: string
  gratitude: string[]
}

function draftStorageKey(dayKey: string) {
  return `brain2-morning-draft:${dayKey}`
}

function asStringList(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback
  return value.map((x) => (typeof x === "string" ? x : String(x ?? "")))
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function safeClock(offset: number | undefined): string {
  if (offset === undefined || !Number.isFinite(offset)) return ""
  try {
    return offsetToClock(offset)
  } catch {
    return ""
  }
}

function asWalkForms(value: unknown): Record<string, TodoWalkFormFields> {
  if (!value || typeof value !== "object") return {}
  const out: Record<string, TodoWalkFormFields> = {}
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue
    const r = raw as Partial<TodoWalkFormFields>
    out[id] = {
      ...emptyTodoWalkForm(),
      tier: asString(r.tier),
      duration: asString(r.duration),
      points: asString(r.points),
      importance: asString(r.importance),
      resistance: asString(r.resistance),
      excitement: asString(r.excitement),
      skipped: !!r.skipped,
    }
  }
  return out
}

function readMorningDraft(dayKey: string): MorningDraft | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const raw = sessionStorage.getItem(draftStorageKey(dayKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<MorningDraft>
    if (!parsed || typeof parsed !== "object") return null
    return {
      allNighter: !!parsed.allNighter,
      wakeTime: asString(parsed.wakeTime),
      bedTime: asString(parsed.bedTime),
      dream: asString(parsed.dream),
      affirmations: asStringList(parsed.affirmations),
      newTodoLines: asStringList(parsed.newTodoLines, [""]),
      priorityIds: asStringList(parsed.priorityIds),
      priorityHabitIds: asStringList(parsed.priorityHabitIds),
      todoWalkById: asWalkForms(parsed.todoWalkById),
      dayPlan: asString(parsed.dayPlan),
      circumstance: {
        mustDo: !!parsed.circumstance?.mustDo,
        mustNotDo: !!parsed.circumstance?.mustNotDo,
        newEvents: !!parsed.circumstance?.newEvents,
        excited: !!parsed.circumstance?.excited,
      },
      mustDo: asString(parsed.mustDo),
      mustNotDo: asString(parsed.mustNotDo),
      newEvents: asString(parsed.newEvents),
      excitedAbout: asString(parsed.excitedAbout),
      bestDayWhy: asString(parsed.bestDayWhy),
      gratitude: asStringList(parsed.gratitude, Array.from({ length: 10 }, () => "")),
    }
  } catch {
    return null
  }
}

function writeMorningDraft(dayKey: string, draft: MorningDraft) {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(draftStorageKey(dayKey), JSON.stringify(draft))
  } catch {
    // Quota / private mode — in-progress answers stay in React state only.
  }
}

function clearMorningDraft(dayKey: string) {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.removeItem(draftStorageKey(dayKey))
  } catch {
    /* ignore */
  }
}

/** Finished store slice wins; otherwise same-day session draft; else clean defaults. */
function seedFromMorning(existing: MorningSlice | undefined, draft: MorningDraft | null) {
  if (existing) {
    return {
      allNighter: !!existing.allNighter,
      wakeTime: asString(existing.wakeTime),
      bedTime: "",
      dream: asString(existing.dream),
      affirmations: asStringList(existing.affirmations),
      newTodoLines: [""] as string[],
      priorityIds: asStringList(existing.priorityTaskIds),
      priorityHabitIds: asStringList(existing.priorityHabitIds),
      todoWalkById: {} as Record<string, TodoWalkFormFields>,
      dayPlan: "",
      circumstance: {
        mustDo: !!existing.mustDo,
        mustNotDo: !!existing.mustNotDo,
        newEvents: !!existing.newEvents,
        excited: !!existing.excitedAbout,
      },
      mustDo: asString(existing.mustDo),
      mustNotDo: asString(existing.mustNotDo),
      newEvents: asString(existing.newEvents),
      excitedAbout: asString(existing.excitedAbout),
      bestDayWhy: asString(existing.bestDayWhy),
      gratitude: asStringList(existing.gratitude).length
        ? asStringList(existing.gratitude)
        : Array.from({ length: 10 }, () => ""),
    }
  }
  if (draft) return draft
  return {
    allNighter: false,
    wakeTime: "",
    bedTime: "",
    dream: "",
    affirmations: [] as string[],
    newTodoLines: [""] as string[],
    priorityIds: [] as string[],
    priorityHabitIds: [] as string[],
    todoWalkById: {} as Record<string, TodoWalkFormFields>,
    dayPlan: "",
    circumstance: { mustDo: false, mustNotDo: false, newEvents: false, excited: false },
    mustDo: "",
    mustNotDo: "",
    newEvents: "",
    excitedAbout: "",
    bestDayWhy: "",
    gratitude: Array.from({ length: 10 }, () => ""),
  }
}

class MorningReviewErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[MorningReview]", error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return (
        <Button
          variant="outline"
          size="sm"
          data-morning-review-entry
          title="Morning review hit a snag — click to try again"
          onClick={() => this.setState({ failed: false })}
        >
          <Sun className="h-4 w-4 mr-2" />
          Morning
        </Button>
      )
    }
    return this.props.children
  }
}

function StringListEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  const rows = values.length ? values : [""]
  return (
    <div className="space-y-2">
      {rows.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={v}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={placeholder}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [""])}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...rows, ""])}>
        <Plus className="h-4 w-4 mr-1" />
        Add
      </Button>
    </div>
  )
}

function usePaintedNight(dayKey: string) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  return useMemo(() => inferNight({ scopes, entries }, dayKey), [scopes, entries, dayKey])
}

function ensureAffirmationLines(lists: List[], tasks: Task[], addList: (n: string) => string, addTask: (t: Task) => void): string[] {
  try {
    let list = findAffirmationsCategory(lists)
    if (!list) {
      const id = addList(AFFIRMATIONS_LIST_NAME)
      list = { id, name: AFFIRMATIONS_LIST_NAME } as List
      for (const line of DEFAULT_AFFIRMATIONS) {
        addTask(createListItem(line, [id]) as Task)
      }
    }
    const fromList = getAffirmationItems(tasks, list.id)
      .map((item) => affirmationText(item).trim())
      .filter(Boolean)
    const pool = fromList.length > 0 ? fromList : DEFAULT_AFFIRMATIONS
    return pickRandom(pool, AFFIRMATIONS_PER_SESSION)
  } catch {
    return pickRandom(DEFAULT_AFFIRMATIONS, AFFIRMATIONS_PER_SESSION)
  }
}

export function MorningReviewDialog({
  open,
  onClose,
  date = new Date(),
}: {
  open: boolean
  onClose: () => void
  date?: Date
}) {
  useSleepSync()
  const dayKey = localDayKey(date)
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const addList = useTaskStore((s) => s.addList)
  const addTask = useTaskStore((s) => s.addTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const saveMorningReview = useReviewsStore((s) => s.saveMorningReview)
  const existing = useReviewsStore((s) => s.getReview("day", dayKey)?.morning)

  const loggedNight = useSleepStore((s) => s.nights[dayKey])
  const setStoreBedtime = useSleepStore((s) => s.setBedtime)
  const setStoreWakeTime = useSleepStore((s) => s.setWakeTime)
  const setAllNighter = useSleepStore((s) => s.setAllNighter)

  const paintedNight = usePaintedNight(dayKey)

  const knownWake =
    loggedNight?.wokeMin ??
    (existing?.wakeTime ? parseWakeTime(existing.wakeTime) : undefined) ??
    paintedNight?.wokeMin
  const knownBedtime = loggedNight?.sleptMin ?? paintedNight?.sleptMin

  // Finished review wins; else same-day session draft; else clean. Live sleep
  // clocks always layer on top so a stale draft cannot mask the sleep log / grid.
  const seed = useMemo(() => {
    const base = seedFromMorning(existing, readMorningDraft(dayKey))
    if (knownWake !== undefined) base.wakeTime = safeClock(knownWake)
    if (knownBedtime !== undefined) base.bedTime = safeClock(knownBedtime)
    if (loggedNight?.allNighter || existing?.allNighter) base.allNighter = true
    return base
    // Seed once per open/day — field edits must not reset from store churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dayKey])

  const [allNighter, setAllNighterLocal] = useState(seed.allNighter)
  const [wakeTime, setWakeTime] = useState(seed.wakeTime)
  const [bedTime, setBedTime] = useState(seed.bedTime)
  const [dream, setDream] = useState(seed.dream)
  const [affirmations, setAffirmations] = useState<string[]>(seed.affirmations)
  const [newTodoLines, setNewTodoLines] = useState<string[]>(seed.newTodoLines)
  const [priorityIds, setPriorityIds] = useState<string[]>(seed.priorityIds)
  const [priorityHabitIds, setPriorityHabitIds] = useState<string[]>(seed.priorityHabitIds)
  const [todoWalkById, setTodoWalkById] = useState<Record<string, TodoWalkFormFields>>(seed.todoWalkById)
  const [dayPlan, setDayPlan] = useState(seed.dayPlan)
  const [circumstance, setCircumstance] = useState(seed.circumstance)
  const [mustDo, setMustDo] = useState(seed.mustDo)
  const [mustNotDo, setMustNotDo] = useState(seed.mustNotDo)
  const [newEvents, setNewEvents] = useState(seed.newEvents)
  const [excitedAbout, setExcitedAbout] = useState(seed.excitedAbout)
  const [bestDayWhy, setBestDayWhy] = useState(seed.bestDayWhy)
  const [gratitude, setGratitude] = useState<string[]>(seed.gratitude)
  const [affirmationsOpen, setAffirmationsOpen] = useState(false)
  const [sessionAffirmations, setSessionAffirmations] = useState<string[]>(seed.affirmations)

  useEffect(() => {
    if (!open) return
    setAllNighterLocal(seed.allNighter)
    setWakeTime(seed.wakeTime)
    setBedTime(seed.bedTime)
    setDream(seed.dream)
    setAffirmations(seed.affirmations)
    setNewTodoLines(seed.newTodoLines)
    setPriorityIds(seed.priorityIds)
    setPriorityHabitIds(seed.priorityHabitIds)
    setTodoWalkById(seed.todoWalkById)
    setDayPlan(seed.dayPlan)
    setCircumstance(seed.circumstance)
    setMustDo(seed.mustDo)
    setMustNotDo(seed.mustNotDo)
    setNewEvents(seed.newEvents)
    setExcitedAbout(seed.excitedAbout)
    setBestDayWhy(seed.bestDayWhy)
    setGratitude(seed.gratitude)
    setSessionAffirmations(seed.affirmations)
  }, [open, dayKey, seed])

  useEffect(() => {
    if (!open) return
    if (seed.affirmations.length) return
    try {
      const picked = ensureAffirmationLines(lists, tasks, addList, addTask)
      setSessionAffirmations(picked)
      setAffirmations(picked)
    } catch {
      setSessionAffirmations(DEFAULT_AFFIRMATIONS.slice(0, AFFIRMATIONS_PER_SESSION))
      setAffirmations(DEFAULT_AFFIRMATIONS.slice(0, AFFIRMATIONS_PER_SESSION))
    }
    // Only re-pick when the dialog opens without a finished/draft affirmation set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dayKey])

  // Persist in-progress answers for refresh / close-reopen on the same day.
  // Never overwrite a finished review in the store — only session draft.
  useEffect(() => {
    if (!open) return
    if (existing) return
    writeMorningDraft(dayKey, {
      allNighter,
      wakeTime,
      bedTime,
      dream,
      affirmations,
      newTodoLines,
      priorityIds,
      priorityHabitIds,
      todoWalkById,
      dayPlan,
      circumstance,
      mustDo,
      mustNotDo,
      newEvents,
      excitedAbout,
      bestDayWhy,
      gratitude,
    })
  }, [
    open,
    dayKey,
    existing,
    allNighter,
    wakeTime,
    bedTime,
    dream,
    affirmations,
    newTodoLines,
    priorityIds,
    priorityHabitIds,
    todoWalkById,
    dayPlan,
    circumstance,
    mustDo,
    mustNotDo,
    newEvents,
    excitedAbout,
    bestDayWhy,
    gratitude,
  ])

  const todaysTasks = useMemo<Task[]>(
    () => tasks.filter((t) => !t.completed && taskScheduledOnDay(t, date)),
    [tasks, date],
  )

  const storedExemption = useExemptionContext()
  const habitPickCtx = useMemo(() => {
    if (!allNighter) return storedExemption
    const mornings = new Set(storedExemption.allNighterMornings)
    mornings.add(dayKey)
    return { allNighterMornings: mornings }
  }, [allNighter, storedExemption, dayKey])
  const allNighterLifts = useMemo(() => describeAllNighterLifts(habitTasks), [habitTasks])

  const dailyHabits = useMemo(
    () =>
      habitTasks.filter(
        (h) =>
          (h.frequency || "daily") === "daily" &&
          !isHabitPeriodExempt(h, dayKey, "daily", habitExemptions, habitPickCtx),
      ),
    [habitTasks, habitExemptions, dayKey, habitPickCtx],
  )

  const draftNight = {
    date: dayKey,
    sleptMin: !allNighter && bedTime.trim() ? parseBedtime(bedTime) : undefined,
    wokeMin: !allNighter && wakeTime.trim() ? parseWakeTime(wakeTime) : undefined,
  }
  const draftMinutes = sleepMinutes(draftNight)
  const nightSummary = allNighter
    ? "All-nighter — sleep clocks are skipped. Still start the day with this morning routine."
    : nightProblem(draftNight) ??
      (draftMinutes !== null
        ? `${formatSleepDuration(draftMinutes)} asleep. Saving paints it on the Sleep pen and logs it in Done.`
        : "Both ends turn the night into tracked time, a Done row, and habit minutes.")

  const togglePriority = (id: string) =>
    setPriorityIds((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id)
      if (p.length >= 5) return p
      return [...p, id]
    })

  const toggleHabitPriority = (id: string) =>
    setPriorityHabitIds((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id)
      if (p.length >= 3) return p
      return [...p, id]
    })

  const patchWalk = (id: string, patch: Partial<TodoWalkFormFields>) =>
    setTodoWalkById((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyTodoWalkForm()), ...patch },
    }))

  const handleSave = () => {
    try {
      const addedIds: string[] = []
      for (const line of newTodoLines.map((s) => s.trim()).filter(Boolean)) {
        const task = createScheduledTodoTask({
          description: line,
          period: "day",
          date,
        })
        task.id = `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        task.notes = LOGGED_FROM_TEXT
        addTask(task)
        addedIds.push(task.id)
      }

      const now = new Date()
      for (const t of todaysTasks) {
        const form = todoWalkById[t.id] ?? emptyTodoWalkForm()
        const reply = formToTodoWalkReply(form)
        if (reply === "skip") continue
        const parsed = parseTodoWalkReply(reply)
        if (!parsed.ok) continue
        updateTask(applyTodoWalkSlots(t, parsed.slots, dayKey, now, "morning-desktop"))
      }

      const planText = dayPlan.trim()
      let dayPlanLogged = false
      if (planText) {
        appendPlanEntry("day", dayKey, planText, now)
        dayPlanLogged = true
      }

      if (allNighter) {
        setAllNighter(dayKey, true, { at: now.toISOString(), source: "desktop" })
      } else {
        setAllNighter(dayKey, false)
        setStoreWakeTime(dayKey, wakeTime.trim() ? parseWakeTime(wakeTime) : undefined)
        setStoreBedtime(dayKey, bedTime.trim() ? parseBedtime(bedTime) : undefined)
      }

      const allPriority = [
        ...priorityIds,
        // Newly added items selected? priorities only from checkboxes on existing + we'll refresh
      ].filter((id, i, arr) => arr.indexOf(id) === i)

      saveMorningReview(dayKey, {
        wakeTime: allNighter ? undefined : wakeTime.trim() || undefined,
        dream: allNighter ? undefined : dream.trim() || undefined,
        intentions: [],
        affirmations: affirmations.map((s) => s.trim()).filter(Boolean),
        postponedTaskIds: [],
        allNighter,
        todosAddedIds: [...asStringList(existing?.todosAddedIds), ...addedIds],
        priorityTaskIds: allPriority,
        priorityHabitIds,
        dayPlanLogged,
        mustDo: circumstance.mustDo ? mustDo.trim() || undefined : undefined,
        mustNotDo: circumstance.mustNotDo ? mustNotDo.trim() || undefined : undefined,
        newEvents: circumstance.newEvents ? newEvents.trim() || undefined : undefined,
        excitedAbout: circumstance.excited ? excitedAbout.trim() || undefined : undefined,
        bestDayWhy: bestDayWhy.trim() || undefined,
        gratitude: gratitude.map((s) => s.trim()).filter(Boolean),
        source: "desktop",
      })
      clearMorningDraft(dayKey)
      onClose()
    } catch (err) {
      console.error("[MorningReview] save failed", err)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        className="hpp95 hpp95-dialog sm:max-w-xl max-h-[88vh] overflow-hidden flex flex-col"
        data-ui-name="Morning review"
        data-ui-docs="components/Reviews/README.md"
      >
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Morning Review
            </DialogTitle>
          </div>
          <DialogDescription className="hpp-caption-lead">{periodLabel("day", dayKey)}</DialogDescription>
        </DialogHeader>

        <div className="hpp-body flex-1 overflow-y-auto space-y-6 pr-1">
          <label className="flex items-start gap-2 rounded-md border p-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={allNighter}
              onChange={(e) => setAllNighterLocal(e.target.checked)}
            />
            <span>
              <span className="font-semibold">All nighter</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                I did not sleep. Habits with an all-nighter block are exempt: the evening before for the night you stayed up, and this morning for the ones set to the morning of. Edit each block on the habit.
              </span>
              {allNighterLifts.length === 0 ? (
                <span className="block text-xs text-muted-foreground mt-1">
                  No habit has an all-nighter block yet. Add one in that habit’s settings.
                </span>
              ) : (
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {allNighterLifts.map((row) => (
                    <li key={`${row.name}-${row.day}`}>
                      {row.name} — {row.day === "evening-before" ? "the evening before this night" : "this morning"}
                    </li>
                  ))}
                </ul>
              )}
            </span>
          </label>

          {!allNighter && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-semibold text-sm" htmlFor="morning-bedtime">
                    Fell asleep
                  </Label>
                  <Input
                    id="morning-bedtime"
                    type="time"
                    value={bedTime}
                    onChange={(e) => setBedTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-sm" htmlFor="morning-waketime">
                    Wake time
                  </Label>
                  <Input
                    id="morning-waketime"
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                  />
                </div>
                <p className="col-span-2 -mt-1 text-xs text-muted-foreground">{nightSummary}</p>
              </div>

              <section className="space-y-2">
                <Label className="font-semibold text-sm flex items-center gap-1">
                  <Moon className="h-4 w-4" />
                  Dream journal
                </Label>
                <Textarea
                  value={dream}
                  onChange={(e) => setDream(e.target.value)}
                  rows={2}
                  placeholder="Anything you remember…"
                />
              </section>
            </>
          )}

          {allNighter && <p className="text-xs text-muted-foreground">{nightSummary}</p>}

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="font-semibold text-sm flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                Affirmations
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setAffirmationsOpen(true)}
              >
                <Mic className="h-3.5 w-3.5" />
                Speak them
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Five lines picked at random from your Lists → {AFFIRMATIONS_LIST_NAME} list.
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              {(affirmations.length ? affirmations : sessionAffirmations).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </section>

          <section className="space-y-2">
            <Label className="font-semibold text-sm">To do for today</Label>
            {todaysTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">There is nothing on your to do list for today yet.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Here is what is on your to do list for the day:</p>
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  {todaysTasks.map((t) => (
                    <li key={t.id}>{itemTitle(t)}</li>
                  ))}
                </ol>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Add any new items (notes: logged from text). Leave blank to skip.
            </p>
            <StringListEditor values={newTodoLines} onChange={setNewTodoLines} placeholder="New to-do…" />
          </section>

          {(todaysTasks.length > 0 || newTodoLines.some((l) => l.trim())) && (
            <section className="space-y-2">
              <Label className="font-semibold text-sm">3–5 highest priorities</Label>
              <p className="text-xs text-muted-foreground">
                Pick up to five from today&apos;s list (new items appear after save — select existing ones now).
              </p>
              <div className="space-y-1">
                {todaysTasks.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 border rounded-md p-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={priorityIds.includes(t.id)}
                      onChange={() => togglePriority(t.id)}
                    />
                    <span className="truncate flex-1">{itemTitle(t)}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <Label className="font-semibold text-sm">Daily habit priorities</Label>
            <p className="text-xs text-muted-foreground">
              Optionally pick 1–3 habits to prioritize for the day (shown on Home → Habits). Leave blank for none.
            </p>
            {dailyHabits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No daily habits yet.</p>
            ) : (
              <div className="space-y-1">
                {dailyHabits.map((h) => (
                  <label
                    key={h.id}
                    className="flex items-center gap-2 border rounded-md p-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={priorityHabitIds.includes(h.id)}
                      onChange={() => toggleHabitPriority(h.id)}
                    />
                    <span className="truncate flex-1">{h.name}</span>
                    {priorityHabitIds.includes(h.id) && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        #{priorityHabitIds.indexOf(h.id) + 1}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <Label className="font-semibold text-sm">Go through to do list</Label>
            <p className="text-xs text-muted-foreground">
              For each item: tier, expected duration (minutes), points, importance (1–10 for today), resistance
              (1–10, recorded each time), excitement (1–10 for today). Leave a field blank or &quot;-&quot; to keep
              the existing value. Skip leaves every field untouched.
            </p>
            {todaysTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing on today&apos;s to-do list to walk through.</p>
            ) : (
              todaysTasks.map((t) => {
                const form = todoWalkById[t.id] ?? emptyTodoWalkForm()
                const dayRating = t.dayRatings?.[dayKey]
                return (
                  <div key={t.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{itemTitle(t)}</p>
                        <p className="text-xs text-muted-foreground">
                          current: tier {getTierFromTask(t)} · duration{" "}
                          {t.estimatedDuration != null ? `${t.estimatedDuration}m` : "—"} · points{" "}
                          {t.rewardValue != null ? t.rewardValue : "—"}
                          {dayRating?.importance != null ? ` · importance ${dayRating.importance}` : ""}
                          {dayRating?.excitement != null ? ` · excitement ${dayRating.excitement}` : ""}
                          {(t.resistanceReadings?.length ?? 0) > 0
                            ? ` · resistance readings ${t.resistanceReadings!.length}`
                            : ""}
                        </p>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.skipped}
                          onChange={(e) => patchWalk(t.id, { skipped: e.target.checked })}
                        />
                        Skip
                      </label>
                    </div>
                    {!form.skipped && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Tier</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                            value={form.tier}
                            onChange={(e) => patchWalk(t.id, { tier: e.target.value })}
                          >
                            <option value="">— keep</option>
                            {TODO_WALK_TIERS.map((tier) => (
                              <option key={tier} value={tier}>
                                {tier}
                              </option>
                            ))}
                          </select>
                        </div>
                        {(
                          [
                            ["duration", "Duration (min)", form.duration],
                            ["points", "Points", form.points],
                            ["importance", "Importance 1–10", form.importance],
                            ["resistance", "Resistance 1–10", form.resistance],
                            ["excitement", "Excitement 1–10", form.excitement],
                          ] as const
                        ).map(([key, label, value]) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs">{label}</Label>
                            <Input
                              value={value}
                              onChange={(e) => patchWalk(t.id, { [key]: e.target.value })}
                              placeholder="—"
                              inputMode="numeric"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </section>

          <section className="space-y-2">
            <Label className="font-semibold text-sm">Plaintext day plan</Label>
            <p className="text-xs text-muted-foreground">
              Appends today&apos;s Plan log on the Plan tab (same as submitting there). Leave blank to skip.
            </p>
            <Textarea
              value={dayPlan}
              onChange={(e) => setDayPlan(e.target.value)}
              rows={3}
              placeholder="Write the day plan…"
            />
          </section>

          <section className="space-y-3">
            <Label className="font-semibold text-sm">Circumstances</Label>
            <p className="text-xs text-muted-foreground">Check what applies, then fill in:</p>
            {(
              [
                ["mustDo", "1. Something I absolutely must do", mustDo, setMustDo],
                ["mustNotDo", "2. Something I absolutely must not do", mustNotDo, setMustNotDo],
                ["newEvents", "3. New events scheduled today", newEvents, setNewEvents],
                ["excited", "4. Something I'm excited about", excitedAbout, setExcitedAbout],
              ] as const
            ).map(([key, label, value, setter]) => (
              <div key={key} className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={circumstance[key]}
                    onChange={(e) => setCircumstance((c) => ({ ...c, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
                {circumstance[key] && (
                  <Textarea value={value} onChange={(e) => setter(e.target.value)} rows={2} />
                )}
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <Label className="font-semibold text-sm">Why is today going to be the best day ever?</Label>
            <Textarea value={bestDayWhy} onChange={(e) => setBestDayWhy(e.target.value)} rows={2} />
          </section>

          <section className="space-y-2">
            <Label className="font-semibold text-sm">10 things you are grateful for today</Label>
            <StringListEditor values={gratitude} onChange={setGratitude} placeholder="Grateful for…" />
          </section>
        </div>

        <div className="hpp-actions">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="hpp-key-go" onClick={handleSave}>Save Morning Review</Button>
        </div>
      </DialogContent>

      <AffirmationsDialog
        open={affirmationsOpen}
        onClose={() => {
          setAffirmationsOpen(false)
          if (sessionAffirmations.length) setAffirmations(sessionAffirmations)
        }}
      />
    </Dialog>
  )
}

export function MorningReview({ variant = "outline" }: { variant?: "outline" | "default" }) {
  return (
    <MorningReviewErrorBoundary>
      <MorningReviewButton variant={variant} />
    </MorningReviewErrorBoundary>
  )
}

function MorningReviewButton({ variant = "outline" }: { variant?: "outline" | "default" }) {
  const [open, setOpen] = useState(false)
  // Persist rehydrates from localStorage on the client only — gate the ✓ so the
  // first client paint matches the server ("Morning") and avoid a hydration crash.
  const [showDone, setShowDone] = useState(false)
  const today = localDayKey(new Date())
  const done = useReviewsStore((s) => !!s.getReview("day", today)?.morning)

  useEffect(() => {
    setShowDone(done)
  }, [done])

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} data-morning-review-entry>
        <Sun className="h-4 w-4 mr-2" />
        {showDone ? "Morning ✓" : "Morning"}
      </Button>
      <MorningReviewDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export default MorningReview
