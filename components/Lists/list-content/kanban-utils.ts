/**
 * components/Lists/list-content/kanban-utils.ts — Pure Kanban column helpers
 *
 * Shared, side-effect-free logic for the Kanban board display (Feature 6). A
 * board's columns are derived from a chosen selection/status attribute: its
 * manual options plus any distinct values actually present on items, with a
 * leading "no value" backlog column when some items are unset. Moving a card
 * between columns is expressed as the attribute value to write back onto the
 * item (`statusValueToWrite`).
 *
 * Kept free of React/store imports so it can be unit-tested in isolation and
 * reused by both the Lists display mode and the Module workspace view.
 */
import type { AttributeDefinition, AttributeValue, Task } from "@/lib/types"

/** Sentinel column key for items that have no value for the status attribute. */
export const KANBAN_BACKLOG = "__kanban_backlog__"

export interface KanbanColumn {
  /** Column key: an attribute value, or `KANBAN_BACKLOG` for unset items. */
  key: string
  /** Human label shown in the column header. */
  label: string
  /** Ids of the tasks that belong in this column, in input order. */
  taskIds: string[]
}

/** Read an item's status value as a single comparable string ("" when unset). */
export function statusValueOf(task: Task, def: AttributeDefinition): string {
  const raw = task.attributes?.[def.id]
  if (raw === undefined || raw === null) return ""
  if (Array.isArray(raw)) return raw.length ? String(raw[0]) : ""
  return String(raw)
}

/**
 * Build the ordered list of board columns for `tasks` grouped by `def`.
 * Column order: the attribute's manual options first (so empty columns still
 * show), then any other values found on items, then a trailing backlog column
 * for unset items (only when at least one item is unset).
 */
export function deriveKanbanColumns(tasks: Task[], def: AttributeDefinition | undefined): KanbanColumn[] {
  if (!def) return []

  const order: string[] = []
  const seen = new Set<string>()
  const push = (v: string) => {
    if (v !== "" && !seen.has(v)) {
      seen.add(v)
      order.push(v)
    }
  }

  for (const opt of def.options ?? []) push(String(opt))

  let hasBacklog = false
  const byValue = new Map<string, string[]>()
  for (const t of tasks) {
    const v = statusValueOf(t, def)
    if (v === "") {
      hasBacklog = true
      const arr = byValue.get(KANBAN_BACKLOG) ?? []
      arr.push(t.id)
      byValue.set(KANBAN_BACKLOG, arr)
      continue
    }
    push(v)
    const arr = byValue.get(v) ?? []
    arr.push(t.id)
    byValue.set(v, arr)
  }

  const columns: KanbanColumn[] = order.map((v) => ({
    key: v,
    label: v,
    taskIds: byValue.get(v) ?? [],
  }))

  if (hasBacklog) {
    columns.push({
      key: KANBAN_BACKLOG,
      label: `No ${def.name}`,
      taskIds: byValue.get(KANBAN_BACKLOG) ?? [],
    })
  }

  return columns
}

/**
 * The attribute value to persist when a card is dropped into `columnKey`.
 * Backlog clears the value (`undefined`); multi-valued attributes store a
 * single-element array so existing renderers keep working.
 */
export function statusValueToWrite(def: AttributeDefinition, columnKey: string): AttributeValue {
  if (columnKey === KANBAN_BACKLOG) return undefined
  if (def.allowMultiple || def.type === "multistring" || def.type === "multiimage") return [columnKey]
  return columnKey
}

/** Candidate attributes a Kanban board can group by (selection-like / textual). */
export function isKanbanGroupable(def: AttributeDefinition): boolean {
  return (
    def.type === "selection" ||
    def.type === "string" ||
    def.type === "multistring" ||
    def.type === "boolean" ||
    def.type === "list"
  )
}
