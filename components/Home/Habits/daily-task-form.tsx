/**
 * components/Home/Habits/daily-task-form.tsx — Habit form
 *
 * Create/edit body for a habit. The draft, the locks, submit, and the milled
 * section strip stay here. Field groups live in `habit-form/`. Visual order
 * is flex `order` in `habit-form-dialog.css`. The strip scrolls
 * `.habit95-fields` only; it does not hide sections. The active key follows
 * the intersecting section nearest the well top, or the last one when scroll
 * is maxed. A clicked key stays pinned until a hand scroll.
 *
 * Prioritize habit refreshes the star immediately, then asks for an optional
 * why (`PriorityReasonDialog`). Skip or a blank note stores no reasoning.
 *
 * Spec: §9.4 (habit data model).
 */
"use client"

import { numberFieldsIn } from "@/lib/pen-fields"
import type React from "react"

import { useEffect, useRef, useState } from "react"
import {
  type WeeklyTask,
  TaskType,
  type HabitFrequency,
  type HabitTimeEstimate,
  type HabitTrackingLink,
  type HabitCompletionSourceId,
  type HabitCompletionPipeline,
  type HabitStatSet,
  type HabitTextTrigger,
  type IncrementalHabitData,
} from "@/lib/types"
import { normalizeTaskType } from "@/lib/habit-utils"
import { isTimeMeasuredHabit } from "@/lib/habit-time-estimate"
import { formatLocalDateKey, formatLocalMonthKey, getWeekString, getWeekStartDate } from "@/lib/date-utils"
import { normalizeIncrementalData } from "@/lib/incremental-habits"
import { supportsTrackingLink } from "@/lib/habit-tracking"
import { defaultTriggersForHabit, describeHabitTriggerPreview, makeHabitTriggerId } from "@/lib/ingest/text-triggers"
import { keywordForSubmit } from "@/lib/habit-keyword-source"
import { retargetTagIds, retargetTaggedTaskTag, type CatalogTagEdit } from "@/lib/catalog-tag"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { penIdsForTags } from "@/lib/tracked-time"
import { useThemeStore } from "@/lib/theme-store"
import { pickRandomCatalogGem } from "@/lib/habit-gems"
import { serializeSnapshot } from "@/lib/unsaved-changes"
import { currentExemptionContext, isHabitPeriodExempt, presetLogExemptions, sanitizeLogExemptions } from "@/lib/habit-exemption"
import { presetListLink, presetSleepLink } from "@/lib/habit-connections"
import {
  clampCoverageThreshold,
  deriveCompletionSources,
  presetCoverageLink,
  presetDailyFloorLink,
} from "@/lib/habit-completion-source"
import { normalizeTag } from "@/lib/links"
import { openedStatBinding } from "@/components/Home/Habits/stat-source-builder"
import {
  effectiveHabitCount,
  flattenPipelines,
  pipelinesFromSources,
  storedListSentFields,
} from "@/lib/habit-completion-pipeline"
import { clampListSentGrace } from "@/lib/list-sent"
import { calculateTaskPercentage } from "@/lib/calculations"
import { datesForCompletionAverage } from "@/lib/habit-daily-completion-average"
import { periodWindowsForFrequency } from "@/lib/habit-period-windows"
import { type HabitStatContext } from "@/lib/habit-stat-points"
import { HabitListPopup } from "@/components/Home/Habits/habit-list-popup"
import { useHabitsStore } from "@/lib/habits-store"
import { localDayKey, useReviewsStore } from "@/lib/reviews-store"
import {
  applyPriorityPress,
  attachPriorityReasoning,
  neglectPrioritySentence,
} from "@/lib/habit-priority"
import { PriorityReasonDialog } from "@/components/Home/Habits/PriorityReasonDialog"
import { useTaskStore } from "@/lib/task-store"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { habitPeriodPointsKey } from "@/lib/habit-points"
import { pointsRuleValue } from "@/lib/points-rules-live"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { HabitFormIdentity } from "@/components/Home/Habits/habit-form/identity"
import { HabitFormKeywords } from "@/components/Home/Habits/habit-form/keywords"
import { HabitFormConnections, HabitFormLift } from "@/components/Home/Habits/habit-form/lift-and-connections"
import { HabitFormPointsTimeWording } from "@/components/Home/Habits/habit-form/points-time-wording"
import { HabitFormSources } from "@/components/Home/Habits/habit-form/sources"
import { HabitFormTarget } from "@/components/Home/Habits/habit-form/target"
import { HabitFormTrackingFill } from "@/components/Home/Habits/habit-form/tracking-fill"
import {
  EMPTY_RITUAL_IDS,
  emptyClimb,
  habitSectionNav,
  resolveHabitSectionNavActive,
  seedTextTriggers,
  withSourceOrder,
} from "@/components/Home/Habits/habit-form/model"

export { resolveHabitSectionNavActive }

interface TaskFormProps {
  onSubmit: (task: WeeklyTask) => void
  onCancel: () => void
  onDelete?: (taskId: string) => void
  initialTask?: WeeklyTask | null
  defaultFrequency?: HabitFrequency
  onDirtyChange?: (dirty: boolean) => void
  /** Close the window without the unsaved prompt — the draft is stashed for the return trip. */
  onLeaveForItem?: () => void
}

export function TaskForm({ onSubmit, onCancel, onDelete, initialTask, defaultFrequency = "daily", onDirtyChange, onLeaveForItem }: TaskFormProps) {
  const colors = useThemeStore((s) => s.colors)
  const trackingTags = useTimeTrackingStore((s) => s.tags)
  const trackingScopes = useTimeTrackingStore((s) => s.scopes)
  const defaultHabitPoints = useHabitsStore((s) => s.defaultHabitPoints)
  const allHabits = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const weeklyHabitData = useHabitsStore((s) => s.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((s) => s.monthlyHabitData)
  const quarterlyHabitData = useHabitsStore((s) => s.quarterlyHabitData)
  const ritualMultiplier = useHabitsStore((s) => s.morningRitualPointMultiplier)
  const dailyFullMark = useUserSettingsStore(
    (s) => s.pointsRules?.["habit.dailyFullMark"] ?? pointsRuleValue("habit.dailyFullMark"),
  )
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const gradeTolerance = useHabitsStore((s) => s.gradeTolerance)
  const outputGradeTolerance = useHabitsStore((s) => s.outputGradeTolerance)
  const accomplishmentThreshold = useHabitsStore((s) => s.accomplishmentThreshold)
  const ritualDayKey = localDayKey(new Date())
  const storedRitualIds =
    useReviewsStore((s) => s.getMorningReview(ritualDayKey)?.priorityHabitIds) ?? EMPTY_RITUAL_IDS
  const [ritualOverride, setRitualOverride] = useState<boolean | null>(null)
  const ritualOn = ritualOverride ?? (initialTask ? storedRitualIds.includes(initialTask.id) : false)
  const vaultLists = useTaskStore((s) => s.lists)
  const vaultItems = useTaskStore((s) => s.tasks)
  const [openListId, setOpenListId] = useState<string | null>(null)
  const listPopupHost = useRef<HTMLElement | null>(null)
  const [fieldsEl, setFieldsEl] = useState<HTMLDivElement | null>(null)
  const [activeSection, setActiveSection] = useState("habit95-sec-priority")
  const [priorityReasonOpen, setPriorityReasonOpen] = useState(false)
  const sectionNavRef = useRef<{ id: string; label: string }[]>([])
  /** Clicked section key; held until the user scrolls the well by hand. */
  const pinnedSectionRef = useRef<string | null>(null)
  const jumpScrollingRef = useRef(false)
  const initialClimb = initialTask ? normalizeIncrementalData(initialTask.incrementalData) : undefined
  const seededTriggers = seedTextTriggers(initialTask)
  const hadStoredTriggers = Boolean(initialTask?.textTriggers?.length)
  const [triggersLocked, setTriggersLocked] = useState(hadStoredTriggers)
  const seedName = { name: initialTask?.name || "", frequency: initialTask?.frequency || defaultFrequency, type: initialTask ? normalizeTaskType(initialTask.type) : TaskType.BOOLEAN }
  const [logsLocked, setLogsLocked] = useState(Array.isArray(initialTask?.logExemptions))
  const [sleepLocked, setSleepLocked] = useState(!!initialTask && initialTask.sleepLink !== undefined)
  const [listLocked, setListLocked] = useState(!!initialTask && initialTask.listLink !== undefined)
  const [coverageLocked, setCoverageLocked] = useState(!!initialTask && initialTask.coverageLink !== undefined)
  const [floorLocked, setFloorLocked] = useState(!!initialTask && initialTask.dailyFloorLink !== undefined)
  const [sourcesLocked, setSourcesLocked] = useState(
    Array.isArray(initialTask?.completionSources) || Array.isArray(initialTask?.completionPipelines),
  )
  const estimateHold = useRef<HabitTimeEstimate | undefined>(initialTask?.timeEstimate)
  const creating = !initialTask
  const [rewardTouched, setRewardTouched] = useState(!creating)
  const seededReward = initialTask
    ? (initialTask.rewardValue ?? 10)
    : defaultHabitPoints[habitPeriodPointsKey(defaultFrequency)]
  const [phrase, setPhrase] = useState("")
  const addTrackingTag = useTimeTrackingStore((s) => s.addTag)
  const [task, setTask] = useState<WeeklyTask>({
    id: initialTask?.id || "",
    name: initialTask?.name || "",
    type: initialTask ? normalizeTaskType(initialTask.type) : TaskType.BOOLEAN,
    goal: initialTask?.goal || 0,
    unit: initialTask?.unit || initialClimb?.unit || "",
    rewardValue: seededReward,
    frequency: initialTask?.frequency || defaultFrequency,
    incrementalData: initialClimb,
    trackingLink: initialTask?.trackingLink,
    completionSources: initialTask?.completionSources,
    coverageLink:
      initialTask && initialTask.coverageLink !== undefined
        ? initialTask.coverageLink
        : presetCoverageLink(seedName),
    dailyFloorLink:
      initialTask && initialTask.dailyFloorLink !== undefined
        ? initialTask.dailyFloorLink
        : presetDailyFloorLink(seedName),
    timeEstimate: initialTask?.timeEstimateNA ? undefined : initialTask?.timeEstimate,
    timeEstimateNA: initialTask?.timeEstimateNA ? true : undefined,
    doneTaskPhrase: initialTask?.doneTaskPhrase,
    doneTaskUseText: initialTask?.doneTaskUseText,
    taggedTaskTag: initialTask?.taggedTaskTag,
    textTriggers: seededTriggers,
    priorityPinned: initialTask?.priorityPinned,
    priorityMuted: initialTask?.priorityMuted,
    priorityLog: initialTask?.priorityLog,
    priorityEvents: initialTask?.priorityEvents,
    priorityRefreshedOn: initialTask?.priorityRefreshedOn,
    priorityPermanent: initialTask?.priorityPermanent,
    gem: initialTask?.gem || pickRandomCatalogGem(),
    logExemptions: initialTask?.logExemptions ?? presetLogExemptions(seedName),
    sleepLink: initialTask && initialTask.sleepLink !== undefined ? initialTask.sleepLink : presetSleepLink(seedName),
    listLink: initialTask && initialTask.listLink !== undefined ? initialTask.listLink : presetListLink(seedName),
    habitValueLink: initialTask?.habitValueLink ?? null,
    listSentLink: initialTask?.listSentLink ?? null,
    completionPipelines: initialTask?.completionPipelines,
    showGoalBar: initialTask?.showGoalBar,
  })
  const [baseline] = useState(() => serializeSnapshot({
    name: initialTask?.name || "",
    type: initialTask ? normalizeTaskType(initialTask.type) : TaskType.BOOLEAN,
    goal: initialTask?.goal || 0,
    unit: initialTask?.unit || initialClimb?.unit || "",
    rewardValue: seededReward,
    frequency: initialTask?.frequency || defaultFrequency,
    incrementalData: initialClimb,
    trackingLink: initialTask?.trackingLink,
    coverageLink:
      initialTask && initialTask.coverageLink !== undefined
        ? initialTask.coverageLink
        : presetCoverageLink(seedName),
    dailyFloorLink:
      initialTask && initialTask.dailyFloorLink !== undefined
        ? initialTask.dailyFloorLink
        : presetDailyFloorLink(seedName),
    timeEstimate: initialTask?.timeEstimateNA ? undefined : initialTask?.timeEstimate,
    timeEstimateNA: initialTask?.timeEstimateNA ? true : undefined,
    doneTaskPhrase: initialTask?.doneTaskPhrase ?? "",
    doneTaskUseText: initialTask?.doneTaskUseText ? true : undefined,
    taggedTaskTag: initialTask?.taggedTaskTag ?? "",
    textTriggers: seededTriggers,
    gem: task.gem,
    priorityPinned: initialTask?.priorityPinned,
    priorityMuted: initialTask?.priorityMuted,
    priorityLog: initialTask?.priorityLog,
    priorityEvents: initialTask?.priorityEvents,
    priorityRefreshedOn: initialTask?.priorityRefreshedOn,
    priorityPermanent: initialTask?.priorityPermanent,
    logExemptions: initialTask?.logExemptions ?? presetLogExemptions(seedName),
    sleepLink: initialTask && initialTask.sleepLink !== undefined ? initialTask.sleepLink : presetSleepLink(seedName),
    listLink: initialTask && initialTask.listLink !== undefined ? initialTask.listLink : presetListLink(seedName),
    completionSources: initialTask?.completionSources,
    completionPipelines: initialTask?.completionPipelines,
    habitValueLink: initialTask?.habitValueLink ?? null,
    listSentLink: initialTask?.listSentLink ?? null,
    showGoalBar: !!initialTask?.showGoalBar,
  }))

  useEffect(() => {
    onDirtyChange?.(
      serializeSnapshot({
        name: task.name,
        type: task.type,
        goal: task.goal || 0,
        unit: task.unit || "",
        rewardValue: task.rewardValue,
        frequency: task.frequency,
        incrementalData: task.incrementalData,
        trackingLink: task.trackingLink,
        coverageLink: task.coverageLink ?? null,
        dailyFloorLink: task.dailyFloorLink ?? null,
        timeEstimate: task.timeEstimate,
        timeEstimateNA: task.timeEstimateNA ? true : undefined,
        doneTaskPhrase: task.doneTaskPhrase ?? "",
        doneTaskUseText: task.doneTaskUseText ? true : undefined,
        taggedTaskTag: task.taggedTaskTag ?? "",
        textTriggers: task.textTriggers ?? [],
        gem: task.gem,
        priorityPinned: task.priorityPinned,
        priorityMuted: task.priorityMuted,
        priorityLog: task.priorityLog,
        priorityEvents: task.priorityEvents,
        priorityRefreshedOn: task.priorityRefreshedOn,
        priorityPermanent: task.priorityPermanent,
        logExemptions: task.logExemptions ?? [],
        sleepLink: task.sleepLink ?? null,
        listLink: task.listLink ?? null,
        completionSources: task.completionSources,
        completionPipelines: task.completionPipelines,
        habitValueLink: task.habitValueLink ?? null,
        listSentLink: task.listSentLink ?? null,
        showGoalBar: !!task.showGoalBar,
      }) !== baseline,
    )
  }, [task, baseline, onDirtyChange])

  // Preview preset keywords when the name matches and the user has not edited yet.
  const skipTriggerNameSync = useRef(true)
  useEffect(() => {
    if (skipTriggerNameSync.current) {
      skipTriggerNameSync.current = false
      return
    }
    if (triggersLocked) return
    setTask((current) => ({
      ...current,
      textTriggers: defaultTriggersForHabit({ name: current.name, textTriggers: undefined }),
    }))
  }, [task.name, triggersLocked])

  const skipLinkSync = useRef(true)
  useEffect(() => {
    if (skipLinkSync.current) {
      skipLinkSync.current = false
      if (task.name === (initialTask?.name || "")) return
    }
    setTask((current) => {
      const next = {
        ...current,
        logExemptions: logsLocked ? current.logExemptions : presetLogExemptions(current),
        sleepLink: sleepLocked ? current.sleepLink : presetSleepLink(current),
        listLink: listLocked ? current.listLink : presetListLink(current),
        coverageLink: coverageLocked ? current.coverageLink : presetCoverageLink(current),
        dailyFloorLink: floorLocked ? current.dailyFloorLink : presetDailyFloorLink(current),
      }
      if (!sourcesLocked) {
        next.completionSources = deriveCompletionSources(next)
        next.completionPipelines = undefined
      }
      return next
    })
  }, [task.name, task.frequency, task.type, logsLocked, sleepLocked, listLocked, coverageLocked, floorLocked, sourcesLocked])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const finalTask = { ...task }
    if (task.type === TaskType.INCREMENTAL) {
      const climb = normalizeIncrementalData(task.incrementalData) ?? emptyClimb()
      finalTask.incrementalData = {
        ...climb,
        startedOn: climb.startedOn || formatLocalDateKey(new Date()),
      }
      finalTask.unit = climb.unit || task.unit
    }
    // An empty selection is no link at all, so the sync can clean up after it.
    finalTask.trackingLink = task.trackingLink?.tagIds.length ? task.trackingLink : undefined
    finalTask.coverageLink = task.coverageLink === null ? null : task.coverageLink ?? null
    if (finalTask.coverageLink) {
      finalTask.coverageLink = {
        threshold: clampCoverageThreshold(finalTask.coverageLink.threshold),
        enabled: finalTask.coverageLink.enabled !== false,
      }
      if (finalTask.type === TaskType.GOAL) {
        finalTask.goal = finalTask.coverageLink.threshold
        finalTask.unit = finalTask.unit || "%"
      }
    }
    finalTask.dailyFloorLink =
      task.dailyFloorLink === null
        ? null
        : task.dailyFloorLink
          ? {
              floorPercent: Math.min(100, Math.max(0, Math.round(task.dailyFloorLink.floorPercent ?? 0))),
              enabled: task.dailyFloorLink.enabled !== false,
              ...((task.dailyFloorLink.allowAtZero ?? 0) > 0
                ? { allowAtZero: Math.max(0, Math.round(task.dailyFloorLink.allowAtZero ?? 0)) }
                : {}),
            }
          : null
    // N/A stores the flag and no minutes. Otherwise drop an empty estimate object.
    if (task.timeEstimateNA) {
      finalTask.timeEstimate = undefined
      finalTask.timeEstimateNA = true
    } else {
      const estimate = task.timeEstimate
      finalTask.timeEstimate =
        estimate && ((estimate.minutesPerUnit ?? 0) > 0 || (estimate.minutes ?? 0) > 0) ? estimate : undefined
      finalTask.timeEstimateNA = undefined
    }
    const donePhrase = (task.doneTaskPhrase ?? "").trim()
    finalTask.doneTaskPhrase = donePhrase || undefined
    finalTask.doneTaskUseText = task.type === TaskType.TEXT && task.doneTaskUseText ? true : undefined
    // Stamp editable triggers (including preset defaults) when present; clear when empty.
    const cleaned = (task.textTriggers ?? [])
      .map((t) => ({
        ...t,
        keyword: t.keyword.trim(),
        unitWords: t.unitWords?.map((u) => u.trim()).filter(Boolean),
        connector: t.connector?.trim() || undefined,
      }))
      .filter((t) => t.keyword.length > 0)
    finalTask.textTriggers = cleaned.length > 0 ? cleaned : undefined
    finalTask.logExemptions = sanitizeLogExemptions(task.logExemptions ?? [])
    finalTask.sleepLink = task.sleepLink ?? null
    finalTask.listLink =
      task.listLink && task.listLink.listName.trim()
        ? { listName: task.listLink.listName.trim(), count: Math.max(1, Math.round(task.listLink.count) || 1) }
        : null
    finalTask.gem = task.gem || pickRandomCatalogGem()
    finalTask.showGoalBar = task.showGoalBar ? true : undefined
    finalTask.habitValueLink = task.habitValueLink?.habitId
      ? { habitId: task.habitValueLink.habitId, enabled: task.habitValueLink.enabled !== false }
      : null
    const draftedRows =
      task.completionPipelines ??
      pipelinesFromSources(
        sourcesLocked && Array.isArray(task.completionSources)
          ? task.completionSources
          : deriveCompletionSources(finalTask),
      )
    finalTask.completionPipelines = draftedRows.map((row) => {
      if (row.kind === "habitsStats") return { ...row, statBinding: openedStatBinding(row) }
      if (row.kind === "keywords") return { ...row, keyword: keywordForSubmit(row.keyword) }
      return row
    })
    finalTask.completionSources = flattenPipelines(draftedRows)
    const listRow = draftedRows.some((row) => row.kind === "lists")
    finalTask.listSentLink =
      task.listSentLink?.listId && (listRow || finalTask.completionSources.includes("listSent"))
        ? {
            listId: task.listSentLink.listId,
            grace: clampListSentGrace(task.listSentLink.grace),
            enabled: task.listSentLink.enabled !== false,
            ...storedListSentFields(task.listSentLink),
          }
        : null
    if (!finalTask.completionSources.includes("listSent") && !listRow) finalTask.listSentLink = null
    if (!finalTask.coverageLink) {
      const measure = effectiveHabitCount(finalTask, undefined, vaultItems, new Date())
      if (measure.derived) finalTask.goal = measure.target
    }
    const tagged = normalizeTag(task.taggedTaskTag ?? "")
    finalTask.taggedTaskTag =
      finalTask.completionSources?.includes("taggedTasks") && tagged ? tagged : undefined
    if (initialTask && ritualOverride === true && !storedRitualIds.includes(initialTask.id)) {
      useReviewsStore.getState().saveMorningReview(ritualDayKey, {
        priorityHabitIds: [...storedRitualIds, initialTask.id],
      })
    }
    if (initialTask && ritualOverride === false) {
      useReviewsStore.getState().saveMorningReview(ritualDayKey, {
        priorityHabitIds: storedRitualIds.filter((id) => id !== initialTask.id),
      })
    }
    onSubmit(finalTask)
  }

  const triggers = task.textTriggers ?? []
  const patchTrigger = (id: string, patch: Partial<HabitTextTrigger>) => {
    setTriggersLocked(true)
    setTask((current) => ({
      ...current,
      textTriggers: (current.textTriggers ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }
  const addTrigger = () => {
    setTriggersLocked(true)
    setTask((current) => ({
      ...current,
      textTriggers: [
        ...(current.textTriggers ?? []),
        { id: makeHabitTriggerId(), keyword: "", mode: "done" as const },
      ],
    }))
  }
  const removeTrigger = (id: string) => {
    setTriggersLocked(true)
    setTask((current) => ({
      ...current,
      textTriggers: (current.textTriggers ?? []).filter((t) => t.id !== id),
    }))
  }

  const link: HabitTrackingLink = task.trackingLink ?? { tagIds: [] }
  const setLink = (patch: Partial<HabitTrackingLink>) =>
    setTask((current) => ({ ...current, trackingLink: { ...(current.trackingLink ?? { tagIds: [] }), ...patch } }))
  const toggleLinkTag = (id: string) => {
    const on = link.tagIds.includes(id)
    setSourcesLocked(true)
    setTask((current) => {
      const linkNow = current.trackingLink ?? { tagIds: [] }
      const tagIds = on ? linkNow.tagIds.filter((tag) => tag !== id) : [...linkNow.tagIds, id]
      const order: HabitCompletionSourceId[] =
        sourcesLocked && Array.isArray(current.completionSources)
          ? current.completionSources
          : deriveCompletionSources(current)
      const completionSources: HabitCompletionSourceId[] = tagIds.length
        ? order.includes("tags")
          ? order
          : [...order, "tags"]
        : order.filter((source) => source !== "tags")
      return {
        ...current,
        completionSources,
        trackingLink: { ...linkNow, tagIds, enabled: tagIds.length > 0 },
      }
    })
  }

  const periodWord =
    task.frequency === "weekly"
      ? "that week"
      : task.frequency === "monthly"
        ? "that month"
        : task.frequency === "quarterly"
          ? "that season"
          : "that day"
  const linkedPenCount = penIdsForTags(trackingScopes, link.tagIds).size
  const trackingNumberFields = numberFieldsIn(trackingScopes, trackingTags)
  const sourceOrder =
    sourcesLocked && Array.isArray(task.completionSources)
      ? task.completionSources
      : deriveCompletionSources(task)
  const displayPipelines = task.completionPipelines ?? pipelinesFromSources(sourceOrder)
  const showTracking = supportsTrackingLink(task) && sourceOrder.includes("tags")
  const showTagsPipeline =
    displayPipelines.some((row) => row.kind === "tags") || sourceOrder.includes("taggedTasks")
  const showTagRolesLegend =
    showTagsPipeline ||
    showTracking ||
    displayPipelines.some((row) => row.kind === "trackingTags")
  const showBothTagRoles = showTagsPipeline && showTracking
  const doneCountName = (task.taggedTaskTag ?? "").trim()
  const minuteTagNames = link.tagIds
    .map((id) => trackingTags.find((tag) => tag.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  const listChoices = vaultLists
    .filter((list) => !isFolderAllItemsCategoryId(list.id))
    .map((list) => ({ id: list.id, name: list.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const setRowSources = (row: HabitCompletionPipeline, sources: HabitCompletionSourceId[]) => {
    commitPipelines(
      displayPipelines.map((item) => (item.id === row.id ? { ...item, sources } : item)),
      "structure",
    )
  }
  const dailyValueSources = allHabits.filter(
    (habit) =>
      (habit.frequency || "daily") === "daily" &&
      habit.id !== task.id &&
      habit.type !== TaskType.TEXT,
  )
  const todayKey = formatLocalDateKey(new Date())
  const periodWindow = periodWindowsForFrequency(task.frequency, [todayKey])[0]
  const periodDates = periodWindow ? datesForCompletionAverage(task.frequency, periodWindow, todayKey) : []
  const dailyHabits = allHabits.filter((habit) => (habit.frequency || "daily") === "daily")
  const weeklyHabits = allHabits.filter((habit) => habit.frequency === "weekly" && habit.id !== task.id)
  const monthlyHabits = allHabits.filter((habit) => habit.frequency === "monthly" && habit.id !== task.id)
  const exemptionContext = currentExemptionContext()
  const dailyExempt = (habit: WeeklyTask, dateKey: string) =>
    isHabitPeriodExempt(habit, dateKey, "daily", habitExemptions, exemptionContext)
  const dailyPercents = dailyHabits.map((habit) => ({
    id: habit.id,
    name: habit.name || "Untitled",
    pct: periodDates.length
      ? calculateTaskPercentage(habit.id, dailyHabits, weeklyData, periodDates, dailyExempt)
      : 0,
    active: periodDates.some((date) => !dailyExempt(habit, formatLocalDateKey(date))),
  }))
  const averageRows = dailyPercents.filter((row) => row.active)
  const averageMean =
    averageRows.length > 0 ? averageRows.reduce((sum, row) => sum + row.pct, 0) / averageRows.length : null
  const sumKeys = periodDates.map((date) => formatLocalDateKey(date)).filter((key) => key <= todayKey)

  const commitPipelines = (rows: HabitCompletionPipeline[], reason: "rename" | "structure") => {
    setSourcesLocked(true)
    if (reason === "rename") {
      setTask((current) => ({ ...current, completionPipelines: rows }))
      return
    }
    setCoverageLocked(true)
    setFloorLocked(true)
    setSleepLocked(true)
    setListLocked(true)
    const order = flattenPipelines(rows)
    setTask((current) => ({ ...withSourceOrder(current, order), completionPipelines: rows }))
  }

  const patchStatsRow = (row: HabitCompletionPipeline, next: HabitCompletionPipeline) => {
    commitPipelines(
      displayPipelines.map((item) => (item.id === row.id ? next : item)),
      "structure",
    )
  }

  const statContext = (set: HabitStatSet): HabitStatContext => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    monthStart.setHours(0, 0, 0, 0)
    return {
      today: now,
      weekStart: getWeekStartDate(now),
      monthStart,
      periodDays: periodDates,
      set,
      subject: task,
      dailyTasks: dailyHabits,
      weeklyTasks: weeklyHabits,
      monthlyTasks: monthlyHabits,
      weeklyData,
      weeklyHabitData,
      monthlyHabitData,
      gradeTolerance,
      outputGradeTolerance,
      isExempt: (habit, key) =>
        isHabitPeriodExempt(habit, key, habit.frequency || "daily", habitExemptions, exemptionContext),
    }
  }

  const noteCatalogEdit = (result: CatalogTagEdit) => {
    setTask((current) => {
      const taggedTaskTag = retargetTaggedTaskTag(current.taggedTaskTag, result.fromName, result.toName)
      const link = current.trackingLink
      const tagIds =
        result.replacedId && link ? retargetTagIds(link.tagIds, result.replacedId, result.tag.id) : link?.tagIds
      if (taggedTaskTag === current.taggedTaskTag && tagIds === link?.tagIds) return current
      return {
        ...current,
        taggedTaskTag,
        ...(link && tagIds && tagIds !== link.tagIds ? { trackingLink: { ...link, tagIds } } : {}),
      }
    })
  }

  const createTrackingTag = (name: string) => {
    const id = addTrackingTag(name)
    if (!id) return
    setSourcesLocked(true)
    setTask((current) => {
      const linkNow = current.trackingLink ?? { tagIds: [] }
      const tagIds = linkNow.tagIds.includes(id) ? linkNow.tagIds : [...linkNow.tagIds, id]
      const order =
        sourcesLocked && Array.isArray(current.completionSources)
          ? current.completionSources
          : deriveCompletionSources(current)
      return {
        ...current,
        completionSources: order.includes("tags") ? order : [...order, "tags"],
        trackingLink: { ...linkNow, tagIds, enabled: true },
      }
    })
  }

  const createCountTag = (name: string) => {
    const id = addTrackingTag(name)
    if (!id) return
    const created = useTimeTrackingStore.getState().tags.find((tag) => tag.id === id)
    setTask((current) => ({ ...current, taggedTaskTag: normalizeTag(created?.name ?? name) }))
  }

  const loggedNow = (() => {
    if (!task.id) return 0
    const habits = useHabitsStore.getState()
    const today = new Date()
    if ((task.frequency || "daily") === "weekly") {
      return habits.weeklyHabitData[getWeekString(getWeekStartDate(today))]?.[task.id]?.value ?? 0
    }
    if (task.frequency === "monthly") {
      return habits.monthlyHabitData[formatLocalMonthKey(today)]?.[task.id]?.value ?? 0
    }
    if (task.frequency === "quarterly") return 0
    return habits.weeklyData[formatLocalDateKey(today)]?.[task.id]?.value ?? 0
  })()
  const phrasePreview = describeHabitTriggerPreview(phrase, task.textTriggers ?? [], loggedNow)
  const listMeasure = effectiveHabitCount(task, undefined, vaultItems, new Date())

  const timeEstimate: HabitTimeEstimate = task.timeEstimate ?? {}
  const setTimeEstimate = (patch: Partial<HabitTimeEstimate>) =>
    setTask((current) => {
      const next = { ...(current.timeEstimate ?? {}), ...patch }
      estimateHold.current = next
      return { ...current, timeEstimate: next }
    })
  const setEstimateNA = (na: boolean) => {
    setTask((current) => {
      if (na) {
        estimateHold.current = current.timeEstimate ?? estimateHold.current
        return { ...current, timeEstimateNA: true, timeEstimate: undefined }
      }
      return { ...current, timeEstimateNA: undefined, timeEstimate: estimateHold.current }
    })
  }
  // A habit logged in minutes/hours already is a duration; a rate would double-count.
  const measuredInTime = isTimeMeasuredHabit(task)
  const usesRate = !measuredInTime && (task.type === TaskType.GOAL || task.type === TaskType.INCREMENTAL)

  const setClimb = (patch: Partial<IncrementalHabitData>) => {
    const current = normalizeIncrementalData(task.incrementalData) ?? emptyClimb()
    setTask({ ...task, incrementalData: { ...current, ...patch }, unit: patch.unit ?? current.unit ?? task.unit })
  }

  const setType = (value: TaskType) => {
    setTask({
      ...task,
      type: value,
      goal: value === TaskType.GOAL ? task.goal : undefined,
      unit: value === TaskType.GOAL || value === TaskType.INCREMENTAL ? task.unit : undefined,
      incrementalData: value === TaskType.INCREMENTAL ? normalizeIncrementalData(task.incrementalData) ?? emptyClimb() : undefined,
    })
  }

  const climb = normalizeIncrementalData(task.incrementalData) ?? emptyClimb()
  const canSubmit =
    Boolean(task.name.trim()) && (task.type !== TaskType.INCREMENTAL || climb.increment > 0)

  const neglectFrequency = task.frequency || "daily"
  const neglectBook =
    neglectFrequency === "weekly"
      ? weeklyHabitData
      : neglectFrequency === "monthly"
        ? monthlyHabitData
        : neglectFrequency === "quarterly"
          ? quarterlyHabitData
          : weeklyData
  const neglectSentence = initialTask
    ? neglectPrioritySentence({ ...task, id: initialTask.id }, neglectBook, new Date(), neglectFrequency)
    : null

  const sectionNav = habitSectionNav({
    type: task.type,
    frequency: task.frequency,
    showTracking,
    keywordsOn: sourceOrder.includes("keywords"),
  })
  const sectionNavKey = sectionNav.map((section) => `${section.id}:${section.label}`).join("|")
  sectionNavRef.current = sectionNav

  useEffect(() => {
    if (!sectionNavRef.current.some((section) => section.id === activeSection)) {
      setActiveSection(sectionNavRef.current[0]?.id ?? "habit95-sec-priority")
    }
  }, [sectionNavKey, activeSection])

  useEffect(() => {
    const root = fieldsEl
    if (!root || typeof IntersectionObserver !== "function") return
    const nodes = sectionNavRef.current
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => node instanceof HTMLElement)
    if (!nodes.length) return

    const visible = new Map<Element, boolean>()
    const pickActive = () => {
      const pinned = pinnedSectionRef.current
      if (pinned) {
        setActiveSection(pinned)
        return
      }
      const intersecting = nodes.filter((node) => visible.get(node))
      if (!intersecting.length) return
      const id = resolveHabitSectionNavActive(
        root.scrollTop,
        root.scrollHeight,
        root.clientHeight,
        root.getBoundingClientRect().top,
        intersecting.map((node) => ({
          id: node.id,
          top: node.getBoundingClientRect().top,
        })),
      )
      if (id) setActiveSection(id)
    }

    const onScroll = () => {
      if (!jumpScrollingRef.current) pinnedSectionRef.current = null
      pickActive()
    }
    const releaseJumpScroll = () => {
      jumpScrollingRef.current = false
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target, entry.isIntersecting)
        }
        pickActive()
      },
      // Full well: bottom sections must count when scroll is maxed.
      { root, rootMargin: "0px", threshold: [0, 0.01, 0.1, 0.5, 1] },
    )
    for (const node of nodes) observer.observe(node)
    root.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      observer.disconnect()
      root.removeEventListener("scroll", onScroll)
      releaseJumpScroll()
    }
  }, [fieldsEl, sectionNavKey])

  const jumpToSection = (id: string) => {
    // Paint the clicked key before the observer catches up; hold it through
    // the programmatic scroll so a maxed well does not steal the key for a
    // lower neighbor that also intersects.
    pinnedSectionRef.current = id
    jumpScrollingRef.current = true
    setActiveSection(id)
    const node = document.getElementById(id)
    if (!(node instanceof HTMLElement)) {
      jumpScrollingRef.current = false
      return
    }
    const scroller = node.closest(".habit95-fields")
    if (scroller instanceof HTMLElement) {
      // scrollIntoView also scrolls the dialog (overflow:hidden still moves)
      // and the page, which carries the key strip off the window.
      const delta = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      scroller.scrollTop += delta - 8
    }
    node.focus({ preventScroll: true })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jumpScrollingRef.current = false
      })
    })
  }

  const prioritizeHabit = () => {
    setTask((current) => applyPriorityPress(current))
    setPriorityReasonOpen(true)
  }

  const resolvePriorityReason = (text: string | undefined) => {
    setPriorityReasonOpen(false)
    const trimmed = text?.trim()
    if (!trimmed) return
    setTask((current) => {
      const eventId = current.priorityEvents?.at(-1)?.id
      if (!eventId || current.priorityEvents?.at(-1)?.source !== "manual") return current
      return attachPriorityReasoning(current, eventId, trimmed)
    })
  }

  return (
    <>
    <form id="habit95-form" onSubmit={handleSubmit} className="habit95-form">
      <nav className="habit95-section-nav" aria-label="Habit sections">
        {sectionNav.map((section) => (
          <button
            key={`${section.id}:${section.label}`}
            type="button"
            className="habit95-btn habit95-section-key"
            aria-current={activeSection === section.id ? "true" : undefined}
            aria-controls={section.id}
            onClick={() => jumpToSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>
      <div className="habit95-fields" ref={setFieldsEl}>
      <HabitFormIdentity
        neglectSentence={neglectSentence}
        task={task}
        setTask={setTask}
        prioritizeHabit={prioritizeHabit}
        ritualOn={ritualOn}
        ritualMultiplier={ritualMultiplier}
        initialTask={initialTask}
        setRitualOverride={setRitualOverride}
        onLeaveForItem={onLeaveForItem}
        colors={colors}
        setType={setType}
        creating={creating}
        rewardTouched={rewardTouched}
        defaultHabitPoints={defaultHabitPoints}
      />
      <HabitFormSources
        displayPipelines={displayPipelines}
        commitPipelines={commitPipelines}
        showTagRolesLegend={showTagRolesLegend}
        showBothTagRoles={showBothTagRoles}
        doneCountName={doneCountName}
        minuteTagNames={minuteTagNames}
        trackingTags={trackingTags}
        task={task}
        setTask={setTask}
        createCountTag={createCountTag}
        noteCatalogEdit={noteCatalogEdit}
        setRowSources={setRowSources}
        setCoverageLocked={setCoverageLocked}
        weeklyHabits={weeklyHabits}
        monthlyHabits={monthlyHabits}
        dailyHabits={dailyHabits}
        statContext={statContext}
        accomplishmentThreshold={accomplishmentThreshold}
        patchStatsRow={patchStatsRow}
        averageRows={averageRows}
        averageMean={averageMean}
        dailyValueSources={dailyValueSources}
        setSourcesLocked={setSourcesLocked}
        weeklyData={weeklyData}
        sumKeys={sumKeys}
        dailyPercents={dailyPercents}
        setFloorLocked={setFloorLocked}
        listChoices={listChoices}
        vaultItems={vaultItems}
        setListLocked={setListLocked}
        onOpenList={(listId, host) => {
          listPopupHost.current = host
          setOpenListId(listId)
        }}
      />
      <HabitFormTarget
        task={task}
        setTask={setTask}
        listMeasure={listMeasure}
        setCoverageLocked={setCoverageLocked}
        climb={climb}
        setClimb={setClimb}
      />
      <HabitFormPointsTimeWording
        task={task}
        setTask={setTask}
        setRewardTouched={setRewardTouched}
        dailyFullMark={dailyFullMark}
        measuredInTime={measuredInTime}
        timeEstimate={timeEstimate}
        setTimeEstimate={setTimeEstimate}
        setEstimateNA={setEstimateNA}
        usesRate={usesRate}
      />
      <HabitFormTrackingFill
        showTracking={showTracking}
        periodWord={periodWord}
        trackingTags={trackingTags}
        link={link}
        toggleLinkTag={toggleLinkTag}
        createTrackingTag={createTrackingTag}
        noteCatalogEdit={noteCatalogEdit}
        task={task}
        setLink={setLink}
        trackingNumberFields={trackingNumberFields}
        linkedPenCount={linkedPenCount}
      />
      <HabitFormLift task={task} setTask={setTask} setLogsLocked={setLogsLocked} />
      <HabitFormConnections
        task={task}
        setTask={setTask}
        setSleepLocked={setSleepLocked}
        setListLocked={setListLocked}
      />
      <HabitFormKeywords
        sourceOrder={sourceOrder}
        hadStoredTriggers={hadStoredTriggers}
        triggers={triggers}
        phrase={phrase}
        setPhrase={setPhrase}
        phrasePreview={phrasePreview}
        patchTrigger={patchTrigger}
        addTrigger={addTrigger}
        removeTrigger={removeTrigger}
      />
      </div>

      <div className="habit95-actions">
        {initialTask && onDelete ? (
          <button
            type="button"
            className="habit95-btn habit95-btn-danger"
            onClick={() => {
              if (window.confirm(`Delete “${task.name || "this habit"}”?`)) onDelete(initialTask.id)
            }}
          >
            Delete habit
          </button>
        ) : null}
        <button type="button" className="habit95-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="habit95-btn habit95-btn-default" disabled={!canSubmit}>
          {initialTask ? "Update Habit" : "Add Habit"}
        </button>
      </div>
    </form>
    <HabitListPopup
      listId={openListId}
      link={task.listSentLink}
      frequency={task.frequency}
      container={listPopupHost.current}
      onClose={() => setOpenListId(null)}
    />
    <PriorityReasonDialog
      open={priorityReasonOpen}
      subject={task.name.trim() || "This habit"}
      onResolve={resolvePriorityReason}
    />
    </>
  )
}
