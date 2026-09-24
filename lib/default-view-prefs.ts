/**
 * lib/default-view-prefs.ts — Default view reading-row chrome
 *
 * Unset / `custom !== true` keeps the built-in Default look (status pip, 16px
 * orb, name, type, U·I, date, first filled attribute chips). Custom prefs are
 * per list (`List.defaultView`) and independent of Details columns and
 * Spreadsheet columns.
 *
 * List Settings → View mode settings → Default view mode settings.
 */
import { migrateAttributeDefinition } from "@/lib/attribute-utils"
import { composeListAttributes } from "@/lib/item-types"
import {
  DEFAULT_VIEW_CHROME_KEYS,
  type AttributeDefinition,
  type DefaultViewChromeKey,
  type DefaultViewDensity,
  type ItemTypeDefinition,
  type List,
  type ListDefaultView,
  type Task,
} from "@/lib/types"

/** Built-in Default chrome: what an unset list already shows (and hides). */
export const BUILTIN_DEFAULT_VIEW_SHOW: Record<DefaultViewChromeKey, boolean> = {
  pip: true,
  orb: true,
  type: true,
  priority: true,
  date: true,
  tags: false,
  listNames: false,
  estimate: false,
  description: false,
  attributeChips: true,
}

export const DEFAULT_VIEW_CHROME_LABELS: Record<DefaultViewChromeKey, string> = {
  pip: "Status pip",
  orb: "Icon",
  type: "Item type",
  priority: "Urgency / importance",
  date: "Date",
  tags: "Tags",
  listNames: "List names",
  estimate: "Estimate",
  description: "Description snippet",
  attributeChips: "Attribute chips",
}

export interface DefaultViewAttrCandidate {
  id: string
  name: string
  onThisList: boolean
}

export function isDefaultViewChromeKey(value: unknown): value is DefaultViewChromeKey {
  return typeof value === "string" && (DEFAULT_VIEW_CHROME_KEYS as readonly string[]).includes(value)
}

function sanitizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== "string") continue
    const id = item.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function sanitizeShow(
  value: unknown,
): Partial<Record<DefaultViewChromeKey, boolean>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const show: Partial<Record<DefaultViewChromeKey, boolean>> = {}
  for (const key of DEFAULT_VIEW_CHROME_KEYS) {
    if (typeof raw[key] === "boolean") show[key] = raw[key]
  }
  return Object.keys(show).length > 0 ? show : undefined
}

export function sanitizeListDefaultView(value: unknown): ListDefaultView | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const show = sanitizeShow(raw.show)
  const extraAttributeIds = sanitizeIdList(raw.extraAttributeIds)
  const density: DefaultViewDensity | undefined = raw.density === "compact" ? "compact" : undefined
  const custom = raw.custom === true
  if (!custom && !show && extraAttributeIds.length === 0 && !density) return undefined
  const next: ListDefaultView = {}
  if (custom) next.custom = true
  if (show) next.show = show
  if (extraAttributeIds.length > 0) next.extraAttributeIds = extraAttributeIds
  if (density) next.density = density
  return next
}

export function isCustomDefaultView(prefs: ListDefaultView | undefined): boolean {
  return prefs?.custom === true
}

export function resolveDefaultViewShow(
  prefs: ListDefaultView | undefined,
): Record<DefaultViewChromeKey, boolean> {
  const show = { ...BUILTIN_DEFAULT_VIEW_SHOW }
  if (!isCustomDefaultView(prefs) || !prefs?.show) return show
  for (const key of DEFAULT_VIEW_CHROME_KEYS) {
    if (typeof prefs.show[key] === "boolean") show[key] = prefs.show[key]!
  }
  return show
}

export function resolveDefaultViewDensity(prefs: ListDefaultView | undefined): DefaultViewDensity {
  if (!isCustomDefaultView(prefs)) return "comfortable"
  return prefs.density === "compact" ? "compact" : "comfortable"
}

export function resolveDefaultViewExtraAttributeIds(prefs: ListDefaultView | undefined): string[] {
  if (!isCustomDefaultView(prefs)) return []
  return sanitizeIdList(prefs.extraAttributeIds)
}

/** Switch Use default layout ↔ custom without throwing away a stored custom pick. */
export function setDefaultViewLayoutMode(
  current: ListDefaultView | undefined,
  custom: boolean,
): ListDefaultView | undefined {
  const kept = sanitizeListDefaultView(current)
  if (!custom) {
    if (!kept) return undefined
    const { custom: _drop, ...rest } = kept
    return sanitizeListDefaultView(rest)
  }
  return {
    ...kept,
    custom: true,
    show: { ...BUILTIN_DEFAULT_VIEW_SHOW, ...kept?.show },
  }
}

export function patchDefaultView(
  current: ListDefaultView | undefined,
  patch: Partial<ListDefaultView>,
): ListDefaultView | undefined {
  const base = setDefaultViewLayoutMode(current, true) ?? { custom: true, show: { ...BUILTIN_DEFAULT_VIEW_SHOW } }
  return sanitizeListDefaultView({
    ...base,
    ...patch,
    custom: true,
    show: patch.show ? { ...base.show, ...patch.show } : base.show,
  })
}

export function toggleDefaultViewChrome(
  current: ListDefaultView | undefined,
  key: DefaultViewChromeKey,
  on: boolean,
): ListDefaultView | undefined {
  return patchDefaultView(current, { show: { [key]: on } })
}

export function toggleDefaultViewExtraAttribute(
  current: ListDefaultView | undefined,
  id: string,
  on: boolean,
): ListDefaultView | undefined {
  const ids = new Set(resolveDefaultViewExtraAttributeIds(setDefaultViewLayoutMode(current, true)))
  if (on) ids.add(id)
  else ids.delete(id)
  return patchDefaultView(current, { extraAttributeIds: [...ids] })
}

export function setDefaultViewDensity(
  current: ListDefaultView | undefined,
  density: DefaultViewDensity,
): ListDefaultView | undefined {
  return patchDefaultView(current, { density: density === "compact" ? "compact" : undefined })
}

export function formatEstimateMinutes(mins: number | undefined): string {
  if (mins == null || !Number.isFinite(mins) || mins <= 0) return ""
  const m = Math.round(mins)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `${h}h ${rem}m` : `${h}h`
}

export function descriptionSnippet(task: Pick<Task, "title" | "description" | "taskDescription" | "notes" | "body">): string {
  const title = (typeof task.title === "string" && task.title.trim()) || (typeof task.description === "string" ? task.description.trim() : "")
  const candidates = [task.taskDescription, task.notes, task.body]
  for (const raw of candidates) {
    const text = (raw ?? "").replace(/\s+/g, " ").trim()
    if (!text || text === title) continue
    return text.length > 48 ? `${text.slice(0, 47)}…` : text
  }
  return ""
}

function defName(def: AttributeDefinition): { id: string; name: string } {
  const migrated = migrateAttributeDefinition(def)
  return { id: migrated.id, name: migrated.name || migrated.id }
}

export function buildDefaultViewAttrCatalog(opts: {
  list: List
  types: ItemTypeDefinition[]
  listItems: Task[]
  vaultLists: List[]
}): DefaultViewAttrCandidate[] {
  const byId = new Map<string, DefaultViewAttrCandidate>()
  const remember = (id: string, name: string, onThisList: boolean) => {
    const prev = byId.get(id)
    if (!prev) {
      byId.set(id, { id, name, onThisList })
      return
    }
    if (onThisList && !prev.onThisList) prev.onThisList = true
    if (prev.name === prev.id && name !== id) prev.name = name
  }

  for (const def of composeListAttributes(opts.list, opts.types)) {
    const { id, name } = defName(def)
    remember(id, name, true)
  }
  for (const item of opts.listItems) {
    for (const def of item.itemAttributeDefinitions ?? []) {
      const { id, name } = defName(def)
      remember(id, name, true)
    }
    for (const id of Object.keys(item.attributes ?? {})) {
      remember(id, id, true)
    }
  }
  for (const other of opts.vaultLists) {
    if (other.id === opts.list.id) continue
    for (const def of composeListAttributes(other, opts.types)) {
      const { id, name } = defName(def)
      remember(id, name, false)
    }
  }

  return [...byId.values()].sort((a, b) => {
    if (a.onThisList !== b.onThisList) return a.onThisList ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function filterDefaultViewAttrCatalog(
  catalog: DefaultViewAttrCandidate[],
  opts: { query?: string; onThisListOnly?: boolean },
): DefaultViewAttrCandidate[] {
  const q = (opts.query ?? "").trim().toLowerCase()
  return catalog.filter((c) => {
    if (opts.onThisListOnly && !c.onThisList) return false
    if (!q) return true
    return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
  })
}
