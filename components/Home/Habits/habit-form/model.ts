/**
 * components/Home/Habits/habit-form/model.ts — Pure values for the habit form.
 *
 * Constants and functions that used to sit above `TaskForm`. No hooks.
 * The type-tile icons sit on `HABIT_TYPES`.
 * The draft, the locks, submit, and the section observer stay in
 * `daily-task-form.tsx`. `habitSectionNav` is the milled-strip key list.
 * It is not re-exported from that file.
 */
import { AlignLeft, CheckCircle2, Target, TrendingUp } from "lucide-react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { effectiveListLink, effectiveSleepLink } from "@/lib/habit-connections"
import {
  clampCoverageThreshold,
  DEFAULT_COVERAGE_THRESHOLD,
  effectiveCoverageLink,
  effectiveDailyFloorLink,
} from "@/lib/habit-completion-source"
import { legacyModeForRouting, storedListSentFields } from "@/lib/habit-completion-pipeline"
import { defaultTriggersForHabit } from "@/lib/ingest/text-triggers"
import { clampListSentGrace } from "@/lib/list-sent"
import {
  TaskType,
  type HabitCompletionSourceId,
  type HabitFrequency,
  type HabitListMeasure,
  type HabitListTarget,
  type HabitTextTrigger,
  type HabitTrackingMode,
  type IncrementalHabitData,
  type WeeklyTask,
} from "@/lib/types"

export const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Season" },
]

export const HABIT_TYPES: {
  value: TaskType
  name: string
  desc: string
  colorKey: "habitBoolean" | "habitGoal" | "habitText" | "habitIncremental"
  Icon: typeof CheckCircle2
}[] = [
  { value: TaskType.BOOLEAN, name: "Yes/No", desc: "Did it happen?", colorKey: "habitBoolean", Icon: CheckCircle2 },
  { value: TaskType.GOAL, name: "Goal", desc: "Minutes, pages, reps…", colorKey: "habitGoal", Icon: Target },
  { value: TaskType.TEXT, name: "Text", desc: "A short log each period", colorKey: "habitText", Icon: AlignLeft },
  {
    value: TaskType.INCREMENTAL,
    name: "Climb",
    desc: "Daily or weekly rising target",
    colorKey: "habitIncremental",
    Icon: TrendingUp,
  },
]

export const TRACKING_MODES: { value: HabitTrackingMode; label: string; desc: string }[] = [
  { value: "add", label: "Add", desc: "Tracked time tops up what you log by hand." },
  { value: "max", label: "Higher of the two", desc: "Counts your log or tracked time, whichever is more." },
  { value: "replace", label: "Tracking only", desc: "The tracker is the only source for this habit." },
]

export const LIST_MEASURES: { id: HabitListMeasure; label: string; hint: string }[] = [
  { id: "sent", label: "Sent", hint: "Items where Sent is true." },
  { id: "completed", label: "Completed", hint: "Items where Completed is true." },
  { id: "added", label: "Added this period", hint: "Items added in this period." },
]

export const LIST_TARGETS: { id: HabitListTarget; label: string; hint: string }[] = [
  {
    id: "periodSet",
    label: "This period's set",
    hint: "Still on the list without that yes/no, plus items that tripped it this period.",
  },
  { id: "listLength", label: "List length", hint: "How many items are on the list." },
  { id: "one", label: "One", hint: "A fixed 1." },
]

export const GRACE_SENTENCE =
  "Grace 100 leaves the raw percent. Grace 80 means a raw 80 counts as 100, and a raw 40 counts as 50 (raw / grace × 100, capped at 100)."

export function sourcesForListRouting(routing: { measure: HabitListMeasure; target: HabitListTarget }): HabitCompletionSourceId[] {
  const legacy = legacyModeForRouting(routing)
  if (legacy === "oneComplete") return ["list"]
  if (legacy === "allComplete" || legacy === "oneAdded") return []
  if (legacy === "sentThisWeek" || routing.measure === "sent") return ["listSent"]
  return []
}

export const TRIGGER_MODES: { value: HabitTextTrigger["mode"]; label: string }[] = [
  { value: "done", label: "Done (bare keyword)" },
  { value: "quantity", label: "Quantity" },
  { value: "score", label: "Score" },
]

export function seedTextTriggers(task: Pick<WeeklyTask, "name" | "textTriggers"> | null | undefined): HabitTextTrigger[] {
  if (task?.textTriggers && task.textTriggers.length > 0) return task.textTriggers.map((t) => ({ ...t }))
  return defaultTriggersForHabit({ name: task?.name || "", textTriggers: undefined })
}

/** Events line up with the tail of `priorityLog`. Older lines can predate events. */
export function reasoningUnderLogLine(task: WeeklyTask, logIndex: number): string | undefined {
  const log = task.priorityLog ?? []
  const events = task.priorityEvents ?? []
  const event = events[logIndex - (log.length - events.length)]
  const text = event?.reasoning?.trim()
  return text || undefined
}

export function emptyClimb(): IncrementalHabitData {
  return {
    cadence: "weekly",
    startValue: 2,
    increment: 1,
    unit: "minutes",
    startedOn: formatLocalDateKey(new Date()),
  }
}

export function withSourceOrder(current: WeeklyTask, order: HabitCompletionSourceId[]): WeeklyTask {
  let next: WeeklyTask = { ...current, completionSources: order }
  if (order.includes("coverage")) {
    const threshold = clampCoverageThreshold(
      (effectiveCoverageLink(current)?.threshold ?? current.goal) || DEFAULT_COVERAGE_THRESHOLD,
    )
    next = { ...next, coverageLink: { threshold, enabled: true }, goal: current.goal || threshold, unit: current.unit || "%" }
  } else {
    next = { ...next, coverageLink: null }
  }
  if (order.includes("dailyFloor")) {
    next = {
      ...next,
      frequency: "weekly",
      type: current.type === TaskType.GOAL ? current.type : TaskType.BOOLEAN,
      dailyFloorLink: effectiveDailyFloorLink({ ...current, frequency: "weekly", type: TaskType.BOOLEAN }) ?? {
        floorPercent: 0,
        enabled: true,
      },
    }
  } else {
    next = { ...next, dailyFloorLink: null }
  }
  if (order.includes("sleep")) {
    next = { ...next, sleepLink: effectiveSleepLink(current) ?? { end: "wake", beforeMinutes: 9 * 60 } }
  } else {
    next = { ...next, sleepLink: null }
  }
  if (order.includes("list")) {
    next = { ...next, listLink: effectiveListLink(current) ?? { listName: "to do", count: 1 } }
  } else {
    next = { ...next, listLink: null }
  }
  if (order.includes("tags")) {
    next = { ...next, trackingLink: { ...(current.trackingLink ?? { tagIds: [] }), enabled: true } }
  } else if (current.trackingLink) {
    next = { ...next, trackingLink: { ...current.trackingLink, enabled: false } }
  }
  if (order.includes("habitValue")) {
    const habitId = current.habitValueLink?.habitId || ""
    next = { ...next, habitValueLink: habitId ? { habitId, enabled: true } : current.habitValueLink ?? null }
  } else {
    next = { ...next, habitValueLink: null }
  }
  if (order.includes("listSent")) {
    const prev = current.listSentLink
    next = {
      ...next,
      listSentLink: {
        listId: prev?.listId ?? "",
        grace: clampListSentGrace(prev?.grace),
        ...storedListSentFields(prev),
      },
    }
  } else if (current.listSentLink?.listId && current.listSentLink.mode && current.listSentLink.mode !== "sentThisWeek") {
    next = { ...next, listSentLink: current.listSentLink }
  } else {
    next = { ...next, listSentLink: null }
  }
  return next
}

export const EMPTY_RITUAL_IDS: string[] = []

/**
 * Active key for the milled section strip: nearest intersecting top to the
 * well top; when scroll is maxed, the last intersecting mounted section.
 */
export function resolveHabitSectionNavActive(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  wellTop: number,
  intersecting: { id: string; top: number }[],
): string | null {
  if (!intersecting.length) return null
  const maxScroll = Math.max(0, scrollHeight - clientHeight)
  if (maxScroll <= 0 || scrollTop >= maxScroll - 1) {
    return intersecting[intersecting.length - 1]!.id
  }
  let bestId = intersecting[0]!.id
  let bestDist = Math.abs(intersecting[0]!.top - wellTop)
  for (let i = 1; i < intersecting.length; i++) {
    const dist = Math.abs(intersecting[i]!.top - wellTop)
    if (dist < bestDist) {
      bestDist = dist
      bestId = intersecting[i]!.id
    }
  }
  return bestId
}

export function habitSectionNav(input: {
  type: TaskType
  frequency?: HabitFrequency
  showTracking: boolean
  keywordsOn: boolean
}): { id: string; label: string }[] {
  return [
    { id: "habit95-sec-priority", label: "Priority" },
    { id: "habit95-sec-name", label: "Name" },
    { id: "habit95-sec-freq", label: "Frequency" },
    { id: "habit95-sec-type", label: "Type" },
    { id: "habit95-sec-gem", label: "Gem" },
    ...(input.type === TaskType.GOAL || input.type === TaskType.INCREMENTAL
      ? [{ id: "habit95-sec-target", label: input.type === TaskType.INCREMENTAL ? "Climb" : "Target" }]
      : []),
    { id: "habit95-sec-sources", label: "Sources" },
    ...(input.showTracking ? [{ id: "habit95-sec-fill", label: "Auto-fill" }] : []),
    ...(input.keywordsOn ? [{ id: "habit95-sec-keywords", label: "BIM Keywords" }] : []),
    ...(input.frequency === "daily" && input.type === TaskType.BOOLEAN
      ? [{ id: "habit95-sec-links", label: "Connections" }]
      : []),
    ...(input.frequency === "daily" ? [{ id: "habit95-sec-lift", label: "Lift" }] : []),
    { id: "habit95-sec-points", label: "Points" },
    { id: "habit95-sec-time", label: "Time" },
    { id: "habit95-sec-wording", label: "Wording" },
  ]
}
