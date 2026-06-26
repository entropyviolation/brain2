/**
 * lib/types.ts — Shared data-model types
 *
 * The single source of TypeScript interfaces/enums used across COGS: tasks,
 * to-do items, calendar events, plans, categories/folders, weekly-habit types,
 * scheduling, and review records.
 *
 * Spec: this is where the unified "Item" model (spec §5) will converge. The
 * current `Task` interface intentionally still carries v1's near-duplicate fields
 * (`category` vs `categories`, `entropy` vs `cognitiveLoad`, `context` vs future
 * tags) — see docs/SPEC_MAPPING.md §5 for the planned consolidation. Types map
 * to MongoDB document shapes (flexible `attributes`, `links`, embedded subdocs).
 */
/**
 * Unified Item model (spec §5). Every domain entity is an `Item` with a `type`
 * discriminator and the second-brain primitives `tags` + `links`. `attributes`
 * carry flexible, schema-driven fields. Concrete built-in subtypes (e.g. `Task`)
 * extend this.
 *
 * Design notes (per project owner):
 *   - `type` is the foundational concept. Built-in types ship today ("task");
 *     users will define their own ("Book", "Friend", …) via `ItemTypeDefinition`,
 *     each with its own attributes/defaults/capabilities. This is what makes COGS
 *     behave like a second brain.
 *   - An item also *belongs to* one or more **categories** (lists) and inherits
 *     that list's attribute schema + default values (see `List`).
 *     Type-level and category-level attributes compose.
 *   - There is intentionally NO core `status` field. A task's lifecycle bucket
 *     stays on `Task.stage` (built-in task behavior). A generalized status,
 *     if ever needed, is modeled as a per-type attribute — not a core Item field.
 *   - `entropy` (0-1, display) and `cognitiveLoad` (1-3, feeds the priority
 *     formula) are distinct fields and are intentionally NOT merged.
 *
 * During the v1→v2 migration the new base fields are optional so existing data
 * and literals keep compiling; the store migration backfills them. See
 * docs/SPEC_MAPPING.md §5.
 */
// Type-only import (erased at compile time → no runtime dependency / import
// cycle). `lib/modules-store.ts` does not import this file, so this is safe and
// lets `ModuleDefinition` reuse the existing module view + plan-sync shapes.
import type { ModuleView, ModuleInstance } from "@/lib/modules-store"

/** Built-in item types. User-defined types are arbitrary ids (kept open). */
export type BuiltinItemType = "task" | "habit" | "event" | "goal" | "note"
export type ItemType = BuiltinItemType | (string & {})

/**
 * Stance a (typically source→belief) link expresses, on a five-level spectrum
 * (Brain2 second-brain model). Used to weight belief strength. (Worker E.)
 */
export type LinkStance =
  | "strong-support"
  | "weak-support"
  | "none"
  | "weak-refute"
  | "strong-refute"

export interface ItemLink {
  id: string
  /** Typed relation, e.g. "blocks", "supports", "reviews", "checklist-of". */
  relation: string
  /** Id of the linked item/entity. */
  targetId: string
  /** Optional support/refute stance (second-brain belief graph). */
  stance?: LinkStance
  /** Optional numeric weight for the relation (0-1), e.g. relation certainty. */
  weight?: number
}

/**
 * Defines an item *type* (built-in like "task", or user-created like "Book"):
 * the attributes every item of the type carries, default values, and built-in
 * capability flags. The extensibility seam for the second-brain model — type-
 * level attributes compose with the category (list) attributes an item inherits.
 */
/** Behavioral capabilities a type enables. Built-in flags drive UI/automation. */
export interface ItemTypeCapabilities {
  /** Can be surfaced/placed in the Scheduler. */
  scheduleable?: boolean
  /** Participates in the Next Actions workflow. */
  nextActions?: boolean
  /** Awards points on completion. */
  points?: boolean
  /** Carries an estimated/actual duration. */
  duration?: boolean
  /** Carries a deadline/due date. */
  deadline?: boolean
  /** Supports nested subtasks/checklist. */
  subtasks?: boolean
  /** Can be marked complete. */
  completable?: boolean
  /** Supports recurrence/repetition. */
  recurring?: boolean
}

/** When a rule is evaluated against an item. */
export type ItemRuleTrigger = "create" | "update" | "complete" | "schedule" | "validate"

/** Comparison operators for a rule condition (kept serializable + portable). */
export type ItemRuleOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "exists"
  | "empty"

/**
 * A condition over an item's attribute (by id) or a built-in field name.
 * Serializable so rules can be authored in the UI and ported across apps.
 */
export interface ItemRuleCondition {
  /** Attribute id, or a built-in field like "title"/"completed". */
  field: string
  operator: ItemRuleOperator
  value?: AttributeValue
}

/**
 * A declarative, serializable action. Adding a new behavior = adding a variant
 * here plus a handler where rules are applied (see lib/item-types.ts).
 */
export type ItemRuleAction =
  | { kind: "require"; field: string; message?: string }
  | { kind: "block"; message: string }
  | { kind: "setDefault"; field: string; value: AttributeValue }
  | { kind: "setAttribute"; field: string; value: AttributeValue }
  | { kind: "addTag"; tag: string }
  | { kind: "addToNextActions" }

/** A declarative rule: optionally gated by `when`, runs an `action` on `trigger`. */
export interface ItemTypeRule {
  id: string
  name: string
  trigger: ItemRuleTrigger
  when?: ItemRuleCondition
  action: ItemRuleAction
  enabled?: boolean
}

/**
 * Defines an item *type* — a named category of items with associated attributes,
 * rules, and behaviors. The extensibility seam for the second-brain model:
 * "task" ships built-in; users define their own ("Book", "Friend", …). Designed
 * to be flexible and portable across applications (fully serializable).
 *
 * Composition: an item's *effective* attribute schema is its type's `attributes`
 * unioned with the attributes of every category (list) it belongs to. Defaults
 * compose the same way (type defaults first, then category defaults).
 */
export interface ItemTypeDefinition {
  id: ItemType
  name: string
  /** Plural display label, e.g. "Books". Defaults to `name`. */
  pluralName?: string
  /** Singular label for one item, e.g. "book". Defaults to lowercased `name`. */
  itemLabel?: string
  description?: string
  /** Custom icon (orb path or data URL). */
  icon?: string
  color?: string
  /** Built-in types ship with the app and cannot be deleted. */
  builtin?: boolean
  /** When set, this type inherits attributes, defaults, capabilities, and rules from the parent. */
  parentTypeId?: ItemType
  /** Attribute schema for items of this type (composes with category attrs). */
  attributes?: AttributeDefinition[]
  /** Default attribute values applied to new items of this type. */
  defaultAttributeValues?: Record<string, AttributeValue>
  /** Attribute ids surfaced in compact/table displays (defaults to all). */
  displayedAttributes?: string[]
  /** Tabs shown in the item-detail view for items of this type. */
  detailPanels?: ItemDetailPanel[]
  /** Behavioral capability flags this type enables. */
  capabilities?: ItemTypeCapabilities
  /** Declarative validation/automation rules. */
  rules?: ItemTypeRule[]
}

export interface Item {
  id: string
  /** Type discriminator. Defaults to "task" during migration. */
  type?: ItemType
  /** Canonical display label. Mirrors `Task.description` during transition. */
  title?: string
  createdAt: Date
  /** Free-form tags (spec §5) — e.g. "to schedule". */
  tags?: string[]
  /** Typed relationships to other items (spec §5). */
  links?: ItemLink[]
  /** Flexible, schema-driven attributes keyed by AttributeDefinition.id. */
  attributes?: Record<string, AttributeValue>
  /**
   * Attribute schema that applies only to this item (not shared with its lists).
   * Values live in `attributes`; definitions here drive typed editors and labels.
   */
  itemAttributeDefinitions?: AttributeDefinition[]
  /** Rich-text / markdown body for document-type items (Feature 4, Worker D). */
  body?: string
}

/**
 * A subtask / checklist step of a Task. Brain2 "molecular decomposition":
 * `isMolecular` marks an atomic step that cannot be split further; `context`
 * carries the background needed to understand the step out of its list context.
 */
export interface Subtask {
  id: string
  description: string
  completed: boolean
  /** Atomic step that should not be decomposed further. */
  isMolecular?: boolean
  /** Self-contained background so the step reads correctly out of context. */
  context?: string
}

/**
 * Tunable weights for the transparent To-Do priority formula (Brain2 #46).
 * Higher weight = more influence on the computed rank.
 */
export interface PriorityWeights {
  urgency: number
  importance: number
  cognitiveLoad: number
  entropy: number
}

// ---- Richer completion status (Feature 9, Worker I) -----------------------
export type CompletionStatus = "active" | "done" | "partial" | "deferred" | "cancelled"

export interface Task extends Item {
  id: string
  description: string
  // Built-in task lifecycle bucket (inbox → clarified → scheduled → completed,
  // or "list" for plain list items). Task-type behavior, not a core Item concept.
  // Historically named `category`; renamed to `stage` in the category→list
  // migration to disambiguate from list membership (`lists`).
  stage: "inbox" | "clarified" | "scheduled" | "completed" | "list"
  createdAt: Date
  completed: boolean
  /**
   * When the task last transitioned to completed. Stamped centrally by the task
   * store on every completion path so "Done today/this week/this month" lists
   * bucket by *when it was finished* (not when it was scheduled/created). Cleared
   * when a task is re-opened.
   */
  completedDate?: Date
  /**
   * Richer completion status (Feature 9, Worker I). Invariant:
   * `status === "done"` ⇔ `completed === true`; helpers in
   * `lib/completion-status.ts` keep the two in sync.
   */
  status?: CompletionStatus
  lists: string[] // ids of the lists this task belongs to; attrs inherited
  // ---- Next-actions / scheduling fields (optional; only meaningful for items
  // in the Next Actions folder tree — see lib/item-utils.ts) ----------------
  estimatedDuration?: number // minutes
  actualDuration?: number // minutes - set when task is completed
  cognitiveLoad?: number // 1-3
  urgency?: number // 1-5
  importance?: number // 1-5
  dependencies?: string[] // task IDs
  context?: string // @home, @work, etc.
  entropy?: number // 0-1
  rewardValue?: number
  allowPartialCompletion?: boolean
  minimumChunkSize?: number // minimum minutes for partial completion
  /** Per-item override: show in Scheduler when true; hide when false. */
  scheduleable?: boolean
  deadline?: Date // Optional deadline
  why?: string // Why this task needs to be done
  consequences?: string // What happens if not done
  scheduledDate?: Date // When task is scheduled
  scheduledTime?: string // Time of day if scheduled
  scheduledWeek?: string // Week range (e.g., "2024-05-19_2024-05-25")
  scheduledMonth?: string // Month (e.g., "2024-05")
  scheduledYear?: string // Year (e.g., "2024")
  /** How many times this task was pushed forward in the To-Do day/week/month views. */
  daysPushed?: number
  weeksPushed?: number
  monthsPushed?: number
  /** Hide from To-Do lists without marking complete. */
  hiddenFromTodo?: boolean
  notes?: string // Additional notes
  parentTaskId?: string // For subtasks
  subtasks?: Subtask[] // Array of subtask objects
  // ---- Brain2 additions (see docs/brain2_features_roadmap.md §2) ----
  /** Gantt: a "summary"/rollup task that completes when its children do. */
  isSummary?: boolean
  /** Concurrency map: tasks sharing a group can run in parallel. */
  parallelGroup?: string
  /** "Tricky step" flag — likely to go wrong; attach a helper checklist. */
  riskFlag?: boolean
  /** PERT three-point estimate (minutes). Coexists with estimatedDuration. */
  pertEstimate?: { optimistic: number; likely: number; pessimistic: number }
  /** Perfectionism guardrail: an explicit "good enough" definition of done. */
  definitionOfDone?: string
  /** Post-mortem captured when this task was completed (spec §13.7). */
  completionReview?: TaskCompletionReview
  completedChunks?: { date: Date; duration: number; notes?: string }[] // track partial completions
  // New fields
  taskDescription?: string // Optional detailed description
  // Scheduling constraints
  schedulingConstraints?: {
    canOnlyBeDoneAt?: string[] // specific times like ["09:00", "14:00"]
    canOnlyBeDoneOnDays?: string[] // specific days like ["monday", "wednesday"]
    canOnlyBeDoneOnDates?: Date[] // specific dates
    mustBeDoneAfter?: Date
    mustBeDoneBefore?: Date
    timeOfDayPreference?: "morning" | "afternoon" | "evening" | "night"
    dayConstraints?: string // free-form text for day constraints
  }
  // Repeated task settings
  isRepeated?: boolean
  repeatSettings?: {
    type: "count" | "frequency"
    totalCount?: number // must be completed X times total
    frequency?: {
      times: number // X times per period
      period: "day" | "week" | "month"
    }
    completedCount?: number // how many times completed so far
  }
  // Optional custom icon (orb path under /orbs-removebackground or a data URL
  // from the user's uploaded icon library). Used by the Lists "File Manager".
  icon?: string
  // Flexible, list-driven attributes (spec §5). Keyed by AttributeDefinition.id.
  attributes?: Record<string, AttributeValue>
  /** Logged actual time segments (distinct from estimatedDuration plan). */
  timeLogs?: TimeLogEntry[]
  // ---- Objective / goal contribution (redesigned Goals layer) -------------
  /** Objectives this task contributes to (earns stacking point multipliers). */
  contributesToObjectiveIds?: string[]
  /** Goals this task contributes to (increments their tracked value). */
  contributesToGoalIds?: string[]
}

export interface TimeLogEntry {
  id: string
  date: string // YYYY-MM-DD
  startTime?: string // HH:mm
  endTime?: string
  durationMinutes: number
  notes?: string
  taskId?: string
  location?: string
  activityLabel?: string
}

/**
 * Flexible per-item attributes (spec §5: unified Item model). A list can define
 * an attribute schema (`List.itemAttributes`); items store concrete
 * values in `Task.attributes` keyed by the attribute id. Values are kept as
 * primitives so they serialize cleanly alongside the rest of the task store.
 */
export type AttributeType =
  | "string"
  | "boolean"
  | "color"
  | "datetime"
  | "list"
  | "multistring"
  | "number"
  | "selection"
  | "image"
  | "multiimage"
  | "file" // a single attached file (FileValue); uri holds a data URL today
  | "multifile" // multiple attached files (FileValue[])
  | "item"
  | "link"
  | "goal" // an x / y progress value with custom labels (e.g. actual / goal)
  | "formula" // computed cell from an expression over other attributes (Feature 5, Worker E)

export type BooleanDisplay = "checkbox" | "switch"

export interface AttributeDefinition {
  id: string
  name: string
  type: AttributeType
  /** Manual options for selection-type attributes. */
  options?: string[]
  unit?: string // optional display unit/suffix (e.g. "$", "min")
  labels?: { current?: string; target?: string } // for goal
  /** For formula attributes (Feature 5): the expression, e.g. "=price*qty". */
  formula?: string
  /** For formula attributes: how to format the computed result. */
  formatAs?: "number" | "currency" | "percent"
  /** For list/item: optional category scope for references. */
  refListId?: string
  /** boolean: render as checkbox or toggle switch. */
  booleanDisplay?: BooleanDisplay
  /** number: allow decimal values when true. */
  allowFloat?: boolean
  /** selection / multistring: allow picking or storing multiple values. */
  allowMultiple?: boolean
  /** selection: where option choices come from. */
  optionSource?: "manual" | "list"
  /** selection with optionSource "list": category id whose items supply options. */
  optionListId?: string
  /** datetime: date-only, time-only, or full datetime input. */
  datetimeMode?: "date" | "time" | "datetime"
}

export interface GoalValue {
  current: number
  target: number
}

/**
 * An attached file value for `"file"` / `"multifile"` attributes.
 *
 * `uri` holds a data URL today (inline, localStorage-friendly). The field is
 * intentionally generic so a future Electron file-store can reuse it for an
 * on-disk path or blob reference without changing the shape — only how `uri`
 * is resolved. `extractedText` is optional indexed/searchable text.
 */
export interface FileValue {
  id: string
  name: string
  mime: string
  /** Data URL today; future Electron file-store path / blobRef reuses this field. */
  uri: string
  size?: number
  extractedText?: string
}

export type AttributeValue =
  | string
  | number
  | boolean
  | string[]
  | GoalValue
  | FileValue
  | FileValue[]
  | null
  | undefined

// To-do tracking system
export interface TodoItem {
  id: string
  description: string
  tier: "A+" | "A" | "A/B" | "B" | "C" | "D"
  scheduledDate: Date | null
  createdDate: Date
  daysOverdue: number
  weeksOverdue: number
  monthsOverdue: number
  daysPushed: number
  weeksPushed: number
  monthsPushed: number
  hiddenFromTodo?: boolean
  completed: boolean
  taskId?: string // Reference to main task if applicable
  estimatedDuration?: number // minutes
  rewardValue?: number
  // Mirror of the Scheduler's coarser scheduling fields so the To-Do tabs can
  // surface tasks scheduled at week/month/year granularity (not just by date).
  scheduledWeek?: string
  scheduledMonth?: string
  scheduledYear?: string
}

// Calendar event for planning
export interface CalendarEvent {
  id: string
  title: string
  startTime: string // "09:00"
  endTime: string // "10:00"
  date: Date
  endDate?: Date
  type: "event" | "task" | "hardcoded"
  taskId?: string
  color?: string
  isScheduled: boolean
  estimatedDuration?: number
  rewardValue?: number
  isAllDay?: boolean
  location?: string
  description?: string
}

// Day plan text
export interface DayPlan {
  date: string // YYYY-MM-DD
  planText: string
  lastUpdated: Date
}

// Monthly deadline/reminder
export interface MonthlyItem {
  id: string
  title: string
  date: Date
  type: "deadline" | "reminder"
  description?: string
  color?: string
}

// Weekly task tracker types
export enum TaskType {
  BOOLEAN = "BOOLEAN",
  GOAL = "GOAL",
  TIME = "TIME", // legacy — treated as GOAL
  COUNT = "COUNT", // legacy — treated as GOAL
  TEXT = "TEXT",
  INCREMENTAL = "INCREMENTAL",
}

export type HabitFrequency = "daily" | "weekly" | "monthly"

export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"

export interface Category {
  id: string
  name: string
  color: string
}

export interface WeeklyTask {
  id: string
  name: string
  type: TaskType
  goal?: number
  unit?: string
  categoryId?: string // deprecated — kept for data compat
  rewardValue?: number
  frequency?: HabitFrequency // default daily
  incrementalData?: {
    currentValues: Record<string, number>
    weeklyIncrement: Record<string, number>
  }
}

export interface TaskCompletion {
  completed?: boolean
  value?: number
  goal?: number
  text?: string
  incrementalValues?: Record<string, number>
}

// Updated to use date strings as keys instead of day names
export interface WeeklyData {
  [dateString: string]: {
    [taskId: string]: TaskCompletion
  }
}

// Custom graph types
export interface GraphNode {
  id: string
  task: Task
  position: {
    x: number
    y: number
  }
  isOnCriticalPath: boolean
  isSelected: boolean
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  isOnCriticalPath: boolean
}

// Custom user lists (shown as "Lists" in the UI). Historically named
// `TaskCategory`; renamed to `List` in the category→list migration.
export interface List {
  id: string
  name: string
  color: string
  description?: string
  createdAt: Date
  order?: number // for custom ordering
  /** Parent list for nested lists / sublists (Feature 8, Worker H). */
  parentListId?: string
  // When true (default), items in this list are surfaced in the Scheduler.
  scheduleable?: boolean
  // Optional custom icon (orb path or uploaded data URL) for the Lists view.
  icon?: string
  /**
   * Item *type* for items in this list (e.g. "book"). Items created here adopt
   * this type and inherit its attributes/defaults/rules; the list can then layer
   * its own list-specific attributes (`itemAttributes`) and overrides on top.
   */
  itemTypeId?: ItemType
  // Optional attribute schema applied to items in this list (spec §5). Items
  // belonging to multiple lists get the union of their lists' attributes. When
  // the list has an `itemTypeId`, these are layered on top of the type's own
  // attributes (list-specific extras, e.g. "Recommended by" on a reading list).
  itemAttributes?: AttributeDefinition[]
  /** Default attribute values applied when new items are added to this list. */
  defaultAttributeValues?: Record<string, AttributeValue>
  /** Attribute ids shown in the list table view (defaults to all itemAttributes). */
  displayedAttributes?: string[]
  /**
   * Which display modes are *offered* (selectable via the toolbar) for this
   * list. Undefined = all modes offered (backwards-compatible default).
   */
  enabledDisplays?: ListDisplayMode[]
  /**
   * List-scoped automation/validation rules. These compose with the item type's
   * rules and apply to an item across *all* its lists (e.g. on a "Books to Buy"
   * list: when purchased = true, set owned = true).
   */
  rules?: ItemTypeRule[]
  /** Singular label for items in this list (e.g. book, habit). Next Actions defaults to "task". */
  itemLabel?: string
  /** Tabs shown in item detail view for items in this list. */
  detailPanels?: ItemDetailPanel[]
}

export type ItemDetailPanel =
  | "details"
  | "scheduling"
  | "dependencies"
  | "subtasks"
  | "analysis"
  | "time"
  | "body"

/**
 * The presentation modes the Lists "File Manager" can render a list's contents
 * in. Canonical definition lives here so it can be referenced on the data model
 * (`List.enabledDisplays`); `lib/lists-ui-store.ts` re-exports it as
 * `ListDisplay` for its UI-only "active display" preference.
 */
export type ListDisplayMode = "default" | "checklist" | "table" | "icons" | "spreadsheet" | "kanban"

// ===========================================================================
// Objectives & Goals (redesigned)
// ===========================================================================
//
// Objectives are *all-time, aspirational life directions* — qualitative, with
// no inherent target or deadline (e.g. "Read a lot", "Be healthy"). They can be
// **prioritized** for a given period (day/week/month/year), which carries a
// user-set points multiplier on contributing actions.
//
// Goals are *quantifiable metrics* over a period that move you toward one or
// more Objectives (no goal without an objective) — e.g. "Read 20 books this
// year". Tasks can contribute to goals (incrementing their value) and/or
// objectives (earning stacking point multipliers).

/** Periods an objective can be prioritized for (and reviewed against). */
export type PriorityPeriod = "day" | "week" | "month" | "year"

/**
 * A period-scoped prioritization of an objective. While the current date falls
 * within `period`/`periodKey`, contributing actions earn `multiplier`× points.
 */
export interface ObjectivePriority {
  period: PriorityPeriod
  /** day=YYYY-MM-DD, week=getWeekString, month=YYYY-MM, year=YYYY. */
  periodKey: string
  /** User-set points multiplier for actions serving this objective this period. */
  multiplier: number
}

/** A written end-of-period analysis of progress on one objective. */
export interface ObjectiveReview {
  /** `${period}:${periodKey}`. */
  id: string
  period: PriorityPeriod
  periodKey: string
  /** Free-text analysis of success in furthering this objective. */
  summary: string
  completedAt: Date
}

export interface Objective {
  id: string
  title: string
  description?: string
  /** Optional icon (orb path or data URL) / accent color. */
  icon?: string
  color?: string
  /** Period prioritizations with custom point multipliers. */
  priorities?: ObjectivePriority[]
  /** End-of-period written reviews of this objective. */
  reviews?: ObjectiveReview[]
  /** Hidden from the active list without deleting. */
  archived?: boolean
  createdAt: Date
}

/** How a goal's time horizon is expressed. */
export type GoalPeriodKind = "day" | "week" | "month" | "year" | "custom" | "aspirational"

export interface Goal {
  id: string
  title: string
  description?: string
  type: "numerical" | "boolean" | "count"
  target: number
  current: number
  /** Display unit for numerical/count goals (e.g. "books", "pages"). */
  unit?: string
  /** Time horizon kind. "custom" uses startDate/endDate + periodLabel. */
  periodKind: GoalPeriodKind
  /** Free-form label for custom ranges, e.g. "while in South America". */
  periodLabel?: string
  startDate?: Date
  endDate?: Date
  /** Objectives this goal moves toward. Required: a goal always serves ≥1. */
  objectiveIds: string[]
  points: number
  deadline?: Date
  completed: boolean
  createdAt: Date
}

// Scheduling types
export type SchedulePeriod = "always" | "year" | "month" | "week" | "day"

export interface ScheduleBox {
  id: string
  label: string
  period: SchedulePeriod
  date?: Date
  tasks: string[] // task IDs
}

// Task completion review
export interface TaskCompletionReview {
  taskId: string
  completedAt: Date
  actualDuration: number
  satisfaction: number // 1-10
  resistance: number // 1-10
  focus: number // 1-10
  distraction: number // 1-10
  notes?: string
}

// Hard-coded events for day planning
export interface DayEvent {
  id: string
  title: string
  startTime: string // "09:00"
  endTime: string // "10:00"
  date: Date
  type: "event" | "task"
  taskId?: string // if type is "task"
  color?: string
}

// Folders that nest "Lists" in the UI. Historically named `CategoryFolder`;
// renamed to `Folder` in the category→list migration.
// Folders carry default settings that new lists created inside them inherit.
export interface Folder {
  id: string
  name: string
  createdAt: Date
  listIds: string[] // ids of the lists in this folder
  /** Nested folder support (subfolder of another folder). */
  parentFolderId?: string
  color?: string
  description?: string
  // Default scheduleable value applied to lists created inside this folder.
  scheduleable?: boolean
  // Optional custom icon (orb path or uploaded data URL) for the Lists view.
  icon?: string
}

// ---- Period reviews (day / week / month / quarter / year) ----------------
export type ReviewPeriod = "day" | "week" | "month" | "quarter" | "year"

export interface PeriodReview {
  id: string // `${period}:${periodKey}`
  period: ReviewPeriod
  periodKey: string // day=YYYY-MM-DD, week=getWeekString, month=YYYY-MM, quarter=YYYY-Qn, year=YYYY
  completedAt: Date
  summary: string
  gratitude: string[]
  nextPlans: string
  planReflection?: string
  reflections: Record<string, string> // reflection question id -> answer
  // Snapshot of how the carried-over tasks were resolved during the review.
  resolvedTaskIds: string[] // marked done
  pushedTaskIds: string[] // pushed to the next period
  // ---- Morning review ritual (HM2) + structured blocked reasons (HM3), Worker G ----
  morning?: {
    wakeTime?: string
    dream?: string
    intentions?: string[]
    affirmations?: string[]
    postponedTaskIds?: string[]
  }
  /** Why each carried-over/skipped task was blocked, keyed by taskId. */
  blockedReasons?: Record<string, BlockedReason>
  /** Items created during the review (e.g. follow-ups spawned). */
  spawnedItemIds?: string[]
}

// ---- Structured "why blocked/skipped" reasons (HM3, Worker G) -------------
export type BlockedReason =
  | "no-energy"
  | "missing-input"
  | "procrastination"
  | "no-time"
  | "blocked-by-other"
  | "other"

// ===========================================================================
// Module platform — declarative module + workflow contract (Phase 0 seam)
// ===========================================================================
//
// The shared, serializable type contract for the flexible "Module platform":
// a `ModuleDefinition` binds one or more **lists** (categories) to **views**
// and **workflows**. These types are additive and forward-looking — the
// workflow engine, builder UI, and example modules are later workstreams. They
// deliberately reuse the existing item-rule primitives (`ItemRuleTrigger`,
// `ItemRuleCondition`, `ItemRuleAction`) and module view / plan-sync shapes so
// downstream agents build on one set of names.

/**
 * Binds a single list (category) into a module under a named `role` (e.g.
 * "items", "phases"), optionally pinning an item type and extending the list's
 * attribute schema with module-specific attributes.
 */
export interface ModuleListBinding {
  /** Logical role of this list within the module, e.g. "items" / "resources". */
  role: string
  /** Category (list) id this binding targets. */
  categoryId: string
  /** Optional item type pinned for items created in this list. */
  itemTypeId?: ItemType
  /** Module-specific attributes layered onto the list's schema (additive). */
  attributeExtensions?: AttributeDefinition[]
}

/** Plan-sync config (reuses the existing `ModuleInstance.planSync` shape). */
export type ModulePlanSync = NonNullable<ModuleInstance["planSync"]>

/**
 * A serializable definition of a composable module: bound lists, presentation
 * views, and declarative workflows. `views` reuses `ModuleView` and `planSync`
 * reuses the existing module plan-sync shape (both from `lib/modules-store.ts`,
 * imported type-only to avoid an import cycle).
 */
export interface ModuleDefinition {
  id: string
  name: string
  description?: string
  /** Custom icon (orb path or data URL). */
  icon?: string
  lists: ModuleListBinding[]
  /** Presentation views (reuses the existing `ModuleView` shape). */
  views: ModuleView[]
  workflows: WorkflowDefinition[]
  /** Push finalized, dated items from a source list into the Plan. */
  planSync?: ModulePlanSync
  /** Show a print/export action in the module workspace header. */
  enablePrint?: boolean
}

/**
 * When a workflow fires. Builds on the item-rule trigger (`ItemRuleTrigger`)
 * for item lifecycle events, and adds attribute-change, manual-button, and
 * schedule (interval) triggers.
 */
export type WorkflowTrigger =
  | { kind: "item"; event: ItemRuleTrigger }
  | { kind: "attribute"; attrId: string; event: "change" }
  | { kind: "manual"; buttonLabel?: string }
  | { kind: "schedule"; intervalMinutes?: number }

/**
 * A declarative workflow action. The existing item-rule actions
 * (`ItemRuleAction`) remain usable, unioned with new module-level variants
 * (create/link items, set schedule, sync plan, chain workflows, etc.).
 */
export type WorkflowAction =
  | ItemRuleAction
  | { kind: "createItem"; categoryId: string; defaults?: Record<string, AttributeValue>; titleFrom?: string }
  | { kind: "link"; relation: string; targetId?: string; targetFromAttr?: string }
  | { kind: "setSchedule"; dateAttrId: string; timeAttrId?: string; fromAttrs?: boolean }
  | { kind: "syncPlan" }
  | { kind: "runWorkflow"; workflowId: string }
  | { kind: "throw"; message: string }
  | { kind: "pickRandom"; storeInAttr: string; fromCategoryId: string; count: number }

/**
 * A declarative, serializable workflow: a `trigger`, optional gating
 * `conditions` (reusing `ItemRuleCondition`), and an ordered list of `actions`.
 * Optionally scoped to specific lists / item types.
 */
export interface WorkflowDefinition {
  id: string
  name: string
  moduleId?: string
  scope?: { listIds?: string[]; itemTypeIds?: string[] }
  trigger: WorkflowTrigger
  conditions?: ItemRuleCondition[]
  actions: WorkflowAction[]
  enabled?: boolean
}
