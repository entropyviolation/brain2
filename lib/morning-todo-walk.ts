/**
 * lib/morning-todo-walk.ts — Six-slot morning to-do walkthrough grammar
 *
 * Shared by BIM `gm` and the desktop Morning Review. Slots (spaces):
 *   tier  duration  points  importance  resistance  excitement
 * A dash leaves that slot unchanged (does not create a missing value).
 */
import { getTierFromTask, tierToUrgencyImportance } from "@/components/Home/ToDo/todo-utils"
import type { Task, TodoItem } from "@/lib/types"

export const TODO_WALK_SLOT_ORDER =
  "tier  duration  points  importance  resistance  excitement" as const

export const TODO_WALK_TIERS: TodoItem["tier"][] = ["A+", "A", "A/B", "B", "C", "D"]

export type TodoWalkSource = "morning-telegram" | "morning-desktop"

export type TodoWalkSlots = {
  /** null = leave unchanged; undefined not used — use null for dash */
  tier: TodoItem["tier"] | null
  duration: number | null
  points: number | null
  importance: number | null
  resistance: number | null
  excitement: number | null
}

export type TodoWalkParseOk = { ok: true; slots: TodoWalkSlots }
export type TodoWalkParseErr = { ok: false; error: string }
export type TodoWalkParseResult = TodoWalkParseOk | TodoWalkParseErr

const TIER_SET = new Set(TODO_WALK_TIERS.map((t) => t.toUpperCase()))

function isDash(token: string): boolean {
  return token === "-" || token === "—" || token === "–"
}

function parseTier(token: string): TodoItem["tier"] | null {
  if (isDash(token)) return null
  const upper = token.toUpperCase()
  // Normalize a/b → A/B
  const normalized = upper === "A/B" || upper === "AB" ? "A/B" : upper
  if (!TIER_SET.has(normalized === "A/B" ? "A/B" : normalized)) return null
  if (normalized === "A+") return "A+"
  if (normalized === "A") return "A"
  if (normalized === "A/B") return "A/B"
  if (normalized === "B") return "B"
  if (normalized === "C") return "C"
  if (normalized === "D") return "D"
  return null
}

function parseOptionalNumber(token: string, min: number, max: number, label: string): number | null | "bad" {
  if (isDash(token)) return null
  const n = Number(token)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) return "bad"
  return n
}

/** Parse six space-separated slots. Returns error text for re-prompt. */
export function parseTodoWalkReply(text: string): TodoWalkParseResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { ok: false, error: "Send six slots, skip, or leave blank to skip this item." }
  }
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  if (tokens.length !== 6) {
    return {
      ok: false,
      error: `Need exactly six slots (${TODO_WALK_SLOT_ORDER}). Got ${tokens.length}.`,
    }
  }

  const tier = parseTier(tokens[0]!)
  if (tier === null && !isDash(tokens[0]!)) {
    return { ok: false, error: `Tier must be A+, A, A/B, B, C, D, or -. Got "${tokens[0]}".` }
  }

  const duration = parseOptionalNumber(tokens[1]!, 0, 24 * 60, "duration")
  if (duration === "bad") {
    return { ok: false, error: `Duration (minutes) must be an integer 0–1440, or -. Got "${tokens[1]}".` }
  }

  const points = parseOptionalNumber(tokens[2]!, 0, 1_000_000, "points")
  if (points === "bad") {
    return { ok: false, error: `Points must be a non-negative integer, or -. Got "${tokens[2]}".` }
  }

  const importance = parseOptionalNumber(tokens[3]!, 0, 10, "importance")
  if (importance === "bad") {
    return { ok: false, error: `Importance must be 0–10, or -. Got "${tokens[3]}".` }
  }

  const resistance = parseOptionalNumber(tokens[4]!, 0, 10, "resistance")
  if (resistance === "bad") {
    return { ok: false, error: `Resistance must be 0–10, or -. Got "${tokens[4]}".` }
  }

  const excitement = parseOptionalNumber(tokens[5]!, 0, 10, "excitement")
  if (excitement === "bad") {
    return { ok: false, error: `Excitement must be 0–10, or -. Got "${tokens[5]}".` }
  }

  return {
    ok: true,
    slots: {
      tier: isDash(tokens[0]!) ? null : tier,
      duration,
      points,
      importance,
      resistance,
      excitement,
    },
  }
}

export function todoWalkGrammarHelp(): string {
  return [
    `Reply with six slots separated by spaces (dash = leave unchanged):`,
    `  ${TODO_WALK_SLOT_ORDER}`,
    ``,
    `Example (item already has points 30 and estimated duration 10 minutes):`,
    `  A+ - 40 - 10 0`,
    `→ tier A+, keep duration 10m, points 40, no importance created, resistance 10, excitement 0`,
    ``,
    `Or skip to leave this item untouched.`,
  ].join("\n")
}

export function formatTodoWalkCurrent(task: Task): string {
  const tier = getTierFromTask(task)
  const dur = task.estimatedDuration != null ? `${task.estimatedDuration}m` : "—"
  const pts = task.rewardValue != null ? String(task.rewardValue) : "—"
  return `current: tier ${tier} · duration ${dur} · points ${pts}`
}

/**
 * Apply parsed slots onto a task. Dash/null slots are skipped.
 * Resistance always appends a timestamped reading (series, not overwrite).
 */
export function applyTodoWalkSlots(
  task: Task,
  slots: TodoWalkSlots,
  dayKey: string,
  now: Date,
  source: TodoWalkSource,
): Task {
  let next: Task = { ...task }

  if (slots.tier != null) {
    Object.assign(next, tierToUrgencyImportance(slots.tier))
  }
  if (slots.duration != null) {
    next = { ...next, estimatedDuration: slots.duration }
  }
  if (slots.points != null) {
    next = { ...next, rewardValue: slots.points }
  }

  if (slots.importance != null || slots.excitement != null) {
    const prev = { ...(next.dayRatings?.[dayKey] ?? {}) }
    if (slots.importance != null) prev.importance = slots.importance
    if (slots.excitement != null) prev.excitement = slots.excitement
    next = {
      ...next,
      dayRatings: { ...(next.dayRatings ?? {}), [dayKey]: prev },
    }
  }

  if (slots.resistance != null) {
    const reading = {
      at: now.toISOString(),
      value: slots.resistance,
      source,
    }
    next = {
      ...next,
      resistanceReadings: [...(next.resistanceReadings ?? []), reading],
    }
  }

  return next
}

/** Desktop form: blank or dash means leave unchanged; empty form = skip item. */
export type TodoWalkFormFields = {
  tier: string
  duration: string
  points: string
  importance: string
  resistance: string
  excitement: string
  skipped: boolean
}

export function emptyTodoWalkForm(): TodoWalkFormFields {
  return {
    tier: "",
    duration: "",
    points: "",
    importance: "",
    resistance: "",
    excitement: "",
    skipped: false,
  }
}

export function isTodoWalkFormBlank(form: TodoWalkFormFields): boolean {
  if (form.skipped) return true
  return [form.tier, form.duration, form.points, form.importance, form.resistance, form.excitement].every(
    (v) => !v.trim() || isDash(v.trim()),
  )
}

/** Build a six-slot reply string from desktop form fields (for shared parser). */
export function formToTodoWalkReply(form: TodoWalkFormFields): string | "skip" {
  if (form.skipped || isTodoWalkFormBlank(form)) return "skip"
  const slot = (v: string) => {
    const t = v.trim()
    return !t || isDash(t) ? "-" : t
  }
  return [form.tier, form.duration, form.points, form.importance, form.resistance, form.excitement]
    .map(slot)
    .join(" ")
}
