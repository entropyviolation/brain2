/**
 * lib/checklist-checkbox-vars.ts — Checklist tick columns
 *
 * Default checklist view is a single labeled **Completed** checkbox.
 * Extra ticks (today: Missed opportunity) are opt-in per list via
 * List Settings → View mode settings → Checklist view mode settings.
 */
import type { ChecklistCheckboxVar } from "@/lib/types"
export { CHECKLIST_CHECKBOX_VARS } from "@/lib/types"

export const DEFAULT_CHECKLIST_CHECKBOX_VARS: ChecklistCheckboxVar[] = ["completed"]

export const CHECKLIST_CHECKBOX_LABELS: Record<ChecklistCheckboxVar, string> = {
  completed: "Completed",
  missed: "Missed opportunity",
}

/** Optional ticks the user can add; Completed is always present. */
export const OPTIONAL_CHECKLIST_CHECKBOX_VARS: ChecklistCheckboxVar[] = ["missed"]

export function isChecklistCheckboxVar(value: unknown): value is ChecklistCheckboxVar {
  return value === "completed" || value === "missed"
}

/**
 * Completed is always first. Unknown ids are dropped.
 * Empty / missing → `["completed"]` only.
 */
export function sanitizeChecklistCheckboxVars(value: unknown): ChecklistCheckboxVar[] {
  const extras = new Set<ChecklistCheckboxVar>()
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isChecklistCheckboxVar(item) && item !== "completed") extras.add(item)
    }
  }
  if (extras.size === 0) return DEFAULT_CHECKLIST_CHECKBOX_VARS
  return ["completed", ...OPTIONAL_CHECKLIST_CHECKBOX_VARS.filter((id) => extras.has(id))]
}

export function checklistHasVar(
  vars: readonly ChecklistCheckboxVar[],
  id: ChecklistCheckboxVar,
): boolean {
  return vars.includes(id)
}

export function toggleChecklistCheckboxVar(
  current: unknown,
  id: ChecklistCheckboxVar,
  on: boolean,
): ChecklistCheckboxVar[] | undefined {
  if (id === "completed") return sanitizeChecklistCheckboxVars(current)
  const set = new Set(sanitizeChecklistCheckboxVars(current))
  if (on) set.add(id)
  else set.delete(id)
  const next = sanitizeChecklistCheckboxVars([...set])
  return next.length === 1 && next[0] === "completed" ? undefined : next
}
