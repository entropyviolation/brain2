/**
 * lib/time-tracking-store.ts — TimeGrid-style life tracker
 *
 * A color-grid tracker modeled after the Brain2 "TimeGrid". The user paints the
 * day with a "pen"; pens are grouped into independent *scopes* (Activity,
 * Location, Mood) so the same minute can be labeled along several dimensions,
 * each viewed and edited separately. This is the primary capture surface — what
 * the header "Tracking" button and the Home → Tracking tab render.
 *
 * Writes that change time, pens, or tags push onto `lib/action-history.ts` so
 * Cmd/Ctrl-Z can reverse a stroke. Selection and cell-size changes do not.
 *
 * ## Minutes, not slots
 *
 * Time is stored as **intervals** (`lib/time-entries.ts`), not a fixed array of
 * 15-minute slots. That buys minute-accurate tracking without paying for 1440
 * mostly-empty cells per scope per day, and it gives every painted block an
 * identity — so it can be listed, renamed, split, and deleted in the Activity Log
 * instead of being just a color. `gridStep` controls how coarsely the grid draws
 * and paints (1/5/10/15/30 min); it never changes what is stored.
 *
 * ## Three ways to label a minute
 *
 * - **Pen** — the label itself. One **primary** pen per minute per scope (grid
 *   color), plus optional **secondaries** that still feed tags/habits. A pen
 *   may sit under another in the same view (`parentId`): "taking out the trash"
 *   counts as Cleaning. Painting always writes the specific pen; `displayDepth`
 *   decides which ancestor you see (`lib/pen-tree.ts`). A pen may also carry
 *   **actionFormats** that log a Done-today row when a block is painted.
 * - **Variant** — a finer cut *within* a pen ("In conversation" → Elijah).
 *   Several may be true at once. Use this for overlapping labels; use parents
 *   when one thing *is a kind of* another.
 * - **Tag** — a cross-scope label from a shared library. Tags join Tracking to
 *   the Habits tab: a daily habit links tags and every minute painted with a
 *   matching pen counts toward its goal (`lib/tracked-time.ts` rolls up per tag,
 *   `lib/habit-tracking-sync.ts` writes the result).
 *
 * A stroke is **certain** unless the block is marked `precision: "estimated"`.
 * Analytics can drop assumed time. Future autolog pipelines (done tasks, ingest)
 * should stamp estimated rather than pretending the machine saw the day.
 *
 * Persisted to localStorage under `brain2-timegrid-store`. Persist **v12**
 * appends **iPhone Screen Time**, **iPhone Calls**, and **iPhone Texts**
 * (Telegram / Shortcuts pings, not Apple export or CallKit) without switching
 * `activeScopeId`. **v11** appends the **Screen Time** view
 * (ActivityWatch meaning, not a window watcher) without switching
 * `activeScopeId`. **v10** folds infinite day/week into one
 * `infiniteScroll` flag. **v9** adds hidden pens, untracked-gap notes, and
 * confirmed Day Log events. **v8** snaps the active view back to one that
 * actually has paint when the current view is empty (a leftover "Add view" was
 * hiding every date). **v7** stamps `lastUsedAt` from existing paint so Recent
 * sort works on older vaults. v6 adds the Company view, pen parents, and
 * per-view display depth. v5 added `dayNotes`. Bottom notes live in
 * `lib/day-notes-persist.ts` (`brain2-tracking-day-notes`) as an append log so a
 * hub pick of this blob cannot wipe the scratch pad. This persist blob does not
 * rewrite `dayNotes` on every submit. Persist merge and `lib/vault-guard.js`
 * overlay that dedicated map onto a richer hub of entries. Screen Time prefs
 * live in `lib/screentime/prefs.ts` (`brain2-screentime-prefs`), not this blob.
 * Target: MongoDB `timeIntervals` collection (see docs/SPEC_MAPPING.md §12).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage, registerPersistRehydrator } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { getDayNotesPersist, hydrateDayNotesFromStorage, mergeDayNotes, seedDayNotesPersist, setDayNotePersist } from "@/lib/day-notes-persist"
import {
  DEFAULT_GRID_STEP,
  DEFAULT_WEEK_STEP,
  MINUTES_PER_DAY,
  clearWrappingRange,
  entriesForDay,
  mergeAdjacent,
  moveEntry,
  normalizeIds,
  normalizeSecondaryPenIds,
  paintWrappingRange,
  splitEntry,
  wrappingSlices,
  untrackedNoteKey,
  type GridSpan,
  type GridStep,
  type PaintRangeInput,
  type TimeEntry,
  type TrackingPrecision,
  type WeekStep,
} from "@/lib/time-entries"
import { DEFAULT_DEPTH_LABELS, penAtDepth, wouldCycle, type DisplayDepth } from "@/lib/pen-tree"
import { lastUsedFromEntries, type PenSortMode } from "@/lib/pen-sort"
import {
  applyPenLinks,
  attachCompanion as attachCompanionTo,
  type CompanionTarget,
  type PenLink,
} from "@/lib/entry-links"
import { rememberWorld } from "@/lib/action-history"

export type { PenLink, CompanionTarget } from "@/lib/entry-links"

export { MINUTES_PER_DAY, type GridSpan, type GridStep, type TimeEntry, type TimeEntryKind, type TrackingPrecision, type WeekStep } from "@/lib/time-entries"
export type { DisplayDepth } from "@/lib/pen-tree"
export type { PenSortMode } from "@/lib/pen-sort"

/**
 * A cross-scope label attached to pens. Tags are the join key between Tracking
 * and daily habits (`lib/tracked-time.ts`, `lib/habit-tracking.ts`).
 */
export interface TrackTag {
  id: string
  name: string
  color: string
}

/**
 * A finer cut within a pen. Several may be true over the same minutes — an hour
 * of conversation can be with Elijah *and* Rebecca — which is why variants live
 * on the entry as a list rather than being separate pens: the parent total has to
 * stay one span of time so Analytics can show it whole before breaking it down.
 */
export interface PenVariant {
  id: string
  name: string
  /** Falls back to the pen's color when unset. */
  color?: string
}

export interface TrackPen {
  id: string
  name: string
  color: string
  /**
   * Another pen in this same view this one counts as. "Taking out the trash"
   * under Cleaning; "Balboa Park" under "At the park" under Out under Mexico.
   * Painting writes this pen. Display depth picks which ancestor you see.
   */
  parentId?: string
  /** `TrackTag` ids. A pen may carry several tags. */
  tags?: string[]
  /** What the variants answer, e.g. "Who?". Shown as the picker's heading. */
  variantLabel?: string
  variants?: PenVariant[]
  /** Epoch ms of the last stroke (or creation). Drives Recent sort. */
  lastUsedAt?: number
  /**
   * Standing cross-scope implications: "Ian's House always means Social".
   * Applied on every stroke by `lib/entry-links.ts`, which only ever fills
   * minutes the other scope left blank.
   */
  links?: PenLink[]
  /**
   * Templates that turn a painted block into a Done-today action
   * (`lib/pen-action-format.ts`). Empty/omitted means this pen does not log.
   * Several templates can compete: the most specific whose variables are all
   * present wins. Separate from habit tag links.
   */
  actionFormats?: PenActionFormat[]
  /**
   * Optional photograph / orb used in place of the solid color on the grid.
   * The image tiles across that pen's cells as a mosaic. Color remains the
   * fallback (palette bead, totals, assumed hatch).
   */
  image?: string
}

/**
 * One default-action template on a pen. `{minutes}`, `{hours}`, `{location}`,
 * `{project}`, `{name}` and kin are substituted from the block. Planned:
 * parallel counts-as chains and multi-select parents — not implemented; keep
 * `parentId` a single nest.
 */
export interface PenActionFormat {
  id: string
  /** e.g. "Went for a {minutes} minute walk at {location}" */
  template: string
}

export interface TrackScope {
  id: string
  name: string
  pens: TrackPen[]
  /**
   * Which ancestor of a painted pen this view currently shows. `null` / omitted
   * is Exact — the leaf that was painted. `0` is the root category.
   */
  displayDepth?: DisplayDepth
  /** Names for the depth buttons, last one being Exact. See `DEFAULT_DEPTH_LABELS`. */
  depthLabels?: string[]
}

interface TimeTrackingState {
  scopes: TrackScope[]
  /** Tag library shared by every scope. */
  tags: TrackTag[]
  /** Every tracked block, across all days and scopes. */
  entries: TimeEntry[]
  /**
   * Ids removed on purpose (delete, clear, split, a paint that ate a neighbor).
   * A union of two snapshots must not paint them back. Generated Screen Time
   * and sleep rows are not listed here — the sync that refreshes their batch
   * replaces them.
   */
  removedEntryIds: string[]
  /**
   * Plain-text scratch notes keyed by local calendar day (`YYYY-MM-DD`).
   * Mirrored to `cogs-tracking-day-notes` so the jot survives a hub pick
   * of this blob. Lives under every Tracking view so a jot on the grid is
   * still there on the Activity Log and Day Log for the same date.
   */
  dayNotes: Record<string, string>
  /** Cell size the grid draws and paints with. Storage stays minute-accurate. */
  gridStep: GridStep
  /** Whether the grid shows one day or a whole week. Purely a way of looking. */
  gridSpan: GridSpan
  /** Cell size for the week grid, which cannot afford the day grid's finest. */
  weekStep: WeekStep
  activeScopeId: string
  selectedPenId: string | null
  /** Variants applied to the next painted block. */
  selectedVariantIds: string[]
  /** How the palette lists pens. Default Recent. */
  penSort: PenSortMode

  setActiveScope: (id: string) => void
  setSelectedPen: (id: string | null) => void
  setPenSort: (mode: PenSortMode) => void
  setGridStep: (step: GridStep) => void
  setGridSpan: (span: GridSpan) => void
  setWeekStep: (step: WeekStep) => void
  setSelectedVariants: (ids: string[]) => void
  toggleSelectedVariant: (id: string) => void

  addScope: (name: string) => void
  removeScope: (id: string) => void
  renameScope: (id: string, name: string) => void
  setScopeDisplayDepth: (scopeId: string, depth: DisplayDepth) => void
  setScopeDepthLabels: (scopeId: string, labels: string[]) => void

  /** Returns the new pen's id so callers can select it straight away. */
  addPen: (scopeId: string, pen: Omit<TrackPen, "id">) => string
  updatePen: (scopeId: string, pen: TrackPen) => void
  removePen: (scopeId: string, penId: string) => void
  /** Nest `penId` under `parentId` in the same view. `null` makes it a root. */
  setPenParent: (scopeId: string, penId: string, parentId: string | null) => void

  /** Returns the new variant's id. Re-uses an existing same-named one. */
  addVariant: (scopeId: string, penId: string, name: string, color?: string) => string
  updateVariant: (scopeId: string, penId: string, variant: PenVariant) => void
  removeVariant: (scopeId: string, penId: string, variantId: string) => void

  /** Creates the tag (or returns the id of an existing same-named one). */
  addTag: (name: string, color?: string) => string
  updateTag: (tag: TrackTag) => void
  removeTag: (id: string) => void
  setPenTags: (scopeId: string, penId: string, tagIds: string[]) => void
  /** Standing "this pen also means that pen" rules — see `lib/entry-links.ts`. */
  setPenLinks: (scopeId: string, penId: string, links: PenLink[]) => void

  /** Paint a companion block across one block's window in another scope. */
  attachCompanion: (entryId: string, target: CompanionTarget, options?: { overwrite?: boolean }) => void

  /** Replace the plaintext notes for one local calendar day. Empty text drops the key. */
  setDayNotes: (date: string, text: string) => void
  /**
   * Notes on an untracked gap (Activity Log). Keyed by date|scope|start|end.
   * Empty text drops the key.
   */
  untrackedNotes: Record<string, string>
  setUntrackedNote: (date: string, scopeId: string, startMin: number, endMin: number, text: string) => void
  /**
   * Per-view hidden pens. Hidden pens stay in the vault and keep their paint;
   * they just leave the well so the palette stays the pens you actually use.
   */
  hiddenPenIds: Record<string, string[]>
  toggleHiddenPen: (scopeId: string, penId: string) => void
  /** One continuous strip (time left-to-right, day rows + week bands). */
  infiniteScroll: boolean
  setInfiniteScroll: (value: boolean) => void
  /** Calendar events the Day Log has confirmed into tracked blocks. */
  confirmedEventIds: string[]
  confirmEventId: (id: string) => void

  /** Paint `[startMin, endMin)`. A null pen erases. `endMin` earlier than `startMin` continues onto the next day. */
  paintMinutes: (
    date: string,
    scopeId: string,
    startMin: number,
    endMin: number,
    penId: string | null,
    variantIds?: string[],
    spanId?: string,
    precision?: TrackingPrecision,
    extras?: Partial<
      Pick<
        PaintRangeInput,
        "title" | "notes" | "kind" | "startEventId" | "endEventId" | "tagIds" | "secondaryPenIds" | "endDate"
      >
    >,
  ) => void
  clearDay: (date: string, scopeId: string) => void

  updateEntry: (id: string, patch: Partial<Omit<TimeEntry, "id">>, wrapEndDate?: string) => void
  removeEntry: (id: string) => void
  splitEntryAt: (id: string, atMin: number) => void
  moveEntryTo: (id: string, startMin: number, endMin: number) => void
  entriesFor: (date: string, scopeId: string) => TimeEntry[]
}

const rid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const TAG_PALETTE = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#0ea5e9",
  "#ef4444",
  "#84cc16",
]

/** Offered when creating a pen, so new pens do not all come out indigo. */
export const PEN_PALETTE = [
  "#2563eb",
  "#0ea5e9",
  "#10b981",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#a855f7",
  "#8b5cf6",
  "#64748b",
]

/** The seeded tag library. Exported so tests can restore a clean slate. */
export const defaultTags = (): TrackTag[] => [
  { id: "tag-work", name: "Work", color: "#2563eb" },
  { id: "tag-rest", name: "Rest", color: "#10b981" },
  { id: "tag-exercise", name: "Exercise", color: "#f59e0b" },
  { id: "tag-social", name: "Social", color: "#ec4899" },
  { id: "tag-cleaning", name: "Cleaning", color: "#8b5cf6" },
  { id: "tag-sleep", name: "Sleep", color: "#1e293b" },
]

/** Tags pre-attached to the seeded pens, so the habit link works out of the box. */
const DEFAULT_PEN_TAGS: Record<string, string[]> = {
  "act-work": ["tag-work"],
  "act-rest": ["tag-rest"],
  "act-exercise": ["tag-exercise"],
  "act-social": ["tag-social"],
  "act-chores": ["tag-cleaning"],
  "act-sleep": ["tag-sleep"],
}

/** Who you were with — a dimension of its own, not an Activity called "hanging out". */
export function defaultCompanyScope(): TrackScope {
  return {
    id: "company",
    name: "Company",
    depthLabels: DEFAULT_DEPTH_LABELS.company,
    pens: [
      { id: "co-alone", name: "Alone", color: "#64748b" },
      { id: "co-together", name: "Together", color: "#f59e0b" },
      {
        id: "co-talking",
        name: "In conversation",
        color: "#ec4899",
        parentId: "co-together",
        variantLabel: "Who?",
      },
    ],
  }
}

/** ActivityWatch meaning — apps under category roots. Not a window watcher. */
export const SCREENTIME_SCOPE_ID = "screentime"

export const SCREENTIME_CATEGORY_PENS: TrackPen[] = [
  { id: "st-cat-work", name: "Work", color: "#2563eb" },
  { id: "st-cat-communication", name: "Communication", color: "#ec4899" },
  { id: "st-cat-browsing", name: "Browsing", color: "#0ea5e9" },
  { id: "st-cat-media", name: "Media", color: "#8b5cf6" },
  { id: "st-cat-system", name: "System", color: "#64748b" },
  { id: "st-cat-other", name: "Other", color: "#f59e0b" },
]

const normalizeName = (name: string) => name.trim().toLowerCase()

export function isScreenTimeScope(scope: Pick<TrackScope, "id" | "name">): boolean {
  return scope.id === SCREENTIME_SCOPE_ID || normalizeName(scope.name) === "screen time"
}

export function findScreenTimeScope(scopes: TrackScope[]): TrackScope | undefined {
  return scopes.find(isScreenTimeScope)
}

export function defaultScreenTimeScope(): TrackScope {
  return {
    id: SCREENTIME_SCOPE_ID,
    name: "Screen Time",
    depthLabels: DEFAULT_DEPTH_LABELS.screentime,
    pens: SCREENTIME_CATEGORY_PENS.map((pen) => ({ ...pen })),
  }
}

/** Phone pings — Telegram / Shortcuts. Not Mac ActivityWatch. Distinct pen ids. */
export const IPHONE_SCREENTIME_SCOPE_ID = "iphone-screentime"

export const IPHONE_SCREENTIME_CATEGORY_PENS: TrackPen[] = [
  { id: "iphone-st-cat-work", name: "Work", color: "#2563eb" },
  { id: "iphone-st-cat-communication", name: "Communication", color: "#ec4899" },
  { id: "iphone-st-cat-browsing", name: "Browsing", color: "#0ea5e9" },
  { id: "iphone-st-cat-media", name: "Media", color: "#8b5cf6" },
  { id: "iphone-st-cat-system", name: "System", color: "#64748b" },
  { id: "iphone-st-cat-other", name: "Other", color: "#f59e0b" },
]

export function isIphoneScreenTimeScope(scope: Pick<TrackScope, "id" | "name">): boolean {
  return scope.id === IPHONE_SCREENTIME_SCOPE_ID || normalizeName(scope.name) === "iphone screen time"
}

export function findIphoneScreenTimeScope(scopes: TrackScope[]): TrackScope | undefined {
  return scopes.find(isIphoneScreenTimeScope)
}

export function defaultIphoneScreenTimeScope(): TrackScope {
  return {
    id: IPHONE_SCREENTIME_SCOPE_ID,
    name: "iPhone Screen Time",
    depthLabels: DEFAULT_DEPTH_LABELS["iphone-screentime"],
    pens: IPHONE_SCREENTIME_CATEGORY_PENS.map((pen) => ({ ...pen })),
  }
}

/** People you called — Telegram / Shortcuts. Not a CallKit watcher. */
export const IPHONE_CALLS_SCOPE_ID = "iphone-calls"

export function isIphoneCallsScope(scope: Pick<TrackScope, "id" | "name">): boolean {
  return scope.id === IPHONE_CALLS_SCOPE_ID || normalizeName(scope.name) === "iphone calls"
}

export function findIphoneCallsScope(scopes: TrackScope[]): TrackScope | undefined {
  return scopes.find(isIphoneCallsScope)
}

export function defaultIphoneCallsScope(): TrackScope {
  return {
    id: IPHONE_CALLS_SCOPE_ID,
    name: "iPhone Calls",
    depthLabels: DEFAULT_DEPTH_LABELS["iphone-calls"],
    pens: [],
  }
}

/** Texts you sent us — Telegram / Share Sheet. Not an iMessage interceptor. */
export const IPHONE_TEXTS_SCOPE_ID = "iphone-texts"

export function isIphoneTextsScope(scope: Pick<TrackScope, "id" | "name">): boolean {
  return scope.id === IPHONE_TEXTS_SCOPE_ID || normalizeName(scope.name) === "iphone texts"
}

export function findIphoneTextsScope(scopes: TrackScope[]): TrackScope | undefined {
  return scopes.find(isIphoneTextsScope)
}

export function defaultIphoneTextsScope(): TrackScope {
  return {
    id: IPHONE_TEXTS_SCOPE_ID,
    name: "iPhone Texts",
    depthLabels: DEFAULT_DEPTH_LABELS["iphone-texts"],
    pens: [],
  }
}

/** The seeded scopes and pens. Exported so tests can restore a clean slate. */
export const defaultScopes = (): TrackScope[] => [
  {
    id: "activity",
    name: "Activity",
    depthLabels: DEFAULT_DEPTH_LABELS.activity,
    pens: [
      { id: "act-work", name: "Work", color: "#2563eb", tags: ["tag-work"], variantLabel: "What on?" },
      { id: "act-rest", name: "Rest", color: "#10b981", tags: ["tag-rest"] },
      { id: "act-exercise", name: "Exercise", color: "#f59e0b", tags: ["tag-exercise"], variantLabel: "Which?" },
      { id: "act-social", name: "Social", color: "#ec4899", tags: ["tag-social"], variantLabel: "Who with?" },
      { id: "act-chores", name: "Chores", color: "#8b5cf6", tags: ["tag-cleaning"] },
      { id: "act-sleep", name: "Sleep", color: "#1e293b", tags: ["tag-sleep"] },
    ],
  },
  {
    id: "location",
    name: "Location",
    depthLabels: DEFAULT_DEPTH_LABELS.location,
    pens: [
      { id: "loc-home", name: "Home", color: "#16a34a" },
      { id: "loc-work", name: "Work", color: "#0ea5e9" },
      { id: "loc-out", name: "Outside", color: "#f97316" },
      { id: "loc-transit", name: "Transit", color: "#a855f7" },
    ],
  },
  {
    id: "mood",
    name: "Mood",
    depthLabels: DEFAULT_DEPTH_LABELS.mood,
    pens: [
      { id: "mood-great", name: "Great", color: "#22c55e" },
      { id: "mood-good", name: "Good", color: "#84cc16" },
      { id: "mood-meh", name: "Meh", color: "#eab308" },
      { id: "mood-low", name: "Low", color: "#ef4444" },
    ],
  },
  defaultCompanyScope(),
  defaultScreenTimeScope(),
  defaultIphoneScreenTimeScope(),
  defaultIphoneCallsScope(),
  defaultIphoneTextsScope(),
]

/** Drop links pointing at something that no longer exists. */
function withoutLinksTo(pen: TrackPen, matches: (link: PenLink) => boolean): TrackPen {
  if (!pen.links?.some(matches)) return pen
  const kept = pen.links.filter((l) => !matches(l))
  return { ...pen, links: kept.length ? kept : undefined }
}

// ---- migration --------------------------------------------------------------

const LEGACY_SLOT_MINUTES = 15

interface LegacyBlockDetail {
  date: string
  scopeId: string
  penId: string
  startSlot: number
  endSlot: number
  notes?: string
  title?: string
  pages?: number
  project?: string
  books?: string
}

interface LegacyState {
  scopes?: TrackScope[]
  tags?: TrackTag[]
  data?: Record<string, Record<string, (string | null)[]>>
  blockDetails?: LegacyBlockDetail[]
  entries?: TimeEntry[]
  dayNotes?: Record<string, string>
  untrackedNotes?: Record<string, string>
  hiddenPenIds?: Record<string, string[]>
  infiniteDay?: boolean
  infiniteWeek?: boolean
  infiniteScroll?: boolean
  confirmedEventIds?: string[]
  gridStep?: GridStep
  activeScopeId?: string
  selectedPenId?: string | null
  penSort?: PenSortMode
}

/**
 * v3 introduced the tag library. Stores written before it get the default tags
 * plus the seeded pen assignments, so an existing vault gains the habit link
 * without the user re-labeling their Activity pens. v5 adds `dayNotes`. v6 adds
 * the Company view (if the vault has no view named Company) and named depth
 * labels on the seeded scopes. v7 stamps `lastUsedAt` from existing paint.
 * v9 adds view prefs (hidden pens, infinite scroll) and untracked-gap notes.
 * v11 appends Screen Time without changing the active view. v12 appends
 * iPhone Screen Time the same way.
 */
function migrateTags(state: LegacyState): LegacyState {
  if (Array.isArray(state.tags)) return state
  return {
    ...state,
    tags: defaultTags(),
    scopes: (state.scopes || []).map((scope) => ({
      ...scope,
      pens: scope.pens.map((pen) => (pen.tags ? pen : { ...pen, tags: DEFAULT_PEN_TAGS[pen.id] ?? [] })),
    })),
  }
}

/**
 * v4 replaced the 96-slot arrays with minute intervals. Each run of identical
 * neighbouring slots becomes one entry at 15-minute boundaries, so painted time
 * is preserved exactly; block details are re-attached to whichever entry they
 * overlap. Nothing is lost, and the grid is free to go finer from here on.
 */
export function migrateSlotsToEntries(state: LegacyState): LegacyState {
  if (Array.isArray(state.entries)) return state
  const entries: TimeEntry[] = []
  const details = state.blockDetails ?? []

  for (const [date, scopes] of Object.entries(state.data ?? {})) {
    for (const [scopeId, slots] of Object.entries(scopes ?? {})) {
      if (!Array.isArray(slots)) continue
      let runStart = -1
      let runPen: string | null = null

      const flush = (endSlot: number) => {
        if (runStart < 0 || !runPen) return
        const startMin = runStart * LEGACY_SLOT_MINUTES
        const endMin = Math.min(MINUTES_PER_DAY, (endSlot + 1) * LEGACY_SLOT_MINUTES)
        const detail = details.find(
          (d) =>
            d.date === date &&
            d.scopeId === scopeId &&
            d.penId === runPen &&
            d.startSlot <= endSlot &&
            d.endSlot >= runStart,
        )
        entries.push({
          id: rid("te"),
          date,
          scopeId,
          penId: runPen,
          startMin,
          endMin,
          ...(detail
            ? {
                notes: detail.notes,
                title: detail.title,
                pages: detail.pages,
                project: detail.project,
                books: detail.books,
              }
            : {}),
        })
        runStart = -1
        runPen = null
      }

      slots.forEach((penId, index) => {
        if (penId && penId === runPen) return
        flush(index - 1)
        if (penId) {
          runStart = index
          runPen = penId
        }
      })
      flush(slots.length - 1)
    }
  }

  const { data: _data, blockDetails: _blockDetails, ...rest } = state
  return { ...rest, entries, gridStep: state.gridStep ?? DEFAULT_GRID_STEP }
}

export function migrateCompanyAndDepth(state: LegacyState): LegacyState {
  const scopes = [...(state.scopes ?? [])]
  const hasCompany = scopes.some((s) => s.id === "company" || normalizeName(s.name) === "company")
  if (!hasCompany) scopes.push(defaultCompanyScope())
  return {
    ...state,
    scopes: scopes.map((scope) => ({
      ...scope,
      depthLabels: scope.depthLabels?.length ? scope.depthLabels : DEFAULT_DEPTH_LABELS[scope.id],
    })),
  }
}

/**
 * v11 appends Screen Time when the vault has no view with that id or name.
 * Never switches `activeScopeId` — adding a machine grid must not hide Activity.
 */
export function migrateScreenTime(state: LegacyState): LegacyState {
  const scopes = [...(state.scopes ?? [])]
  const hasScreenTime = scopes.some(isScreenTimeScope)
  if (!hasScreenTime) scopes.push(defaultScreenTimeScope())
  return {
    ...state,
    scopes: scopes.map((scope) => ({
      ...scope,
      depthLabels: scope.depthLabels?.length ? scope.depthLabels : DEFAULT_DEPTH_LABELS[scope.id],
    })),
  }
}

/**
 * v12 appends iPhone Screen Time / Calls / Texts when missing (id or name).
 * Never switches `activeScopeId`. Never touches Mac `screentime`.
 */
export function migrateIphoneScreenTime(state: LegacyState): LegacyState {
  const scopes = [...(state.scopes ?? [])]
  if (!scopes.some(isIphoneScreenTimeScope)) scopes.push(defaultIphoneScreenTimeScope())
  if (!scopes.some(isIphoneCallsScope)) scopes.push(defaultIphoneCallsScope())
  if (!scopes.some(isIphoneTextsScope)) scopes.push(defaultIphoneTextsScope())
  return { ...state, scopes }
}

export function migrateRecentPens(state: LegacyState): LegacyState {
  const latest = lastUsedFromEntries(state.entries ?? [])
  return {
    ...state,
    penSort: state.penSort ?? "recent",
    scopes: (state.scopes ?? []).map((scope) => ({
      ...scope,
      pens: scope.pens.map((pen) =>
        pen.lastUsedAt || !latest[pen.id] ? pen : { ...pen, lastUsedAt: latest[pen.id] },
      ),
    })),
  }
}

/**
 * If the saved view has never been painted and another view has, open that one
 * instead. Adding a view used to switch to it immediately; a vault that last
 * looked at an empty "discrete events" (one Default pen) then showed 0% on
 * every date while Activity still held every hour.
 */
export function restoreOccupiedScope(state: LegacyState): LegacyState {
  const entries = state.entries ?? []
  const scopes = state.scopes ?? []
  if (entries.length === 0) return state
  if (entries.some((entry) => entry.scopeId === state.activeScopeId)) return state
  const fallback = scopes.find((scope) => entries.some((entry) => entry.scopeId === scope.id))
  if (!fallback) return state
  return {
    ...state,
    activeScopeId: fallback.id,
    selectedPenId: fallback.pens[0]?.id ?? state.selectedPenId,
  }
}

function migrate(persisted: unknown, version: number): LegacyState {
  let state = (persisted ?? {}) as LegacyState
  if (version < 3) state = migrateTags(state)
  if (version < 4) state = migrateSlotsToEntries(state)
  if (version < 5) state = { ...state, dayNotes: state.dayNotes ?? {} }
  if (version < 6) state = migrateCompanyAndDepth(state)
  if (version < 7) state = migrateRecentPens(state)
  if (version < 8) state = restoreOccupiedScope(state)
  if (version < 9) {
    state = {
      ...state,
      untrackedNotes: state.untrackedNotes ?? {},
      hiddenPenIds: state.hiddenPenIds ?? {},
      infiniteDay: state.infiniteDay ?? false,
      infiniteWeek: state.infiniteWeek ?? false,
      confirmedEventIds: state.confirmedEventIds ?? [],
    }
  }
  if (version < 10) {
    state = {
      ...state,
      infiniteScroll: state.infiniteScroll ?? Boolean(state.infiniteDay || state.infiniteWeek),
    }
  }
  if (version < 11) state = migrateScreenTime(state)
  if (version < 12) state = migrateIphoneScreenTime(state)
  return state
}

// ---- store ------------------------------------------------------------------

/** Remember ids this edit dropped so a later union cannot paint the block back. */
function dropping(
  state: { entries: TimeEntry[]; removedEntryIds?: string[] },
  entries: TimeEntry[],
): { entries: TimeEntry[]; removedEntryIds: string[] } {
  const live = new Set(entries.map((entry) => entry.id))
  const removed = new Set(state.removedEntryIds ?? [])
  for (const entry of state.entries) {
    if (!live.has(entry.id)) removed.add(entry.id)
  }
  const removedEntryIds = removed.size > 4000 ? [...removed].slice(removed.size - 4000) : [...removed]
  return { entries, removedEntryIds }
}

export const useTimeTrackingStore = create<TimeTrackingState>()(
  persist(
    (set, get) => ({
      scopes: defaultScopes(),
      tags: defaultTags(),
      entries: [],
      removedEntryIds: [],
      dayNotes: {},
      untrackedNotes: {},
      hiddenPenIds: {},
      infiniteScroll: false,
      confirmedEventIds: [],
      gridStep: DEFAULT_GRID_STEP,
      gridSpan: "day",
      weekStep: DEFAULT_WEEK_STEP,
      activeScopeId: "activity",
      selectedPenId: null,
      selectedVariantIds: [],
      penSort: "recent",

      setActiveScope: (id) => {
        const scope = get().scopes.find((s) => s.id === id)
        set({ activeScopeId: id, selectedPenId: scope?.pens[0]?.id ?? null, selectedVariantIds: [] })
      },
      // Variants belong to a pen, so switching pens drops the selection rather
      // than silently carrying Elijah over onto "Work".
      setSelectedPen: (id) => set({ selectedPenId: id, selectedVariantIds: [] }),
      setPenSort: (mode) => set({ penSort: mode }),
      setGridStep: (step) => set({ gridStep: step }),
      setGridSpan: (span) => set({ gridSpan: span }),
      setWeekStep: (step) => set({ weekStep: step }),
      setSelectedVariants: (ids) => set({ selectedVariantIds: [...new Set(ids)] }),
      toggleSelectedVariant: (id) =>
        set((state) => ({
          selectedVariantIds: state.selectedVariantIds.includes(id)
            ? state.selectedVariantIds.filter((v) => v !== id)
            : [...state.selectedVariantIds, id],
        })),

      addScope: (name) => {
        rememberWorld("add scope")
        set((state) => {
          const penId = rid("pen")
          const scope: TrackScope = {
            id: rid("scope"),
            name,
            pens: [{ id: penId, name: "Default", color: "#6366f1" }],
          }
          // Stay on the current view. Switching here hid every painted date
          // behind an empty Default pen (see persist v8 / restoreOccupiedScope).
          return { scopes: [...state.scopes, scope] }
        })
      },
      removeScope: (id) => {
        rememberWorld("remove scope")
        set((state) => ({
          scopes: state.scopes
            .filter((s) => s.id !== id)
            .map((s) => ({ ...s, pens: s.pens.map((p) => withoutLinksTo(p, (l) => l.scopeId === id)) })),
          ...dropping(
            state,
            state.entries.filter((e) => e.scopeId !== id),
          ),
          activeScopeId: state.activeScopeId === id ? state.scopes[0]?.id ?? "" : state.activeScopeId,
        }))
      },
      renameScope: (id, name) => {
        rememberWorld("rename scope")
        set((state) => ({ scopes: state.scopes.map((s) => (s.id === id ? { ...s, name } : s)) }))
      },
      setScopeDisplayDepth: (scopeId, depth) => {
        set((state) => ({
          scopes: state.scopes.map((s) => (s.id === scopeId ? { ...s, displayDepth: depth } : s)),
        }))
      },
      setScopeDepthLabels: (scopeId, labels) => {
        set((state) => ({
          scopes: state.scopes.map((s) => (s.id === scopeId ? { ...s, depthLabels: labels } : s)),
        }))
      },

      // A nameless pen is invisible in the palette and unusable everywhere else,
      // so refuse to make one rather than leaving a blank swatch behind.
      addPen: (scopeId, pen) => {
        const name = String(pen?.name ?? "").trim()
        if (!name) return ""
        rememberWorld("add pen")
        const id = rid("pen")
        const at = Date.now()
        set((state) => ({
          scopes: state.scopes.map((s) =>
            s.id === scopeId ? { ...s, pens: [...s.pens, { ...pen, name, id, lastUsedAt: at }] } : s,
          ),
        }))
        return id
      },
      updatePen: (scopeId, pen) => {
        rememberWorld("update pen")
        set((state) => ({
          scopes: state.scopes.map((s) =>
            s.id === scopeId ? { ...s, pens: s.pens.map((p) => (p.id === pen.id ? pen : p)) } : s,
          ),
        }))
      },
      removePen: (scopeId, penId) => {
        rememberWorld("remove pen")
        set((state) => {
          const orphanParent = state.scopes.find((s) => s.id === scopeId)?.pens.find((p) => p.id === penId)?.parentId
          return {
            scopes: state.scopes.map((s) => ({
              ...s,
              pens: (s.id === scopeId ? s.pens.filter((p) => p.id !== penId) : s.pens).map((p) => {
                const next = withoutLinksTo(p, (l) => l.penId === penId)
                if (s.id === scopeId && next.parentId === penId) {
                  return { ...next, parentId: orphanParent }
                }
                return next
              }),
            })),
            // Time painted with a deleted pen is time that did not happen
            // when it was the primary. A secondary mention is dropped, not the block.
            entries: state.entries
              .filter((e) => e.penId !== penId)
              .map((e) =>
                e.secondaryPenIds?.includes(penId)
                  ? { ...e, secondaryPenIds: normalizeIds(e.secondaryPenIds.filter((id) => id !== penId)) }
                  : e,
              ),
            selectedPenId: state.selectedPenId === penId ? null : state.selectedPenId,
          }
        })
      },
      setPenParent: (scopeId, penId, parentId) => {
        rememberWorld("set pen parent")
        set((state) => ({
          scopes: state.scopes.map((s) => {
            if (s.id !== scopeId) return s
            if (parentId && wouldCycle(s.pens, penId, parentId)) return s
            return {
              ...s,
              pens: s.pens.map((p) =>
                p.id === penId ? { ...p, parentId: parentId || undefined } : p,
              ),
            }
          }),
        }))
      },

      addVariant: (scopeId, penId, name, color) => {
        const trimmed = name.trim()
        if (!trimmed) return ""
        const pen = get().scopes.find((s) => s.id === scopeId)?.pens.find((p) => p.id === penId)
        const existing = pen?.variants?.find((v) => normalizeName(v.name) === normalizeName(trimmed))
        if (existing) return existing.id
        rememberWorld("add variant")
        const id = rid("var")
        set((state) => ({
          scopes: state.scopes.map((s) =>
            s.id !== scopeId
              ? s
              : {
                  ...s,
                  pens: s.pens.map((p) =>
                    p.id !== penId
                      ? p
                      : {
                          ...p,
                          variants: [
                            ...(p.variants ?? []),
                            {
                              id,
                              name: trimmed,
                              color: color || TAG_PALETTE[(p.variants?.length ?? 0) % TAG_PALETTE.length],
                            },
                          ],
                        },
                  ),
                },
          ),
        }))
        return id
      },
      updateVariant: (scopeId, penId, variant) => {
        rememberWorld("update variant")
        set((state) => ({
          scopes: state.scopes.map((s) =>
            s.id !== scopeId
              ? s
              : {
                  ...s,
                  pens: s.pens.map((p) =>
                    p.id !== penId
                      ? p
                      : { ...p, variants: (p.variants ?? []).map((v) => (v.id === variant.id ? variant : v)) },
                  ),
                },
          ),
        }))
      },
      removeVariant: (scopeId, penId, variantId) => {
        rememberWorld("remove variant")
        set((state) => ({
          scopes: state.scopes.map((s) => ({
            ...s,
            pens: s.pens.map((p) => {
              const base =
                s.id === scopeId && p.id === penId
                  ? { ...p, variants: (p.variants ?? []).filter((v) => v.id !== variantId) }
                  : p
              // Another pen's link may pre-tick this variant; that half of the
              // rule is gone, but the link itself still means something.
              if (!base.links?.some((l) => l.variantIds?.includes(variantId))) return base
              return {
                ...base,
                links: base.links.map((l) =>
                  l.variantIds?.includes(variantId)
                    ? { ...l, variantIds: l.variantIds.filter((v) => v !== variantId) }
                    : l,
                ),
              }
            }),
          })),
          // The time itself survives; it just loses that label.
          entries: state.entries.map((e) =>
            e.variantIds?.includes(variantId)
              ? { ...e, variantIds: normalizeIds(e.variantIds.filter((v) => v !== variantId)) }
              : e,
          ),
          selectedVariantIds: state.selectedVariantIds.filter((v) => v !== variantId),
        }))
      },

      addTag: (name, color) => {
        const trimmed = name.trim()
        if (!trimmed) return ""
        const existing = get().tags.find((t) => normalizeName(t.name) === normalizeName(trimmed))
        if (existing) return existing.id
        rememberWorld("add tag")
        const id = rid("tag")
        set((state) => ({
          tags: [
            ...state.tags,
            { id, name: trimmed, color: color || TAG_PALETTE[state.tags.length % TAG_PALETTE.length] },
          ],
        }))
        return id
      },
      updateTag: (tag) => {
        rememberWorld("update tag")
        set((state) => ({ tags: state.tags.map((t) => (t.id === tag.id ? tag : t)) }))
      },
      removeTag: (id) => {
        rememberWorld("remove tag")
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== id),
          scopes: state.scopes.map((s) => ({
            ...s,
            pens: s.pens.map((p) => (p.tags?.includes(id) ? { ...p, tags: p.tags.filter((t) => t !== id) } : p)),
          })),
          // Blocks that carried the tag on their own keep their time; a deleted
          // tag must not linger as a dangling id on them either.
          entries: state.entries.map((e) =>
            e.tagIds?.includes(id) ? { ...e, tagIds: normalizeIds(e.tagIds.filter((t) => t !== id)) } : e,
          ),
        }))
      },
      setPenTags: (scopeId, penId, tagIds) => {
        rememberWorld("set pen tags")
        set((state) => ({
          scopes: state.scopes.map((s) =>
            s.id === scopeId
              ? { ...s, pens: s.pens.map((p) => (p.id === penId ? { ...p, tags: [...new Set(tagIds)] } : p)) }
              : s,
          ),
        }))
      },
      setPenLinks: (scopeId, penId, links) => {
        rememberWorld("set pen links")
        set((state) => ({
          scopes: state.scopes.map((s) =>
            s.id === scopeId
              ? { ...s, pens: s.pens.map((p) => (p.id === penId ? { ...p, links: links.length ? links : undefined } : p)) }
              : s,
          ),
        }))
      },

      attachCompanion: (entryId, target, options) => {
        rememberWorld("attach companion")
        set((state) => {
          const entry = state.entries.find((e) => e.id === entryId)
          if (!entry) return state
          return dropping(state, attachCompanionTo(state.entries, entry, target, options ?? {}, () => rid("te")))
        })
      },

      paintMinutes: (date, scopeId, startMin, endMin, penId, variantIds, spanId, precision, extras) => {
        rememberWorld(penId ? "paint" : "erase")
        set((state) => {
          if (!penId) {
            return dropping(state, clearWrappingRange(state.entries, date, scopeId, startMin, endMin, () => rid("te")))
          }
          const painted = paintWrappingRange(
            state.entries,
            {
              date,
              scopeId,
              penId,
              startMin,
              endMin,
              variantIds,
              spanId,
              precision: precision === "estimated" ? "estimated" : undefined,
              title: extras?.title,
              notes: extras?.notes,
              kind: extras?.kind,
              startEventId: extras?.startEventId,
              endEventId: extras?.endEventId,
              tagIds: extras?.tagIds,
              secondaryPenIds: extras?.secondaryPenIds,
              endDate: extras?.endDate,
            },
            () => rid("te"),
          )
          // Standing links fire on the stroke, not on the whole day: painting
          // one block must not reach back and fill in around older ones.
          const slices = wrappingSlices(date, startMin, endMin, extras?.endDate)
          let next = painted
          for (const entry of painted) {
            if (entry.scopeId !== scopeId) continue
            const hit = slices.some(
              (slice) =>
                entry.date === slice.date &&
                entry.endMin > slice.startMin &&
                entry.startMin < slice.endMin,
            )
            if (!hit) continue
            next = applyPenLinks(next, state.scopes, entry, () => rid("te"))
          }
          return { ...dropping(state, next), scopes: stampPenUse(state.scopes, scopeId, penId) }
        })
      },

      clearDay: (date, scopeId) => {
        rememberWorld("clear day")
        set((state) =>
          dropping(
            state,
            state.entries.filter((e) => e.date !== date || e.scopeId !== scopeId),
          ),
        )
      },

      updateEntry: (id, patch, wrapEndDate) => {
        rememberWorld("edit block")
        set((state) => {
          const target = state.entries.find((e) => e.id === id)
          if (!target) return state
          const next = { ...target, ...patch, id: target.id }
          if (patch.variantIds !== undefined) next.variantIds = normalizeIds(patch.variantIds)
          if (patch.tagIds !== undefined) next.tagIds = normalizeIds(patch.tagIds)
          if (patch.secondaryPenIds !== undefined || patch.penId !== undefined) {
            next.secondaryPenIds = normalizeSecondaryPenIds(next.penId, next.secondaryPenIds)
          }
          // Bounds moved → go through moveEntry so it clears what it lands on.
          if (
            next.startMin !== target.startMin ||
            next.endMin !== target.endMin ||
            next.date !== target.date ||
            wrapEndDate
          ) {
            const wraps = wrappingSlices(next.date, next.startMin, next.endMin, wrapEndDate)
            const withoutSiblings =
              target.spanId
                ? state.entries.filter((e) => e.id === id || e.spanId !== target.spanId)
                : state.entries
            if (wraps.length > 1) {
              return dropping(
                state,
                paintWrappingRange(
                  withoutSiblings.filter((e) => e.id !== id),
                  {
                    date: next.date,
                    scopeId: next.scopeId,
                    penId: next.penId,
                    startMin: next.startMin,
                    endMin: next.endMin,
                    endDate: wrapEndDate,
                    variantIds: next.variantIds,
                    tagIds: next.tagIds,
                    secondaryPenIds: next.secondaryPenIds,
                    title: next.title,
                    notes: next.notes,
                    project: next.project,
                    books: next.books,
                    pages: next.pages,
                    spanId: target.spanId,
                    precision: next.precision,
                  },
                  () => rid("te"),
                ),
              )
            }
            const moved = moveEntry(
              withoutSiblings.map((e) =>
                e.id === id ? { ...next, startMin: target.startMin, endMin: target.endMin } : e,
              ),
              id,
              next.startMin,
              next.endMin,
              () => rid("te"),
            )
            return dropping(
              state,
              moved.map((e) => (e.id === id ? { ...e, date: next.date } : e)),
            )
          }
          return {
            ...dropping(
              state,
              mergeAdjacent(
                state.entries.map((e) => (e.id === id ? next : e)),
                target.date,
                target.scopeId,
              ),
            ),
            ...(next.penId !== target.penId ? { scopes: stampPenUse(state.scopes, next.scopeId, next.penId) } : {}),
          }
        })
      },

      removeEntry: (id) => {
        rememberWorld("delete block")
        set((state) => {
          const target = state.entries.find((e) => e.id === id)
          if (!target) return state
          if (target.spanId) {
            return dropping(
              state,
              state.entries.filter((e) => e.spanId !== target.spanId),
            )
          }
          return dropping(
            state,
            state.entries.filter((e) => e.id !== id),
          )
        })
      },

      splitEntryAt: (id, atMin) => {
        rememberWorld("split block")
        set((state) => dropping(state, splitEntry(state.entries, id, atMin, () => rid("te"))))
      },

      moveEntryTo: (id, startMin, endMin) => {
        rememberWorld("move block")
        set((state) => dropping(state, moveEntry(state.entries, id, startMin, endMin, () => rid("te"))))
      },

      setDayNotes: (date, text) => {
        // Dedicated key first — the timegrid blob can lose this jot on hub pick.
        setDayNotePersist(date, text)
        set((state) => {
          const current = state.dayNotes ?? {}
          if (!text) {
            if (!(date in current)) return state
            const { [date]: _dropped, ...rest } = current
            return { dayNotes: rest }
          }
          if (current[date] === text) return state
          return { dayNotes: { ...current, [date]: text } }
        })
      },

      setUntrackedNote: (date, scopeId, startMin, endMin, text) => {
        const key = untrackedNoteKey(date, scopeId, startMin, endMin)
        set((state) => {
          const current = state.untrackedNotes ?? {}
          if (!text.trim()) {
            if (!(key in current)) return state
            const { [key]: _dropped, ...rest } = current
            return { untrackedNotes: rest }
          }
          return { untrackedNotes: { ...current, [key]: text } }
        })
      },

      toggleHiddenPen: (scopeId, penId) => {
        set((state) => {
          const current = state.hiddenPenIds[scopeId] ?? []
          const hidden = current.includes(penId)
            ? current.filter((id) => id !== penId)
            : [...current, penId]
          return {
            hiddenPenIds: { ...state.hiddenPenIds, [scopeId]: hidden },
            selectedPenId: state.selectedPenId === penId ? null : state.selectedPenId,
          }
        })
      },

      setInfiniteScroll: (value) => set({ infiniteScroll: value }),
      confirmEventId: (id) =>
        set((state) =>
          state.confirmedEventIds.includes(id) ? state : { confirmedEventIds: [...state.confirmedEventIds, id] },
        ),

      entriesFor: (date, scopeId) => entriesForDay(get().entries, date, scopeId),
    }),
    {
      name: persistKey("timegrid-store"),
      version: 12,
      storage: createCogsJSONStorage(),
      migrate: (persisted, version) => migrate(persisted, version) as TimeTrackingState,
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<TimeTrackingState>
        return {
          ...currentState,
          ...persisted,
          // Dedicated `brain2-tracking-day-notes` wins over an empty hub blob.
          // In-memory notes (typed during a hub wait) still overlay an empty
          // persist snapshot. Empty current keys never wipe a stored jot.
          dayNotes: mergeDayNotes(persisted.dayNotes, currentState.dayNotes, getDayNotesPersist()),
          untrackedNotes: { ...(persisted.untrackedNotes ?? {}), ...(currentState.untrackedNotes ?? {}) },
        }
      },
      partialize: (state) => {
        const { dayNotes: _notes, ...rest } = state
        return rest
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        void hydrateDayNotesFromStorage().then(() => {
          seedDayNotesPersist(state.dayNotes)
          const dedicated = getDayNotesPersist()
          if (Object.keys(dedicated).length === 0) return
          const merged = mergeDayNotes(state.dayNotes, undefined, dedicated)
          if (JSON.stringify(merged) === JSON.stringify(useTimeTrackingStore.getState().dayNotes ?? {})) return
          useTimeTrackingStore.setState({ dayNotes: merged })
        })
      },
    },
  ),
)

registerPersistRehydrator(persistKey("timegrid-store"), () => useTimeTrackingStore.persist.rehydrate())

// ---- helpers ----------------------------------------------------------------

function stampPenUse(scopes: TrackScope[], scopeId: string, penId: string, at = Date.now()): TrackScope[] {
  return scopes.map((scope) =>
    scope.id !== scopeId
      ? scope
      : {
          ...scope,
          pens: scope.pens.map((pen) => (pen.id === penId ? { ...pen, lastUsedAt: at } : pen)),
        },
  )
}

/** The pen behind an entry, wherever it lives. */
export function findPen(scopes: TrackScope[], penId: string): TrackPen | undefined {
  for (const scope of scopes) {
    const pen = scope.pens.find((p) => p.id === penId)
    if (pen) return pen
  }
  return undefined
}

/**
 * The pen to color and name at this view's current depth. Painting still wrote
 * the leaf; this is only how the grid, log, Day Log and totals present it.
 */
export function displayedPen(scope: TrackScope | undefined, penId: string): TrackPen | undefined {
  if (!scope) return undefined
  const shown = penAtDepth(scope.pens, penId, scope.displayDepth ?? null)
  if (!shown) return scope.pens.find((p) => p.id === penId)
  return scope.pens.find((p) => p.id === shown.id)
}

/** Hatch assumed blocks so they read as reconstructed rather than observed. */
export function entryFill(color: string | undefined, precision?: TrackingPrecision): string | undefined {
  if (!color) return undefined
  if (precision !== "estimated") return color
  return `repeating-linear-gradient(135deg, ${color} 0 5px, rgba(255,255,255,0.38) 5px 10px)`
}

/**
 * Grid cell paint: a pen's photograph tiles as a mosaic when set, otherwise
 * the solid (or hatched) color. `minute` offsets the tile so neighbouring
 * cells of the same pen read as one surface.
 */
export function penCellStyle(
  pen: { color: string; image?: string } | null | undefined,
  precision?: TrackingPrecision,
  minute = 0,
): { background?: string; backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string } {
  if (!pen) return {}
  if (pen.image) {
    const hatch =
      precision === "estimated"
        ? `repeating-linear-gradient(135deg, transparent 0 5px, rgba(255,255,255,0.38) 5px 10px), `
        : ""
    return {
      backgroundImage: `${hatch}url("${pen.image}")`,
      backgroundSize: "48px 48px",
      backgroundPosition: `${-(minute % 48)}px ${-(Math.floor(minute / 60) % 48)}px`,
    }
  }
  return { background: entryFill(pen.color, precision) }
}

export function findVariant(pen: TrackPen | undefined, variantId: string): PenVariant | undefined {
  return pen?.variants?.find((v) => v.id === variantId)
}

/** "Elijah + Rebecca" for an entry's variants, or "" when it has none. */
export function variantNames(pen: TrackPen | undefined, variantIds: string[] | undefined): string {
  if (!pen || !variantIds?.length) return ""
  return variantIds
    .map((id) => findVariant(pen, id)?.name)
    .filter(Boolean)
    .join(" + ")
}
