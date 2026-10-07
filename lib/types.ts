/**
 * lib/types.ts — Shared data-model types
 *
 * The single source of TypeScript interfaces/enums used across Brain2: tasks,
 * to-do items, calendar events, plans, categories/folders, weekly-habit types,
 * scheduling, and review records.
 *
 * Spec: this is where the unified "Item" model (spec §5) converges. Ontology:
 * every row is an Item. Runtime: the persisted document interface is still named
 * `Task` (v1); prefer `ItemRecord` on new signatures. Task-the-kind is
 * `type: "task"` plus Next Actions membership — not a second storage shape.
 * Kept distinctions: `title` vs `description`, `stage` vs `lists`, `entropy` vs
 * `cognitiveLoad`. Types map to MongoDB document shapes (flexible `attributes`,
 * `links`, embedded subdocs). See docs/CANONICAL_FIELDS.md and docs/SPEC_MAPPING.md §5.
 */
/**
 * Unified Item model (spec §5). Every domain entity is an `Item` with a `type`
 * discriminator and the second-brain primitives `tags` + `links`. `attributes`
 * carry flexible, schema-driven fields. `Task` is the persisted document of an
 * Item (v1 name) and also the built-in completable/scheduleable *kind*. Prefer
 * `ItemRecord` when the function means "a row in the brain."
 *
 * Design notes (per project owner):
 *   - `type` is the foundational concept. Built-in types ship today ("task");
 *     users will define their own ("Book", "Friend", …) via `ItemTypeDefinition`,
 *     each with its own attributes/defaults/capabilities. This is what makes Brain2
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
export type BuiltinItemType = "task" | "item" | "action" | "habit" | "event" | "goal" | "note"
export type ItemType = BuiltinItemType | (string & {})

/**
 * How a seeded type is treated by the registry.
 * - `system` — re-seeded from code on load; capabilities/panels locked (Task, Note, Operation, Item).
 * - `catalog` — seeded once if missing; user edits persist (Book, Furniture, …).
 * User-created types omit `kind`.
 */
export type ItemTypeKind = "system" | "catalog"

/** How the item-detail surface lays out type-owned fields (hero cover, featured attrs). */
export interface ItemDetailLayout {
  /** Attribute id of an `image` shown as a large cover/photo. */
  heroImageAttrId?: string
  /** Attribute ids rendered as prominent editors above the rest of the schema. */
  featuredAttributeIds?: string[]
  /** Optional titled groups of attributes on the details panel. */
  sections?: { title?: string; attributeIds: string[] }[]
}

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
  /**
   * Shows scheduling fields (dates, deadlines, constraints) and the Scheduling tab.
   * Does not send the item to the Scheduler. That is the Send to Scheduler switch.
   */
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
  /** True when the field's value differs from the previous snapshot (update trigger). */
  | "changed"
  /** True when a numeric field increased vs the previous snapshot. */
  | "increased"
  /** True when a numeric field decreased vs the previous snapshot. */
  | "decreased"

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
  /**
   * Log a completed activity into Done (Home / To-Do day view). Title templates
   * may use `{title}`, `{delta}`, `{value}`, and `{attrId}` placeholders.
   */
  | { kind: "logAction"; titleTemplate: string; awardPoints?: boolean }
  /**
   * Add to a daily habit's progress. `amount: "delta"` uses the numeric increase
   * of the `when` field; a number is an absolute increment.
   */
  | { kind: "incrementHabit"; habitId: string; amount: "delta" | number }

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
  /** System types are re-seeded and locked; catalog types are seeded then user-editable. */
  kind?: ItemTypeKind
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
  /** Cover image, featured fields, and attribute sections for the details panel. */
  detailLayout?: ItemDetailLayout
  /** Behavioral capability flags this type enables. */
  capabilities?: ItemTypeCapabilities
  /** Declarative validation/automation rules. */
  rules?: ItemTypeRule[]
}

export interface Item {
  id: string
  /** Type discriminator. Missing type is filled in persist v12 (Next Actions / inbox → `"task"`, else `"item"`). Explicit types are never overwritten. New list items use `"item"`; Next Actions / To-Do create `"task"`. */
  type?: ItemType
  /** Canonical display label. Mirrors `Task.description` during transition. */
  title?: string
  createdAt: Date
  /** Free-form tags (spec §5) — e.g. "to schedule". */
  tags?: string[]
  /**
   * Typed relationships to other items (spec §5). This is the graph: edges are
   * `ItemLink`s; backlinks are derived (`getBacklinks`). Distinct from
   * task-kind `Task.dependencies` / `parentTaskId` (scheduler/critical-path) —
   * those arrays are not merged into `links` in this persist era.
   */
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
 * Steps nest (`subtasks`) without an order or a dependency on each other.
 */
export interface Subtask {
  id: string
  description: string
  completed: boolean
  /** Atomic step that should not be decomposed further. */
  isMolecular?: boolean
  /** Self-contained background so the step reads correctly out of context. */
  context?: string
  /** Minutes typed on this step. The time that counts is the greater of this and the sum of nested steps. */
  estimatedDuration?: number
  /** Steps inside this step. Independent of one another. */
  subtasks?: Subtask[]
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
export type CompletionStatus = "active" | "done" | "partial" | "deferred" | "cancelled" | "missed"

/** Period grain a To Do commitment mark can name. Day / week / month drive Home → To Do. */
export type TodoMarkPeriod = "day" | "week" | "month" | "quarter" | "year"

/**
 * Extra commitment on a task already assigned to one To Do period.
 * The period key matches the To Do / ritual key: day `YYYY-MM-DD`, week
 * `getWeekString`, month `YYYY-MM`, quarter `YYYY-Qn`, year `YYYY`.
 */
export interface TodoPeriodMark {
  period: TodoMarkPeriod
  periodKey: string
  /** Absolutely must be done this period. Shown on the Required list. */
  required?: boolean
  /** Highlighted on the Assigned list. */
  prioritized?: boolean
}

/**
 * Persisted document for one row in the brain (v1 name: Task).
 *
 * Ontology: the row is an Item. Task-the-kind is `type: "task"` (and Next
 * Actions membership via `isTaskItem`). Fields below `Item` are type
 * capabilities (schedule, complete, priority, subtasks, …) — not a second noun.
 */
export interface Task extends Item {
  id: string
  /**
   * The v1 name for the task's text, kept because every persisted vault and
   * backup carries it. `Item.title` is the field of record now — read a name
   * with `itemTitle()` / `itemTitleOrUntitled()` (`lib/item-utils.ts`), never
   * this field directly.
   *
   * It is *mostly* a mirror of `title`, but not always: parked Apple Notes
   * (`noteToParkedItem`) store their full body here so `lib/search.ts`, which
   * indexes `description` and not `body`, can find them. See the open question
   * in `docs/CANONICAL_FIELDS.md` before making the two fields agree by force.
   */
  description: string
  // Built-in task lifecycle bucket (inbox → clarified → scheduled → completed,
  // or "list" for plain list items). Task-type behavior, not a core Item concept.
  // Historically named `category`; renamed to `stage` in the category→list
  // migration to disambiguate from list membership (`lists`).
  stage: "inbox" | "clarified" | "scheduled" | "completed" | "list"
  /**
   * Inbox partition. `true` is Monkey brain: a dump of compulsive, repetitive
   * thoughts the user does not mean to revisit the way they revisit Inbox.
   * Absent on a normal Inbox capture. Leaving Inbox (clarify, file) drops it.
   */
  monkeyBrain?: boolean
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
   * Wall-clock start of the work window that `completedDate` closes. Autogenerated
   * completions derive it from the duration (`completedDate` − minutes) or from
   * painted Tracking slots; see `lib/completion-window.ts`.
   */
  startedAt?: Date
  /**
   * Which of this record's values were assumed/derived rather than observed, and
   * on what basis. Nothing is silently synthesized: an autogenerated time carries
   * a `FieldEstimate` here until the user confirms or corrects it in the review.
   * Helpers: `lib/estimated-values.ts`.
   */
  estimates?: FieldEstimate[]
  /**
   * The person marked this completion's duration and/or start as a rough
   * estimate (Assumed times → Est.). Distinct from autogenerated `estimates`:
   * those say the app filled a number in; this says the person still treats
   * the clock or the length as approximate. Shown wherever that window is read.
   */
  timeRough?: boolean
  /**
   * Richer completion status (Feature 9, Worker I). Invariant:
   * `status === "done"` ⇔ `completed === true`; helpers in
   * `lib/completion-status.ts` keep the two in sync.
   * `"missed"` is too-late (not done): it leaves To Do / Next Actions the same
   * way done does, but lands on the automatic Missed Opportunities list instead
   * of Completed.
   */
  status?: CompletionStatus
  /**
   * When the task was marked a missed opportunity (too late). Stamped by
   * `withStatus(..., "missed")` / `markMissedOpportunity`. Cleared on reopen.
   */
  missedAt?: Date
  lists: string[] // ids of the lists this task belongs to; attrs inherited
  /**
   * List ids this item was manually removed from. Connected-list links
   * (`List.linkedTargetListIds`) will not auto-add these again until the user
   * explicitly adds the item back. See `components/Lists/LIST_LINKS.md`.
   */
  listMembershipExclusions?: string[]
  // ---- Next-actions / scheduling fields (optional; only meaningful for items
  // in the Next Actions folder tree — see lib/item-utils.ts) ----------------
  estimatedDuration?: number // minutes
  actualDuration?: number // minutes - set when task is completed
  /**
   * How firmly `actualDuration` is known.
   * `unknown` is explicit: the length is absent, never stored as 0.
   * Omitted on older rows — a positive `actualDuration` with no flag is exact
   * unless `timeRough` or an unconfirmed `actualDuration` estimate says otherwise.
   */
  durationCertainty?: DurationCertainty
  /**
   * How firmly `startedAt` is known. Same three states as `durationCertainty`.
   * `unknown` stores no start. `estimated` stores an approximate time.
   * Omitted beside a `startedAt` means exact, unless an estimate flag says otherwise.
   * Older rows may still say `"known"`; readers treat that as `exact`.
   */
  startCertainty?: StartCertainty
  cognitiveLoad?: number // 1-3
  urgency?: number // 1-5
  importance?: number // 1-5
  dependencies?: string[] // task IDs
  context?: string // @home, @work, etc.
  entropy?: number // 0-1
  rewardValue?: number
  allowPartialCompletion?: boolean
  minimumChunkSize?: number // minimum minutes for partial completion
  /**
   * Send to Scheduler. `true` shows this item in the Scheduler even when no
   * list is sent; `false` hides it. Omitted inherits from lists.
   * Dates, a deadline, or a trip itinerary do not set this.
   */
  scheduleable?: boolean
  deadline?: Date // Optional deadline
  why?: string // Why this task needs to be done
  consequences?: string // What happens if not done
  scheduledDate?: Date // When task is scheduled
  scheduledTime?: string // Time of day if scheduled
  scheduledWeek?: string // Week range (e.g., "2024-05-19_2024-05-25")
  scheduledMonth?: string // Month (e.g., "2024-05")
  scheduledYear?: string // Year (e.g., "2024")
  /**
   * When true, an unfinished day, week, or month is pushed onto the next one
   * when that period ends, and the ended period stays Undone. Omitted and
   * `false` leave the task on the coarser To Do list instead. This is not the
   * Scheduler (`scheduleable`).
   */
  autoPush?: boolean
  /**
   * Every period this task was on and did not finish. Periods are independent:
   * Monday and Tuesday can both be Undone. Gray Scheduler cells read these.
   * Roll-up does not increment push counters; a push and auto-push do.
   * `resolved: "pushed"` clears it from a Scheduler card's working queue and
   * leaves it on Home → To Do Undone. `resolved: "discarded"` drops it from
   * both working lists. The placement stays for analytics either way.
   */
  schedulePlacements?: SchedulePlacement[]
  /** How many times this task was pushed forward in the To-Do day/week/month views. */
  daysPushed?: number
  weeksPushed?: number
  monthsPushed?: number
  /** Hide from To-Do lists without marking complete. */
  hiddenFromTodo?: boolean
  /**
   * Required / prioritized marks for a To Do period. Being on that period's
   * list already means assigned. `required` is non-negotiable and leaves the
   * Assigned list. `prioritized` stays on Assigned and is marked. Both can be
   * set. Absent means just assigned.
   */
  todoMarks?: TodoPeriodMark[]
  /**
   * True when this record is a generated implied-action (e.g. "read 12 pages of Dune").
   * Counts toward Done / points / goals without being a user-authored Task.
   */
  loggedAction?: boolean
  notes?: string // Additional notes
  parentTaskId?: string // For subtasks
  subtasks?: Subtask[] // Array of subtask objects
  // ---- Brain2 additions (see docs/BRAIN2_FEATURE_IDEAS.md) ----
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
  /**
   * Per-day morning walkthrough ratings (1–10). Key = local `YYYY-MM-DD`.
   * `importance` / `excitement` are for that day; not the 1–5 priority `importance`.
   */
  dayRatings?: Record<string, { importance?: number; excitement?: number }>
  /**
   * Resistance samples over time (morning walkthrough and elsewhere). Append-only;
   * each reading keeps its timestamp so Analytics can show the series.
   */
  resistanceReadings?: Array<{
    at: string
    value: number
    source?: "morning-telegram" | "morning-desktop"
  }>
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
  /**
   * When this item was marked sent, keyed by list id (ISO). Missing key means
   * not sent on that list. Sent is not completion and not deletion.
   * Absent means the item has never been marked sent.
   */
  sentAtByList?: Record<string, string>
}

/**
 * Preferred name for “a row in the brain” on new signatures.
 *
 * Same type as {@link Task}: storage, persist key `brain2-task-storage`, and the
 * JSON array `tasks` are unchanged. `Task` stays exported so existing call
 * sites compile. Prefer `ItemRecord` when the code means the record, and keep
 * saying Task when the code means the completable/scheduleable kind.
 */
export type ItemRecord = Task

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

// ---- Estimated / autogenerated value provenance --------------------------
// The app fills in a lot of time data on the user's behalf (a habit's minutes
// from its per-unit rate, the clock window a completion occupied). Every such
// value is *flagged* rather than passed off as observed, so the review can ask
// the user to confirm or correct it. Helpers: `lib/estimated-values.ts`.

/** Task fields that may hold an autogenerated value. */
export type EstimatedField = "completedDate" | "startedAt" | "actualDuration"

/** How an autogenerated value was produced (drives copy and review ordering). */
export type EstimateKind =
  /** Read off painted Tracking slots — the most trustworthy autogeneration. */
  | "tracked"
  /** The user's own logged number already was minutes (habit unit minutes/hours). */
  | "logged"
  /** Logged amount × a per-unit rate (e.g. 4 pages × 10 min/page). */
  | "rate"
  /** A flat per-completion length configured on the habit. */
  | "flat"
  /** Assumed the work finished just now (habit ticked off today). */
  | "now"
  /** Assumed a default time of day because the day is already over. */
  | "anchor"

export interface FieldEstimate {
  field: EstimatedField
  kind: EstimateKind
  /** One-line explanation shown on the badge and in the review row. */
  basis: string
  /** ISO timestamp of when the value was autogenerated. */
  generatedAt: string
  /** ISO timestamp of the user confirming or correcting it. Absent = unconfirmed. */
  confirmedAt?: string
}

/**
 * How much clock time one period's worth of a habit is assumed to consume.
 * `minutesPerUnit` scales with what was logged (10 min per page × 4 pages);
 * `minutes` is a flat length for Yes/No habits. `precision: "definite"` means the
 * length is known, so the derived duration is not flagged for confirmation.
 * A habit with no meaningful duration stores `WeeklyTask.timeEstimateNA` instead
 * of a zero-minute estimate.
 */
export interface HabitTimeEstimate {
  minutesPerUnit?: number
  minutes?: number
  precision?: "estimated" | "definite"
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
  | "file" // a single attached file (FileValue); uri is idb:<id> or a legacy data URL
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
 * `uri` is a blob reference: `idb:<id>` for bytes in IndexedDB (`lib/attachments.ts`),
 * or a legacy `data:` URL. The field is intentionally generic so an Electron
 * file-store path can reuse it later — only how `uri` is resolved changes.
 * `extractedText` is optional indexed/searchable text.
 */
export interface FileValue {
  id: string
  name: string
  mime: string
  /** `idb:<id>` blob ref (or legacy data URL). Same field for a future file-store path. */
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

export type HabitFrequency = "daily" | "weekly" | "monthly" | "quarterly"

export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"

export interface Category {
  id: string
  name: string
  color: string
}

/**
 * Climb (incremental) habit config.
 *
 * `cadence: "weekly"` — like a goal habit whose target rises on Monday only if
 * the previous week had ≥4 days at/above that week's target.
 * `cadence: "daily"` — log a running score; each day's target is last logged
 * score + `increment`. A lower log still updates the next day's base.
 *
 * Legacy multi-key `currentValues` / `weeklyIncrement` maps are still accepted
 * and migrated in `lib/incremental-habits.ts`.
 */
export type IncrementalCadence = "daily" | "weekly"

export interface IncrementalHabitData {
  cadence: IncrementalCadence
  startValue: number
  increment: number
  unit?: string
  /** Local YYYY-MM-DD; week-0 Monday is derived from this (weekly cadence). */
  startedOn?: string
}

/** Pre-cadence multi-metric map still found in persisted stores. */
export interface IncrementalHabitLegacy {
  currentValues?: Record<string, number>
  weeklyIncrement?: Record<string, number>
}

export type IncrementalHabitPersisted = IncrementalHabitData | IncrementalHabitLegacy

/** Unit tracked minutes are converted to before they land on a habit. */
export type HabitTrackingUnit = "minutes" | "hours"

/**
 * How tracked time combines with what the user typed into the habit cell.
 * `add` — tracked time tops up the manual log (default).
 * `max` — the habit shows whichever is larger.
 * `replace` — the tracker is the only source; manual entries are ignored.
 */
export type HabitTrackingMode = "add" | "max" | "replace"

/**
 * Auto-fill a Goal / Yes-No habit from Tracking tags (`lib/time-tracking-store.ts`).
 *
 * Every minute painted with a pen carrying one of `tagIds` counts toward the
 * habit for that day, week, or month (matching `WeeklyTask.frequency`). Minutes
 * are unioned across scopes, so a minute painted "Do dishes" in Activity and
 * "Home" in Location only counts once even if both pens carry the tag. Math
 * lives in `lib/habit-tracking.ts`; the store bridge is `lib/habit-tracking-sync.ts`.
 */
export interface HabitTrackingLink {
  /** Tag ids; a pen matches when it carries any one of them. */
  tagIds: string[]
  /** Converted unit for the habit value. Default `minutes`. */
  unit?: HabitTrackingUnit
  /** Default `add`. */
  mode?: HabitTrackingMode
  /** BOOLEAN habits: converted amount needed to auto-check. Default: any tracked time. */
  threshold?: number
  /** Default true. Keeps the tag selection when switched off. */
  enabled?: boolean
}

/**
 * Habit value autofilled from Tracking period coverage (paint %).
 * Completes when coverage ≥ `threshold` (default 75). Editable on the habit.
 */
export interface HabitCoverageLink {
  /** Percent of the period that must be painted. Default 75. */
  threshold?: number
  /** Default true. */
  enabled?: boolean
}

/**
 * Weekly yes/no: complete when every daily habit ends the week above `floorPercent`
 * (default 0 = at least one attempt, no daily habit still at 0%).
 */
export interface HabitDailyFloorLink {
  /** Min week-% each daily habit must clear. Default 0. */
  floorPercent?: number
  /** Default true. */
  enabled?: boolean
}

/**
 * Phone-ingest keyword that marks this habit when the *whole* message matches
 * (see `lib/ingest/text-triggers.ts`). Editable on the habit in Settings / Habits.
 */
export interface HabitTextTrigger {
  id: string
  /** Whole-message keyword, e.g. `hemisync`, `read`, `exercise`, `chess`. */
  keyword: string
  /**
   * - `done` — bare keyword (optional trailing note) marks complete
   * - `quantity` — keyword + number + optional unit words + trailing note
   * - `score` — keyword + connector (default `score`) + number + trailing note
   */
  mode: "done" | "quantity" | "score"
  /** Unit tokens consumed after the number (`pages`, `min`, …). */
  unitWords?: string[]
  /** Phrase between keyword and number for `score` mode (default `score`). */
  connector?: string
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
  incrementalData?: IncrementalHabitPersisted
  /** Optional auto-fill from Tracking tags (daily / weekly / monthly GOAL/BOOLEAN habits). */
  trackingLink?: HabitTrackingLink
  /**
   * Autofill from Tracking period coverage % (day / week / month / season paint).
   * `undefined` uses the name preset ("log 75% of the …"). `null` turns it off.
   */
  coverageLink?: HabitCoverageLink | null
  /**
   * Period habit: add up one daily habit's logged amount across the days of
   * this week, month, or season (`lib/habit-value-sync.ts`).
   */
  habitValueLink?: HabitValueLink | null
  /** Goal cells draw a thin tube under the number, filled by value / goal. */
  showGoalBar?: boolean
  /**
   * Weekly: auto-check when no daily habit is still at 0% for the week.
   * `undefined` uses the name preset. `null` turns it off.
   */
  dailyFloorLink?: HabitDailyFloorLink | null
  /**
   * How long completing this habit is assumed to take, so the Done row it writes
   * carries a duration and a clock window instead of a bare date
   * (`lib/habit-time-estimate.ts`).
   */
  timeEstimate?: HabitTimeEstimate
  /**
   * This habit has no meaningful duration. Minutes are not stored.
   * Grades and planning treat it as no estimate, not as 0 minutes.
   */
  timeEstimateNA?: boolean
  /**
   * Optional wording for the Done line written the next time this habit is met.
   * `{value}` is the number logged, which can differ from the goal.
   * Empty or absent keeps the habit name. Already-logged Done rows stay as they are.
   */
  doneTaskPhrase?: string
  /**
   * Text habits: the Done line is the text entered in the cell.
   * The link back to this habit stays; only the displayed wording changes.
   */
  doneTaskUseText?: boolean
  /**
   * Tag whose Done tasks each count as 1 toward this habit's numeric goal
   * (`lib/habit-tagged-count.ts`). "cooking" with a goal of 2 is met by two
   * Done tasks tagged cooking in the period. Missing means that source is off.
   * This is not the minute Tracking-tags link.
   */
  taggedTaskTag?: string
  /**
   * Telegram / phone keywords for this habit. Empty/undefined falls back to
   * built-in presets that match the habit name (`hemisync`, `read`, …).
   */
  textTriggers?: HabitTextTrigger[]
  /** User pin: stays until they turn it off. Adds +1 to effective priority. */
  priorityPinned?: boolean
  /** Drop missed-period auto-priority (manual deprioritize). Pin still applies. */
  priorityMuted?: boolean
  /** When the habit was created (ISO). Sort by date created; stamped on add. */
  createdAt?: string
  /** Row gem (catalog path or uploaded data URL). Assigned at create / one-time migrate; never a type or category default. */
  gem?: string
  /**
   * Log blocks that lift this daily habit (`lib/habit-exemption.ts`).
   * `undefined` uses the name preset. `[]` means that preset was cleared.
   * All-nighter nights are the morning date: `evening-before` is the day that
   * led into the night, `morning-of` is that morning.
   */
  logExemptions?: HabitLogExemption[]
  /**
   * Sleep clock that checks this habit (`lib/habit-connections.ts`).
   * `undefined` uses the name preset. `null` means the preset was turned off.
   */
  sleepLink?: HabitSleepLink | null
  /**
   * Next-action list that checks this habit. `undefined` uses the name preset.
   * `null` means that preset was turned off. The to-do block is the template.
   */
  listLink?: HabitListLink | null
  /**
   * List whose sent-this-period ratio fills this habit (`lib/list-sent.ts`).
   * Missing means the source is off. Grace defaults to 100 when omitted.
   */
  listSentLink?: HabitListSentLink | null
  /**
   * Completion sources, most trusted first. When two disagree, the earlier one
   * wins. Absent on old rows: derived from the links already stored.
   */
  completionSources?: HabitCompletionSourceId[]
}

/** A logged fact that can lift a daily habit. All-nighter is the morning date. */
export type HabitLogSignal = "all-nighter"

/**
 * Which day that log lifts.
 * `evening-before` — the day that led into the night (bedtime).
 * `morning-of` — the morning the night is keyed by (wake, dream).
 */
export type HabitLogDay = "evening-before" | "morning-of"

export interface HabitLogExemption {
  when: HabitLogSignal
  day: HabitLogDay
}

/** Sleep log that can check a daily yes/no habit. Thresholds use sleep-offset minutes. */
export interface HabitSleepLink {
  end: "bed" | "wake"
  /** Met when the logged end is at or before this offset. */
  beforeMinutes: number
}

/** Done next actions on a named list that can check a daily yes/no habit. */
export interface HabitListLink {
  listName: string
  /** How many finished next actions on that list complete the day. */
  count: number
}

/**
 * A list's sent ratio for this period. `grace` is the raw percent that
 * reports as 100 (default 100). Missing link means the source is off.
 */
export interface HabitListSentLink {
  listId: string
  grace?: number
  enabled?: boolean
}

/**
 * Where a habit may learn that it is done. Order is trust: index 0 wins when
 * two sources disagree. Missing means "derive from the links already on the habit"
 * (`lib/habit-completion-trust.ts`). An empty list trusts nothing.
 */
/** Daily habit whose logged amount is summed into a weekly, monthly, or season cell. */
export interface HabitValueLink {
  habitId: string
  enabled?: boolean
}

export type HabitCompletionSourceId =
  | "manual"
  | "tags"
  | "taggedTasks"
  | "coverage"
  | "sleep"
  | "list"
  | "dailyFloor"
  | "habitValue"
  | "dailyCompletionAverage"
  | "listSent"
  | "keywords"

export interface TaskCompletion {
  completed?: boolean
  value?: number
  goal?: number
  text?: string
  incrementalValues?: Record<string, number>
  /** Part of `value` contributed by the habit's tracking link. */
  trackedValue?: number
  /** Part of `value` the user typed, kept so tracked time can recompute `value`. */
  manualValue?: number
  /** BOOLEAN habits: `completed` was set by the tracking link, not by hand. */
  trackedCompleted?: boolean
  /** BOOLEAN habits: checked because the sleep log met this habit's clock. */
  sleepCompleted?: boolean
  /** BOOLEAN habits: checked because enough next actions on the linked list were done. */
  listCompleted?: boolean
  /** Goal / Yes-No: value or check came from Tracking period coverage %. */
  coverageCompleted?: boolean
  /** Sum of a linked daily habit across the days of this period so far. */
  habitSumValue?: number
  /**
   * Raw mean of daily-habit row percents for this week, month, or season
   * (`lib/habit-daily-completion-average.ts`). Kept when a hand-typed number
   * owns `value`.
   */
  dailyCompletionAverage?: number
  /**
   * Grace-adjusted percent of a linked list marked sent during this period
   * (`lib/list-sent.ts`). Kept when a hand-typed number owns `value`.
   */
  listSentPercent?: number
  /**
   * How many Done tasks carrying `taggedTaskTag` fell on a day of this period
   * that has already happened. 0 is a reading, not a number typed by hand.
   */
  taggedTaskCount?: number
  /** Weekly Yes-No: checked because every daily habit cleared the week floor. */
  dailyFloorCompleted?: boolean
  /**
   * The person typed or ticked this cell. `true` / `false` is their opinion,
   * kept apart from auto flags so a higher-trust source can disagree.
   * Absent means they have not touched the cell.
   */
  handCompleted?: boolean
  /**
   * This period was definitely not done. Absence is not marked.
   * Not a completion and not an exemption: grades, percents, streaks, gems,
   * and points do not read it.
   */
  missedOpportunity?: boolean
  /** A phone keyword line logged into this cell (`lib/ingest/apply-habit-trigger.ts`). */
  keywordLogged?: boolean
  /** Amount that keyword lines have added (quantity) or set (score). */
  keywordValue?: number
  /**
   * Wall clock of the last edit to this cell. A stale window's copy of the
   * day loses to this, so a check cannot be unmarked by an older snapshot.
   */
  updatedAt?: number
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
  /**
   * Other lists that receive this list's items (membership, not nesting).
   * A→B is stored only on A; B's settings derives "receives from A".
   * See `components/Lists/LIST_LINKS.md`.
   */
  linkedTargetListIds?: string[]
  /**
   * Send to Scheduler. Only `true` puts this list's items in the Scheduler.
   * Omitted and false do not. A dated list, such as a trip itinerary, is
   * scheduled on its own and is not sent unless this is on.
   */
  scheduleable?: boolean
  // Optional custom icon (orb path or uploaded data URL) for the Lists view.
  icon?: string
  /**
   * Hide this list from the Lists tab's global All directory / All Items.
   * Undefined inherits: lists under Module Lists (and unfiled module-created
   * lists) are hidden. `false` shows the list in All even inside that tree.
   */
  hiddenFromGlobalAll?: boolean
  /** Workspace module that created this list (auto-filed under Module Lists). */
  createdByModuleId?: string
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
   * Per-list spreadsheet layout (sort / filter / freeze / widths / visible
   * column ids). Independent of `displayedAttributes` and `detailsColumns`.
   */
  sheetConfig?: import("@/lib/spreadsheet-contract").SheetViewConfig
  /**
   * Ordered Details-table column ids for this list (attribute ids and
   * `__field_*__` built-ins). Independent of `sheetConfig.columnIds`.
   * Undefined = current Details defaults (schema / `displayedAttributes`, plus
   * Next Actions urgency / importance / scheduled). `[]` = Name only.
   */
  detailsColumns?: string[]
  /**
   * Which display modes are *offered* (selectable via the toolbar) for this
   * list. Undefined = all modes offered (backwards-compatible default).
   */
  enabledDisplays?: ListDisplayMode[]
  /**
   * Extra checklist tick columns besides Completed. Undefined = Completed only.
   * `"missed"` adds a Missed opportunity checkbox. List Settings → View mode
   * settings → Checklist view mode settings.
   */
  checklistCheckboxVars?: ChecklistCheckboxVar[]
  /**
   * Default view reading-row chrome for this list. Undefined = built-in layout
   * (pip, 16px orb, name, type, U·I, date, first attribute chips). Custom
   * prefs apply only when `custom === true`. Independent of Details
   * `detailsColumns` and Spreadsheet `sheetConfig`.
   * List Settings → View mode settings → Default view mode settings.
   */
  defaultView?: ListDefaultView
  /**
   * Next Actions auto-archive list. Set when sync creates or adopts
   * **Completed** / **Missed Opportunities**.
   */
  autoArchive?: "completed" | "missed"
  /**
   * List-scoped automation/validation rules. These compose with the item type's
   * rules and apply to an item across *all* its lists (e.g. on a "Books to Buy"
   * list: when purchased = true, set owned = true).
   */
  rules?: ItemTypeRule[]
  /**
   * Sent this week. Off unless `true`. Items can be marked sent on their
   * detail; sent rows hide until Show sent. A previous week's sends leave
   * this list at the week boundary and are not deleted. Missing means off.
   */
  sentThisWeek?: boolean
  /** Singular label for items in this list (e.g. book, habit). Next Actions defaults to "task". */
  itemLabel?: string
  /** Tabs shown in item detail view for items in this list (unioned with the type's panels). */
  detailPanels?: ItemDetailPanel[]
  /** Panels to hide even if the item type (or another list) would show them. */
  hiddenDetailPanels?: ItemDetailPanel[]
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
 *
 * Kanban is a Modules workspace view only — not a Lists-tab display mode.
 */
export const LIST_DISPLAY_MODES = ["default", "checklist", "icons", "table", "spreadsheet"] as const
export type ListDisplayMode = (typeof LIST_DISPLAY_MODES)[number]

/** Ticks shown in Lists checklist view. Default is Completed only. */
export const CHECKLIST_CHECKBOX_VARS = ["completed", "missed"] as const
export type ChecklistCheckboxVar = (typeof CHECKLIST_CHECKBOX_VARS)[number]

/** Chrome bits a list can show or hide on Default reading rows. */
export const DEFAULT_VIEW_CHROME_KEYS = [
  "pip",
  "orb",
  "type",
  "priority",
  "date",
  "tags",
  "listNames",
  "estimate",
  "description",
  "attributeChips",
] as const
export type DefaultViewChromeKey = (typeof DEFAULT_VIEW_CHROME_KEYS)[number]
export type DefaultViewDensity = "comfortable" | "compact"

/**
 * Per-list Default display. Undefined / `custom !== true` keeps the built-in
 * reading row. Extra attribute ids are compact meta only — not a column grid.
 */
export interface ListDefaultView {
  custom?: boolean
  show?: Partial<Record<DefaultViewChromeKey, boolean>>
  extraAttributeIds?: string[]
  density?: DefaultViewDensity
}

export function isListDisplayMode(value: unknown): value is ListDisplayMode {
  return typeof value === "string" && (LIST_DISPLAY_MODES as readonly string[]).includes(value)
}

/** Drop unknown/removed modes (e.g. legacy `"kanban"`). Undefined = all modes. */
export function sanitizeEnabledDisplays(displays: unknown): ListDisplayMode[] | undefined {
  if (!Array.isArray(displays) || displays.length === 0) return undefined
  const next = displays.filter(isListDisplayMode)
  return next.length > 0 ? next : undefined
}

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
export type PriorityPeriod = "day" | "week" | "month" | "quarter" | "year"

/**
 * A period-scoped prioritization of an objective. While the current date falls
 * within `period`/`periodKey`, contributing actions earn `multiplier`× points.
 */
export interface ObjectivePriority {
  period: PriorityPeriod
  /** day=YYYY-MM-DD, week=getWeekString, month=YYYY-MM, quarter=YYYY-Qn, year=YYYY. */
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
export type GoalPeriodKind = "day" | "week" | "month" | "quarter" | "year" | "custom" | "aspirational"

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

/** One recorded period placement (live or historical after roll-up). */
export type SchedulePlacementPeriod = Exclude<SchedulePeriod, "always">

/** How a past placement left the Scheduler's working queue. History stays on the row. */
export type SchedulePlacementResolution = "assimilated" | "pushed" | "discarded" | "clarified"

export interface SchedulePlacement {
  period: SchedulePlacementPeriod
  /** Day `YYYY-MM-DD`, week range, month `YYYY-MM`, or year `YYYY`. */
  value: string
  /**
   * `pushed` and `clarified` leave the Scheduler queue for this period.
   * Home → To Do and the period's Undone list still show them.
   * `discarded` drops the period from those lists too.
   * The placement itself stays for analytics either way.
   */
  resolved?: SchedulePlacementResolution
}

export interface ScheduleBox {
  id: string
  label: string
  period: SchedulePeriod
  date?: Date
  tasks: string[] // task IDs
}

/**
 * How firmly a completion's length or start is known.
 * `unknown` carries no minutes and no start time. `estimated` carries a value
 * the person does not treat as exact.
 */
export type ClockCertainty = "exact" | "estimated" | "unknown"

/** How firmly a completion's length is known. */
export type DurationCertainty = ClockCertainty

/**
 * How firmly a completion's start is known. Same three states as a length.
 * Older saved reviews may still store `"known"`; `readStartCertainty` maps that to `exact`.
 */
export type StartCertainty = ClockCertainty

/**
 * Optional 1–10 reflections on a completion. A missing score was not asked —
 * it is not a 5.
 */
export interface CompletionReflections {
  /** How hard the person thought the work would be. */
  expectedDifficulty?: number
  /** How hard the work was. */
  actualDifficulty?: number
  /** How much they enjoyed it. */
  enjoyment?: number
  /** How hard it was to start. */
  resistance?: number
  /** The energy they had. */
  energy?: number
  /** How absorbed they were. */
  focus?: number
  /** Whether it was worth it. */
  meaning?: number
}

// Task completion review
export interface TaskCompletionReview extends CompletionReflections {
  taskId: string
  completedAt: Date
  /**
   * Minutes. Present for exact and estimated lengths.
   * Absent when `durationCertainty` is `unknown` — never 0 as a stand-in.
   * Older reviews may still carry a number and no certainty field.
   */
  actualDuration?: number
  durationCertainty?: DurationCertainty
  /**
   * Person-corrected start. Mirrors `Task.startedAt` when the review saved one.
   * Absent when `startCertainty` is `unknown` — never an invented midnight.
   */
  startedAt?: Date
  startCertainty?: StartCertainty
  /** Legacy 1–10. Optional on new reviews. */
  satisfaction?: number
  /** Legacy 1–10. Optional on new reviews. */
  distraction?: number
  /**
   * Notes from the completion popup's quick review. Word-count points read this
   * string only. A later Reflect note is `reflectNotes`, not this field.
   */
  notes?: string
  /** Later Reflect note. Separate from the quick-review `notes`. */
  reflectNotes?: string
  /**
   * Whitespace-separated tokens in the quick-review `notes` when the person
   * agreed. Written only by that award. See `reviewWordCount` in
   * `lib/completion-review.ts`.
   */
  reviewWordCount?: number
  /**
   * 3 points for agreeing to the quick review, plus 0.1 per word in `notes`.
   * The same number is written to the points ledger under `review:${taskId}`.
   * A later Reflect save does not create, revise, or delete this.
   */
  reviewPoints?: number
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
  /**
   * When true, new lists in this folder start sent to the Scheduler. Omitted
   * and false do not. New folders start off. Dates on a list do not do this.
   */
  scheduleable?: boolean
  // Optional custom icon (orb path or uploaded data URL) for the Lists view.
  icon?: string
  /**
   * Hide this folder from the Lists tab's global All directory. Undefined
   * inherits: folders under Module Lists are hidden. `false` shows it in All.
   */
  hiddenFromGlobalAll?: boolean
  /** Workspace module that owns this auto-created `{ModuleName} Lists` folder. */
  createdByModuleId?: string
}

// ---- Period reviews / rituals (day / week / month / quarter / year) ------
export type ReviewPeriod = "day" | "week" | "month" | "quarter" | "year"

/**
 * Ritual phase on a period. Day uses morning (start) / night (end);
 * week–year use start / end (review). User-facing label is Rituals.
 */
export type RitualPhase = "start" | "end"

/** Day-pair roles for the sun / moon UI (aliases of start / end). */
export type DayRitualRole = "morning" | "night"

/**
 * Start-of-period planning ritual (week/month/quarter/year).
 * Day start lives on `morning` instead so existing morning data stays intact.
 */
export interface PeriodStartRitual {
  /**
   * `false` while answers are saved but the ritual is unfinished.
   * `true` after a full submit. Omitted on older saves — populated slices count as done.
   */
  completed?: boolean
  /** Next text step when the person left off. */
  resumeStep?: string
  /** Free-text priorities for the coming period. */
  priorities?: string
  /** Tasks / outcomes that MUST be done this period. */
  mustDo?: string
  /** Notes on unfinished items carried from the previous period. */
  undoneNotes?: string
  /** Task ids pulled from the previous period into this one during start. */
  pulledTaskIds?: string[]
  /** Intentions / what matters most. */
  summary?: string
  /** Concrete plan for the coming period. */
  nextPlans?: string
  gratitude?: string[]
  reflections?: Record<string, string>
  source?: "telegram" | "desktop"
}

export interface PeriodReview {
  id: string // `${period}:${periodKey}`
  period: ReviewPeriod
  periodKey: string // day=YYYY-MM-DD, week=getWeekString, month=YYYY-MM, quarter=YYYY-Qn, year=YYYY
  completedAt: Date
  summary: string
  gratitude: string[]
  nextPlans: string
  planReflection?: string
  /**
   * Optional note for the next morning: things to remember on waking.
   * Empty or omitted means the morning ritual shows nothing.
   */
  wakeReminder?: string
  /**
   * Optional "what matters most" for the day after this ritual.
   * Shown on that next morning after `wakeReminder`.
   */
  tomorrowMatters?: string
  /** Short analysis from the night's glance at the time grid / day log / activity log. */
  timeReflection?: string
  /**
   * Goals to focus on the day after this ritual. Tasks that serve them earn the
   * goal-focus multiplier (see `lib/goal-focus.ts`) on that next day.
   */
  tomorrowFocusGoalIds?: string[]
  reflections: Record<string, string> // reflection question id -> answer
  // Snapshot of how the carried-over tasks were resolved during the review.
  resolvedTaskIds: string[] // marked done
  pushedTaskIds: string[] // pushed to the next period
  /**
   * End / night / review ritual completion.
   * `true` after Save Review / Telegram end save. `false` while partial.
   * Omitted on legacy rows — inferred from end-body content (see `endRitualPhase`).
   */
  endCompleted?: boolean
  // ---- Morning review ritual (HM2) + structured blocked reasons (HM3), Worker G ----
  morning?: {
    wakeTime?: string
    dream?: string
    intentions?: string[]
    affirmations?: string[]
    postponedTaskIds?: string[]
    /** Clock the person fell asleep, when this ritual recorded one. */
    bedTime?: string
    /** Did not sleep — skips bed/wake/dream. */
    allNighter?: boolean
    /**
     * `false` while answers are saved but the ritual is unfinished.
     * `true` after a full submit. Omitted on reviews saved before partial
     * progress existed — those count as finished.
     */
    completed?: boolean
    /** Next text question when the person left off (or jumped). */
    resumeStep?: string
    /** Affirmation lines shown this session, so a resume does not re-roll. */
    shownAffirmations?: string[]
    /** Index into `shownAffirmations` of the line still waiting. */
    affirmationIndex?: number
    /** To-do walk cursor when they left off mid-list. */
    walkIndex?: number
    /** Last plaintext day plan written by this ritual (skips a second append). */
    dayPlanText?: string
    /** Circumstance prompts still selected (1 must-not, 2 events, 3 excited). Required tasks are asked earlier. */
    circumstanceNums?: number[]
    /** To-do items created during the morning ritual. */
    todosAddedIds?: string[]
    /** Task ids marked required during the text ritual. Empty means the question was answered. */
    requiredTaskIds?: string[]
    /** 3–5 highest-priority to-do ids for the day (Home → To Do). */
    priorityTaskIds?: string[]
    /** 1–3 daily habit ids prioritized for the day (Home → Habits). */
    priorityHabitIds?: string[]
    /** True when this ritual appended a day-plan log entry. */
    dayPlanLogged?: boolean
    mustDo?: string
    mustNotDo?: string
    newEvents?: string
    excitedAbout?: string
    bestDayWhy?: string
    /** Morning gratitude list (often 10). Distinct from evening `gratitude`. */
    gratitude?: string[]
    /** Where the ritual was completed — label text-pipeline rows in Analytics. */
    source?: "telegram" | "desktop"
  }
  /**
   * Start ritual for week/month/quarter/year (planning the coming period).
   * Day start is `morning` (sun). End / night body fields stay on the review root.
   */
  start?: PeriodStartRitual
  /**
   * Why each carried-over/skipped task was blocked, keyed by taskId.
   * A preset is the token. Other is `{ reason: "other", note }` when the person typed words.
   */
  blockedReasons?: Record<string, StoredBlockedReason>
  /**
   * Week / month / season / year reflection. One shape so analytics can read
   * every longer ritual the same way. Empty answers are omitted.
   */
  arc?: PeriodArcReflection
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

/**
 * A blocked reason as stored on a review. Presets stay a token.
 * Other keeps the token and, when the person wrote something, the words.
 * An empty Other is the token alone — it does not invent a custom reason.
 */
export type StoredBlockedReason = BlockedReason | { reason: BlockedReason; note?: string }

/** Longer-period reflection. All optional. Photos use the attachment store (`FileValue`). */
export interface PeriodArcReflection {
  wins?: string
  lessons?: string
  timeManagement?: string
  energyStress?: string
  physical?: string
  joyBalance?: string
  social?: string
  boundaries?: string
  primaryFocus?: string
  obstacles?: string
  anticipate?: string
  inspired?: string
  inspiredPhotos?: FileValue[]
  joy?: string
  fear?: string
  fearReframe?: string
  bestWorst?: string
  idealNext?: string
}

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
