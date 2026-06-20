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
export interface Task {
  id: string
  description: string
  // NOTE: v1 lifecycle bucket. Spec §5.3 expands this to a richer `status`
  // (inbox | clarified | active | scheduled | completed | archived).
  category: "inbox" | "clarified" | "scheduled" | "completed" | "list"
  createdAt: Date
  completed: boolean
  categories: string[] // Multiple categories a task can belong to
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
  subtasks?: { id: string; description: string; completed: boolean }[] // Array of subtask objects
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
 * an attribute schema (`TaskCategory.itemAttributes`); items store concrete
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
  | "item"
  | "link"
  | "goal" // an x / y progress value with custom labels (e.g. actual / goal)

export type BooleanDisplay = "checkbox" | "switch"

export interface AttributeDefinition {
  id: string
  name: string
  type: AttributeType
  /** Manual options for selection-type attributes. */
  options?: string[]
  unit?: string // optional display unit/suffix (e.g. "$", "min")
  labels?: { current?: string; target?: string } // for goal
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

export type AttributeValue = string | number | boolean | string[] | GoalValue | null | undefined

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
  quarterlyImportance?: "Q+" | "Q" | "I+" | "I" // Q = Quarterly important, I = Immediately important
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

// New type for custom categories (a.k.a. "Lists" in the UI)
export interface TaskCategory {
  id: string
  name: string
  color: string
  description?: string
  createdAt: Date
  order?: number // for custom ordering
  // When true (default), items in this list are surfaced in the Scheduler.
  scheduleable?: boolean
  // Optional custom icon (orb path or uploaded data URL) for the Lists view.
  icon?: string
  // Optional attribute schema applied to items in this list (spec §5). Items
  // belonging to multiple lists get the union of their lists' attributes.
  itemAttributes?: AttributeDefinition[]
  /** Default attribute values applied when new items are added to this list. */
  defaultAttributeValues?: Record<string, AttributeValue>
  /** Attribute ids shown in the list table view (defaults to all itemAttributes). */
  displayedAttributes?: string[]
  /** Singular label for items in this list (e.g. book, habit). Next Actions defaults to "task". */
  itemLabel?: string
  /** Tabs shown in item detail view for items in this list. */
  detailPanels?: ItemDetailPanel[]
}

export type ItemDetailPanel = "details" | "scheduling" | "dependencies" | "subtasks" | "analysis" | "time"

export interface Goal {
  id: string
  title: string
  description?: string
  type: "numerical" | "boolean" | "count"
  target: number
  current: number
  period: "week" | "month" | "year"
  category: string
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

// New type for category folders (folders that nest "Lists" in the UI).
// Folders carry default settings that new lists created inside them inherit.
export interface CategoryFolder {
  id: string
  name: string
  createdAt: Date
  categoryIds: string[] // List of category IDs in this folder
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
}
