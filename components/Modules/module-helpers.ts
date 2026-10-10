/**
 * components/Modules/module-helpers.ts — Modules constants + pure helpers
 *
 * Shared, side-effect-free building blocks for the Modules dashboard: random
 * pickers, writing-prompt word banks, module metadata, rule operators/stat
 * options, and rule/list evaluation. Kept pure so they're unit-testable.
 */
import type React from "react"
import {
  BookOpen,
  PenLine,
  BarChart3,
  ListChecks,
  Shuffle,
  Workflow,
  LayoutGrid,
  Table,
  CheckSquare,
  CalendarDays,
  Timer,
  Hash,
  Image,
  StickyNote,
  Scale,
  Columns3,
  Link2,
  Gamepad2,
  Gauge,
  CalendarRange,
  FileText,
  Map,
  Plane,
  Clapperboard,
  GraduationCap,
  Home,
} from "lucide-react"
import type { ModuleType, ModuleViewKind, AttrRule, RuleOperator } from "@/lib/modules-store"
import type { Task, AttributeValue } from "@/lib/types"

export const rand = <T,>(arr: T[]): T | undefined =>
  arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined

export const randN = <T,>(arr: T[], n: number): T[] => {
  if (n <= 0 || arr.length === 0) return []
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.min(n, copy.length))
}

export const WRITING_FORMS = ["a short story", "an essay", "a poem", "a journal entry", "an open letter", "a scene of dialogue"]
export const WRITING_TOPICS = [
  "a door that shouldn't be open",
  "the last day of summer",
  "an unexpected kindness",
  "a machine that feels",
  "a memory you can't trust",
  "the city at 3am",
  "two people, one umbrella",
  "what the ocean remembers",
  "a promise made and broken",
  "the smell of rain",
]
export const WRITING_CONSTRAINTS = [
  "in under 300 words",
  "from an unexpected point of view",
  "without using the word 'I'",
  "set fifty years in the future",
  "that ends with a question",
  "using only the present tense",
]

export const MODULE_META: Record<ModuleType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  "list-explorer": { label: "List Explorer", icon: BookOpen },
  "writing-prompt": { label: "Writing Generator", icon: PenLine },
  "list-summary": { label: "List Summary", icon: ListChecks },
  "analytics-stat": { label: "Analytics Stat", icon: BarChart3 },
  "random-task": { label: "Random Task", icon: Shuffle },
  rules: { label: "Rules / Cause→Effect", icon: Workflow },
  workspace: { label: "Workspace", icon: LayoutGrid },
}

/**
 * Metadata for each workspace **view kind**. `needsList` marks kinds that read
 * from a source list (so the editor requires one). This is the single registry
 * both the view editor (`ModuleViewEditor`) and tests consume — adding a new
 * kind means adding one entry here.
 */
export interface ModuleViewKindMeta {
  kind: ModuleViewKind
  label: string
  needsList: boolean
  icon: React.ComponentType<{ className?: string }>
}

export const MODULE_VIEW_KINDS: ModuleViewKindMeta[] = [
  { kind: "spreadsheet", label: "Spreadsheet (editable grid)", needsList: true, icon: Table },
  { kind: "checklist", label: "Checklist", needsList: true, icon: CheckSquare },
  { kind: "agenda", label: "Agenda (by date)", needsList: true, icon: CalendarDays },
  { kind: "timeline", label: "Timeline (confirmed, dated)", needsList: true, icon: CalendarRange },
  { kind: "itinerary-doc", label: "Itinerary (printable days)", needsList: false, icon: Plane },
  { kind: "trip-map", label: "Trip activities map", needsList: true, icon: Map },
  { kind: "film-dna", label: "Film DNA Lab", needsList: true, icon: Clapperboard },
  { kind: "house-cleaning", label: "House cleaning (Tidy)", needsList: false, icon: Home },
  { kind: "grad-search", label: "GradSearch (program explorer)", needsList: false, icon: GraduationCap },
  { kind: "doc", label: "Document (Docs editor)", needsList: false, icon: FileText },
  { kind: "summary", label: "Summary / rollup", needsList: true, icon: ListChecks },
  { kind: "dashboard", label: "Dashboard (rollup cards)", needsList: false, icon: Gauge },
  { kind: "randomizer", label: "Randomizer (gamified)", needsList: true, icon: Shuffle },
  { kind: "matcher", label: "Matcher (link lists)", needsList: true, icon: Link2 },
  { kind: "quiz", label: "Quiz / game (taste it)", needsList: true, icon: Gamepad2 },
  { kind: "gallery", label: "Gallery (images)", needsList: true, icon: Image },
  { kind: "decision-matrix", label: "Decision matrix (weighted ranking)", needsList: true, icon: Scale },
  { kind: "kanban", label: "Kanban board (by status)", needsList: true, icon: Columns3 },
  { kind: "timer", label: "Focus timer", needsList: false, icon: Timer },
  { kind: "stat", label: "Analytics stat", needsList: false, icon: Hash },
  { kind: "notes", label: "Notes", needsList: false, icon: StickyNote },
]

/** Quick lookup of a view-kind's metadata by kind. */
export const MODULE_VIEW_KIND_META: Record<ModuleViewKind, ModuleViewKindMeta> = Object.fromEntries(
  MODULE_VIEW_KINDS.map((m) => [m.kind, m]),
) as Record<ModuleViewKind, ModuleViewKindMeta>

/** Widget (single-card) module types, in the order shown in the widget config form. */
export const WIDGET_MODULE_TYPES: ModuleType[] = [
  "list-explorer",
  "writing-prompt",
  "list-summary",
  "analytics-stat",
  "random-task",
  "rules",
]

/**
 * What each dashboard card is for, and the reading it should tell.
 * Labels stay `MODULE_META`. No type is added or removed. The three saved
 * cards keep their bindings. Writing Generator, List Summary, and Rules have
 * no saved card: a new one must not lie, and that is the whole change.
 * The gray field stays. Phosphor stays on the analytics stat.
 */
export type WidgetModuleBlurb = {
  id: (typeof WIDGET_MODULE_TYPES)[number]
  name: string
  shows: string
}

export const WIDGET_MODULE_CATALOG: WidgetModuleBlurb[] = [
  {
    id: "list-explorer",
    name: "List Explorer",
    shows: "Each pick is the title, then author and genre. Unlabeled blurbs stay off this face. Opening one pick shows that blurb on the same card. The card names the list and how many were drawn.",
  },
  {
    id: "writing-prompt",
    name: "Writing Generator",
    shows: "A writing assignment. No card of this type is saved. A new card keeps the sentence across reload and says when the topics are the built-in list. It does not look configured when nothing was chosen.",
  },
  {
    id: "list-summary",
    name: "List Summary",
    shows: "A list's completion ratio. No card of this type is saved. A missing list and an empty list are not a 0/0 ratio. Unbound still asks for a list.",
  },
  {
    id: "analytics-stat",
    name: "Analytics Stat",
    shows: "One stat. Opening the total shows the days that make it. The phosphor figure stays; the days sit under it.",
  },
  {
    id: "random-task",
    name: "Random Task",
    shows: "One open item from the chosen list. The draw defaults to this month's open items and the card says that pool. A uniform draw of every open to-do is not what to do now, and the card must not pretend that it is.",
  },
  {
    id: "rules",
    name: "Rules / Cause→Effect",
    shows: "Cause and effect on one list. No card of this type is saved. A blank comparison must not match: an empty value on > is not greater than zero, and an empty contains does not match every row.",
  },
]

export const RULE_OPERATORS: RuleOperator[] = [">", ">=", "<", "<=", "=", "contains", "is empty", "is set"]

export const rid = () => `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

/** Evaluate a single rule against an attribute value (the "cause"). */
export function ruleMatches(rule: AttrRule, value: AttributeValue): boolean {
  const present = !(value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))
  switch (rule.op) {
    case "is set":
      return present
    case "is empty":
      return !present
    case "contains":
      return String(value ?? "").toLowerCase().includes((rule.value || "").toLowerCase())
    case "=":
      return String(value ?? "") === (rule.value || "")
    default: {
      const a = Number(typeof value === "object" ? (value as { current?: number } | null)?.current : value)
      const b = Number(rule.value)
      if (isNaN(a) || isNaN(b)) return false
      if (rule.op === ">") return a > b
      if (rule.op === ">=") return a >= b
      if (rule.op === "<") return a < b
      if (rule.op === "<=") return a <= b
      return false
    }
  }
}

export const STAT_OPTIONS: { value: string; label: string }[] = [
  { value: "points-total", label: "Total points" },
  { value: "points-week", label: "Points this week" },
  { value: "points-today", label: "Points today" },
  { value: "tasks-open", label: "Open tasks" },
  { value: "tasks-done", label: "Completed tasks" },
  { value: "habits-today", label: "Habits logged today" },
]

export function tasksInList(tasks: Task[], categoryId?: string): Task[] {
  if (!categoryId) return tasks
  return tasks.filter((t) => t.lists?.includes(categoryId))
}
