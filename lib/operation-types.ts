/**
 * lib/operation-types.ts — Operation item type + operation configuration model
 *
 * An **Operation** is a little graphic tool for any kind of project: the work,
 * the ideas, the data, and the progress. A trip, a paid job, a magazine, a
 * house. It is deliberately **not** trip-shaped. What an individual operation
 * *is* comes from configuration stored on the item:
 *
 *   - **Categories** (`OPERATION_ATTR.categories`) — free-form, many-per-op
 *     labels ("trip", "paid", "foxtide job", "computer work", …). The Operations
 *     home page groups, filters, and sorts by them. New categories are created
 *     just by typing one, so the set is open-ended.
 *   - **Panels** (`OPERATION_ATTR.panels`) — which of the prebuilt panels this
 *     operation shows (To do, Phases, Parts, Timeline, Locations, Plan,
 *     Resources, Log, Queue rail). Chosen per operation in its Settings dialog,
 *     so a "computer work" op never has to carry a Locations map it doesn't want.
 *   - **Tracking tags** (`OPERATION_ATTR.trackingTagIds`) — ids from the
 *     Tracking tag library. "Working on this now" paints the Activity grid with
 *     a pen carrying those tags, so linked daily habits auto-fill from the same
 *     minutes.
 *
 * Structurally an Operation is still just a `Task` carrying `type: "operation"`,
 * so it inherits the whole item model (attributes, links, lists, time logs). Its
 * phases, parts, and resources are *other* tasks linked through the typed
 * relations in `lib/links.ts` (`has-phase`/`phase-of`, `has-part`/`part-of`,
 * `has-resource`/`resource-of`), and its **Tasks panel is a real Lists panel**
 * over a backing `List` (`lib/operation-lists.ts`), which is how Operations and
 * the Lists/item model connect.
 *
 * This module is pure + serializable (no store or React imports): the item-type
 * schema, the panel registry, the presets, and the normalizers that read the
 * two configuration attributes off an operation.
 */
import type { AttributeDefinition, AttributeValue, ItemTypeDefinition } from "@/lib/types"

/** Stable item-type id, referenced by helpers, components, and tests. */
export const OPERATION_TYPE_ID = "operation"

/**
 * Attribute ids for the Operation type. Centralized so `lib/operations.ts` and
 * the Operations UI can read e.g. the stage without hard-coding strings.
 */
export const OPERATION_ATTR = {
  mission: "mission",
  stage: "stage",
  targetDate: "targetDate",
  homeNotes: "homeNotes",
  /** Free-form categories this operation belongs to (an op can have many). */
  categories: "categories",
  /** Enabled panel ids; unset means `DEFAULT_OPERATION_PANELS`. */
  panels: "panels",
  /** Backing `List` for the To do panel (Operations ↔ Lists bridge). */
  taskListId: "taskListId",
  /** JSON part formulas (kinds). See `lib/operation-parts.ts`. */
  partFormulas: "partFormulas",
  /** JSON part instances, including ideas. See `lib/operation-parts.ts`. */
  partInstances: "partInstances",
  /** Glance labels on the Parts board. Absent means every label. */
  partsGlance: "partsGlance",
  /** Linked workspace module powering the Timeline + Locations panels. */
  itineraryModuleId: "itineraryModuleId",
  /**
   * Tracking-library tag ids this operation paints with. Same tags Habits
   * link, so time spent "working on this now" can auto-fill a daily habit.
   */
  trackingTagIds: "trackingTagIds",
  /** Activity-scope pen created for live "working on this now" painting. */
  trackingPenId: "trackingPenId",
} as const

/** Lifecycle stages an Operation moves through. */
export const OPERATION_STAGES = ["planning", "active", "paused", "done", "abandoned"] as const
export type OperationStage = (typeof OPERATION_STAGES)[number]

/** Default stage applied to a freshly created / upgraded Operation. */
export const DEFAULT_OPERATION_STAGE: OperationStage = "planning"

/** Anything shaped enough to read operation configuration off of. */
export interface OperationAttributeSource {
  attributes?: Record<string, unknown>
}

// ===========================================================================
// Panels — what an individual operation is made of
// ===========================================================================

/** Every prebuilt panel an operation can switch on, in workspace order. */
export const OPERATION_PANEL_IDS = [
  "home",
  "tasks",
  "phases",
  "parts",
  "timeline",
  "locations",
  "plan",
  "resources",
  "log",
  "queue",
] as const
export type OperationPanelId = (typeof OPERATION_PANEL_IDS)[number]

export interface OperationPanelDefinition {
  id: OperationPanelId
  /** Tab / rail label shown in the workspace. */
  label: string
  /** One-line explanation shown in the operation Settings dialog. */
  description: string
  /** `tab` panels sit in the tab strip; `rail` panels dock beside them. */
  surface: "tab" | "rail"
  /** Always on, not switchable off (Home is the operation's own briefing). */
  locked?: boolean
  /** On by default for a new operation with no explicit panel choice. */
  default?: boolean
  /** Needs the full width — the rail steps aside while this tab is open. */
  wide?: boolean
}

export const OPERATION_PANELS: readonly OperationPanelDefinition[] = [
  {
    id: "home",
    label: "Home",
    description: "Mission, stage, progress, notes pad, and the work/neglect heatmap.",
    surface: "tab",
    locked: true,
    default: true,
  },
  {
    id: "tasks",
    label: "To do",
    description: "Every task for this operation, including steps from phases and parts.",
    surface: "tab",
    default: true,
  },
  {
    id: "phases",
    label: "Phases",
    description: "Ordered phases with their own checklists of steps.",
    surface: "tab",
    default: true,
  },
  {
    id: "parts",
    label: "Parts",
    description:
      "Formulas for the pieces of this operation — issues and articles, or rooms — each with its own page, ideas, and glance metrics.",
    surface: "tab",
    default: true,
  },
  {
    id: "timeline",
    label: "Timeline",
    description: "Day-by-day grid for anything date-shaped (travel days, shoot days, sprints).",
    surface: "tab",
    wide: true,
  },
  {
    id: "locations",
    label: "Locations",
    description: "Map plus place lists for anywhere this operation touches ground.",
    surface: "tab",
    wide: true,
  },
  {
    id: "plan",
    label: "Plan",
    description: "Long-form plan document that doesn't fit the day grid.",
    surface: "tab",
    wide: true,
  },
  {
    id: "resources",
    label: "Resources",
    description: "Attached references, assets, contacts, and gear.",
    surface: "tab",
  },
  {
    id: "log",
    label: "Log",
    description: "Reverse-chronological time log with a quick punch-in form.",
    surface: "tab",
    default: true,
  },
  {
    id: "queue",
    label: "Queue rail",
    description: "Ranked next actions docked beside the panels.",
    surface: "rail",
    default: true,
  },
]

/** Panels a new operation gets when it makes no explicit choice. */
export const DEFAULT_OPERATION_PANELS: OperationPanelId[] = OPERATION_PANELS.filter(
  (p) => p.default,
).map((p) => p.id)

/** Panels that can never be switched off. */
export const LOCKED_OPERATION_PANELS: OperationPanelId[] = OPERATION_PANELS.filter(
  (p) => p.locked,
).map((p) => p.id)

/**
 * Renames of panel ids that operations may already have persisted:
 * `activities` → `locations` and `itinerary` → `timeline` (the trip-flavored
 * names from when every operation was assumed to be a trip).
 */
export const OPERATION_PANEL_ALIASES: Record<string, OperationPanelId> = {
  activities: "locations",
  itinerary: "timeline",
  briefing: "home",
  notes: "home",
}

const PANEL_ORDER = new Map<OperationPanelId, number>(
  OPERATION_PANEL_IDS.map((id, index) => [id, index]),
)

export function getOperationPanel(id: string): OperationPanelDefinition | undefined {
  const canonical = canonicalOperationPanelId(id)
  return canonical ? OPERATION_PANELS.find((p) => p.id === canonical) : undefined
}

/** Map a raw/legacy panel id onto a current one; `null` when unknown. */
export function canonicalOperationPanelId(id: unknown): OperationPanelId | null {
  if (typeof id !== "string") return null
  const key = id.trim().toLowerCase()
  if (!key) return null
  if ((OPERATION_PANEL_IDS as readonly string[]).includes(key)) return key as OperationPanelId
  return OPERATION_PANEL_ALIASES[key] ?? null
}

/** Registry order, de-duplicated, with locked panels forced on. */
export function sortOperationPanelIds(ids: Iterable<OperationPanelId>): OperationPanelId[] {
  const set = new Set<OperationPanelId>(ids)
  for (const locked of LOCKED_OPERATION_PANELS) set.add(locked)
  return [...set].sort((a, b) => (PANEL_ORDER.get(a) ?? 0) - (PANEL_ORDER.get(b) ?? 0))
}

/**
 * Parse a persisted panel selection (string array, or a comma/space separated
 * string) into canonical ids. Returns `null` when nothing was stored, so callers
 * can tell "no choice yet" from "deliberately minimal".
 */
export function normalizeOperationPanelIds(value: unknown): OperationPanelId[] | null {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]/)
      : null
  if (!raw) return null
  const ids = raw
    .map((entry) => canonicalOperationPanelId(entry))
    .filter((id): id is OperationPanelId => id !== null)
  if (ids.length === 0) return null
  return sortOperationPanelIds(ids)
}

/** The panels an operation actually shows (defaults when unconfigured). */
export function resolveOperationPanels(operation: OperationAttributeSource | null | undefined): OperationPanelId[] {
  const stored = normalizeOperationPanelIds(operation?.attributes?.[OPERATION_ATTR.panels])
  return stored ?? sortOperationPanelIds(DEFAULT_OPERATION_PANELS)
}

export function isOperationPanelEnabled(
  operation: OperationAttributeSource | null | undefined,
  id: OperationPanelId,
): boolean {
  return resolveOperationPanels(operation).includes(id)
}

/** Switch a panel on/off in a selection; locked panels stay on. */
export function toggleOperationPanelIds(
  ids: Iterable<OperationPanelId>,
  id: OperationPanelId,
  enabled: boolean,
): OperationPanelId[] {
  const set = new Set<OperationPanelId>(ids)
  if (enabled) set.add(id)
  else if (!LOCKED_OPERATION_PANELS.includes(id)) set.delete(id)
  return sortOperationPanelIds(set)
}

/** True when the tab wants the full workspace width (rail hidden). */
export function isWideOperationPanel(id: string): boolean {
  return getOperationPanel(id)?.wide === true
}

// ===========================================================================
// Categories — how operations are filed on the home page
// ===========================================================================

/** Bucket label for operations with no categories. */
export const UNCATEGORIZED_OPERATION_CATEGORY = "Uncategorized"

/** Case/whitespace-insensitive identity for a category name. */
export function operationCategoryKey(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Parse a persisted category value (string array, or a comma separated string)
 * into trimmed names, de-duplicated case-insensitively with first-seen casing
 * kept, in the order they were stored.
 */
export function normalizeOperationCategories(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]/)
      : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of raw) {
    if (typeof entry !== "string") continue
    const name = entry.trim()
    if (!name) continue
    const key = operationCategoryKey(name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/** Categories an operation belongs to (possibly none). */
export function getOperationCategories(operation: OperationAttributeSource | null | undefined): string[] {
  return normalizeOperationCategories(operation?.attributes?.[OPERATION_ATTR.categories])
}

/** Tracking tag ids this operation's "working on this now" pen carries. */
export function getOperationTrackingTagIds(
  operation: OperationAttributeSource | null | undefined,
): string[] {
  const raw = operation?.attributes?.[OPERATION_ATTR.trackingTagIds]
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of raw) {
    if (typeof entry !== "string") continue
    const id = entry.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** Attribute patch that stores tracking tag ids (serializable). */
export function operationTrackingTagIdsAttribute(ids: Iterable<string>): Record<string, AttributeValue> {
  return { [OPERATION_ATTR.trackingTagIds]: getOperationTrackingTagIds({ attributes: { [OPERATION_ATTR.trackingTagIds]: [...ids] } }) }
}

/** Add a category (no-op when already present, ignoring case). */
export function withOperationCategory(categories: string[], name: string): string[] {
  return normalizeOperationCategories([...categories, name])
}

/** Remove a category, ignoring case. */
export function withoutOperationCategory(categories: string[], name: string): string[] {
  const key = operationCategoryKey(name)
  return normalizeOperationCategories(categories).filter((c) => operationCategoryKey(c) !== key)
}

// ===========================================================================
// Presets — prebuilt panel sets so a new operation isn't shaped like a trip
// ===========================================================================

export interface OperationPreset {
  id: string
  name: string
  description: string
  panels: OperationPanelId[]
  /** Categories suggested (not forced) when creating from this preset. */
  categories?: string[]
}

export const OPERATION_PRESETS: readonly OperationPreset[] = [
  {
    id: "standard",
    name: "Standard",
    description: "To do, phases, parts, log, and the queue rail.",
    panels: sortOperationPanelIds(DEFAULT_OPERATION_PANELS),
  },
  {
    id: "blank",
    name: "Blank",
    description: "Home only. Switch panels on as the operation takes shape.",
    panels: ["home"],
  },
  {
    id: "trip",
    name: "Trip",
    description: "Timeline, locations map, plan doc, and packing tasks.",
    panels: sortOperationPanelIds(["home", "tasks", "timeline", "locations", "plan", "log", "queue"]),
    categories: ["trip"],
  },
  {
    id: "project",
    name: "Project",
    description: "Phases, parts, to-do, resources, and a log — for computer work and builds.",
    panels: sortOperationPanelIds(["home", "tasks", "phases", "parts", "resources", "log", "queue"]),
    categories: ["computer work"],
  },
  {
    id: "job",
    name: "Paid job",
    description: "Tasks, timeline, resources, and time logging for billable work.",
    panels: sortOperationPanelIds(["home", "tasks", "timeline", "resources", "log", "queue"]),
    categories: ["paid"],
  },
]

export function getOperationPreset(id: string): OperationPreset | undefined {
  return OPERATION_PRESETS.find((p) => p.id === id)
}

// ===========================================================================
// Item type definition
// ===========================================================================

const OPERATION_ATTRIBUTES: AttributeDefinition[] = [
  { id: OPERATION_ATTR.mission, name: "Mission", type: "string" },
  {
    id: OPERATION_ATTR.stage,
    name: "Stage",
    type: "selection",
    optionSource: "manual",
    options: [...OPERATION_STAGES],
  },
  // Categories are free-form and open-ended: the Operations home page collects
  // whatever names exist across operations, so no fixed option list here.
  { id: OPERATION_ATTR.categories, name: "Categories", type: "multistring" },
  { id: OPERATION_ATTR.targetDate, name: "Target Date", type: "datetime", datetimeMode: "date" },
  // The Home notes pad lives in the dedicated `homeNotes` attribute so it never
  // collides with the task's generic `notes` field.
  { id: OPERATION_ATTR.homeNotes, name: "Home Notes", type: "string" },
  {
    id: OPERATION_ATTR.trackingTagIds,
    name: "Tracking tags",
    type: "multistring",
  },
]

/** The Operation item-type definition (built-in; seeded at integration). */
export function getOperationTypeDefinition(): ItemTypeDefinition {
  return {
    id: OPERATION_TYPE_ID,
    name: "Operation",
    pluralName: "Operations",
    itemLabel: "operation",
    description:
      "A little graphic tool for any kind of project: its work, its ideas, its data, and its progress. Filed under any number of categories, and assembled from the panels it needs (to do, phases, parts, timeline, locations, plan, resources, log).",
    builtin: true,
    kind: "system",
    color: "#0f766e",
    attributes: OPERATION_ATTRIBUTES,
    defaultAttributeValues: {
      [OPERATION_ATTR.stage]: DEFAULT_OPERATION_STAGE,
    },
    displayedAttributes: [
      OPERATION_ATTR.stage,
      OPERATION_ATTR.categories,
      OPERATION_ATTR.mission,
      OPERATION_ATTR.targetDate,
    ],
    // Operations surface phases/parts/resources through the generic relations
    // panel ("dependencies") and roll up logged time ("time").
    detailPanels: ["details", "dependencies", "time", "analysis"],
    capabilities: {
      completable: true,
      subtasks: true,
      scheduleable: true,
      deadline: true,
      duration: true,
      nextActions: true,
    },
  }
}

/** Operation type id, for presence checks / seeding. */
export const OPERATION_TYPE_IDS = [OPERATION_TYPE_ID] as const

/**
 * Pure "register the Operation type" merge: returns `existing` with the
 * Operation type appended if missing (existing definitions are preserved
 * untouched, so this is idempotent and never removes user types). The
 * integration pass wires this into the built-in registry / item-type store.
 */
export function withOperationType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === OPERATION_TYPE_ID)) return existing
  return [...existing, getOperationTypeDefinition()]
}

/** Attribute patch that stores a panel selection (serializable). */
export function operationPanelsAttribute(ids: Iterable<OperationPanelId>): Record<string, AttributeValue> {
  return { [OPERATION_ATTR.panels]: sortOperationPanelIds(ids) }
}

/** Attribute patch that stores a category list (serializable). */
export function operationCategoriesAttribute(names: string[]): Record<string, AttributeValue> {
  return { [OPERATION_ATTR.categories]: normalizeOperationCategories(names) }
}
