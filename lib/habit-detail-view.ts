/**
 * lib/habit-detail-view.ts — What a habit's double-click view is made of
 *
 * A habit's detail view is a short list of panels (`HabitDetailPanel`, in `lib/types.ts`):
 *
 *   sources    the existing account of where the number came from
 *   breakdown  what made up the number, grouped by the item it was about (pages per Book)
 *   entry      a small form: how much, and which item (type a Book and a page count)
 *
 * The list is plain data on the habit (`detailView`). With none stored, the stock view is
 * `sources` plus a `breakdown` for each module the habit listens to, so wiring a module to a
 * habit makes its breakdown appear with nothing else to set. Every edit goes through
 * `validateDetailView`, which refuses a panel whose measure the habit cannot count or whose
 * subject type does not exist. That check is what a BIM plan runs before it asks you to accept.
 * Pure. No stores.
 */
import { activeFeeds, habitMeasure } from "@/lib/habit-feeds"
import { measureDef } from "@/lib/module-output"
import type { HabitDetailPanel, HabitDetailView, WeeklyTask } from "@/lib/types"

export type PanelKind = HabitDetailPanel["kind"]
export const PANEL_KINDS: PanelKind[] = ["sources", "breakdown", "entry"]

const panelKey = (p: HabitDetailPanel): string => (p.kind === "sources" ? "sources" : `${p.kind}:${p.measure}:${p.subjectType ?? ""}`)

/** The panels the dialog draws, in order. Stored panels win; otherwise the stock view. */
export function resolveDetailPanels(task: WeeklyTask): HabitDetailPanel[] {
  const stored = task.detailView?.panels
  if (stored && stored.length) return stored.filter(isPanel)
  const panels: HabitDetailPanel[] = [{ kind: "sources" }]
  for (const feed of activeFeeds(task)) {
    const subjectType = measureDef(feed.measure)?.subjectType
    const panel: HabitDetailPanel = { kind: "breakdown", measure: feed.measure, ...(subjectType ? { subjectType } : {}) }
    if (!panels.some((p) => panelKey(p) === panelKey(panel))) panels.push(panel)
  }
  return panels
}

/** Does a double-click on this habit's cell have something to show beyond the sources account? */
export function habitHasDetailView(task: WeeklyTask): boolean {
  if (task.detailView?.panels?.some((p) => p.kind !== "sources")) return true
  return activeFeeds(task).length > 0
}

function isPanel(value: unknown): value is HabitDetailPanel {
  if (!value || typeof value !== "object") return false
  const p = value as Record<string, unknown>
  if (p.kind === "sources") return true
  if (p.kind !== "breakdown" && p.kind !== "entry") return false
  return typeof p.measure === "string" && (p.subjectType === undefined || typeof p.subjectType === "string")
}

export type DetailViewCheck =
  | { ok: true; view: HabitDetailView; warnings: string[] }
  | { ok: false; errors: string[] }

/**
 * Check a proposed view for one habit. `knownTypes` is the item-type ids that exist, so a panel
 * cannot point at a type that is not there. Warnings do not block; errors do.
 */
export function validateDetailView(task: WeeklyTask, view: unknown, knownTypes: string[]): DetailViewCheck {
  const errors: string[] = []
  const warnings: string[] = []
  const panelsRaw = (view as { panels?: unknown })?.panels
  if (!Array.isArray(panelsRaw) || panelsRaw.length === 0) return { ok: false, errors: ["the view has no panels"] }
  const panels: HabitDetailPanel[] = []
  const own = habitMeasure(task)
  for (const raw of panelsRaw) {
    if (!isPanel(raw)) {
      errors.push(`a panel is not one of ${PANEL_KINDS.join(", ")}`)
      continue
    }
    if (raw.kind !== "sources") {
      if (!measureDef(raw.measure)) errors.push(`${raw.kind}: “${raw.measure}” is not a measure`)
      else if (own && own !== raw.measure) errors.push(`${raw.kind}: “${task.name}” counts ${own}, not ${raw.measure}`)
      if (raw.subjectType && !knownTypes.includes(raw.subjectType)) errors.push(`${raw.kind}: there is no “${raw.subjectType}” item type`)
    }
    if (!panels.some((p) => panelKey(p) === panelKey(raw))) panels.push(raw)
  }
  if (!panels.some((p) => p.kind === "sources")) {
    panels.unshift({ kind: "sources" })
    warnings.push("kept the source account at the top")
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, view: { panels }, warnings }
}

/** The task's view with a panel added (or replaced when the same panel is there). Starts from what the dialog shows now. */
export function withPanel(task: WeeklyTask, panel: HabitDetailPanel): HabitDetailView {
  const current = resolveDetailPanels(task)
  const key = panelKey(panel)
  const next = current.some((p) => panelKey(p) === key) ? current.map((p) => (panelKey(p) === key ? panel : p)) : [...current, panel]
  return { panels: next }
}
