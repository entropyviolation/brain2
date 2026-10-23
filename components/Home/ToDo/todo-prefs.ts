/**
 * components/Home/ToDo/todo-prefs.ts — To Do view prefs
 *
 * Available-now filter (default off), the filter strip's All tasks, Status and Sort, the soft WIP cap (default 3), and which
 * open-lid sections are collapsed (flags / time / steps, default all open).
 * Same localStorage snapshot pattern as Tracking view prefs. Not a second store.
 */
"use client"

import type { PriorityWeights, StepTier } from "@/lib/types"
import { useSyncExternalStore } from "react"

import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"
import { DEFAULT_ESTIMATE_MIN } from "@/lib/todo-steps"
import { PARKING_LOT_MODES, type ParkingLotMode } from "./parking-lot/types"
import { DEFAULT_TODO_SORT_ORDER, TODO_STATUS_FILTERS, type TodoSortMode, type TodoSortOrder, type TodoStatusFilter } from "./todo-utils"

export function normalizeParkingLotMode(value: unknown): ParkingLotMode {
  return PARKING_LOT_MODES.some((m) => m.id === value) ? (value as ParkingLotMode) : "classic"
}

export const TODO_PREFS_KEY = persistKey("todo-prefs")

export const DEFAULT_WIP_LIMIT = 3
export const MIN_WIP_LIMIT = 1
export const MAX_WIP_LIMIT = 99

export const MAX_DEFAULT_ESTIMATE_MIN = 600

export function clampDefaultEstimate(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (value === undefined || value === null || value === "" || !Number.isFinite(n)) return DEFAULT_ESTIMATE_MIN
  return Math.min(MAX_DEFAULT_ESTIMATE_MIN, Math.max(0, Math.round(n)))
}

export const LID_SECTIONS = ["flags", "time", "steps"] as const
export type TodoLidSection = (typeof LID_SECTIONS)[number]

export type TodoPrefs = {
  availableNow: boolean
  wipLimit: number
  /** True when that open-lid section is folded. Missing keys stay open. */
  lidCollapsed: Record<TodoLidSection, boolean>
  /** Hide Night ritual before sunset and an unstarted Morning ritual after it, on today's day lens. */
  ritesFollowSun: boolean
  /** Minutes counted for a task with no estimate and no steps; shown as `~30`. 0 = none. Never written to the task. */
  defaultEstimateMin: number
  /** Pace overrides by `paceKey` (`lib/estimate-pace.ts`). A missing key reads your own median. */
  paceOverrides: Record<string, number>
  /** The dim "usually ×2.4 for you" ghost beside estimates. */
  paceGhosts: boolean
  /** Session fit gauge → Padded for you: lines read at your own pace (`sessionPaceFactor`). Off shows raw estimates. */
  sessionPadded: boolean
  /** Hide steps and rows waiting on an open prerequisite (`lib/prereqs.ts`). Never hides for being incomplete. */
  hideLocked: boolean
  /** A branch shows only its next step and "+ N more" until opened. */
  showNextOnly: boolean
  /** Tier filter (Phase 10): every lid shows that level's view. `all` shows every step. */
  tierView: TodoTierView
  /** Global To Do settings: the word before the view phrase ("To do" → "To do today"). */
  titleBase: string
  /** Full title per view; a blank or missing key reads `titleBase` + the view phrase. */
  titleByView: Partial<Record<TodoTitleView, string>>
  /** Other view: custom ranges. Each id is a real List (`todo-ranges.ts`); the name lives on the List. */
  ranges: TodoRange[]
  /** The range the Other view has loaded. */
  activeRangeId: string | null
  /** Saved priority formulas. Applying one writes its weights to the task store. */
  formulas: SavedFormula[]
  /** Settings → Show the math: the formula panel opens its plots. */
  showMath: boolean
  /** Filter strip: every scheduled task, not just this period's. */
  showAllTasks: boolean
  /** Filter strip: Status. */
  statusFilter: TodoStatusFilter
  /** Filter strip: Sort and its direction. */
  sortMode: TodoSortMode
  sortOrder: TodoSortOrder
  /** Header ▾: the load instrument under the glass is open. Default closed. */
  loadOpen: boolean
  /** Header Show key: the filter tray is open. Default closed. */
  showTrayOpen: boolean
  /** Settings → B/G/E mode: each list splits into Bare minimum / Goal / Exceptional (`TodoPeriodMark.tier`) and scores on that scale. */
  bgeTiers: boolean
  /** Parked popup: how the parking lot draws (`parking-lot/types.ts`). Classic is the plain list. */
  parkingLotMode: ParkingLotMode
}

export type SavedFormula = { id: string; name: string; weights: PriorityWeights }

export type TodoTitleView = "day" | "week" | "month" | "quarter" | "other"
/** `end` is the "done before" day, `YYYY-MM-DD`. `start` is optional and only labels the span. */
export type TodoRange = { id: string; end: string; start?: string }

export const DEFAULT_LID_COLLAPSED: Record<TodoLidSection, boolean> = {
  flags: false,
  time: false,
  steps: false,
}

export const DEFAULT_TODO_PREFS: TodoPrefs = {
  availableNow: false,
  wipLimit: DEFAULT_WIP_LIMIT,
  lidCollapsed: { ...DEFAULT_LID_COLLAPSED },
  ritesFollowSun: true,
  defaultEstimateMin: DEFAULT_ESTIMATE_MIN,
  paceOverrides: {},
  paceGhosts: true,
  sessionPadded: true,
  hideLocked: false,
  showNextOnly: false,
  tierView: "all",
  titleBase: "To do",
  titleByView: {},
  ranges: [],
  activeRangeId: null,
  formulas: [],
  showMath: false,
  showAllTasks: false,
  statusFilter: "open",
  sortMode: "priority",
  sortOrder: DEFAULT_TODO_SORT_ORDER.priority,
  loadOpen: false,
  showTrayOpen: false,
  bgeTiers: false,
  parkingLotMode: "classic",
}

export function normalizeStatusFilter(value: unknown): TodoStatusFilter {
  return TODO_STATUS_FILTERS.some((f) => f.value === value) ? (value as TodoStatusFilter) : "open"
}

export function normalizeSortMode(value: unknown): TodoSortMode {
  return typeof value === "string" && Object.hasOwn(DEFAULT_TODO_SORT_ORDER, value) ? (value as TodoSortMode) : "priority"
}

export type TodoTierView = "all" | StepTier

export function normalizeTierView(value: unknown): TodoTierView {
  return value === "min" || value === "goal" || value === "exceptional" ? value : "all"
}

/** Keeps only positive finite overrides, clamped to 0.5–4. */
export function normalizePaceOverrides(value: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!value || typeof value !== "object") return out
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof raw === "number" ? raw : Number(raw)
    if (Number.isFinite(n) && n > 0) out[key] = Math.min(4, Math.max(0.5, n))
  }
  return out
}

export function normalizeLidCollapsed(value: unknown): Record<TodoLidSection, boolean> {
  const raw = value && typeof value === "object" ? (value as Partial<Record<TodoLidSection, boolean>>) : {}
  return {
    flags: raw.flags === true,
    time: raw.time === true,
    steps: raw.steps === true,
  }
}

const listeners = new Set<() => void>()
let snapshot: TodoPrefs = load()

export function normalizeTitleBase(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 40) : DEFAULT_TODO_PREFS.titleBase
}

const TITLE_VIEWS: TodoTitleView[] = ["day", "week", "month", "quarter", "other"]

export function normalizeTitleByView(value: unknown): Partial<Record<TodoTitleView, string>> {
  const out: Partial<Record<TodoTitleView, string>> = {}
  if (!value || typeof value !== "object") return out
  for (const view of TITLE_VIEWS) {
    const v = (value as Record<string, unknown>)[view]
    if (typeof v === "string" && v.trim()) out[view] = v.trim().slice(0, 60)
  }
  return out
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export function normalizeRanges(value: unknown): TodoRange[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((r) => {
    if (!r || typeof r !== "object") return []
    const { id, end, start } = r as Record<string, unknown>
    if (typeof id !== "string" || typeof end !== "string" || !DAY_KEY.test(end)) return []
    return [typeof start === "string" && DAY_KEY.test(start) ? { id, end, start } : { id, end }]
  })
}

const WEIGHT_KEYS = ["urgency", "importance", "cognitiveLoad", "entropy", "unlocks"] as const

export function normalizeFormulas(value: unknown): SavedFormula[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((f) => {
    if (!f || typeof f !== "object") return []
    const { id, name, weights } = f as Record<string, unknown>
    if (typeof id !== "string" || typeof name !== "string" || !weights || typeof weights !== "object") return []
    const w = {} as Record<string, number>
    for (const k of WEIGHT_KEYS) {
      const n = Number((weights as Record<string, unknown>)[k])
      w[k] = Number.isFinite(n) && n >= 0 ? n : k === "unlocks" ? 1 : 0
    }
    return [{ id, name: name.slice(0, 40), weights: w as unknown as PriorityWeights }]
  })
}

export function clampWipLimit(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_WIP_LIMIT
  return Math.min(MAX_WIP_LIMIT, Math.max(MIN_WIP_LIMIT, Math.round(n)))
}

function load(): TodoPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_TODO_PREFS }
  try {
    const raw = readAliasedLocal(TODO_PREFS_KEY)
    if (!raw) return { ...DEFAULT_TODO_PREFS }
    const parsed = JSON.parse(raw) as Partial<TodoPrefs>
    return {
      availableNow: parsed.availableNow === true,
      wipLimit: clampWipLimit(parsed.wipLimit),
      lidCollapsed: normalizeLidCollapsed(parsed.lidCollapsed),
      ritesFollowSun: parsed.ritesFollowSun !== false,
      defaultEstimateMin: clampDefaultEstimate(parsed.defaultEstimateMin),
      paceOverrides: normalizePaceOverrides(parsed.paceOverrides),
      paceGhosts: parsed.paceGhosts !== false,
      sessionPadded: parsed.sessionPadded !== false,
      hideLocked: parsed.hideLocked === true,
      showNextOnly: parsed.showNextOnly === true,
      tierView: normalizeTierView(parsed.tierView),
      titleBase: normalizeTitleBase(parsed.titleBase),
      titleByView: normalizeTitleByView(parsed.titleByView),
      ranges: normalizeRanges(parsed.ranges),
      activeRangeId: typeof parsed.activeRangeId === "string" ? parsed.activeRangeId : null,
      formulas: normalizeFormulas(parsed.formulas),
      showMath: parsed.showMath === true,
      showAllTasks: parsed.showAllTasks === true,
      statusFilter: normalizeStatusFilter(parsed.statusFilter),
      sortMode: normalizeSortMode(parsed.sortMode),
      sortOrder:
        parsed.sortOrder === "asc" || parsed.sortOrder === "desc"
          ? parsed.sortOrder
          : DEFAULT_TODO_SORT_ORDER[normalizeSortMode(parsed.sortMode)],
      loadOpen: parsed.loadOpen === true,
      showTrayOpen: parsed.showTrayOpen === true,
      bgeTiers: parsed.bgeTiers === true,
      parkingLotMode: normalizeParkingLotMode(parsed.parkingLotMode),
    }
  } catch {
    return { ...DEFAULT_TODO_PREFS }
  }
}

function emit() {
  for (const listener of listeners) listener()
}

export function getTodoPrefs(): TodoPrefs {
  if (typeof window !== "undefined" && !readAliasedLocal(TODO_PREFS_KEY)) {
    const same =
      snapshot.availableNow === DEFAULT_TODO_PREFS.availableNow &&
      snapshot.wipLimit === DEFAULT_TODO_PREFS.wipLimit &&
      snapshot.lidCollapsed.flags === false &&
      snapshot.lidCollapsed.time === false &&
      snapshot.lidCollapsed.steps === false &&
      snapshot.ritesFollowSun === DEFAULT_TODO_PREFS.ritesFollowSun &&
      snapshot.defaultEstimateMin === DEFAULT_TODO_PREFS.defaultEstimateMin &&
      Object.keys(snapshot.paceOverrides).length === 0 &&
      snapshot.paceGhosts === DEFAULT_TODO_PREFS.paceGhosts &&
      snapshot.sessionPadded === DEFAULT_TODO_PREFS.sessionPadded &&
      snapshot.hideLocked === DEFAULT_TODO_PREFS.hideLocked &&
      snapshot.showNextOnly === DEFAULT_TODO_PREFS.showNextOnly &&
      snapshot.tierView === DEFAULT_TODO_PREFS.tierView &&
      snapshot.titleBase === DEFAULT_TODO_PREFS.titleBase &&
      Object.keys(snapshot.titleByView).length === 0 &&
      snapshot.ranges.length === 0 &&
      snapshot.activeRangeId === null &&
      snapshot.formulas.length === 0 &&
      snapshot.showMath === false &&
      snapshot.showAllTasks === false &&
      snapshot.statusFilter === DEFAULT_TODO_PREFS.statusFilter &&
      snapshot.sortMode === DEFAULT_TODO_PREFS.sortMode &&
      snapshot.sortOrder === DEFAULT_TODO_PREFS.sortOrder &&
      snapshot.loadOpen === false &&
      snapshot.showTrayOpen === false &&
      snapshot.bgeTiers === false &&
      snapshot.parkingLotMode === "classic"
    if (!same) snapshot = { ...DEFAULT_TODO_PREFS }
  }
  return snapshot
}

export function setTodoPrefs(
  patch: Partial<Omit<TodoPrefs, "lidCollapsed">> & {
    lidCollapsed?: Partial<TodoPrefs["lidCollapsed"]>
  },
): void {
  snapshot = {
    availableNow: patch.availableNow ?? snapshot.availableNow,
    wipLimit: patch.wipLimit !== undefined ? clampWipLimit(patch.wipLimit) : snapshot.wipLimit,
    lidCollapsed: normalizeLidCollapsed({
      ...snapshot.lidCollapsed,
      ...(patch.lidCollapsed ?? {}),
    }),
    ritesFollowSun: patch.ritesFollowSun ?? snapshot.ritesFollowSun,
    defaultEstimateMin:
      patch.defaultEstimateMin !== undefined ? clampDefaultEstimate(patch.defaultEstimateMin) : snapshot.defaultEstimateMin,
    paceOverrides:
      patch.paceOverrides !== undefined ? normalizePaceOverrides(patch.paceOverrides) : snapshot.paceOverrides,
    paceGhosts: patch.paceGhosts ?? snapshot.paceGhosts,
    sessionPadded: patch.sessionPadded ?? snapshot.sessionPadded,
    hideLocked: patch.hideLocked ?? snapshot.hideLocked,
    showNextOnly: patch.showNextOnly ?? snapshot.showNextOnly,
    tierView: patch.tierView !== undefined ? normalizeTierView(patch.tierView) : snapshot.tierView,
    titleBase: patch.titleBase !== undefined ? normalizeTitleBase(patch.titleBase) : snapshot.titleBase,
    titleByView: patch.titleByView !== undefined ? normalizeTitleByView(patch.titleByView) : snapshot.titleByView,
    ranges: patch.ranges !== undefined ? normalizeRanges(patch.ranges) : snapshot.ranges,
    activeRangeId: patch.activeRangeId !== undefined ? patch.activeRangeId : snapshot.activeRangeId,
    formulas: patch.formulas !== undefined ? normalizeFormulas(patch.formulas) : snapshot.formulas,
    showMath: patch.showMath ?? snapshot.showMath,
    showAllTasks: patch.showAllTasks ?? snapshot.showAllTasks,
    statusFilter: patch.statusFilter !== undefined ? normalizeStatusFilter(patch.statusFilter) : snapshot.statusFilter,
    sortMode: patch.sortMode !== undefined ? normalizeSortMode(patch.sortMode) : snapshot.sortMode,
    sortOrder: patch.sortOrder === "asc" || patch.sortOrder === "desc" ? patch.sortOrder : snapshot.sortOrder,
    loadOpen: patch.loadOpen ?? snapshot.loadOpen,
    showTrayOpen: patch.showTrayOpen ?? snapshot.showTrayOpen,
    bgeTiers: patch.bgeTiers ?? snapshot.bgeTiers,
    parkingLotMode: patch.parkingLotMode !== undefined ? normalizeParkingLotMode(patch.parkingLotMode) : snapshot.parkingLotMode,
  }
  try {
    writeAliasedLocal(TODO_PREFS_KEY, JSON.stringify(snapshot))
  } catch {
    /* private mode — prefs still apply for this session */
  }
  emit()
}

export function subscribeTodoPrefs(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTodoPrefs(): TodoPrefs {
  return useSyncExternalStore(subscribeTodoPrefs, getTodoPrefs, () => DEFAULT_TODO_PREFS)
}

/** Tests: re-read after `localStorage.clear()`. */
export function resetTodoPrefsForTests(): void {
  snapshot = load()
  emit()
}
