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
