/**
 * components/Reviews/MorningReview.tsx — Morning review ritual (HM2)
 *
 * Start-of-day ritual: sleep (or all-nighter), 5 random affirmations from the
 * Lists "affirmations" list, today's to-dos (add + 3–5 priorities), daily habit
 * priorities (1–3), go-through to-do (six-slot fields), plaintext day plan,
 * branching circumstances, best-day why, and 10 gratitude. Mirrors BIM's `gm`
 * text flow. Save progress writes the answers filled in so far (empty questions
 * stay open). Save Morning Review marks the day complete. Day arrows open
 * another day's saved review. The slice lives on that day's PeriodReview via
 * `reviews-store.replaceMorningReview`, same record the text ritual updates.
 * Dialog shell is milled fascia (`.hpp95` / `header-popup-chrome.css`).
 */
"use client"

import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react"
import "./ritual-steps.css"
import { RitualStepper, useRitualStep, type RitualStep } from "@/components/Reviews/RitualSteps"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sun, Plus, X, Moon, Mic, Shuffle, ListChecks, ChevronLeft, ChevronRight } from "lucide-react"
import { APP_NAV_KEYS, writeListsNavigation, writeStoredId, writeStoredTab } from "@/lib/app-navigation"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { applyRitualPriority } from "@/lib/habit-priority"
import { describeAllNighterLifts, isHabitPeriodExempt } from "@/lib/habit-exemption"
import { useReviewsStore, localDayKey, morningReviewPhase, periodLabel } from "@/lib/reviews-store"
import { useGoalsStore } from "@/lib/goals-store"
import { nightCarryForMorning } from "@/lib/ritual-carry"
import { taskServesFocusGoals } from "@/lib/goal-focus"
import { taskScheduledOnDay } from "@/lib/date-utils"
import type { PeriodReview, Task } from "@/lib/types"
import { AffirmationsDialog } from "@/components/Reviews/AffirmationsDialog"
import { CommitmentMarkList } from "@/components/Reviews/CommitmentMarkList"
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
import { sleepClockEstimateBasis, type SleepClockSource } from "@/lib/estimated-values"
import { itemTitle } from "@/lib/item-utils"
import { createScheduledTodoTask, getTierFromTask } from "@/components/Home/ToDo/todo-utils"
import { taskIsPrioritized, taskIsRequired, tasksWithCommitment } from "@/lib/todo-commitment"
import {
  AFFIRMATIONS_PER_SESSION,
  DEFAULT_AFFIRMATIONS,
  affirmationText,
  findAffirmationsCategory,
  getAffirmationItems,
  pickRandom,
  AFFIRMATIONS_LIST_NAME,
} from "@/lib/affirmations"
import { affirmationKey } from "@/lib/affirmation-lenses"
import { useAffirmationLogStore } from "@/lib/affirmation-log-store"
import { createListItem } from "@/lib/item-utils"
import type { List } from "@/lib/types"
import { appendPlanEntry } from "@/lib/plan-text"
import {
  TODO_WALK_TIERS,
  applyTodoWalkSlots,
  emptyTodoWalkForm,
  formToTodoWalkReply,
  isTodoWalkFormBlank,
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
      bedTime: asString(existing.bedTime),
      dream: asString(existing.dream),
      affirmations: asStringList(existing.affirmations),
      newTodoLines: [""] as string[],
      priorityIds: asStringList(existing.priorityTaskIds),
      priorityHabitIds: asStringList(existing.priorityHabitIds),
      todoWalkById: {} as Record<string, TodoWalkFormFields>,
      dayPlan: asString(existing.dayPlanText),
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
  enterAdvances = false,
  max,
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
  /** Enter moves to the next line (adding one at the end) and keeps the text where it was. */
  enterAdvances?: boolean
  max?: number
}) {
  const rows = values.length ? values : [""]
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const [focusAt, setFocusAt] = useState<number | null>(null)
  useEffect(() => {
    if (focusAt === null) return
    refs.current[focusAt]?.focus()
    setFocusAt(null)
  }, [focusAt, rows.length])
  const advance = (i: number) => {
    if (i + 1 < rows.length) return setFocusAt(i + 1)
    if (max !== undefined && rows.length >= max) return
    onChange([...rows, ""])
    setFocusAt(i + 1)
  }
  return (
    <div className="mr-lines">
      {rows.map((v, i) => (
        <div key={i} className="mr-line" data-filled={v.trim() ? "true" : undefined}>
          <span className="mr-line-num" aria-hidden>
            {i + 1}
          </span>
          <Input
            ref={(el) => {
              refs.current[i] = el
            }}
            value={v}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={
              enterAdvances
                ? (e) => {
                    if (e.key !== "Enter" || e.nativeEvent.isComposing) return
                    e.preventDefault()
                    advance(i)
                  }
                : undefined
            }
            placeholder={placeholder}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={`Remove line ${i + 1}`}
            onClick={() => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [""])}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {max === undefined || rows.length < max ? (
        <Button variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...rows, ""])}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      ) : null}
    </div>
  )
}

/** A stored value, and whether it was written on this ritual's day. */
type StoredSlot = { value: string; today: boolean } | null

function latestDayRating(task: Task, dayKey: string, field: "importance" | "excitement"): StoredSlot {
  const ratings = task.dayRatings ?? {}
  const own = ratings[dayKey]?.[field]
  if (own != null) return { value: String(own), today: true }
  const prior = Object.keys(ratings)
    .filter((key) => key < dayKey && ratings[key]?.[field] != null)
    .sort()
    .pop()
  return prior ? { value: String(ratings[prior]![field]), today: false } : null
}

function latestResistance(task: Task, dayKey: string): StoredSlot {
  const last = task.resistanceReadings?.[task.resistanceReadings.length - 1]
  if (!last) return null
  return { value: String(last.value), today: localDayKey(new Date(last.at)) === dayKey }
}

/** One walk field. Empty shows the stored value greyed as the placeholder; typing replaces it. */
function WalkSlot({
  label,
  value,
  stored,
  onChange,
}: {
  label: string
  value: string
  stored: StoredSlot
  onChange: (next: string) => void
}) {
  const state = value.trim() ? "new" : stored ? (stored.today ? "today" : "stored") : "empty"
  return (
    <label className="mr-slot" data-state={state}>
      <span className="mr-slot-label">
        {label}
        {state === "new" && stored ? (
          <button type="button" className="mr-slot-revert" onClick={() => onChange("")} title={`Keep ${stored.value}`}>
            keep {stored.value}
          </button>
        ) : (
          <span className="mr-slot-state">{state === "new" ? "new" : state === "today" ? "today" : state === "stored" ? "stored" : ""}</span>
        )}
      </span>
      <input
        className="mr-slot-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={stored?.value ?? "—"}
        inputMode="decimal"
        aria-label={label}
      />
    </label>
  )
}

function openListInLists(listId: string) {
  writeListsNavigation({ location: "home", openTarget: { type: "category", id: listId } })
  writeStoredTab(APP_NAV_KEYS.appTab, "categories")
  writeStoredId(APP_NAV_KEYS.appItemId, null)
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT))
}

function usePaintedNight(dayKey: string) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  return useMemo(() => inferNight({ scopes, entries }, dayKey), [scopes, entries, dayKey])
}

/** The Affirmations list's lines (created with defaults if missing), and its id. */
function affirmationPool(lists: List[], tasks: Task[], addList: (l: List) => void, addTask: (t: Task) => void) {
  try {
    let list = findAffirmationsCategory(lists)
    if (!list) {
      list = {
        id: `affirmations-${Date.now()}`,
        name: AFFIRMATIONS_LIST_NAME,
        description: "Spoken morning affirmations",
        createdAt: new Date(),
        scheduleable: false,
        itemLabel: "affirmation",
      } as List
      addList(list)
      for (const line of DEFAULT_AFFIRMATIONS) {
        addTask(createListItem(line, [list.id]) as Task)
      }
    }
    const fromList = getAffirmationItems(tasks, list.id)
      .map((item) => affirmationText(item).trim())
      .filter(Boolean)
    return { pool: fromList.length > 0 ? fromList : DEFAULT_AFFIRMATIONS, listId: list.id as string | undefined }
  } catch {
    return { pool: DEFAULT_AFFIRMATIONS, listId: undefined }
  }
}

function ensureAffirmationLines(lists: List[], tasks: Task[], addList: (l: List) => void, addTask: (t: Task) => void): string[] {
  return pickRandom(affirmationPool(lists, tasks, addList, addTask).pool, AFFIRMATIONS_PER_SESSION)
}

const MORNING_STEPS = [
  { id: "night", label: "Last night" },
  { id: "affirmations", label: "Affirmations" },
  { id: "todos", label: "To do for today" },
  { id: "habits", label: "Daily habit priorities" },
  { id: "walk", label: "Go through to do list" },
  { id: "plan", label: "Day plan" },
  { id: "circumstances", label: "Circumstances" },
  { id: "best", label: "Best day ever" },
  { id: "gratitude", label: "Gratitude" },
] as const

/** `resumeStep` gap names (desktop and `gm`) to the step that asks it. */
const RESUME_TO_STEP: Record<string, string> = {
  bed: "night",
  wake: "night",
  dream: "night",
  affirmation: "affirmations",
  "todo-show": "todos",
  "todo-priorities": "todos",
  "habit-priorities": "habits",
  walk: "walk",
  "day-plan": "plan",
  circumstances: "circumstances",
  "best-day": "best",
  gratitude: "gratitude",
}

export function MorningReviewDialog({
  open,
  onClose,
  date,
}: {
  open: boolean
  onClose: () => void
  date?: Date
}) {
  useSleepSync()
  const [activeDate, setActiveDate] = useState(() => date ?? new Date())
  const dateKey = date ? localDayKey(date) : ""
  useEffect(() => {
    if (!open) return
    setActiveDate(date ?? new Date())
    // `date` objects are not stable; key the reset on the calendar day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dateKey])
  const dayKey = localDayKey(activeDate)
  const recitations = useAffirmationLogStore((s) => s.recitations)
  const recite = useAffirmationLogStore((s) => s.recite)
  const undoRecite = useAffirmationLogStore((s) => s.undoRecite)
  const saidToday = useMemo(() => {
    const out = new Map<string, number>()
    for (const r of recitations) if (r.date === dayKey) out.set(r.key, (out.get(r.key) ?? 0) + 1)
    return out
  }, [recitations, dayKey])
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const addList = useTaskStore((s) => s.addList)
  const addTask = useTaskStore((s) => s.addTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const replaceMorningReview = useReviewsStore((s) => s.replaceMorningReview)
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

  const bedSource: SleepClockSource | null =
    loggedNight?.sleptMin !== undefined
      ? (loggedNight.sleptPrecision ?? "estimated") === "estimated"
        ? "remembered"
        : null
      : paintedNight?.sleptMin !== undefined
        ? "painted"
        : null
  const wakeSource: SleepClockSource | null =
    loggedNight?.wokeMin !== undefined
      ? (loggedNight.wokePrecision ?? "estimated") === "estimated"
        ? "remembered"
        : null
      : paintedNight?.wokeMin !== undefined
        ? "painted"
        : null

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
  const [bedEstSource, setBedEstSource] = useState<SleepClockSource | null>(bedSource)
  const [wakeEstSource, setWakeEstSource] = useState<SleepClockSource | null>(wakeSource)
  const [dream, setDream] = useState(seed.dream)
  const [affirmations, setAffirmations] = useState<string[]>(seed.affirmations)
  const [newTodoLines, setNewTodoLines] = useState<string[]>(seed.newTodoLines)
  const [priorityIds, setPriorityIds] = useState<string[]>(seed.priorityIds)
  const [requiredIds, setRequiredIds] = useState<string[]>([])
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
  const [savedNote, setSavedNote] = useState("")
  const baselineRef = useRef("")
  const affirmationsTouchedRef = useRef(false)
  const submittedRef = useRef(false)
  const reviews = useReviewsStore((s) => s.reviews)
  const goals = useGoalsStore((s) => s.goals)
  const carry = useMemo(() => nightCarryForMorning(reviews, activeDate), [reviews, activeDate])

  const packForm = (fields: MorningDraft) => JSON.stringify(fields)

  useEffect(() => {
    if (!open) return
    let lines = seed.affirmations
    if (!lines.length) {
      try {
        lines = ensureAffirmationLines(lists, tasks, addList, addTask)
      } catch {
        lines = DEFAULT_AFFIRMATIONS.slice(0, AFFIRMATIONS_PER_SESSION)
      }
    }
    const next: MorningDraft = { ...seed, affirmations: lines }
    const dayTasks = useTaskStore
      .getState()
      .tasks.filter((task) => !task.completed && taskScheduledOnDay(task, activeDate))
    const markedPriority = dayTasks.filter((task) => taskIsPrioritized(task, "day", dayKey)).map((task) => task.id)
    const markedRequired = dayTasks.filter((task) => taskIsRequired(task, "day", dayKey)).map((task) => task.id)
    const seededPriority = [...new Set([...next.priorityIds, ...markedPriority])]
    setAllNighterLocal(next.allNighter)
    setWakeTime(next.wakeTime)
    setBedTime(next.bedTime)
    setBedEstSource(bedSource)
    setWakeEstSource(wakeSource)
    setDream(next.dream)
    setAffirmations(next.affirmations)
    setNewTodoLines(next.newTodoLines)
    setPriorityIds(seededPriority)
    setRequiredIds(markedRequired)
    setPriorityHabitIds(next.priorityHabitIds)
    setTodoWalkById(next.todoWalkById)
    setDayPlan(next.dayPlan)
    setCircumstance(next.circumstance)
    setMustDo(next.mustDo)
    setMustNotDo(next.mustNotDo)
    setNewEvents(next.newEvents)
    setExcitedAbout(next.excitedAbout)
    setBestDayWhy(next.bestDayWhy)
    setGratitude(next.gratitude)
    setSessionAffirmations(lines)
    setSavedNote("")
    affirmationsTouchedRef.current = lines.length > 0 && seed.affirmations.length > 0
    baselineRef.current = packForm({ ...next, priorityIds: seededPriority })
    // Re-seed when the open day changes. Store churn must not wipe field edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dayKey, seed])

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

  const todaysTasks = useMemo<Task[]>(() => {
    const open = tasks.filter((t) => !t.completed && taskScheduledOnDay(t, activeDate))
    const focused = new Set(
      open.filter((task) => taskServesFocusGoals(task, goals, carry.focusGoalIds)).map((task) => task.id),
    )
    if (focused.size === 0) return open
    return [...open.filter((task) => focused.has(task.id)), ...open.filter((task) => !focused.has(task.id))]
  }, [tasks, activeDate, goals, carry.focusGoalIds])

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
      const task = useHabitsStore.getState().tasks.find((row) => row.id === id)
      if (task) useHabitsStore.getState().updateTask(applyRitualPriority(task, "day", activeDate))
      return [...p, id]
    })

  const patchWalk = (id: string, patch: Partial<TodoWalkFormFields>) =>
    setTodoWalkById((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyTodoWalkForm()), ...patch },
    }))

  const currentForm = (): MorningDraft => ({
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

  const commitMorning = (complete: boolean) => {
    if (complete) submittedRef.current = true
    try {
      const addedIds: string[] = []
      for (const line of newTodoLines.map((s) => s.trim()).filter(Boolean)) {
        const task = createScheduledTodoTask({
          description: line,
          period: "day",
          date: activeDate,
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
      let dayPlanLogged = !!existing?.dayPlanLogged
      let dayPlanText = existing?.dayPlanText
      if (planText && planText !== (existing?.dayPlanText ?? "")) {
        appendPlanEntry("day", dayKey, planText, now)
        dayPlanLogged = true
        dayPlanText = planText
      } else if (!planText) {
        dayPlanText = undefined
      }

      if (allNighter) {
        setAllNighter(dayKey, true, { at: now.toISOString(), source: "desktop" })
      } else {
        setAllNighter(dayKey, false)
        setStoreWakeTime(
          dayKey,
          wakeTime.trim() ? parseWakeTime(wakeTime) : undefined,
          wakeTime.trim() ? (wakeEstSource ? "estimated" : "definite") : undefined,
        )
        setStoreBedtime(
          dayKey,
          bedTime.trim() ? parseBedtime(bedTime) : undefined,
          bedTime.trim() ? (bedEstSource ? "estimated" : "definite") : undefined,
        )
      }

      const allPriority = priorityIds.filter((id, i, arr) => arr.indexOf(id) === i)
      const spoken = affirmations.map((s) => s.trim()).filter(Boolean)
      const grateful = gratitude.map((s) => s.trim()).filter(Boolean)
      const phase = morningReviewPhase(existing)
      const gap = (() => {
        if (!allNighter && !bedTime.trim()) return "bed"
        if (!allNighter && !wakeTime.trim()) return "wake"
        if (!allNighter && !dream.trim()) return "dream"
        if (!spoken.length) return "affirmation"
        if (!allPriority.length && existing?.priorityTaskIds === undefined && !addedIds.length && !existing?.todosAddedIds?.length)
          return "todo-show"
        if (!allPriority.length && existing?.priorityTaskIds === undefined) return "todo-priorities"
        if (!priorityHabitIds.length && existing?.priorityHabitIds === undefined) return "habit-priorities"
        if (!planText && !dayPlanLogged) return "day-plan"
        const anyBranch = circumstance.mustDo || circumstance.mustNotDo || circumstance.newEvents || circumstance.excited
        if (!anyBranch && !bestDayWhy.trim() && !grateful.length) return "circumstances"
        if (!bestDayWhy.trim()) return "best-day"
        if (!grateful.length) return "gratitude"
        return undefined
      })()
      const morning: MorningSlice = {
        source: "desktop",
        completed: complete ? true : phase === "done" ? true : false,
      }
      if (!complete) {
        const resume = existing?.resumeStep || gap
        if (resume) morning.resumeStep = resume
      }
      if (allNighter) morning.allNighter = true
      if (!allNighter && wakeTime.trim()) morning.wakeTime = wakeTime.trim()
      if (!allNighter && bedTime.trim()) morning.bedTime = bedTime.trim()
      if (!allNighter && dream.trim()) morning.dream = dream.trim()
      if (spoken.length && (complete || (existing?.affirmations?.length ?? 0) > 0 || affirmationsTouchedRef.current)) {
        morning.affirmations = spoken
      }
      if (existing?.shownAffirmations?.length) morning.shownAffirmations = existing.shownAffirmations
      if (typeof existing?.affirmationIndex === "number") morning.affirmationIndex = existing.affirmationIndex
      if (typeof existing?.walkIndex === "number") morning.walkIndex = existing.walkIndex
      if (existing?.circumstanceNums?.length) morning.circumstanceNums = existing.circumstanceNums
      const keptTodos = [...asStringList(existing?.todosAddedIds), ...addedIds]
      if (keptTodos.length) morning.todosAddedIds = keptTodos
      if (allPriority.length || complete) morning.priorityTaskIds = allPriority
      if (priorityHabitIds.length || complete) morning.priorityHabitIds = priorityHabitIds
      if (dayPlanLogged) morning.dayPlanLogged = true
      if (dayPlanText) morning.dayPlanText = dayPlanText
      if (circumstance.mustDo && mustDo.trim()) morning.mustDo = mustDo.trim()
      if (circumstance.mustNotDo && mustNotDo.trim()) morning.mustNotDo = mustNotDo.trim()
      if (circumstance.newEvents && newEvents.trim()) morning.newEvents = newEvents.trim()
      if (circumstance.excited && excitedAbout.trim()) morning.excitedAbout = excitedAbout.trim()
      if (bestDayWhy.trim()) morning.bestDayWhy = bestDayWhy.trim()
      if (grateful.length || complete) morning.gratitude = grateful

      replaceMorningReview(dayKey, morning)
      const scopeIds = todaysTasks.map((task) => task.id)
      const marked = tasksWithCommitment(
        useTaskStore.getState().tasks,
        "day",
        dayKey,
        scopeIds,
        requiredIds,
        allPriority,
      )
      for (const next of marked) updateTask(next)
      clearMorningDraft(dayKey)
      const clearedLines = [""]
      const keptWalks: Record<string, TodoWalkFormFields> = {}
      for (const [id, form] of Object.entries(todoWalkById)) {
        if (form.skipped) keptWalks[id] = { ...emptyTodoWalkForm(), skipped: true }
      }
      setNewTodoLines(clearedLines)
      setTodoWalkById(keptWalks)
      baselineRef.current = packForm({ ...currentForm(), newTodoLines: clearedLines, todoWalkById: keptWalks })
      if (complete) onClose()
      else setSavedNote("Saved. Unanswered questions stay open.")
    } catch (err) {
      console.error("[MorningReview] save failed", err)
    }
  }

  const dismiss = () => {
    if (!submittedRef.current && packForm(currentForm()) !== baselineRef.current) commitMorning(false)
    submittedRef.current = true
    onClose()
  }

  const shiftDay = (delta: number) => {
    if (packForm(currentForm()) !== baselineRef.current) commitMorning(false)
    setSavedNote("")
    setActiveDate((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() + delta)
      return next
    })
  }

  const [affirmSeen, setAffirmSeen] = useState(false)
  const [step, setStep] = useRitualStep(`brain2-morning-step:${dayKey}`, MORNING_STEPS.length, () => {
    if (!existing || existing.completed) return 0
    const id = existing.resumeStep ? RESUME_TO_STEP[existing.resumeStep] : undefined
    const at = MORNING_STEPS.findIndex((s) => s.id === id)
    return at < 0 ? 0 : at
  })
  const stepId = MORNING_STEPS[step]?.id ?? "night"
  useEffect(() => {
    if (open && stepId === "affirmations") setAffirmSeen(true)
  }, [open, stepId])
  useEffect(() => {
    if (open) setAffirmSeen(!!existing?.affirmations?.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dayKey])

  const answered: Record<(typeof MORNING_STEPS)[number]["id"], boolean> = {
    night: allNighter || !!(bedTime.trim() && wakeTime.trim()) || !!dream.trim(),
    affirmations: affirmSeen,
    todos: priorityIds.length > 0 || requiredIds.length > 0 || newTodoLines.some((l) => l.trim()),
    habits: priorityHabitIds.length > 0,
    walk: Object.values(todoWalkById).some((f) => f.skipped || !isTodoWalkFormBlank(f)),
    plan: !!dayPlan.trim() || !!existing?.dayPlanLogged,
    circumstances: Object.values(circumstance).some(Boolean),
    best: !!bestDayWhy.trim(),
    gratitude: gratitude.some((g) => g.trim()),
  }
  const steps: RitualStep[] = MORNING_STEPS.map((s) => ({ id: s.id, label: s.label, answered: answered[s.id] }))

  /** Moving between questions writes progress, the same as Save progress. */
  const goStep = (next: number) => {
    if (packForm(currentForm()) !== baselineRef.current) commitMorning(false)
    setStep(next)
  }

  const shuffleAffirmations = () => {
    const { pool } = affirmationPool(lists, tasks, addList, addTask)
    const current = new Set(affirmations)
    const fresh = pool.filter((line) => !current.has(line))
    const next = pickRandom(fresh.length >= AFFIRMATIONS_PER_SESSION ? fresh : pool, AFFIRMATIONS_PER_SESSION)
    setAffirmations(next)
    setSessionAffirmations(next)
    affirmationsTouchedRef.current = true
  }

  const openAffirmationsList = () => {
    const { listId } = affirmationPool(lists, tasks, addList, addTask)
    dismiss()
    if (listId) openListInLists(listId)
  }

  const shownAffirmations = affirmations.length ? affirmations : sessionAffirmations

  const stepBody = (() => {
    switch (stepId) {
      case "night":
        return (
          <>
            {(carry.wakeReminder || carry.tomorrowMatters || carry.focusGoalIds.length > 0) && (
              <section className="mr-carry" data-testid="morning-carry">
                {carry.wakeReminder ? (
                  <div>
                    <p className="mr-carry-label">From last night</p>
                    <p className="text-sm whitespace-pre-wrap">{carry.wakeReminder}</p>
                  </div>
                ) : null}
                {carry.tomorrowMatters ? (
                  <div>
                    <p className="mr-carry-label">What matters most today</p>
                    <p className="text-sm whitespace-pre-wrap">{carry.tomorrowMatters}</p>
                  </div>
                ) : null}
                {carry.focusGoalIds.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Focus:{" "}
                    {carry.focusGoalIds
                      .map((id) => goals.find((goal) => goal.id === id)?.title)
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                ) : null}
              </section>
            )}
            <label className="flex items-start gap-2 rounded-md border bg-white/70 p-3 text-sm cursor-pointer">
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
                  {(
                    [
                      ["morning-bedtime", "Fell asleep", bedTime, bedEstSource, "asleep", setBedTime, setBedEstSource],
                      ["morning-waketime", "Wake time", wakeTime, wakeEstSource, "awake", setWakeTime, setWakeEstSource],
                    ] as const
                  ).map(([id, label, value, est, kind, set, setEst]) => (
                    <div key={id} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="font-semibold text-sm" htmlFor={id}>
                          {label}
                        </Label>
                        {est ? (
                          <span
                            className="trk-est inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wide"
                            title={sleepClockEstimateBasis(est, kind)}
                          >
                            est.
                          </span>
                        ) : null}
                      </div>
                      <div className={est ? "flex items-center gap-1.5" : undefined}>
                        {est ? <span className="text-sm font-bold text-slate-600" aria-hidden>~</span> : null}
                        <ClockPicker
                          id={id}
                          value={value}
                          onChange={(v) => {
                            setEst(null)
                            set(v)
                          }}
                        />
                      </div>
                    </div>
                  ))}
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
                    rows={3}
                    placeholder="Anything you remember…"
                  />
                </section>
              </>
            )}
            {allNighter && <p className="text-xs text-muted-foreground">{nightSummary}</p>}
          </>
        )
      case "affirmations":
        return (
          <>
            <p className="mr-lede">
              Five lines drawn from your Lists → {AFFIRMATIONS_LIST_NAME} list. Shuffle for a new five; the five
              you keep are saved for today.
            </p>
            <ol className="mr-affirm-list" key={shownAffirmations.join("|")}>
              {shownAffirmations.map((line, i) => {
                const said = saidToday.get(affirmationKey(line)) ?? 0
                return (
                  <li key={i}>
                    <span className="mr-affirm-line">{line}</span>
                    <button
                      type="button"
                      className={said ? "mr-affirm-said is-on" : "mr-affirm-said"}
                      aria-label={said ? `Said ${said} today; log once more` : "Log that I said it"}
                      title={said ? `Said ${said}× today. Click to log again, Alt-click to undo.` : "Said it: log one recitation"}
                      onClick={(event) =>
                        event.altKey ? undoRecite(line, dayKey) : recite(line, dayKey, "ritual")
                      }
                    >
                      {said ? `✓${said > 1 ? said : ""}` : "✓"}
                    </button>
                  </li>
                )
              })}
            </ol>
            <div className="mr-affirm-tools">
              <Button type="button" className="hpp-key-go gap-1.5 h-8" size="sm" onClick={() => setAffirmationsOpen(true)}>
                <Mic className="h-3.5 w-3.5" />
                Speak them
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8" onClick={shuffleAffirmations}>
                <Shuffle className="h-3.5 w-3.5" />
                Shuffle
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8" onClick={openAffirmationsList}>
                <ListChecks className="h-3.5 w-3.5" />
                Edit the list
              </Button>
            </div>
          </>
        )
      case "todos":
        return (
          <>
            <section className="space-y-2">
              {todaysTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">There is nothing on your to do list for today yet.</p>
              ) : (
                <>
                  <p className="mr-lede">Here is what is on your to do list for the day:</p>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    {todaysTasks.map((t) => (
                      <li key={t.id}>{itemTitle(t)}</li>
                    ))}
                  </ol>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Add any new items (notes: logged from text). Enter starts the next line. They join the list when you
                move on.
              </p>
              <StringListEditor values={newTodoLines} onChange={setNewTodoLines} placeholder="New to-do…" enterAdvances />
            </section>

            {todaysTasks.length > 0 && (
              <section className="space-y-2">
                <Label className="font-semibold text-sm">Required today</Label>
                <p className="text-xs text-muted-foreground">
                  These sit on the Required list. Leave them unchecked to keep a task
                  only assigned.
                </p>
                <CommitmentMarkList
                  tasks={todaysTasks}
                  requiredIds={requiredIds}
                  marks="required"
                  onToggle={(_kind, id) =>
                    setRequiredIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
                  }
                />
              </section>
            )}

            {todaysTasks.length > 0 && (
              <section className="space-y-2">
                <Label className="font-semibold text-sm">3–5 highest priorities</Label>
                <p className="text-xs text-muted-foreground">Pick up to five from today&apos;s list.</p>
                <CommitmentMarkList
                  tasks={todaysTasks}
                  requiredIds={requiredIds}
                  prioritizedIds={priorityIds}
                  marks="prioritized"
                  onToggle={(_kind, id) => togglePriority(id)}
                />
              </section>
            )}
          </>
        )
      case "habits":
        return (
          <>
            <p className="mr-lede">
              Optionally pick 1–3 habits to prioritize for the day (shown on Home → Habits). Leave blank for none.
            </p>
            {dailyHabits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No daily habits yet.</p>
            ) : (
              <div className="space-y-1">
                {dailyHabits.map((h) => (
                  <label key={h.id} className="flex items-center gap-2 border bg-white/70 rounded-md p-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={priorityHabitIds.includes(h.id)}
                      onChange={() => toggleHabitPriority(h.id)}
                    />
                    <span className="truncate flex-1">{h.name}</span>
                    {priorityHabitIds.includes(h.id) && (
                      <span className="text-xs text-muted-foreground shrink-0">#{priorityHabitIds.indexOf(h.id) + 1}</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </>
        )
      case "walk":
        return (
          <>
            <p className="mr-lede">
              Tier, minutes, points, and today&apos;s importance, resistance, and excitement (0–10). A blank field keeps
              what is stored. Type to replace it.
            </p>
            <div className="mr-walk-legend" aria-hidden>
              <span>
                <i className="mr-swatch is-stored" /> stored earlier
              </span>
              <span>
                <i className="mr-swatch is-today" /> logged today
              </span>
              <span>
                <i className="mr-swatch is-new" /> changing now
              </span>
            </div>
            {todaysTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing on today&apos;s to-do list to walk through.</p>
            ) : (
              todaysTasks.map((t) => {
                const form = todoWalkById[t.id] ?? emptyTodoWalkForm()
                const changed = !isTodoWalkFormBlank(form)
                const storedTier = getTierFromTask(t)
                const ratedToday =
                  t.dayRatings?.[dayKey] != null || latestResistance(t, dayKey)?.today === true
                return (
                  <div key={t.id} className="mr-walk-row" data-skipped={form.skipped ? "true" : undefined}>
                    <div className="mr-walk-head">
                      <p className="mr-walk-title">{itemTitle(t)}</p>
                      {changed && !form.skipped ? (
                        <span className="mr-walk-badge is-new">Updating</span>
                      ) : ratedToday ? (
                        <span className="mr-walk-badge">Logged today</span>
                      ) : null}
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
                      <div className="mr-walk-grid">
                        <label className="mr-slot" data-state={form.tier ? "new" : storedTier ? "stored" : "empty"}>
                          <span className="mr-slot-label">
                            Tier
                            {form.tier ? (
                              <button type="button" className="mr-slot-revert" onClick={() => patchWalk(t.id, { tier: "" })}>
                                keep {storedTier}
                              </button>
                            ) : (
                              <span className="mr-slot-state">stored</span>
                            )}
                          </span>
                          <select
                            className="mr-slot-field"
                            aria-label="Tier"
                            value={form.tier}
                            onChange={(e) => patchWalk(t.id, { tier: e.target.value })}
                          >
                            <option value="">{storedTier ? `${storedTier} (keep)` : "— keep"}</option>
                            {TODO_WALK_TIERS.map((tier) => (
                              <option key={tier} value={tier}>
                                {tier}
                              </option>
                            ))}
                          </select>
                        </label>
                        <WalkSlot
                          label="Minutes"
                          value={form.duration}
                          stored={t.estimatedDuration != null ? { value: String(t.estimatedDuration), today: false } : null}
                          onChange={(v) => patchWalk(t.id, { duration: v })}
                        />
                        <WalkSlot
                          label="Points"
                          value={form.points}
                          stored={t.rewardValue != null ? { value: String(t.rewardValue), today: false } : null}
                          onChange={(v) => patchWalk(t.id, { points: v })}
                        />
                        <WalkSlot
                          label="Importance"
                          value={form.importance}
                          stored={latestDayRating(t, dayKey, "importance")}
                          onChange={(v) => patchWalk(t.id, { importance: v })}
                        />
                        <WalkSlot
                          label="Resistance"
                          value={form.resistance}
                          stored={latestResistance(t, dayKey)}
                          onChange={(v) => patchWalk(t.id, { resistance: v })}
                        />
                        <WalkSlot
                          label="Excitement"
                          value={form.excitement}
                          stored={latestDayRating(t, dayKey, "excitement")}
                          onChange={(v) => patchWalk(t.id, { excitement: v })}
                        />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </>
        )
      case "plan":
        return (
          <>
            <p className="mr-lede">Appends today&apos;s Plan log on the Plan tab (same as submitting there). Leave blank to skip.</p>
            <Textarea value={dayPlan} onChange={(e) => setDayPlan(e.target.value)} rows={8} placeholder="Write the day plan…" />
          </>
        )
      case "circumstances":
        return (
          <>
            <p className="mr-lede">Check what applies, then fill in.</p>
            {(
              [
                ["mustDo", "Something I absolutely must do", mustDo, setMustDo],
                ["mustNotDo", "Something I absolutely must not do", mustNotDo, setMustNotDo],
                ["newEvents", "New events scheduled today", newEvents, setNewEvents],
                ["excited", "Something I'm excited about", excitedAbout, setExcitedAbout],
              ] as const
            ).map(([key, label, value, setter]) => (
              <div key={key} className="space-y-1.5 rounded-md border bg-white/70 p-2.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={circumstance[key]}
                    onChange={(e) => setCircumstance((c) => ({ ...c, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
                {circumstance[key] && <Textarea value={value} onChange={(e) => setter(e.target.value)} rows={2} autoFocus />}
              </div>
            ))}
          </>
        )
      case "best":
        return (
          <>
            <p className="mr-lede">Why is today going to be the best day ever?</p>
            <Textarea value={bestDayWhy} onChange={(e) => setBestDayWhy(e.target.value)} rows={5} aria-label="Why is today going to be the best day ever?" />
          </>
        )
      case "gratitude":
        return (
          <>
            <p className="mr-lede">
              10 things you are grateful for today. Enter moves to the next line.{" "}
              <b>{gratitude.filter((g) => g.trim()).length}/10</b>
            </p>
            <StringListEditor values={gratitude} onChange={setGratitude} placeholder="Grateful for…" enterAdvances max={10} />
          </>
        )
    }
  })()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <DialogContent
        className="hpp95 hpp95-dialog sm:max-w-2xl h-[min(88vh,780px)] overflow-hidden flex flex-col"
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
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Previous day"
              onClick={() => shiftDay(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <DialogDescription className="hpp-caption-lead flex-1 text-center" data-morning-day={dayKey}>
              {periodLabel("day", dayKey)}
              {morningReviewPhase(existing) === "partial"
                ? " · in progress"
                : morningReviewPhase(existing) === "done"
                  ? " · saved"
                  : ""}
            </DialogDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Next day"
              disabled={dayKey >= localDayKey(new Date())}
              onClick={() => shiftDay(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="hpp-body flex-1 min-h-0">
          <RitualStepper
            steps={steps}
            index={step}
            onStep={goStep}
            finishLabel="Finish"
            onFinish={() => commitMorning(true)}
          >
            {stepBody}
          </RitualStepper>
        </div>

        <div className="hpp-actions flex-wrap">
          {savedNote ? <p className="w-full text-xs text-muted-foreground">{savedNote}</p> : null}
          <Button variant="outline" onClick={dismiss}>
            Close
          </Button>
          <Button variant="outline" onClick={() => commitMorning(false)}>
            Save progress
          </Button>
          <Button className="hpp-key-go" onClick={() => commitMorning(true)}>
            Save Morning Review
          </Button>
        </div>
      </DialogContent>

      <AffirmationsDialog
        dayKey={dayKey}
        open={affirmationsOpen}
        lines={shownAffirmations}
        onClose={() => {
          setAffirmationsOpen(false)
          if (sessionAffirmations.length) {
            setAffirmations(sessionAffirmations)
            affirmationsTouchedRef.current = true
          }
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
  const [shownPhase, setShownPhase] = useState<"none" | "partial" | "done">("none")
  const today = localDayKey(new Date())
  const phase = useReviewsStore((s) => morningReviewPhase(s.getReview("day", today)?.morning))

  useEffect(() => {
    setShownPhase(phase)
  }, [phase])

  const label = shownPhase === "done" ? "Morning ✓" : shownPhase === "partial" ? "Morning …" : "Morning"

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} data-morning-review-entry>
        <Sun className="h-4 w-4 mr-2" />
        {label}
      </Button>
      <MorningReviewDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export default MorningReview
