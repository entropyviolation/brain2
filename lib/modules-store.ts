/**
 * lib/modules-store.ts — User-composed "Modules" dashboard
 *
 * Persists the user's pinned modules: small, configurable widgets that draw on
 * data from across the app (especially Lists) and present it in a chosen way —
 * a reading-list explorer, a writing-assignment generator, a cleaning picker, a
 * list summary, or an analytics stat. Each module is `{ id, type, title,
 * config }`; the Modules panel renders them and lets the user add/remove/
 * reconfigure.
 *
 * Storage: localStorage today; target MongoDB `modules` collection (§3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SheetViewConfig } from "@/lib/spreadsheet-contract"

export type ModuleType =
  | "list-explorer"
  | "writing-prompt"
  | "list-summary"
  | "analytics-stat"
  | "random-task"
  | "rules"
  | "workspace"

/**
 * A "workspace" module is a full-screen mini-app the user composes from their
 * own lists/items. It bundles one or more bound **views** (each a way of seeing
 * a list: editable grid, checklist, agenda, rollup summary, gamified randomizer,
 * focus timer, headline stat, gallery, or notes). This is the platform behind
 * user-built modules like an Itinerary Creator, Cleaning system, or Budget.
 */
export type ModuleViewKind =
  | "spreadsheet"
  | "checklist"
  | "agenda"
  | "summary"
  | "randomizer"
  | "timer"
  | "stat"
  | "gallery"
  | "notes"
  | "decision-matrix"
  | "kanban"
  // ---- Workstream E specialized kinds --------------------------------------
  /** Batch-link items from a source list to candidates in another list. */
  | "matcher"
  /** A "taste it" guessing game over a source list's extracted text. */
  | "quiz"
  /** Summary cards binding multiple lists with optional-inclusion rollups. */
  | "dashboard"
  /** Day-by-day dated view of confirmed items (flights & activities). */
  | "timeline"

/**
 * A weighted criterion for the `decision-matrix` view. Each criterion binds to a
 * numeric list attribute (`attrId`) and carries a relative `weight` and a
 * direction (`benefit`: higher-is-better vs. lower-is-better cost). Stored on the
 * view config so the matrix is self-describing and editable without code.
 */
export interface DecisionCriterion {
  /** AttributeDefinition.id supplying each option's value for this criterion. */
  attrId: string
  /** Relative importance; values ≤ 0 are ignored when scoring. */
  weight: number
  /** true (default) = higher is better; false = lower is better (a cost). */
  benefit?: boolean
}

/** Aggregation applied by a `dashboard` card over its numeric column. */
export type DashboardAggFn = "sum" | "avg" | "min" | "max" | "count"

/**
 * One headline card on a `dashboard` view. Rolls up a numeric attribute over a
 * source list, optionally gated by an "include in calculation" boolean column,
 * and may subtract a second list's rollup (e.g. assets − debts → net worth).
 */
export interface DashboardCard {
  id: string
  label: string
  /** Source list whose rows feed this card. */
  categoryId: string
  /** Numeric attribute id aggregated for the headline figure. */
  attrId: string
  /** How to aggregate (default "sum"). */
  fn?: DashboardAggFn
  /** Optional boolean attribute gating which rows count (optional inclusion). */
  includeAttrId?: string
  /** Optional unit/currency hint when the attribute carries none. */
  unit?: string
  /** Optional second-list rollup subtracted from this card (net-worth style). */
  subtract?: { categoryId: string; attrId: string; includeAttrId?: string }
}

export interface ModuleViewConfig {
  /** Source list (category) the view reads/writes. */
  categoryId?: string
  /** Optional attribute equality filter (e.g. Type = "Finalized"). */
  filterAttrId?: string
  filterValue?: string
  /** summary: group rows by this attribute, optionally summing `valueAttrId`. */
  groupAttrId?: string
  valueAttrId?: string
  /** agenda: order/group items by this date attribute. */
  dateAttrId?: string
  /** randomizer: how many items to surface; framing verb; optional countdown. */
  pickCount?: number
  framing?: string
  /** timer / randomizer countdown length in minutes. */
  timerMinutes?: number
  /** stat: which analytics stat to show. */
  stat?: string
  /** notes: localStorage key holding the free text. */
  notesKey?: string
  /** decision-matrix: weighted criteria (each bound to a numeric attribute). */
  criteria?: DecisionCriterion[]
  /** kanban: selection/status attribute whose values become the board columns. */
  statusAttrId?: string
  /** spreadsheet: persisted sort / filter / freeze / column-width state. */
  sheetConfig?: SheetViewConfig
  /** timeline: optional time attribute used to order items within a day. */
  timeAttrId?: string
  // ---- matcher ----
  /** matcher: candidate list whose items the source rows are linked to. */
  matchTargetCategoryId?: string
  /** matcher / quiz: attribute holding the text (or file) to match / quiz on. */
  matchTextAttrId?: string
  /** matcher: link relation written onto a source item when a match is chosen. */
  linkRelation?: string
  /** matcher: 0–1 confidence below which a source row is flagged "unmatched". */
  matchThreshold?: number
  // ---- quiz ----
  /** quiz: list supplying the prompt/source items (e.g. PDFs). */
  quizSourceCategoryId?: string
  /** quiz / matcher: file attribute whose `extractedText` is the prompt body. */
  fileAttrId?: string
  /** quiz: number of multiple-choice options to present (default 4). */
  quizChoiceCount?: number
  // ---- dashboard ----
  /** dashboard: headline cards, each an optional-inclusion rollup over a list. */
  cards?: DashboardCard[]
}

export interface ModuleView {
  id: string
  title: string
  kind: ModuleViewKind
  config: ModuleViewConfig
}

// A single cause→effect rule evaluated against an item's attribute value.
export type RuleOperator = ">" | ">=" | "<" | "<=" | "=" | "contains" | "is empty" | "is set"

export interface AttrRule {
  id: string
  attrId: string // AttributeDefinition.id to test
  op: RuleOperator
  value?: string // comparison value (number/text as string)
  label: string // shown when the rule matches (the "effect")
  color: string // badge color
}

export interface ModuleConfig {
  categoryId?: string // for list-explorer / list-summary / random-task / writing-prompt / rules source
  stat?: string // for analytics-stat
  framing?: string // optional verb/label, e.g. "Clean", "Read"
  pickCount?: number // list-explorer: how many random items to surface (default 1)
  rules?: AttrRule[] // for the rules module
}

export interface ModuleInstance {
  id: string
  type: ModuleType
  title: string
  config: ModuleConfig
  // ---- Workspace ("mini-app") fields. Absent ⇒ classic dashboard widget. ----
  /** "widget" (a single card) or "workspace" (a full-screen multi-view app). */
  kind?: "widget" | "workspace"
  /** Custom icon (orb path or data URL). */
  icon?: string
  description?: string
  /** Template this workspace was created from (e.g. "itinerary"). */
  templateId?: string
  /** Bound views shown as tabs in the workspace. */
  views?: ModuleView[]
  /** Show a print/export action in the workspace header. */
  enablePrint?: boolean
  /** Push finalized, dated items from a source list into the Plan (day text). */
  planSync?: {
    categoryId: string
    /** datetime attribute that places the item on a day. */
    dateAttrId: string
    /** optional status attribute + value gating which items sync (e.g. Finalized). */
    statusAttrId?: string
    statusValue?: string
  }
  /**
   * Push finalized/confirmed dated items onto the global timeline by writing
   * `Task.scheduledDate`/`scheduledTime` and (optionally) a `CalendarEvent`.
   * See `lib/module-schedule-sync.ts`.
   */
  scheduleSync?: {
    categoryId: string
    /** datetime attribute that places the item on a day. */
    dateAttrId: string
    /** optional time-of-day attribute (datetime/time) for the scheduled time. */
    timeAttrId?: string
    /** optional status attribute + value gating which items sync (e.g. Finalized). */
    statusAttrId?: string
    statusValue?: string
    /** optional boolean attribute requiring the item be "booked"/confirmed. */
    bookedAttrId?: string
    /** also mirror each synced item into a CalendarEvent (default true). */
    toEvents?: boolean
  }
}

interface ModulesState {
  modules: ModuleInstance[]
  addModule: (m: Omit<ModuleInstance, "id">) => void
  /** Add a fully-formed instance (templates supply their own id). */
  addModuleInstance: (m: ModuleInstance) => void
  removeModule: (id: string) => void
  updateModule: (id: string, patch: Partial<ModuleInstance>) => void
}

const defaultModules = (): ModuleInstance[] => [
  { id: "mod-points", type: "analytics-stat", title: "Points this week", config: { stat: "points-week" } },
  { id: "mod-write", type: "writing-prompt", title: "Writing Assignment Generator", config: {} },
  { id: "mod-random", type: "random-task", title: "What should I do now?", config: {} },
]

export const useModulesStore = create<ModulesState>()(
  persist(
    (set) => ({
      modules: defaultModules(),
      addModule: (m) => set((state) => ({ modules: [...state.modules, { ...m, id: `mod-${Date.now()}` }] })),
      addModuleInstance: (m) =>
        set((state) => (state.modules.some((x) => x.id === m.id) ? state : { modules: [...state.modules, m] })),
      removeModule: (id) => set((state) => ({ modules: state.modules.filter((m) => m.id !== id) })),
      updateModule: (id, patch) =>
        set((state) => ({ modules: state.modules.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
    }),
    {
      name: "cogs-modules-store",
      // v2: additive specialized view kinds (matcher/quiz/dashboard/timeline)
      // and optional view-config / scheduleSync fields. All new fields are
      // optional, so persisted v1 state is already valid — no-op migration.
      version: 2,
      migrate: (persisted) => persisted as ModulesState,
    },
  ),
)
