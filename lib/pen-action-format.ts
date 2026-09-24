/**
 * lib/pen-action-format.ts — Default Done-today titles from a painted block
 *
 * A pen can carry one or more templates ("Went for a walk", "worked on {project}
 * for {hours} hours"). When a block is painted, `lib/pen-action-sync.ts` picks
 * the most specific template whose placeholders all have values and writes a
 * logged-action row into To-Do Done. Counting still uses pens and tags; this
 * is only the Done-row *name*.
 *
 * Always-available: `{minutes}` `{x}` `{hours}` `{duration}` `{name}` `{pen}`
 * `{start}` `{end}`. Optional, and they gate which template wins: `{location}`
 * `{project}` (`{project name}`). Missing project → a template without it
 * (e.g. "Worked") can still match.
 *
 * Pure: no store.
 */

import {
  assignedPenIds,
  entryDisplayName,
  entryMinutes,
  formatDuration,
  minutesToLabel,
  type TimeEntry,
} from "@/lib/time-entries"
import type { PenActionFormat, TrackPen, TrackScope } from "@/lib/time-tracking-store"

export type PenActionValues = Record<string, string>

const OPTIONAL_KEYS = new Set(["location", "project", "project name", "projectname"])

export function normalizeActionKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ")
}

export function placeholdersIn(template: string): string[] {
  const found: string[] = []
  const re = /\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(template))) {
    found.push(normalizeActionKey(match[1]))
  }
  return found
}

/** Decimal hours for `{hours}` — 15m → "0.25", 90m → "1.5". */
export function formatActionHours(minutes: number): string {
  const hours = Math.max(0, minutes) / 60
  const rounded = Math.round(hours * 100) / 100
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

export function locationLabelForWindow(
  entry: Pick<TimeEntry, "date" | "startMin" | "endMin" | "scopeId">,
  allEntries: TimeEntry[],
  scopes: TrackScope[],
): string {
  const locScope = scopes.find((s) => s.id === "location" || s.name.trim().toLowerCase() === "location")
  if (!locScope || locScope.id === entry.scopeId) return ""
  const names: string[] = []
  for (const other of allEntries) {
    if (other.scopeId !== locScope.id || other.date !== entry.date) continue
    if (other.endMin <= entry.startMin || other.startMin >= entry.endMin) continue
    const pen = locScope.pens.find((p) => p.id === other.penId)
    const label = entryDisplayName(other, pen?.name)
    if (label && !names.includes(label)) names.push(label)
  }
  return names.join(" / ")
}

export function actionValuesFor(
  entry: TimeEntry,
  pen: TrackPen | undefined,
  allEntries: TimeEntry[],
  scopes: TrackScope[],
): PenActionValues {
  const minutes = entryMinutes(entry)
  const name = entryDisplayName(entry, pen?.name)
  const location = locationLabelForWindow(entry, allEntries, scopes)
  const project = entry.project?.trim() ?? ""
  return {
    minutes: String(minutes),
    x: String(minutes),
    hours: formatActionHours(minutes),
    duration: formatDuration(minutes),
    name,
    pen: pen?.name?.trim() || name,
    start: minutesToLabel(entry.startMin),
    end: minutesToLabel(entry.endMin),
    location,
    project,
    "project name": project,
    projectname: project,
  }
}

export function interpolateActionFormat(template: string, values: PenActionValues): string {
  return template
    .replace(/\{([^}]+)\}/g, (_, raw: string) => values[normalizeActionKey(raw)] ?? "")
    .replace(/\s+/g, " ")
    .trim()
}

function allPlaceholdersFilled(template: string, values: PenActionValues): boolean {
  return placeholdersIn(template).every((key) => {
    if (!OPTIONAL_KEYS.has(key)) return true
    return Boolean(values[key]?.trim())
  })
}

/**
 * Most specific applicable template. Specificity = number of placeholders.
 * A template with no optional placeholders always applies (the "Went for a walk"
 * / "Worked" fallback). Ties keep **list order** so rearranging formats in
 * pen settings is a real control later. Empty list → nothing to log.
 */
export function pickActionFormat(
  formats: PenActionFormat[] | undefined,
  values: PenActionValues,
): PenActionFormat | null {
  const applicable = (formats ?? [])
    .map((format, index) => ({ format, index }))
    .filter(({ format }) => format.template.trim() && allPlaceholdersFilled(format.template, values))
  if (!applicable.length) return null
  applicable.sort((a, b) => {
    const spec = placeholdersIn(b.format.template).length - placeholdersIn(a.format.template).length
    return spec !== 0 ? spec : a.index - b.index
  })
  return applicable[0].format
}

export function renderPenActionTitle(
  formats: PenActionFormat[] | undefined,
  values: PenActionValues,
): string | null {
  const picked = pickActionFormat(formats, values)
  if (!picked) return null
  const title = interpolateActionFormat(picked.template, values)
  return title || null
}

/** Id of the Done row for one block (or a midnight-crossing span). */
export function penActionLogId(entry: Pick<TimeEntry, "id" | "spanId">): string {
  return `pen-action-${entry.spanId || entry.id}`
}

export function entriesWithActionFormats(
  entries: TimeEntry[],
  scopes: TrackScope[],
): TimeEntry[] {
  const byId = new Map<string, TrackPen>()
  for (const scope of scopes) {
    for (const pen of scope.pens) byId.set(pen.id, pen)
  }
  return entries.filter((entry) => {
    if (entry.generatedBy?.kind === "sleep") return false
    return assignedPenIds(entry).some((id) => (byId.get(id)?.actionFormats?.length ?? 0) > 0)
  })
}
